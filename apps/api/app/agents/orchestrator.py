import logging
from datetime import UTC, datetime
from time import perf_counter, sleep

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from app.agents.base import Agent
from app.agents.detection import DetectionAgent
from app.agents.planning import PlanningAgent
from app.agents.security import SecurityAgent
from app.core.observability import (
    agent_duration,
    agent_executions,
    agent_failures,
    agent_low_confidence,
    confidence_band,
    human_review_required,
    scenario_type,
)
from app.models.domain import AgentDecision

logger = logging.getLogger(__name__)
tracer = trace.get_tracer("geotwin.agent-orchestration")


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def _span_ids(span: trace.Span) -> tuple[str | None, str | None]:
    context = span.get_span_context()
    if not context.is_valid:
        return None, None
    return f"{context.trace_id:032x}", f"{context.span_id:016x}"


class AgentOrchestrator:
    def __init__(self, agents: list[Agent] | None = None) -> None:
        self.agents = (
            agents if agents is not None else [DetectionAgent(), SecurityAgent(), PlanningAgent()]
        )

    def _skipped_record(self, agent: Agent, sequence: int, reason: str) -> AgentDecision:
        return AgentDecision(
            agent=agent.name,
            agent_id=agent.name,
            agent_name=getattr(agent, "display_name", agent.name),
            purpose=getattr(agent, "purpose", None),
            stage=getattr(agent, "stage", "agent-evaluation"),
            sequence=sequence,
            status="skipped",
            action="defer-to-human-review",
            confidence=0,
            explanation=reason,
            evidence_ids=getattr(agent, "evidence_ids", []),
            human_review_required=True,
            warning=reason,
        )

    def run(self, context: dict, simulation_id: str, scenario_name: str) -> list[AgentDecision]:
        records: list[AgentDecision] = []
        stop_after_detection_failure = False
        for sequence, agent in enumerate(self.agents, start=1):
            if stop_after_detection_failure:
                records.append(
                    self._skipped_record(
                        agent, sequence, "Skipped because detection did not complete safely."
                    )
                )
                continue

            started_at = _iso_now()
            started = perf_counter()
            stage = getattr(agent, "stage", "agent-evaluation")
            logger.info(
                "Agent execution started",
                extra={
                    "simulation_id": simulation_id,
                    "agent_name": agent.name,
                    "agent_stage": stage,
                    "agent_status": "running",
                },
            )
            with tracer.start_as_current_span("agent.execute") as span:
                span.set_attributes(
                    {
                        "simulation.id": simulation_id,
                        "scenario.name": scenario_name,
                        "agent.id": agent.name,
                        "agent.name": getattr(agent, "display_name", agent.name),
                        "agent.stage": stage,
                        "agent.sequence": sequence,
                    }
                )
                trace_id, span_id = _span_ids(span)
                span.add_event("agent.started")
                try:
                    demo_fault = context.get("demo_fault", "none")
                    if agent.name == "telemetry-integrity-agent":
                        if demo_fault == "security-agent-delay":
                            span.add_event("synthetic_demo.delay", {"delay.ms": 250})
                            sleep(0.25)
                        elif demo_fault == "security-agent-failure":
                            span.add_event("synthetic_demo.failure")
                            raise RuntimeError("Explicit synthetic demo security-agent failure")
                    decision = agent.decide(context)
                    duration_ms = round((perf_counter() - started) * 1000, 3)
                    human_review = decision.action in {
                        "quarantine-and-require-human-review",
                        "activate-regional-load-balancing",
                    }
                    warning = None
                    status = "completed"
                    if decision.action == "quarantine-and-require-human-review":
                        status = "human-review-required"
                        warning = "Telemetry evidence requires authorized human review."
                    elif decision.action in {"escalate", "activate-regional-load-balancing"}:
                        status = "warning"
                        warning = "Elevated simulated conditions require authorized review."
                    record = decision.model_copy(
                        update={
                            "agent_id": agent.name,
                            "agent_name": getattr(agent, "display_name", agent.name),
                            "purpose": getattr(agent, "purpose", None),
                            "stage": stage,
                            "sequence": sequence,
                            "status": status,
                            "evidence_ids": getattr(agent, "evidence_ids", []),
                            "started_at": started_at,
                            "completed_at": _iso_now(),
                            "duration_ms": duration_ms,
                            "human_review_required": human_review,
                            "warning": warning,
                            "trace_id": trace_id,
                            "span_id": span_id,
                            "attributes": {"scenario.name": scenario_name},
                        }
                    )
                    span.set_attributes(
                        {
                            "agent.status": status,
                            "agent.action": record.action,
                            "agent.confidence": record.confidence,
                            "agent.human_review_required": record.human_review_required,
                            "telemetry.integrity": context.get("telemetry_integrity", 0),
                            "regional.risk": context.get("regional_risk", 0),
                            "agent.confidence_band": confidence_band(record.confidence),
                            "agent.evidence_count": len(record.evidence_ids),
                        }
                    )
                    span.add_event(
                        "recommendation.produced",
                        {"agent.action": record.action, "agent.status": status},
                    )
                    metric_dimensions = {
                        "agent.name": agent.name,
                        "result.status": status,
                        "scenario.type": scenario_type(scenario_name),
                    }
                    agent_executions.add(1, metric_dimensions)
                    agent_duration.record(duration_ms, metric_dimensions)
                    if record.confidence < 0.4:
                        agent_low_confidence.add(
                            1,
                            {
                                "agent.name": agent.name,
                                "scenario.type": scenario_type(scenario_name),
                            },
                        )
                        span.add_event("confidence.reduced")
                    if human_review:
                        human_review_required.add(
                            1, {"scenario.type": scenario_type(scenario_name), "source": "agent"}
                        )
                        span.add_event("human_review.triggered")
                    log_level = logging.WARNING if warning else logging.INFO
                    logger.log(
                        log_level,
                        "Agent execution completed",
                        extra={
                            "simulation_id": simulation_id,
                            "agent_name": agent.name,
                            "agent_stage": stage,
                            "agent_action": record.action,
                            "agent_status": status,
                        },
                    )
                    if human_review:
                        logger.warning(
                            "Human review requested",
                            extra={
                                "simulation_id": simulation_id,
                                "agent_name": agent.name,
                                "agent_stage": stage,
                                "agent_action": record.action,
                                "agent_status": status,
                            },
                        )
                    records.append(record)
                except Exception as exc:  # An agent failure becomes a safe execution record.
                    duration_ms = round((perf_counter() - started) * 1000, 3)
                    span.record_exception(exc)
                    span.set_status(Status(StatusCode.ERROR, "Agent execution failed"))
                    span.set_attributes(
                        {"agent.status": "failed", "agent.human_review_required": True}
                    )
                    span.add_event("agent.failed", {"error.type": type(exc).__name__})
                    failure_dimensions = {
                        "agent.name": agent.name,
                        "failure.type": type(exc).__name__,
                        "scenario.type": scenario_type(scenario_name),
                    }
                    agent_executions.add(1, {**failure_dimensions, "result.status": "failed"})
                    agent_failures.add(1, failure_dimensions)
                    agent_duration.record(duration_ms, failure_dimensions)
                    logger.exception(
                        "Agent execution failed",
                        extra={
                            "simulation_id": simulation_id,
                            "agent_name": agent.name,
                            "agent_stage": stage,
                            "agent_action": "defer-to-human-review",
                            "agent_status": "failed",
                        },
                    )
                    records.append(
                        AgentDecision(
                            agent=agent.name,
                            agent_id=agent.name,
                            agent_name=getattr(agent, "display_name", agent.name),
                            purpose=getattr(agent, "purpose", None),
                            stage=stage,
                            sequence=sequence,
                            status="failed",
                            action="defer-to-human-review",
                            confidence=0,
                            explanation="This component did not complete; no decision was accepted from it.",
                            evidence_ids=getattr(agent, "evidence_ids", []),
                            started_at=started_at,
                            completed_at=_iso_now(),
                            duration_ms=duration_ms,
                            human_review_required=True,
                            error="Agent execution failed safely. Review backend telemetry for diagnostic details.",
                            trace_id=trace_id,
                            span_id=span_id,
                            attributes={"scenario.name": scenario_name},
                        )
                    )
                    if isinstance(agent, DetectionAgent):
                        stop_after_detection_failure = True

        failures = [record for record in records if record.status == "failed"]
        average_confidence = round(
            sum(record.confidence for record in records if record.status != "skipped")
            / max(len([record for record in records if record.status != "skipped"]), 1),
            3,
        )
        meta_action = (
            "defer-to-human-review"
            if failures
            else "coordinate-validated-response"
            if context.get("regional_risk", 0) >= 0.45
            else "maintain-observability"
        )
        records.append(
            AgentDecision(
                agent="meta-orchestrator",
                agent_id="meta-orchestrator",
                agent_name="Response Orchestrator",
                component_type="system",
                purpose="Assemble bounded research recommendations from completed execution records.",
                stage="response-assembly",
                sequence=len(self.agents) + 1,
                status="human-review-required" if failures else "completed",
                action=meta_action,
                confidence=0 if failures else average_confidence,
                explanation="The response is deferred to authorized human review because an execution component failed."
                if failures
                else "The agent ensemble prioritizes human review and bounded transfers when risk is elevated.",
                evidence_ids=["regional-risk", "telemetry-integrity"],
                human_review_required=bool(failures) or context.get("regional_risk", 0) >= 0.45,
                warning="Incomplete execution prevents a confident recommendation."
                if failures
                else None,
                attributes={"scenario.name": scenario_name},
            )
        )
        return records

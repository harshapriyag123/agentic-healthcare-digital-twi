from app.agents.orchestrator import AgentOrchestrator
from app.agents.planning import PlanningAgent
from app.agents.security import SecurityAgent
from app.models.domain import CyberEvent, HazardInput, SimulationRequest
from app.services.twin import run_simulation
from opentelemetry.sdk.trace import TracerProvider


def context() -> dict:
    return {
        "hazard_pressure": 0.5,
        "cyber_severity": 0.7,
        "telemetry_integrity": 0.6,
        "regional_risk": 0.58,
        "transfer_count": 1,
        "trust_confidence": 0.54,
    }


def request() -> SimulationRequest:
    return SimulationRequest(
        scenario_name="agent-test",
        demand_multiplier=1.35,
        hazard=HazardInput(heat_index=112, grid_outage_probability=0.4),
        cyber_event=CyberEvent(target_hospital_id="HOSP-DFW-002", severity=0.8),
    )


def test_agent_execution_records_are_ordered_and_traced(monkeypatch) -> None:
    provider = TracerProvider()
    monkeypatch.setattr("app.agents.orchestrator.tracer", provider.get_tracer("test.agents"))
    records = AgentOrchestrator().run(context(), "simulation-test", "agent-test")

    assert [record.agent for record in records] == [
        "compound-event-detector",
        "telemetry-integrity-agent",
        "resilience-planning-agent",
        "meta-orchestrator",
    ]
    assert [record.sequence for record in records] == [1, 2, 3, 4]
    assert all(record.duration_ms is not None for record in records[:3])
    assert all(record.trace_id and record.span_id for record in records[:3])
    assert records[1].evidence_ids == [
        "telemetry-integrity",
        "missing-telemetry",
        "tampering-probability",
    ]
    assert records[-1].component_type == "system"


def test_failed_security_agent_requires_review_and_reduces_confidence(monkeypatch) -> None:
    baseline = run_simulation(request())

    def fail_security(self, execution_context):
        raise RuntimeError("synthetic security failure")

    monkeypatch.setattr(SecurityAgent, "decide", fail_security)
    result = run_simulation(request())
    security = next(
        record for record in result.agent_decisions if record.agent == "telemetry-integrity-agent"
    )

    assert security.status == "failed"
    assert security.human_review_required
    assert (
        security.error
        == "Agent execution failed safely. Review backend telemetry for diagnostic details."
    )
    assert result.trust.human_review_required
    assert result.trust.recommendation_confidence < baseline.trust.recommendation_confidence


def test_failed_planning_agent_returns_no_unsafe_intervention(monkeypatch) -> None:
    def fail_planning(self, execution_context):
        raise RuntimeError("synthetic planning failure")

    monkeypatch.setattr(PlanningAgent, "decide", fail_planning)
    result = run_simulation(request())
    planning = next(
        record for record in result.agent_decisions if record.agent == "resilience-planning-agent"
    )

    assert planning.status == "failed"
    assert planning.action == "defer-to-human-review"
    assert result.transfer_plan == []
    assert result.counterfactuals == []
    assert result.trust.policy_compliance is False
    assert "failed safely" in result.explanation

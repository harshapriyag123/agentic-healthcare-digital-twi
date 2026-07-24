from datetime import UTC, datetime
from math import exp
from time import perf_counter
from uuid import uuid4

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from app.agents.orchestrator import AgentOrchestrator
from app.core.observability import (
    active_simulations,
    critical_hospitals,
    degraded_hospitals,
    human_review_required,
    scenario_type,
    simulation_duration,
    simulation_failures,
    simulation_runs,
    telemetry_integrity_failures,
    trust_score,
)
from app.models.domain import (
    FacilityStatus,
    HospitalState,
    SimulationRequest,
    SimulationResponse,
    TransferAction,
    TrustRecord,
)
from app.services.catalog import HOSPITALS, hospital_map
from app.services.graph import build_infrastructure_graph, centrality_scores, dependency_pressure
from app.services.integrity import assess_integrity
from app.services.trust import evaluate_trust

tracer = trace.get_tracer("geotwin.digital-twin")
GRAPH = build_infrastructure_graph(HOSPITALS)
CENTRALITY = centrality_scores(GRAPH)


def _sigmoid(value: float) -> float:
    return 1 / (1 + exp(-value))


def _hazard_pressure(request: SimulationRequest) -> float:
    heat = max(0, (request.hazard.heat_index - 90) / 45)
    air = max(0, (request.hazard.air_quality_index - 100) / 300)
    return min(
        1,
        0.38 * heat
        + 0.27 * request.hazard.flood_severity
        + 0.2 * air
        + 0.15 * request.hazard.grid_outage_probability,
    )


def _evaluate_states(
    request: SimulationRequest,
    cyber_scale: float = 1,
    demand_scale: float = 1,
    capacity_scale: float = 1,
    demand_offsets: dict[str, float] | None = None,
) -> list[HospitalState]:
    hazard = _hazard_pressure(request)
    failed_dependencies = (
        {"GRID-CENTRAL"} if request.hazard.grid_outage_probability > 0.65 else set()
    )
    states = []
    for hospital in HOSPITALS:
        with tracer.start_as_current_span("twin.evaluate_facility") as span:
            attacked = hospital.hospital_id == request.cyber_event.target_hospital_id
            cyber_loss = (
                request.cyber_event.severity
                * cyber_scale
                * (1 - hospital.cyber_readiness)
                * (0.9 if attacked else 0.08)
            )
            dep = dependency_pressure(GRAPH, hospital.hospital_id, failed_dependencies)
            power_penalty = (
                max(0, request.horizon_hours - hospital.backup_power_hours)
                / max(request.horizon_hours, 1)
                * request.hazard.grid_outage_probability
            )
            effective = (
                hospital.staffed_beds
                * capacity_scale
                * max(0.08, 1 - cyber_loss - 0.25 * dep - 0.2 * power_penalty)
            )
            demand = (
                hospital.staffed_beds
                * hospital.baseline_occupancy
                * request.demand_multiplier
                * demand_scale
                * (1 + 0.42 * hazard)
            )
            demand = max(0, demand + (demand_offsets or {}).get(hospital.hospital_id, 0))
            load = demand / max(effective, 1)
            criticality = CENTRALITY.get(hospital.hospital_id, 0.5)
            probability = _sigmoid(
                4.1 * (load - 1)
                + 2.3 * cyber_loss
                + 1.4 * hazard
                + 1.1 * dep
                + 0.6 * criticality
                - 1.35
            )
            status = (
                FacilityStatus.CRITICAL
                if probability >= 0.75
                else FacilityStatus.DEGRADED
                if probability >= 0.4
                else FacilityStatus.STABLE
            )
            span.set_attributes(
                {
                    "healthcare.facility.id": hospital.hospital_id,
                    "healthcare.load.ratio": load,
                    "geotwin.cyber.loss": cyber_loss,
                    "geotwin.hazard.pressure": hazard,
                    "geotwin.disruption.probability": probability,
                    "geotwin.facility.status": status.value,
                }
            )
            states.append(
                HospitalState(
                    hospital_id=hospital.hospital_id,
                    effective_capacity=round(effective, 2),
                    estimated_demand=round(demand, 2),
                    load_ratio=round(load, 3),
                    cyber_loss=round(cyber_loss, 3),
                    hazard_pressure=round(hazard, 3),
                    dependency_pressure=round(dep, 3),
                    disruption_probability=round(probability, 3),
                    status=status,
                )
            )
    return states


def _regional_risk(states: list[HospitalState]) -> float:
    weighted = sum(
        s.disruption_probability * (0.55 + 0.45 * CENTRALITY.get(s.hospital_id, 0.5))
        for s in states
    )
    denom = sum(0.55 + 0.45 * CENTRALITY.get(s.hospital_id, 0.5) for s in states)
    return min(1, weighted / max(denom, 0.001))


def _plan_transfers(states: list[HospitalState], source_id: str) -> list[TransferAction]:
    by_id = {s.hospital_id: s for s in states}
    hospitals = hospital_map()
    source = by_id[source_id]
    overflow = max(0, round(source.estimated_demand - source.effective_capacity))
    actions = []
    candidates = []
    for neighbor in hospitals[source_id].referral_neighbors:
        target = by_id[neighbor]
        spare = max(0, int(target.effective_capacity - target.estimated_demand))
        if spare and target.status != FacilityStatus.CRITICAL:
            candidates.append((neighbor, spare, target.disruption_probability))
    for target_id, spare, risk in sorted(candidates, key=lambda item: item[2]):
        count = min(overflow, spare)
        overflow -= count
        if count:
            actions.append(
                TransferAction(
                    from_hospital_id=source_id,
                    to_hospital_id=target_id,
                    patients=count,
                    rationale=f"Spare simulated capacity with downstream risk {risk:.2f}",
                    safety_constraints_satisfied=True,
                )
            )
        if overflow <= 0:
            break
    return actions


def _calculate_trust(
    request: SimulationRequest, integrity: float, risk: float, transfers: list[TransferAction]
) -> TrustRecord:
    completeness = max(0, 1 - request.missing_telemetry_ratio)
    uncertainty = min(
        1,
        0.08 + 0.42 * (1 - integrity) + 0.3 * (1 - completeness) + 0.2 * _hazard_pressure(request),
    )
    confidence = max(0, completeness * integrity * (1 - uncertainty))
    return TrustRecord(
        evidence_completeness=round(completeness, 3),
        telemetry_integrity=round(integrity, 3),
        uncertainty=round(uncertainty, 3),
        geographic_coverage=1.0,
        policy_compliance=all(action.safety_constraints_satisfied for action in transfers),
        recommendation_confidence=round(confidence, 3),
    )


def _resilience(risk: float, integrity: float) -> float:
    return max(0, 1 - risk * (1 + 0.35 * (1 - integrity)))


def run_simulation(request: SimulationRequest) -> SimulationResponse:
    simulation_started = perf_counter()
    simulation_id = str(uuid4())
    observed_at = datetime.now(UTC).isoformat()
    dimensions = {"scenario.type": scenario_type(request.scenario_name)}
    active_simulations.add(1, dimensions)
    with tracer.start_as_current_span("simulation.run") as span:
        span_context = span.get_span_context()
        trace_id = f"{span_context.trace_id:032x}" if span_context.is_valid else None
        span.set_attributes(
            {
                "geotwin.simulation.id": simulation_id,
                "geotwin.scenario.name": request.scenario_name,
                "geotwin.cyber.attack_type": request.cyber_event.attack_type,
                "geotwin.cyber.target": request.cyber_event.target_hospital_id,
                "ai.decision.human_review_required": True,
            }
        )
        try:
            if request.cyber_event.target_hospital_id not in hospital_map():
                raise ValueError("Unknown target hospital")
            with tracer.start_as_current_span("telemetry_integrity.evaluate"):
                integrity, _ = assess_integrity(request)
            with tracer.start_as_current_span("hospital_impact.calculate"):
                states = _evaluate_states(request)
            risk = _regional_risk(states)
            with tracer.start_as_current_span("transfer_plan.calculate"):
                transfers = _plan_transfers(states, request.cyber_event.target_hospital_id)
            trust, evidence = evaluate_trust(
                request, simulation_id, states, transfers, risk, observed_at=observed_at
            )
            confidence = trust.recommendation_confidence
            context = {
                "hazard_pressure": _hazard_pressure(request),
                "cyber_severity": request.cyber_event.severity,
                "telemetry_integrity": integrity,
                "regional_risk": risk,
                "transfer_count": len(transfers),
                "trust_confidence": confidence,
                "demo_fault": request.demo_fault,
            }
            with tracer.start_as_current_span("agent_orchestration.run"):
                decisions = AgentOrchestrator().run(context, simulation_id, request.scenario_name)
            failed_agents = {
                decision.agent for decision in decisions if decision.status == "failed"
            }
            if {
                "compound-event-detector",
                "resilience-planning-agent",
            } & failed_agents:
                transfers = []
            trust, evidence = evaluate_trust(
                request, simulation_id, states, transfers, risk, decisions, observed_at
            )
            confidence = trust.recommendation_confidence
            counterfactuals = []
            resilience = _resilience(risk, integrity)
            best = (
                counterfactuals[0].intervention
                if counterfactuals
                else "no counterfactual evaluated"
            )
            explanation = (
                f"The regional twin estimates risk {risk:.2f} and resilience "
                f"{resilience:.2f}. Telemetry integrity is {integrity:.2f}. "
                f"The strongest simulated intervention is '{best}'. All actions are "
                "planning recommendations and require authorized human approval."
            )
            if failed_agents:
                explanation += (
                    " One or more execution components failed safely; intervention "
                    "output is constrained and authorized human review is required."
                )
            simulation_runs.add(1, {**dimensions, "result.status": "success"})
            duration_ms = round((perf_counter() - simulation_started) * 1000, 3)
            simulation_duration.record(duration_ms, dimensions)
            critical_hospitals.record(
                sum(state.status == FacilityStatus.CRITICAL for state in states), dimensions
            )
            degraded_hospitals.record(
                sum(state.status == FacilityStatus.DEGRADED for state in states), dimensions
            )
            trust_score.record(confidence, dimensions)
            if integrity < 0.75:
                telemetry_integrity_failures.add(
                    1, {**dimensions, "integrity.state": "degraded"}
                )
            if trust.human_review_required:
                human_review_required.add(1, dimensions)
            span.set_attributes(
                {
                    "geotwin.regional_risk.score": risk,
                    "geotwin.resilience.score": resilience,
                    "ai.decision.confidence": confidence,
                    "security.telemetry.integrity": integrity,
                    "hospital.count": len(states),
                    "hospital.critical_count": sum(
                        state.status == FacilityStatus.CRITICAL for state in states
                    ),
                    "trust.human_review_required": trust.human_review_required,
                }
            )
            response = SimulationResponse(
                simulation_id=simulation_id,
                scenario_name=request.scenario_name,
                regional_risk_score=round(risk, 3),
                resilience_score=round(resilience, 3),
                affected_hospitals=states,
                transfer_plan=transfers,
                evidence=evidence,
                agent_decisions=decisions,
                counterfactuals=counterfactuals,
                explanation=explanation,
                trust=trust,
                trace_id=trace_id,
                duration_ms=duration_ms,
            )
            if request.enable_counterfactuals and not failed_agents:
                from app.services.counterfactuals import default_counterfactual_results

                response = response.model_copy(
                    update={"counterfactuals": default_counterfactual_results(request, response)}
                )
            from app.services.simulation_store import store_simulation

            store_simulation(request, response)
            return response
        except Exception as exc:
            simulation_failures.add(1, {**dimensions, "failure.type": type(exc).__name__})
            span.record_exception(exc)
            span.set_status(Status(StatusCode.ERROR, "Simulation failed"))
            raise
        finally:
            active_simulations.add(-1, dimensions)

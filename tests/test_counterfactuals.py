import pytest
from app.main import app
from app.models.domain import (
    CounterfactualRunRequest,
    CyberEvent,
    HazardInput,
    InterventionSelection,
    SimulationRequest,
)
from app.services import counterfactuals as service
from app.services.counterfactuals import rank_outcomes, run_counterfactual_comparison
from app.services.simulation_store import clear_simulations
from app.services.twin import run_simulation
from fastapi.testclient import TestClient

client = TestClient(app)
ALL_INTERVENTIONS = [
    "network-segmentation",
    "backup-power-activation",
    "regional-surge-capacity",
    "ambulance-rerouting",
    "telemetry-verification",
    "combined-intervention",
]


def request(scenario_name="flood-grid-cascade", tampering=.25, missing=.15):
    return SimulationRequest(
        scenario_name=scenario_name,
        horizon_hours=48,
        demand_multiplier=1.35,
        hazard=HazardInput(heat_index=108, flood_severity=.8, air_quality_index=180, grid_outage_probability=.85),
        cyber_event=CyberEvent(target_hospital_id="HOSP-DFW-002", severity=.8, telemetry_tampering=tampering),
        missing_telemetry_ratio=missing,
        enable_counterfactuals=True,
    )


def comparison(simulation_request=None, identifiers=None):
    baseline_request = (simulation_request or request()).model_copy(update={"enable_counterfactuals": False})
    baseline = run_simulation(baseline_request)
    result = run_counterfactual_comparison(CounterfactualRunRequest(
        simulation_id=baseline.simulation_id,
        interventions=[InterventionSelection(intervention_id=item) for item in (identifiers or ALL_INTERVENTIONS)],
    ))
    return baseline, result


def outcome(result, identifier):
    return next(item for item in result.interventions if item.intervention_id == identifier)


def test_baseline_and_no_intervention_exactly_match_original_simulation():
    baseline, result = comparison()
    assert result.baseline.regional_risk_score == baseline.regional_risk_score
    assert result.baseline.resilience_score == baseline.resilience_score
    assert result.baseline.hospital_states == baseline.affected_hospitals
    assert result.baseline.transfer_plan == baseline.transfer_plan
    assert result.baseline.telemetry_integrity == baseline.trust.telemetry_integrity


def test_duplicate_unknown_and_missing_baselines_are_rejected():
    baseline = run_simulation(request())
    duplicate = {"simulation_id": baseline.simulation_id, "interventions": [{"intervention_id": "network-segmentation"}, {"intervention_id": "network-segmentation"}]}
    assert client.post("/api/v1/counterfactuals/run", json=duplicate).status_code == 422
    assert client.post("/api/v1/counterfactuals/run", json={"simulation_id": baseline.simulation_id, "interventions": [{"intervention_id": "unknown"}]}).status_code == 422
    clear_simulations()
    assert client.post("/api/v1/counterfactuals/run", json={"simulation_id": "missing", "interventions": [{"intervention_id": "network-segmentation"}]}).status_code == 404


def test_intervention_applicability_is_enforced_as_a_visible_partial_failure():
    clean = request(tampering=0, missing=0)
    baseline, result = comparison(clean, ["telemetry-verification", "regional-surge-capacity"])
    assert baseline
    assert outcome(result, "telemetry-verification").status == "failed"
    assert outcome(result, "regional-surge-capacity").status == "completed"
    assert result.incomplete
    assert [item.intervention_id for item in result.ranking] == ["regional-surge-capacity"]


def test_each_intervention_flows_through_the_twin_model():
    baseline, result = comparison()
    segmented = outcome(result, "network-segmentation")
    backup = outcome(result, "backup-power-activation")
    surge = outcome(result, "regional-surge-capacity")
    verified = outcome(result, "telemetry-verification")

    assert sum(state.cyber_loss for state in segmented.hospital_states) < sum(state.cyber_loss for state in baseline.affected_hospitals)
    assert sum(state.dependency_pressure for state in backup.hospital_states) < sum(state.dependency_pressure for state in baseline.affected_hospitals)
    assert sum(state.effective_capacity for state in surge.hospital_states) > sum(state.effective_capacity for state in baseline.affected_hospitals)
    assert verified.telemetry_integrity > baseline.trust.telemetry_integrity
    assert verified.recommendation_confidence > baseline.trust.recommendation_confidence

    reroute_request = request().model_copy(update={"demand_multiplier": 1.05})
    reroute_baseline, reroute_result = comparison(reroute_request, ["ambulance-rerouting"])
    rerouted = outcome(reroute_result, "ambulance-rerouting")
    reroute_by_baseline = {state.hospital_id: state for state in reroute_baseline.affected_hospitals}
    assert rerouted.total_transfer_patients > 0
    assert any(state.estimated_demand != reroute_by_baseline[state.hospital_id].estimated_demand for state in rerouted.hospital_states)


def test_combined_effect_is_bounded_deterministic_and_outcomes_are_distinct():
    simulation_request = request()
    _, first = comparison(simulation_request)
    _, second = comparison(simulation_request)
    first_values = [(item.intervention_id, item.regional_risk_score, item.resilience_score, item.telemetry_integrity, item.hospital_states, item.transfer_plan) for item in first.interventions]
    second_values = [(item.intervention_id, item.regional_risk_score, item.resilience_score, item.telemetry_integrity, item.hospital_states, item.transfer_plan) for item in second.interventions]
    assert first_values == second_values
    assert len({(item.regional_risk_score, item.resilience_score, item.telemetry_integrity, item.total_transfer_patients) for item in first.interventions}) >= 5
    combined = outcome(first, "combined-intervention")
    assert all(state.effective_capacity <= 1.1 * hospital.staffed_beds for state, hospital in zip(combined.hospital_states, service.HOSPITALS, strict=True))


def test_comparison_deltas_are_calculated_from_baseline():
    _, result = comparison(identifiers=["network-segmentation"])
    intervention = result.interventions[0]
    assert intervention.absolute_risk_reduction == pytest.approx(result.baseline.regional_risk_score-intervention.regional_risk_score, abs=.001)
    assert intervention.resilience_improvement == pytest.approx(intervention.resilience_score-result.baseline.resilience_score, abs=.001)
    assert intervention.unserved_demand_reduction == pytest.approx(result.baseline.unserved_demand-intervention.unserved_demand, abs=.01)


def test_unsafe_outcomes_are_excluded_from_ranking():
    _, result = comparison(identifiers=["network-segmentation", "regional-surge-capacity"])
    unsafe = result.interventions[0].model_copy(update={"transfer_plan_safe": False})
    ranking = rank_outcomes([unsafe, result.interventions[1]], result.baseline)
    assert [item.intervention_id for item in ranking] == ["regional-surge-capacity"]


def test_partial_computation_failure_preserves_success_and_excludes_failure(monkeypatch):
    original = service._evaluate_intervention

    def fail_one(selection, *args, **kwargs):
        if selection.intervention_id == "network-segmentation":
            raise RuntimeError("synthetic comparison failure")
        return original(selection, *args, **kwargs)

    monkeypatch.setattr(service, "_evaluate_intervention", fail_one)
    _, result = comparison(identifiers=["network-segmentation", "regional-surge-capacity"])
    assert outcome(result, "network-segmentation").status == "failed"
    assert outcome(result, "regional-surge-capacity").status == "completed"
    assert [item.intervention_id for item in result.ranking] == ["regional-surge-capacity"]
    assert result.incomplete


def test_low_trust_prevents_overconfident_recommendation():
    low_trust = request(scenario_name="wildfire-telemetry", tampering=.95, missing=.7)
    _, result = comparison(low_trust, ["network-segmentation", "regional-surge-capacity"])
    assert result.baseline.telemetry_integrity < .5
    assert result.recommendation.insufficient_confidence
    assert result.recommendation.intervention_id is None
    assert "Insufficient confidence" in result.recommendation.label

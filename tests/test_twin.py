from app.models.domain import CyberEvent, HazardInput, SimulationRequest
from app.services.twin import run_simulation


def request(**overrides):
    payload = dict(
        scenario_name="test",
        demand_multiplier=1.25,
        hazard=HazardInput(heat_index=112, grid_outage_probability=0.3),
        cyber_event=CyberEvent(target_hospital_id="HOSP-DFW-002", severity=0.85),
    )
    payload.update(overrides)
    return SimulationRequest(**payload)


def test_simulation_scores_are_bounded():
    result = run_simulation(request())
    assert 0 <= result.regional_risk_score <= 1
    assert 0 <= result.resilience_score <= 1
    assert len(result.affected_hospitals) == 5
    assert result.trust.human_review_required


def test_counterfactuals_do_not_increase_reported_reduction():
    result = run_simulation(request())
    assert result.counterfactuals
    assert all(item.risk_reduction >= 0 for item in result.counterfactuals)


def test_tampering_reduces_trust():
    clean = run_simulation(
        request(
            cyber_event=CyberEvent(
                target_hospital_id="HOSP-DFW-002", severity=0.8, telemetry_tampering=0
            )
        )
    )
    tampered = run_simulation(
        request(
            cyber_event=CyberEvent(
                target_hospital_id="HOSP-DFW-002", severity=0.8, telemetry_tampering=0.9
            )
        )
    )
    assert tampered.trust.recommendation_confidence < clean.trust.recommendation_confidence


def test_explanation_is_derived_from_completed_response():
    result = run_simulation(request())
    best = max(result.counterfactuals, key=lambda item: item.risk_reduction)
    transfer_patients = sum(action.patients for action in result.transfer_plan)

    assert result.explanation
    assert f"risk {result.regional_risk_score:.2f}" in result.explanation
    assert f"'{best.intervention}'" in result.explanation
    if result.transfer_plan:
        assert f"{transfer_patients} patients" in result.explanation
    else:
        assert "no transfers recommended" in result.explanation
    assert "no counterfactual evaluated" not in result.explanation.lower()


def test_explanation_reports_disabled_counterfactuals_dynamically():
    result = run_simulation(request(enable_counterfactuals=False))

    assert result.counterfactuals == []
    assert "No counterfactual was evaluated for this run." in result.explanation

from app.models.domain import CyberEvent, HazardInput, SimulationRequest
from app.services.twin import run_simulation


def request(**overrides):
    payload=dict(scenario_name="test",demand_multiplier=1.25,hazard=HazardInput(heat_index=112,grid_outage_probability=.3),cyber_event=CyberEvent(target_hospital_id="HOSP-DFW-002",severity=.85))
    payload.update(overrides); return SimulationRequest(**payload)


def test_simulation_scores_are_bounded():
    result=run_simulation(request())
    assert 0<=result.regional_risk_score<=1
    assert 0<=result.resilience_score<=1
    assert len(result.affected_hospitals)==5
    assert result.trust.human_review_required


def test_counterfactuals_do_not_increase_reported_reduction():
    result=run_simulation(request())
    assert result.counterfactuals
    assert all(item.risk_reduction>=0 for item in result.counterfactuals)


def test_tampering_reduces_trust():
    clean=run_simulation(request(cyber_event=CyberEvent(target_hospital_id="HOSP-DFW-002",severity=.8,telemetry_tampering=0)))
    tampered=run_simulation(request(cyber_event=CyberEvent(target_hospital_id="HOSP-DFW-002",severity=.8,telemetry_tampering=.9)))
    assert tampered.trust.recommendation_confidence < clean.trust.recommendation_confidence

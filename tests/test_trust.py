from copy import deepcopy

from app.main import app
from app.models.domain import EvidenceItem
from app.services.trust import evidence_quality_dimensions
from fastapi.testclient import TestClient

client = TestClient(app)


def run_scenario(identifier: str):
    scenario = next(item for item in client.get("/api/v1/scenarios").json() if item["id"] == identifier)
    response = client.post("/api/v1/simulations/run", json=scenario["request"])
    assert response.status_code == 200
    return response.json()


def test_trust_endpoint_and_canonical_contract():
    simulation = run_scenario("flood-grid-cascade")
    response = client.get(f"/api/v1/trust/{simulation['simulation_id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["trust"] == simulation["trust"]
    assert data["evidence"] == simulation["evidence"]
    assert data["trust"]["calculation_version"] == "geotwin-trust-v2.0"


def test_trust_score_is_bounded_and_visible_contributions_sum():
    trust = run_scenario("heatwave-ransomware")["trust"]
    assert 0 <= trust["trust_score"] <= 1
    assert abs(sum(item["weighted_contribution"] for item in trust["factor_contributions"])-trust["trust_score"]) <= .002


def test_same_inputs_have_deterministic_trust_and_stable_unique_evidence_ids():
    first = run_scenario("flood-grid-cascade")
    second = run_scenario("flood-grid-cascade")
    ignored = {"observed_at", "received_at"}
    def stable(records): return [{key: value for key, value in item.items() if key not in ignored} for item in records]
    assert first["trust"] == second["trust"]
    assert stable(first["evidence"]) == stable(second["evidence"])
    ids = [item["evidence_id"] for item in first["evidence"]]
    assert len(ids) == len(set(ids))


def test_missing_evidence_reduces_completeness_and_requires_review():
    scenario = next(item for item in client.get("/api/v1/scenarios").json() if item["id"] == "flood-grid-cascade")
    request = deepcopy(scenario["request"]); request["missing_telemetry_ratio"] = .6
    trust = client.post("/api/v1/simulations/run", json=request).json()["trust"]
    assert trust["evidence_completeness"] == .4
    assert "LOW_EVIDENCE_COMPLETENESS" in {item["code"] for item in trust["review_reasons"]}


def test_stale_and_conflicting_evidence_reduce_quality_dimensions():
    base = EvidenceItem(evidence_id="a", source="synthetic", signal="x", value=1, reliability=.9, integrity_status="verified", provenance_status="basic-lineage", freshness_status="current")
    current = evidence_quality_dimensions([base])
    stale = evidence_quality_dimensions([base.model_copy(update={"freshness_status": "stale", "integrity_status": "stale"})])
    conflict = evidence_quality_dimensions([base, base.model_copy(update={"evidence_id": "b", "integrity_status": "conflicting"})])
    assert stale["freshness"] < current["freshness"]
    assert conflict["consistency"] < current["consistency"]


def test_wildfire_tampering_is_visible_and_triggers_human_review():
    result = run_scenario("wildfire-telemetry")
    statuses = {item["integrity_status"] for item in result["evidence"]}
    codes = {item["code"] for item in result["trust"]["review_reasons"]}
    assert {"suspected-tampering", "conflicting"}.issubset(statuses)
    assert result["trust"]["human_review_required"]
    assert "SUSPECTED_TAMPERING" in codes
    assert not result["trust"]["policy_compliance"]


def test_flood_has_no_unmodeled_tampering_and_heatwave_has_cyber_evidence():
    flood = run_scenario("flood-grid-cascade")
    heat = run_scenario("heatwave-ransomware")
    assert not any(item["integrity_status"] == "suspected-tampering" for item in flood["evidence"])
    cyber = next(item for item in heat["evidence"] if item["evidence_id"] == "tampering-probability")
    assert cyber["source_type"] == "cyber alert"
    assert "telemetry-integrity-agent" in cyber["agent_ids"]


def test_telemetry_verification_improves_modeled_trust_not_hazard():
    simulation = run_scenario("wildfire-telemetry")
    response = client.post("/api/v1/counterfactuals/run", json={"simulation_id": simulation["simulation_id"], "interventions": [{"intervention_id": "telemetry-verification", "parameters": {}}]}).json()
    outcome = response["interventions"][0]
    assert outcome["telemetry_integrity"] > response["baseline"]["telemetry_integrity"]
    assert outcome["recommendation_confidence"] > response["baseline"]["recommendation_confidence"]
    assert all(state["hazard_pressure"] == baseline["hazard_pressure"] for state, baseline in zip(outcome["hospital_states"], response["baseline"]["hospital_states"], strict=True))


def test_empty_evidence_quality_is_cautious():
    assert evidence_quality_dimensions([]) == {"reliability": 0, "provenance": 0, "freshness": 0, "consistency": 0}


def test_unknown_simulation_is_not_given_default_trust():
    response = client.get("/api/v1/trust/not-found")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

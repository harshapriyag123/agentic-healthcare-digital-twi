from itertools import combinations

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health():
    assert client.get("/api/v1/health").json()["status"] == "ok"


def test_hospital_geo_catalog():
    data = client.get("/api/v1/hospitals").json()
    assert len(data) >= 5
    assert {"latitude", "longitude", "cyber_readiness"}.issubset(data[0])
    assert all(-90 <= hospital["latitude"] <= 90 for hospital in data)
    assert all(-180 <= hospital["longitude"] <= 180 for hospital in data)


def test_scenario_catalog_exists():
    data = client.get("/api/v1/scenarios").json()
    assert len(data) >= 3
    assert {"id", "name", "category", "request"}.issubset(data[0])


def test_catalog_scenarios_produce_distinct_results():
    scenarios = client.get("/api/v1/scenarios").json()
    responses = [client.post("/api/v1/simulations/run", json=item["request"]) for item in scenarios]
    assert all(response.status_code == 200 for response in responses)
    results = [response.json() for response in responses]

    assert len(results) == 3
    for left, right in combinations(results, 2):
        assert left["regional_risk_score"] != right["regional_risk_score"]
        assert left["resilience_score"] != right["resilience_score"]
        assert left["affected_hospitals"] != right["affected_hospitals"]
        assert left["trust"]["telemetry_integrity"] != right["trust"]["telemetry_integrity"]
        assert left["agent_decisions"] != right["agent_decisions"]
        assert left["counterfactuals"] != right["counterfactuals"]


def test_simulation_exposes_agent_execution_and_evidence_lineage():
    scenario = client.get("/api/v1/scenarios").json()[0]
    result = client.post("/api/v1/simulations/run", json=scenario["request"]).json()
    evidence_ids = {item["evidence_id"] for item in result["evidence"]}

    assert result["duration_ms"] >= 0
    assert [item["sequence"] for item in result["agent_decisions"]] == [1, 2, 3, 4]
    assert {item["agent"] for item in result["agent_decisions"][:3]} == {
        "compound-event-detector",
        "telemetry-integrity-agent",
        "resilience-planning-agent",
    }
    assert result["agent_decisions"][-1]["component_type"] == "system"
    assert all(
        set(item["evidence_ids"]).issubset(evidence_ids) for item in result["agent_decisions"]
    )

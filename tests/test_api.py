from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)

def test_health():
    assert client.get("/api/v1/health").json()["status"]=="ok"

def test_hospital_geo_catalog():
    data=client.get("/api/v1/hospitals").json()
    assert len(data)>=5
    assert {"latitude","longitude","cyber_readiness"}.issubset(data[0])

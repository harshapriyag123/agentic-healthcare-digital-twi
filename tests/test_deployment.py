import pytest
from app.core.config import Settings
from app.main import app
from fastapi.testclient import TestClient
from pydantic import ValidationError

client = TestClient(app)


def test_supported_production_configuration_and_public_metadata():
    settings = Settings(
        app_env="production",
        app_version="release-1",
        cors_allowed_origins="https://demo.example",
        trusted_hosts="api.example",
        otel_enabled=False,
    )
    assert settings.cors_origin_list == ["https://demo.example"]
    assert settings.public_metadata == {
        "environment": "production",
        "version": "release-1",
        "service": "geotwin-api",
    }


def test_unsupported_environment_and_unsafe_production_origins_fail_safely():
    with pytest.raises(ValidationError):
        Settings(app_env="development")
    with pytest.raises(ValueError):
        assert Settings(
            app_env="production", cors_allowed_origins="http://localhost:5173"
        ).cors_origin_list
    with pytest.raises(ValueError):
        assert Settings(app_env="production", cors_allowed_origins="*").cors_origin_list


def test_invalid_otlp_url_is_rejected_without_exposing_configuration():
    with pytest.raises(ValidationError):
        Settings(otel_exporter_otlp_endpoint="not-a-url")
    response = client.get("/api/v1/health/observability")
    assert response.status_code == 200
    assert "headers" not in response.text.lower()
    assert "endpoint" not in response.text.lower()


def test_health_readiness_and_metadata_are_fast_safe_contracts():
    assert client.get("/api/v1/health").json()["status"] == "ok"
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/ready").json()["status"] == "ready"
    ready = client.get("/api/v1/ready")
    assert ready.status_code == 200 and ready.json()["catalogs"]["scenarios"] >= 3
    meta = client.get("/api/v1/meta").json()
    assert meta["synthetic_data"] is True
    assert meta["persistence"] == "process-local-bounded"


def test_cors_allows_configured_local_origin_and_rejects_unknown_origin():
    allowed = client.options(
        "/api/v1/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    rejected = client.options(
        "/api/v1/health",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in rejected.headers
    assert allowed.headers.get("access-control-allow-credentials") != "true"


def test_request_size_limit_returns_clear_413():
    response = client.post(
        "/api/v1/simulations/run",
        content=b"x" * 1_048_577,
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert "configured limit" in response.json()["detail"]


def test_container_uses_platform_port_nonroot_and_packages_catalogs():
    dockerfile = open("Dockerfile", encoding="utf-8").read()
    assert "${PORT:-8000}" in dockerfile
    assert "USER 10001:10001" in dockerfile
    assert "COPY --chown=geotwin:geotwin scenarios ./scenarios" in dockerfile
    assert "--reload" not in dockerfile

from app.core.telemetry import should_enable_telemetry


def test_disables_telemetry_when_endpoint_host_is_unreachable() -> None:
    assert not should_enable_telemetry("http://otel-collector.invalid:4317")


def test_allows_explicit_reachable_endpoint(monkeypatch) -> None:
    monkeypatch.setattr("app.core.telemetry._can_reach_otlp_endpoint", lambda endpoint: True)
    assert should_enable_telemetry("http://localhost:4317")

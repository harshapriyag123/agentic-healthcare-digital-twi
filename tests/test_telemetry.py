from app.core.telemetry import force_flush_telemetry, should_enable_telemetry


def test_disables_telemetry_when_endpoint_host_is_unreachable() -> None:
    assert not should_enable_telemetry("http://otel-collector.invalid:4317")


def test_allows_explicit_reachable_endpoint(monkeypatch) -> None:
    monkeypatch.setattr("app.core.telemetry._can_reach_otlp_endpoint", lambda endpoint: True)
    assert should_enable_telemetry("http://localhost:4317")


def test_force_flushes_all_enabled_serverless_providers(monkeypatch) -> None:
    class Provider:
        def __init__(self) -> None:
            self.timeouts: list[int] = []

        def force_flush(self, timeout_millis: int) -> bool:
            self.timeouts.append(timeout_millis)
            return True

    providers = [Provider(), Provider(), Provider()]
    monkeypatch.setattr("app.core.telemetry._enabled", True)
    monkeypatch.setattr("app.core.telemetry._logger_provider", providers[0])
    monkeypatch.setattr("app.core.telemetry._meter_provider", providers[1])
    monkeypatch.setattr("app.core.telemetry._tracer_provider", providers[2])

    assert force_flush_telemetry(timeout_millis=750)
    assert [provider.timeouts for provider in providers] == [[750], [750], [750]]

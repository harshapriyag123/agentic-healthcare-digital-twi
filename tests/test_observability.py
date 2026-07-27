import json
import logging

import pytest
from app.core.telemetry import EventNameFilter, JsonFormatter
from app.models.domain import CyberEvent, HazardInput, SimulationRequest
from app.services.twin import run_simulation
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode


def simulation_request(**updates) -> SimulationRequest:
    request = SimulationRequest(
        scenario_name="wildfire-telemetry",
        demand_multiplier=1.45,
        hazard=HazardInput(
            air_quality_index=330,
            grid_outage_probability=0.6,
        ),
        cyber_event=CyberEvent(
            target_hospital_id="HOSP-DFW-002",
            severity=0.75,
            attack_type="telemetry-tampering",
            telemetry_tampering=0.85,
        ),
        missing_telemetry_ratio=0.35,
    )
    return request.model_copy(update=updates)


def recording_provider(monkeypatch) -> InMemorySpanExporter:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    modules = (
        "app.services.twin.tracer",
        "app.services.trust.tracer",
        "app.services.counterfactuals.tracer",
        "app.agents.orchestrator.tracer",
    )
    for target in modules:
        monkeypatch.setattr(target, provider.get_tracer(target))
    return exporter


def test_primary_scenario_has_nested_agent_counterfactual_and_trust_spans(monkeypatch) -> None:
    exporter = recording_provider(monkeypatch)
    result = run_simulation(simulation_request())
    spans = list(exporter.get_finished_spans())
    by_name = {}
    for span in spans:
        by_name.setdefault(span.name, []).append(span)

    assert result.trace_id and len(result.trace_id) == 32
    assert {
        "simulation.run",
        "hospital_impact.calculate",
        "agent_orchestration.run",
        "agent.execute",
        "trust.evaluate",
        "counterfactual.twin.evaluate",
    }.issubset(by_name)
    root = by_name["simulation.run"][0]
    assert all(span.context.trace_id == root.context.trace_id for span in spans)
    assert all(span.parent is not None for span in by_name["agent.execute"])
    assert {span.attributes["agent.id"] for span in by_name["agent.execute"]} == {
        "compound-event-detector",
        "telemetry-integrity-agent",
        "resilience-planning-agent",
    }
    assert root.attributes["trust.human_review_required"] is True
    assert "geotwin.cyber.target" in root.attributes
    assert all("patient" not in key.lower() for span in spans for key in span.attributes)


def test_controlled_agent_failure_records_error_span_and_safe_result(monkeypatch) -> None:
    exporter = recording_provider(monkeypatch)
    result = run_simulation(simulation_request(demo_fault="security-agent-failure"))
    failed = next(
        span
        for span in exporter.get_finished_spans()
        if span.name == "agent.execute"
        and span.attributes.get("agent.id") == "telemetry-integrity-agent"
    )

    assert failed.status.status_code is StatusCode.ERROR
    assert any(event.name == "agent.failed" for event in failed.events)
    assert result.trust.human_review_required
    assert (
        next(
            item for item in result.agent_decisions if item.agent == "telemetry-integrity-agent"
        ).error
        == "Agent execution failed safely. Review backend telemetry for diagnostic details."
    )


def test_json_logs_preserve_stable_event_name_and_trace_safe_fields() -> None:
    record = logging.LogRecord(
        name="test",
        level=logging.WARNING,
        pathname=__file__,
        lineno=1,
        msg="Human-readable message",
        args=(),
        exc_info=None,
    )
    record.event_name = "human_review.triggered"
    record.simulation_id = "simulation-test"
    record.human_review_required = True
    EventNameFilter().filter(record)
    payload = json.loads(JsonFormatter().format(record))

    assert payload["event.name"] == "human_review.triggered"
    assert payload["body"] == "Human-readable message"
    assert payload["simulation_id"] == "simulation-test"
    assert payload["human_review_required"] is True
    assert "endpoint" not in payload
    assert "headers" not in payload


def test_unknown_hospital_marks_simulation_span_as_error(monkeypatch) -> None:
    exporter = recording_provider(monkeypatch)
    with pytest.raises(ValueError, match="Unknown target hospital"):
        run_simulation(
            simulation_request(
                cyber_event=CyberEvent(
                    target_hospital_id="UNKNOWN",
                    severity=0.5,
                )
            )
        )
    root = next(span for span in exporter.get_finished_spans() if span.name == "simulation.run")
    assert root.status.status_code is StatusCode.ERROR
    assert any(event.name == "exception" for event in root.events)

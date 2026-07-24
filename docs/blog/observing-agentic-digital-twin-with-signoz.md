# How I Traced a Multi-Agent Healthcare Digital Twin with OpenTelemetry and SigNoz

The most revealing observability bug in GeoTwin Sentinel happened before a simulation
started. The OpenTelemetry endpoint was unavailable, the API still created background
exporters, and pytest finished its assertions only to wait while retry threads attempted
to reach port 4317. The simulation was designed to fail open, but its telemetry lifecycle
did not fully honor that promise.

That discovery is a useful summary of why I instrumented this project. A response can be
numerically correct while the execution around it is slow, incomplete, or impossible to
audit. SigNoz cannot prove an agent recommendation correct. It can show which bounded
component ran, what evidence state it observed, where time was spent, which error path was
taken, and why a human-review rule became visible.

## Project context

GeoTwin Sentinel is a research decision-support prototype using synthetic data. A React
command center submits one of three compound-disruption scenarios to a FastAPI service.
The service evaluates a five-hospital directed infrastructure graph, runs three
deterministic agents, calculates a versioned trust record, and compares counterfactual
interventions. It does not control hospitals and its outputs are not operational advice.

The primary demonstration is **Wildfire + Telemetry Tampering**. Smoke and demand affect
hospital capacity while configured missing and manipulated signals reduce evidence
quality. The Compound Event Detector, Telemetry Integrity Agent, and Resilience Planning
Agent produce observable execution records. A Response Orchestrator assembles those
records, but does not pretend to be an independently executed agent.

## Observability architecture

The browser calls `POST /api/v1/simulations/run`. FastAPI instrumentation creates the
server span and accepts W3C `traceparent`. Application spans then form this readable path:

```text
POST /api/v1/simulations/run
└── simulation.run
    ├── telemetry_integrity.evaluate
    ├── hospital_impact.calculate
    │   └── twin.evaluate_facility (five spans)
    ├── transfer_plan.calculate
    ├── trust.evaluate
    ├── agent_orchestration.run
    │   ├── agent.execute (compound-event-detector)
    │   ├── agent.execute (telemetry-integrity-agent)
    │   └── agent.execute (resilience-planning-agent)
    ├── trust.evaluate
    └── counterfactual.* spans when enabled
```

This hierarchy reflects the implementation: agents execute sequentially. I did not draw
overlapping spans to make the waterfall appear more sophisticated. Sequential child spans
make the critical path and fallback behavior honest.

The application exports OTLP/gRPC to an OpenTelemetry Collector and then to SigNoz. The
browser never receives an ingestion key. It receives a trace ID in the response and an
`X-Trace-Id`/`Traceparent` response header; a public dashboard base URL can be configured
separately.

## Instrumenting the workflow

The Python resource identifies one service consistently:

```python
resource_attributes = {
    "service.name": settings.otel_service_name,  # geotwin-api
    "deployment.environment": settings.app_env,
    "service.version": settings.app_version,
    "service.namespace": "geotwin-sentinel",
}
```

The root application span is explicit:

```python
with tracer.start_as_current_span("simulation.run") as span:
    span.set_attributes({
        "geotwin.scenario.name": request.scenario_name,
        "hospital.count": len(states),
        "trust.human_review_required": trust.human_review_required,
    })
```

I keep simulation IDs out of metric dimensions but retain them on spans and logs where
high-cardinality correlation is appropriate. I also exclude requests, secrets, prompts,
raw environment variables, and large JSON responses from telemetry.

## Agent span design

Each `agent.execute` span records the implemented agent ID, stage, sequence, status,
confidence band, evidence count, action category, and human-review impact. Span events mark
`agent.started`, `recommendation.produced`, `confidence.reduced`,
`human_review.triggered`, or `agent.failed`. These are observable state transitions, not
hidden reasoning or chain-of-thought.

An exception is converted to a safe failed execution record. The span records the
exception and receives OpenTelemetry error status; the structured log retains a stack
trace on the server. Downstream behavior is explicit: a detector failure skips later
agents, while a planning failure suppresses transfer output. Both paths defer to an
authorized reviewer.

## Trace and log correlation

The JSON formatter adds `service.name`, `deployment.environment`, timestamp, severity,
event name, and the current trace and span IDs. Known fields such as `simulation_id`,
`agent_name`, and `agent_status` are promoted without dumping arbitrary objects.

That allows a practical SigNoz workflow: open the `simulation.run` trace, select the
Telemetry Integrity Agent span, then filter Logs Explorer by the same `trace_id`. The
warning explains that review was requested; the trace shows where the integrity and trust
checks occurred. Operational traceability, model confidence, evidence quality, policy
compliance, and human approval remain separate concepts.

## Metrics without cardinality surprises

The application emits counters and histograms such as `simulation_runs_total`,
`simulation_failures_total`, `simulation_duration_ms`, `active_simulations`,
`agent_executions_total`, `agent_failures_total`, `agent_duration_ms`,
`agent_low_confidence_total`, `human_review_required_total`, `trust_score`,
`critical_hospitals`, and `telemetry_integrity_failures_total`.

Dimensions are bounded: `scenario.type`, `agent.name`, `result.status`,
`integrity.state`, and failure type. There is deliberately no simulation ID, trace ID,
hospital name, or free-form scenario text on metrics.

## The debugging discovery

The repository already contained `_can_reach_otlp_endpoint()` and a test for it, but
`configure_telemetry()` never called the helper. With no collector running, the SDK
created batch processors anyway. During validation, all functional tests completed, then
OTLP retry threads continued logging connection errors against `localhost:4317`. Some
messages arrived after pytest had closed its capture stream, producing additional
`ValueError: I/O operation on closed file` noise.

I changed startup to test the configured endpoint before constructing exporters. If it is
unreachable, the API emits one structured `OTLP_ENDPOINT_UNAVAILABLE` warning, reports
the exporter inactive through `/api/v1/health/observability`, and continues without
background export threads. When the collector is reachable, normal batch export and
bounded shutdown still apply.

This is not a universal production design—transient network recovery may favor a durable
collector sidecar or exporter retries—but it matches this public prototype’s documented
fail-open contract and makes local tests deterministic.

## What was confusing and what changed

Two other issues surfaced. First, the project declared NumPy and SciPy only because
NetworkX PageRank selected its SciPy backend. On Python 3.14, the old NumPy `<2` pin forced
a source build. I replaced PageRank with deterministic weighted in-degree criticality,
which is the actual concept the model needs, and removed the unused scientific stack.

Second, the original simulation exposed broad spans but only three custom metrics.
Agent execution was visible in records yet incomplete as an operational time series. The
new bounded instruments and agent span events close that gap without adding hundreds of
tiny spans.

## Screenshots

Publication screenshots are intentionally not fabricated. The capture checklist in
`docs/demo/recording-shot-list.md` specifies the required application state, trace
overview, expanded agents, slowest agent, correlated logs, metrics, warning span, trust
decision, filenames, captions, and sensitive-data review. Each image remains marked
pending until captured from a verified SigNoz environment.

## Reproduce it

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
docker compose up --build
curl --fail-with-body -X POST http://127.0.0.1:8000/api/v1/simulations/run \
  -H 'Content-Type: application/json' \
  --data @scenarios/wildfire-telemetry.json
```

Copy the returned trace ID. In SigNoz Traces Explorer, filter
`trace_id = '<trace-id>'`, open Traces view, and expand `simulation.run`. The exact Query
Builder steps, dashboard panels, and alerts are in `docs/signoz-query-guide.md`.

## Limitations and takeaway

The model is deterministic, synthetic, process-local, and not clinically, causally, or
operationally validated. Metadata lineage is not cryptographic provenance. A live SigNoz
receipt, screenshots, public demo, and alerts still require external credentials and
manual verification.

The reproducible takeaway is narrower and useful: give each real agent an honest span,
keep metrics bounded, correlate logs with trace context, and test the exporter-unavailable
path. Observability does not validate the recommendation; it makes the execution that
produced it inspectable.

The implementation and query guide were checked against the current official SigNoz
Cloud ingestion, Query Builder v5, Trace Explorer, Logs Explorer, and trace-alert
documentation, plus the OpenTelemetry Python instrumentation guidance. That matters
because the current SigNoz UI supports expression filters, trace-grouped views, percentile
aggregations, and dashboard/alert creation directly from Query Builder; copying an
unverified dashboard JSON schema would be less reproducible. The repository therefore
documents exact panel construction and keeps the vendor deployment outside this source
tree.

Repository: <https://github.com/harshapriyag123/agentic-healthcare-digital-twi>  
Live demo and published article: **[MANUAL ACTION REQUIRED — add verified URLs]**

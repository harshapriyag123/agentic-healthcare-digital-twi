# SigNoz query guide

These examples target the SigNoz Query Builder v5 UI documented in July 2026. Select the
`geotwin-api` service and the indicated signal. Attribute autocomplete is the final check
that telemetry has arrived. The application exports OTLP/gRPC; no query requires a private
API or an unstable dashboard JSON schema.

## Trace Explorer

Use **Traces → Explorer**, choose **Traces** view for complete waterfalls, and set a time
range containing the run.

| Question | Filter | View / aggregation |
|---|---|---|
| Simulation by trace ID | `trace_id = '<32-character-trace-id>'` | Traces |
| One scenario | `service.name = 'geotwin-api' AND geotwin.scenario.name = 'wildfire-telemetry'` | Traces |
| Failed agents | `name = 'agent.execute' AND agent.status = 'failed'` | List |
| Slow simulations | `name = 'simulation.run'` | Table; `p95(duration_nano)` |
| Security/integrity agent warnings | `name = 'agent.execute' AND agent.id = 'telemetry-integrity-agent' AND agent.status != 'completed'` | List |
| Human review | `trust.human_review_required = true` | List |
| Integrity failures | `name = 'telemetry_integrity.evaluate' AND security.telemetry.integrity < 0.75` | List |
| Counterfactual latency | `name LIKE 'counterfactual.%'` | Table; `p95(duration_nano)`, group by `name` |
| Errors in 15 minutes | `service.name = 'geotwin-api' AND status_code = 2` | List, time range Last 15 minutes |
| P95 simulation duration | `name = 'simulation.run'` | Time Series; `p95(duration_nano)` |

Span status code `2` is OpenTelemetry `ERROR`. If the UI exposes the semantic label, select
`Error` from autocomplete instead of typing the numeric representation.

## Logs Explorer

Container stdout is JSON. The collector parses JSON and promotes trace correlation fields.
Use **Logs → Explorer**, time range **Last 15 minutes**:

| Question | Filter |
|---|---|
| Logs for a trace | `trace_id = '<trace-id>'` |
| Failed agent logs | `service.name = 'geotwin-api' AND agent_status = 'failed'` |
| Human-review events | `service.name = 'geotwin-api' AND event.name = 'Human review requested'` |
| Missing evidence | `service.name = 'geotwin-api' AND event.name LIKE '%evidence%' AND severity IN ('WARNING', 'ERROR')` |
| Integrity warning | `service.name = 'geotwin-api' AND event.name = 'Trust evaluation requires human review'` |

Open a log row and choose its trace-context action to move to the corresponding trace.

## Dashboards

Create panels from Query Builder rather than importing version-sensitive JSON:

1. **Executive Hackathon** — `simulation_runs_total`, success ratio, P95
   `simulation_duration_ms`, `agent_executions_total`, `agent_failures_total`,
   `human_review_required_total`, `critical_hospitals`, and
   `telemetry_integrity_failures_total`.
2. **Simulation Performance** — duration grouped by `scenario.type`, throughput,
   failures, and P95 `simulation.run` span duration.
3. **Agent Observability** — `agent_duration_ms` and execution/failure counters grouped
   only by `agent.name`; add a failed-agent span table.
4. **Trust and Evidence** — `trust_score`, human review, integrity failures,
   `evidence_missing_total`, and `evidence_stale_total`.
5. **Errors and Reliability** — error spans/logs, `simulation_failures_total`,
   `counterfactual_failures_total`, and API error rate from server spans.

Metric dimensions are bounded. Never group by simulation ID, trace ID, hospital name, or
free-form user input.

## Alerts

Create four prototype alerts: simulation failure ratio >5% for 10 minutes; P95 simulation
duration >2 seconds for 10 minutes; any telemetry integrity failure in 5 minutes; and no
`simulation_runs_total` data for 30 minutes while the demo is expected online. Route them
to a tested notification channel and label them `prototype=geotwin`.

## References

- [SigNoz Query Builder v5](https://signoz.io/docs/userguide/query-builder-v5/)
- [Querying traces](https://signoz.io/docs/apm-and-distributed-tracing/querying-traces/)
- [Logs Explorer](https://signoz.io/docs/userguide/logs_query_builder/)
- [Trace-based alerts](https://signoz.io/docs/alerts-management/trace-based-alerts/)
- [SigNoz Cloud ingestion](https://signoz.io/docs/ingestion/signoz-cloud/overview/)

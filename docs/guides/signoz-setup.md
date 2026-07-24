# SigNoz and OpenTelemetry setup

## Modes

1. **Disabled local demo:** `OTEL_ENABLED=false`; simulation works, trace IDs may be absent/non-recording.
2. **Local collector:** run the repository collector config and send gRPC OTLP to `http://127.0.0.1:4317` with insecure transport.
3. **SigNoz Cloud:** configure the provider OTLP endpoint, TLS (`OTEL_EXPORTER_OTLP_INSECURE=false`), and ingestion header only in the backend host secret store.

Example shell (replace values in your secret manager, not Git):

```bash
export OTEL_ENABLED=true
export OTEL_SERVICE_NAME=geotwin-api
export OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.example.invalid:443
export OTEL_EXPORTER_OTLP_INSECURE=false
export OTEL_EXPORTER_OTLP_HEADERS='signoz-ingestion-key=REDACTED'
uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000
```

The `.invalid` endpoint is intentionally non-routable; use the values supplied by your SigNoz environment. Do not paste headers into screenshots, logs, Vercel `VITE_*`, issues, or commits.

## Verify

1. Check `/health/observability` for enabled/configured status without secrets.
2. Run Wildfire + Telemetry Tampering and copy its 32-character trace ID.
3. In SigNoz, filter service `geotwin-api`, exact trace ID, deployed environment, and scenario/simulation attributes.
4. Inspect request → `simulation.run` → `agent.execute` → trust/counterfactual work where emitted.
5. Inspect application metrics and agent/trust structured logs. Attribute names are in [OTel conventions](../OTEL_SEMANTIC_CONVENTIONS.md).

The repository collector deliberately exports all three signals to its `debug` exporter,
which proves local OTLP receipt without pretending to bundle SigNoz. For a local SigNoz
instance, point the application directly at the instance's supported OTLP receiver or
change the collector pipelines to the `otlp/signoz` exporter and provide
`SIGNOZ_OTLP_ENDPOINT` and `SIGNOZ_INGESTION_KEY` through the shell/secret store. Never
commit those values. The official self-hosted Docker deployment remains owned by the
SigNoz repository.

Export fails open. If a trace is delayed/missing, check endpoint/protocol (this app uses OTLP gRPC), TLS, ingestion-header syntax, collector/exporter logs, service/environment filters, sampling/retention, and clock. Do not claim a live SigNoz verification until the trace is actually found. SigNoz observes application execution; no judge analytics, fingerprints, or health/patient data should be added.

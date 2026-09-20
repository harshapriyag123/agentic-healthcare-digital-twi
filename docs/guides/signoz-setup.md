# SigNoz and OpenTelemetry setup

## Modes

1. **In-app SigNoz simulation:** `VITE_SIGNOZ_MODE=simulation`; the Observability route renders dynamic Overview, Traces, Logs, and Service Map views from the latest real GeoTwin execution records. This mode is not persisted SigNoz telemetry.
2. **Disabled exporter:** `OTEL_ENABLED=false`; simulations and the in-app workspace still work, but Cloud trace IDs may be absent/non-recording.
3. **Local collector:** run the repository collector config and send gRPC OTLP to `http://127.0.0.1:4317` with insecure transport.
4. **SigNoz Cloud:** configure the regional OTLP endpoint, TLS (`OTEL_EXPORTER_OTLP_INSECURE=false`), and ingestion header only in the backend host secret store. Set `VITE_SIGNOZ_MODE=external` with an access-appropriate `VITE_SIGNOZ_APP_URL` only when evaluators can open that workspace.

Example shell (replace values in your secret manager, not Git):

```bash
export OTEL_ENABLED=true
export OTEL_SERVICE_NAME=geotwin-api
export OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.<region>.signoz.cloud:443
export OTEL_EXPORTER_OTLP_INSECURE=false
export OTEL_EXPORTER_OTLP_HEADERS='signoz-ingestion-key=<your-ingestion-key>'
export OTEL_RESOURCE_ATTRIBUTES='deployment.platform=vercel'
export OTEL_STARTUP_PROBE_TIMEOUT_SECONDS=2
uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000
```

Use the exact regional ingestion URL and key shown in SigNoz Cloud under **Settings → Ingestion**. SigNoz Cloud accepts OTLP/gRPC and OTLP/HTTP on port 443; this application uses the OTLP/gRPC exporters. Do not paste headers into screenshots, logs, Vercel `VITE_*`, issues, or commits.

For Vercel, add the backend variables above to Production, Preview, and Development only as needed, then redeploy. The API performs a bounded startup connectivity probe and explicitly flushes its trace, metric, and log providers after simulation and counterfactual requests so serverless freezing does not silently retain completed batches. `exporter_active=true` confirms SDK initialization, not SigNoz receipt; verify the trace in SigNoz before claiming persistence.

## Verify

1. Check `/health/observability` for enabled/configured status without secrets.
2. Run Wildfire + Telemetry Tampering and copy its 32-character trace ID.
3. In SigNoz, filter service `geotwin-api`, exact trace ID, deployed environment, and scenario/simulation attributes. The Cloud ingestion key is never needed by the browser.
4. Inspect request → `simulation.run` → `agent.execute` → trust/counterfactual work where emitted.
5. Inspect application metrics and agent/trust structured logs. Attribute names are in [OTel conventions](../OTEL_SEMANTIC_CONVENTIONS.md).

The repository collector deliberately exports all three signals to its `debug` exporter,
which proves local OTLP receipt without pretending to bundle SigNoz. For a local SigNoz
instance, point the application directly at the instance's supported OTLP receiver or
copy the collector config to an ignored local file, add an `otlp/signoz` exporter, and
select it in all three pipelines:

```yaml
exporters:
  otlp/signoz:
    endpoint: ${env:SIGNOZ_OTLP_ENDPOINT}
    headers:
      signoz-ingestion-key: ${env:SIGNOZ_INGESTION_KEY}
    tls:
      insecure: false
service:
  pipelines:
    traces:
      exporters: [otlp/signoz]
    metrics:
      exporters: [otlp/signoz]
    logs:
      exporters: [otlp/signoz]
```

Merge those pipeline entries with the committed receivers and processors; the snippet is
not a standalone collector configuration. SigNoz Cloud requires the ingestion header,
whereas self-hosted/community SigNoz does not. Never commit credential values. The
official self-hosted Docker deployment remains owned by the SigNoz repository.

Export fails open. If a trace is delayed/missing, check endpoint/protocol (this app uses OTLP gRPC), TLS, ingestion-header syntax, collector/exporter logs, service/environment filters, sampling/retention, and clock. Do not claim a live SigNoz verification until the trace is actually found. SigNoz observes application execution; no judge analytics, fingerprints, or health/patient data should be added.

# GeoTwin Sentinel API

FastAPI service for the shared synthetic hospital catalog, scenario-driven digital twin, deterministic agent orchestration, counterfactual comparison, trust/evidence assessment, and OpenTelemetry instrumentation.

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
OTEL_ENABLED=false uvicorn app.main:app --app-dir apps/api --reload --host 127.0.0.1 --port 8000
```

Read [local setup](../../docs/guides/local-development.md), [API overview](../../docs/api/overview.md), and [system architecture](../../docs/architecture/system-architecture.md). This service uses synthetic data and process-local history; it provides no operational authorization.

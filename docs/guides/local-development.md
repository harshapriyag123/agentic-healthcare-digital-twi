# Local development

## Prerequisites

- Git
- Python 3.11+ (`python --version`; CI and container use 3.12)
- Node.js 20 and npm (`node --version`, `npm --version`)
- Optional: Docker Compose; optional OTLP receiver/SigNoz

## Clone and backend

```bash
git clone <repository-url>
cd geotwin-sentinel
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
cp apps/api/.env.example apps/api/.env
uvicorn app.main:app --app-dir apps/api --reload --host 127.0.0.1 --port 8000
```

Windows PowerShell activation is `.venv\Scripts\Activate.ps1`; use `Copy-Item apps/api/.env.example apps/api/.env`. Run remaining commands from PowerShell with the same arguments.

Verify `http://127.0.0.1:8000/health`, `/ready`, and local docs at `/docs`.

## Frontend

In a second terminal:

```bash
cd apps/web
npm ci
cp .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 5173
```

Windows: `Copy-Item .env.example .env.local`. An empty local `VITE_API_BASE_URL` uses same-origin relative calls only; for the separate Vite server set `VITE_API_BASE_URL=http://127.0.0.1:8000` in `.env.local`. Open `http://127.0.0.1:5173`.

## Environment configuration

Backend loads its settings from the process environment (the application does not automatically target `apps/api/.env`; use a shell/environment loader if needed). Safe local defaults are already encoded. Key variables:

| Backend variable | Local value/purpose |
|---|---|
| `APP_ENV` | `local`; production/staging activates stricter validation |
| `APP_VERSION` | Build/release label |
| `LOG_LEVEL` | `INFO`, etc. |
| `CORS_ALLOWED_ORIGINS` | Exact frontend origins, comma-separated |
| `TRUSTED_HOSTS` | Exact API hosts; local hosts by default |
| `MAX_REQUEST_BODY_BYTES` | Default 1048576 |
| `OTEL_ENABLED` | `false` for no-export demo; `true` to configure SDK |
| `OTEL_SERVICE_NAME` | `geotwin-api` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | gRPC OTLP receiver endpoint |
| `OTEL_EXPORTER_OTLP_INSECURE` | `true` only for local plaintext collector |
| `OTEL_EXPORTER_OTLP_HEADERS` | Secret server-side ingestion header; never commit |
| `OTEL_RESOURCE_ATTRIBUTES` | Non-secret `key=value` resource labels |

| Frontend variable | Purpose |
|---|---|
| `VITE_APP_ENV` | local/test/staging/production |
| `VITE_APP_VERSION` | Public build label |
| `VITE_DEPLOYMENT_NAME` | Public footer label |
| `VITE_API_BASE_URL` | Absolute API origin; production requires public HTTPS |
| `VITE_MAP_STYLE_URL` | Public MapLibre style URL |
| `VITE_SIGNOZ_DASHBOARD_URL` | Optional public/read-only dashboard URL |

All `VITE_*` values are public. Never place an OTLP key or private dashboard token in them.

## Run and test

Use the [simulation curl example](../api/simulation-api.md). Test commands are in [testing](testing.md).

For OTel disabled: keep `OTEL_ENABLED=false`. For the repository collector, set `OTEL_ENABLED=true`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317`, and `OTEL_EXPORTER_OTLP_INSECURE=true`, then run an OTLP-compatible collector using `observability/otel-collector-config.yaml`; a SigNoz backend is still required to view data.

Docker convenience path:

```bash
docker compose up --build
```

This starts the API and collector defined by Compose. Start the Vite frontend separately as above. Stop with Ctrl+C, then `docker compose down`; stop native servers with Ctrl+C. No Makefile was added because Docker Compose and existing npm/Python commands already cover the workflow.

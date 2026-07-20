# API overview

Local base URL: `http://127.0.0.1:8000`. Versioned application routes use `/api/v1`; root `/health`, `/ready`, and `/health/observability` are deployment aliases. JSON is the request/response content type.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Liveness and safe build metadata |
| GET | `/api/v1/ready` | Verify packaged hospital/scenario catalogs |
| GET | `/api/v1/health/observability` | Safe OTel enabled/configured status |
| GET | `/api/v1/meta` | Environment/version/synthetic/persistence metadata |
| GET | `/api/v1/hospitals` | Synthetic hospital catalog |
| GET | `/api/v1/scenarios` | Scenario catalog and executable request objects |
| GET | `/api/v1/scenarios/{scenario_id}` | One scenario or 404 |
| POST | `/api/v1/simulations/run` | Run the digital twin and agents |
| GET | `/api/v1/counterfactuals/interventions` | Intervention definitions |
| POST | `/api/v1/counterfactuals/run` | Compare candidates with stored baseline |
| GET | `/api/v1/trust/{simulation_id}` | Rich trust/evidence view for stored run |

FastAPI/Pydantic validation errors use `{"detail":[...]}` with status 422; controlled domain errors use `{"detail":"message"}`; oversized bodies return 413. The default body limit is 1 MiB. A `traceparent` header is accepted and exposed by CORS; simulation/counterfactual/trust responses also carry a `trace_id` field when valid tracing context exists. Correlate that ID with service `geotwin-api` in SigNoz.

Local/test OpenAPI: `/docs` and `/openapi.json`. Interactive docs are intentionally disabled in production; the OpenAPI JSON remains at `/openapi.json` unless the platform blocks it.

Examples below use committed synthetic data:

```bash
curl --fail-with-body http://127.0.0.1:8000/api/v1/scenarios
curl --fail-with-body -X POST http://127.0.0.1:8000/api/v1/simulations/run \
  -H 'Content-Type: application/json' --data @scenarios/wildfire-telemetry.json
```

See [simulation](simulation-api.md), [counterfactual](counterfactual-api.md), [trust](trust-evidence-api.md), and [health/metadata](health-metadata-api.md). No endpoint accepts patient data or authorizes real action.

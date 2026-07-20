# Health and metadata API

| Path | Meaning | Success example |
|---|---|---|
| `/health` or `/api/v1/health` | Process liveness; independent of SigNoz | `{"status":"ok","environment":"local","version":"0.1.0","service":"geotwin-api"}` |
| `/ready` or `/api/v1/ready` | Packaged catalogs can load | `{"status":"ready","catalogs":{"hospitals":5,"scenarios":3}}` |
| `/health/observability` or `/api/v1/health/observability` | Safe exporter status; not readiness dependency | Contains `status`, `required_for_readiness`, enabled/configured fields; never credentials |
| `/api/v1/meta` | Safe deployment metadata | Environment, version, service, `synthetic_data:true`, `persistence:"process-local-bounded"` |

Readiness returns 503 if required catalogs are unavailable. These endpoints deliberately do not reveal OTLP endpoints/headers, host secrets, or environment dumps. Health routes are excluded from FastAPI instrumentation when OTel is enabled to reduce noise. Use `/ready` for deployment health checks and `/meta` to confirm the released version.

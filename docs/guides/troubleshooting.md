# Troubleshooting

| Problem | Check | Resolution |
|---|---|---|
| Python dependency/import error | Active venv, Python 3.11+, `python -c 'import fastapi'` | Reinstall `python -m pip install -e '.[dev]'`; run Uvicorn with `--app-dir apps/api` |
| Node install/version mismatch | Node 20 and committed lockfile | Use Node 20 and `npm ci` in `apps/web` |
| Port occupied | Existing process on 8000/5173/4173 | Stop it or use a new port and update API/CORS URLs consistently |
| Frontend configuration error | `VITE_APP_ENV`, absolute base URL | Local may use HTTP; production requires a public HTTPS origin and rebuild |
| CORS rejection | Exact browser Origin and backend list | Add exact scheme/host/port to `CORS_ALLOWED_ORIGINS`; no wildcard in production |
| Blank map/style error | Network, WebGL, style URL, CSP | Use table fallback; validate `VITE_MAP_STYLE_URL` and CSP/connect sources |
| Simulation 422 | Request bounds/target ID | Start from `GET /scenarios/{id}` request object; target a catalog hospital |
| Counterfactual 404 | Restart/worker mismatch | Run a new baseline against the same process; deploy one worker |
| Counterfactual 422 | Duplicate/unknown candidate or parameter bounds | Use intervention catalog and one unique ID each |
| Missing trust data | No successful/current simulation ID | Run a simulation and query the same process immediately |
| Missing trace ID | OTel disabled/non-recording context | Enable/configure OTel; simulation output remains valid without export |
| OTLP protocol/auth error | gRPC endpoint, TLS, header syntax | Use provider values server-side; rotate exposed keys; inspect exporter logs |
| Docker unhealthy | `/ready`, catalog copy, `PORT`, trusted hosts | Inspect container logs/readiness; build from repository root |
| Cloud cold start | Free-tier suspension | Call `/health`, wait/retry once, use documented demo transition |
| Deep-link 404 | SPA host rewrite | Deploy repository `vercel.json`; navigate from root as temporary recovery |
| Missing environment variable | Scoped examples and production validation | Copy examples, set required provider variables, rebuild/redeploy |

For presentation failures use [demo recovery](../demo/demo-recovery.md); for telemetry use [SigNoz setup](signoz-setup.md).

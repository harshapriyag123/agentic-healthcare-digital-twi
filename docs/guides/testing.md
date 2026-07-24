# Testing and validation

## Backend

```bash
ruff check .
pytest
```

The suite includes model/service unit tests and FastAPI integration tests for catalogs, simulation distinctiveness, agents/failure safety, counterfactual baseline/deltas/ranking, trust/evidence, telemetry status, and deployment configuration. It uses synthetic packaged data and does not require SigNoz.

## Frontend

```bash
cd apps/web
npm ci
npm run lint
npm run typecheck
npm test -- --run
VITE_APP_ENV=production VITE_API_BASE_URL=https://api.example.invalid npm run build
```

Vitest/Testing Library covers routes and UI states plus agent, GIS, counterfactual, trust, deployment, and formatting utilities. There is no Playwright/E2E or screenshot test suite; route-level deployment smoke is performed over HTTP.

## Explicit synthetic failure demonstration

`SimulationRequest.demo_fault` is disabled by default (`none`) and accepts only
`security-agent-delay` or `security-agent-failure`. It is a public, bounded demo/test
control—not a production fault injector. The delay is fixed at 250 ms; the failure creates
a safe failed agent record, error span/event, constrained output, and mandatory human
review. Never enable it for the primary success demonstration.

## Smoke, container, and external checks

```bash
BACKEND_URL=http://127.0.0.1:8000 \
FRONTEND_URL=http://127.0.0.1:4173 \
EXPECTED_FRONTEND_ORIGIN=http://localhost:4173 \
SMOKE_ALLOW_LOCALHOST=true \
python scripts/smoke_test.py

python scripts/check_secrets.py
docker build -t geotwin-sentinel:test .
```

The smoke script checks health/readiness/metadata, catalogs, a simulation, counterfactual/trust lookup, CORS, and SPA routes. Frontend preview must be running for route checks. CI validates non-root container startup when Docker is available. Live cloud URLs, map tiles, SigNoz receipt/retention, provider headers, rollback, and browser/projector behavior require external access and manual verification.

Automated passing tests are evidence of implemented functional behavior, not clinical validation, causal validity, security certification, accessibility conformance, uptime, or model calibration.

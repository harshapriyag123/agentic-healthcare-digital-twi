# Final submission-readiness audit

Audit date: 2026-07-26. Status labels describe evidence produced in this workspace; they
do not convert local checks into external deployment or SigNoz proof.

## Architecture and implementation

| # | Item | Status | Evidence |
|---:|---|---|---|
| 1 | Repository audit summary | VERIFIED | React/Vite/TypeScript/MapLibre frontend; FastAPI/Pydantic/NetworkX backend; synthetic catalogs, tests, deployment, observability, and submission docs inspected. |
| 2 | Existing architecture | VERIFIED | Five-hospital graph twin, synchronous three-agent orchestrator, response orchestrator record, trust/evidence engine, process-local store, and counterfactual reruns. |
| 3 | Existing SigNoz integration | VERIFIED | OTLP/gRPC traces, metrics, and logs; W3C request context; response trace ID/header; collector debug receipt path; configurable SigNoz UI link. |
| 4 | Observability gaps found | VERIFIED | Stable log event IDs were not preserved by JSON output; direct in-memory span coverage was absent; committed collector contained an unusable credentialed exporter template; Windows docs validation assumed the system encoding. |
| 5 | Genuine debugging issue | VERIFIED | `scripts/check_docs.py` reproduced a Windows `UnicodeDecodeError`; formatter output reproduced the stable-event-name mismatch. |
| 6 | Fixes implemented | IMPLEMENTED BUT NOT EXTERNALLY VERIFIED | Explicit UTF-8 docs reads, shared stdout/OTLP event-name filter, safe simulation lifecycle logs, stable agent/trust/counterfactual events, collector cleanup, and in-memory trace/error tests. |
| 7 | Trace hierarchy | VERIFIED | Tests assert `simulation.run`, hospital impact, trust, agent orchestration, three agent spans, and counterfactual twin evaluation in one trace. Agents remain honestly sequential. |
| 8 | Metrics | VERIFIED | Bounded counters/histograms exist for simulation, API, agent, counterfactual, trust/evidence, hospital state, and integrity; identifier dimensions are excluded. |
| 9 | Logs | VERIFIED | JSON formatter test verifies stable `event.name`, readable body, safe correlation fields, and no endpoint/header output. |
| 10 | Error instrumentation | VERIFIED | Controlled agent failure and unknown-hospital tests assert error spans, exception events, safe client/result behavior, and mandatory review. |
| 11 | SigNoz dashboards | DOCUMENTED ONLY | Five manual Query Builder dashboard recipes avoid an unverified import schema. |
| 12 | Alerts | DOCUMENTED ONLY | Four bounded prototype alert recipes are documented; notification delivery is not configured. |
| 13 | UI observability | VERIFIED | Result view exposes trace ID, duration, telemetry configuration, and environment-derived SigNoz link. |
| 14 | Tests added | VERIFIED | `tests/test_observability.py` adds four trace/log/error tests. |

## Validation

| # | Item | Status | Evidence |
|---:|---|---|---|
| 15 | Tests passed | VERIFIED | Backend: 47 passed. Frontend: 59 passed across 6 files. |
| 16 | Build result | VERIFIED | Ruff, ESLint, TypeScript, docs links/invariants, secret-pattern scan, and Vite production build passed. Vite reports a non-blocking MapLibre chunk-size warning. |
| 17 | Docker result | BLOCKED | Docker client 29.2.1 is installed, but no Docker Engine was running; image and Compose runtime were not verified locally. |
| 18 | Cloud deployment | MANUAL ACTION REQUIRED | Render/Vercel configuration exists; no public URL or provider state was available for a smoke test. |
| 19 | SigNoz verification | MANUAL ACTION REQUIRED | No live SigNoz instance/credentials were supplied. Local in-memory spans verify instrumentation, not ingestion or UI receipt. |
| 20 | Primary demo trace ID | BLOCKED | No externally searchable SigNoz trace ID was produced. Do not substitute the local smoke simulation UUID. |
| 21 | README | VERIFIED | Identity, safety, architecture, SigNoz role, quick start, primary scenario, stack, limitations, and documentation links are present; public links/screenshots remain pending. |
| 22 | Blog | IMPLEMENTED BUT NOT EXTERNALLY VERIFIED | Draft exists with repository commands, code, actual span names, and reproduced debugging findings. Publication and screenshots remain manual. |
| 23 | Blog claims | VERIFIED | Implementation claims were checked against source/tests; external SigNoz receipt and publication are explicitly unclaimed. |
| 24 | Submission content | IMPLEMENTED BUT NOT EXTERNALLY VERIFIED | Ready-to-paste summaries and full copy exist; team/demo/video/blog URLs remain placeholders. |
| 25 | Demo script | IMPLEMENTED BUT NOT EXTERNALLY VERIFIED | Three-minute timed script and click runbook exist; rehearsal against public services remains manual. |
| 26 | Judge Q&A | IMPLEMENTED BUT NOT EXTERNALLY VERIFIED | Answers distinguish agents, observability, confidence, correctness, synthetic data, authority, and scaling. |
| 27 | Screenshots | MANUAL ACTION REQUIRED | No image assets are committed; the shot list includes state, caption, filename, placement, and sensitive-data review. |
| 28 | Video | MANUAL ACTION REQUIRED | Script exists; no recording or uploaded URL is claimed. |
| 29 | Public URLs | MANUAL ACTION REQUIRED | Repository URL is present. Demo, video, published blog, and SigNoz URLs are not available. |
| 30 | Manual actions remaining | MANUAL ACTION REQUIRED | Start Docker/SigNoz, verify ingestion, create dashboards/alerts, capture screenshots, deploy, smoke public URLs, rehearse, record/publish video/blog, fill team/links, and submit. |
| 31 | Known limitations | VERIFIED | Synthetic deterministic model, no clinical/causal/security validation, process-local persistence, no production auth/rate limiting, and observability not proof of correctness. |

## Reproduction

| # | Item | Status | Evidence |
|---:|---|---|---|
| 32 | Exact commands | VERIFIED | See below. |
| 33 | Files created | VERIFIED | `tests/test_observability.py`; `docs/final-audit-report.md`. |
| 34 | Files modified | VERIFIED | Telemetry, simulation/agent/trust/counterfactual logging, docs checker, collector config, lockfile advisory update, query/setup guides, and blog. |
| 35 | Files removed | VERIFIED | None. |

```bash
python -m pip install -e '.[dev]'
python -m ruff format --check apps/api tests scripts
python -m ruff check .
python -m pytest -q
python scripts/check_docs.py
python scripts/check_secrets.py

cd apps/web
npm ci
npm run lint
npm run typecheck
npm test -- --reporter=dot
npm run build
```

With a running API, the backend-only deployment flow is:

```bash
BACKEND_URL=http://127.0.0.1:8000 SMOKE_ALLOW_LOCALHOST=true \
  python scripts/smoke_test.py --backend-only
```

With a recording OTLP destination, run `python scripts/verify_observability.py`, copy the
returned 32-character trace ID, and follow the [SigNoz query guide](signoz-query-guide.md).

## Dependency and external-risk notes

`npm audit fix` applied the available non-breaking `brace-expansion` lockfile update.
The current advisory database still reports eight high and one moderate findings through
the Vite/ESLint development toolchain and React Router's unused RSC action mode. npm
offers only major-version toolchain upgrades for most findings; those were not forced
into this final audit without a dedicated migration. Reassess and upgrade before exposing
development servers or adopting server actions. The deployed artifact is a static SPA,
not a Vite development server.

# Changelog

## 0.1.0 — Hackathon research release

### Added

- Real scenario-driven simulation results for Flood Grid Cascade, Heatwave Ransomware, and Wildfire + Telemetry Tampering.
- React Crisis Command Center, geospatial hospital map/details, accessible hospital impact views, and run history.
- Agent Activity Console with detection, integrity, planning, orchestration, evidence references, trace context, and safe failure records.
- Counterfactual Explorer with exact-baseline comparison, intervention transformations, hospital/transfer diffs, trade-offs, and ranking controls.
- Versioned Trust and Evidence Dashboard with factor contributions, lineage, policies, anomalies, improvement actions, and human-review reasons.
- OpenTelemetry traces, metrics, structured logs, trace correlation, optional collector/SigNoz export, and fail-open telemetry health.
- Production-oriented Render backend and Vercel frontend deployment configuration.
- Environment validation, metadata, readiness, observability-health, smoke testing, and release documentation.
- CI checks for backend, frontend, container startup, non-root execution, and common secret patterns.
- Judge demo scripts/runbook/recovery, architecture/API/scenario/research guides, submission copy, issue/PR templates, and contributor/security documentation.

### Changed

- Backend container now uses a pinned slim Python runtime, a non-root account, platform `PORT`, one worker, and graceful shutdown.
- Browser API configuration is centralized and production URLs require HTTPS.
- CORS is explicit and environment-aware; request bodies are bounded.
- Production startup now distinguishes a serverless cold start from an unavailable backend.
- The observability route exposes live readiness and execution evidence without claiming a SigNoz connection when export is disabled.

### Fixed

- Corrected Docker package-copy/install order and added SPA deep-link hosting rewrites.
- Counterfactual comparison now replays the bounded deterministic baseline when Vercel routes requests to different serverless processes.
- OpenTelemetry span-structure tests now use an explicit sampler instead of inheriting a low CI sampling ratio.
- Mobile navigation now uses distinct, labeled screen markers instead of repeated ambiguous symbols.

### Security

- Added CSP and common browser security headers, trusted-host validation, safe environment examples, and server-only OTLP secret handling.

### Known limitations

- All facilities, events, telemetry, and results are synthetic; models and agents are simplified and not clinically, causally, operationally, or empirically validated.
- Server-side simulation and trust lookup history remains process-local and resets on restart or redeploy; the browser keeps the latest completed run, and counterfactuals can replay its bounded input.
- The public synthetic demo has no authentication or application-level rate limiting.
- Evidence lineage is not cryptographic provenance; integrity/anomaly checks are deterministic rules rather than machine learning.
- Public deployment URLs, screenshots, demo video, and live SigNoz receipt remain manual publication steps.
- No production healthcare, clinical, regulatory, availability, or disaster-recovery claims are made.

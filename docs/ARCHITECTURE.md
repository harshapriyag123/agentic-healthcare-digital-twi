# Architecture

GeoTwin Sentinel is organized as five research layers:

1. **Evidence plane** — aggregate hazard, infrastructure, cyber and operational telemetry.
2. **Digital-twin plane** — a directed dependency/referral graph and state-transition model.
3. **Agent plane** — detection, telemetry-integrity and resilience-planning agents.
4. **Trust plane** — evidence completeness, integrity, uncertainty, policy checks and mandatory human review.
5. **Observability plane** — OpenTelemetry traces, metrics and semantic attributes exported to SigNoz.

The current implementation is deterministic and reproducible. It intentionally avoids patient-level data and autonomous clinical decisions.

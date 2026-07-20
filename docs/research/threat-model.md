# Threat model

This prototype reduces some risks but does not claim complete security.

| Threat | Asset/source/path | Existing mitigation | Residual risk | Future mitigation |
|---|---|---|---|---|
| Prompt injection | Agent decision integrity; malicious free text | Current agents accept typed numeric context and make no LLM/tool calls | Future text/tool adapters could create the path | Treat content as untrusted; allowlisted tools, isolation, policy tests |
| Malicious tool output | Agent recommendations; compromised connector | No external agent tools exist | Planned integrations could introduce forged data/actions | Signed adapters, schema validation, least privilege, provenance |
| Telemetry tampering | Evidence/trust; altered input signal | Rule checks, integrity score, anomalies, evidence warning, review requirement | Configured checks can miss realistic attacks | Independent sources, attestation, adversarial evaluation |
| Stale/missing/conflicting evidence | Decision confidence; feed outage or replay | Freshness/status fields, missing/conflict evidence, uncertainty and review policy | Synthetic timestamps do not model real replay/clock failure | Temporal validation, source SLAs, monotonic sequence/attestation |
| Compromised cyber alert | Trust/action ranking; false alert | Basic source metadata and bounded values | No external source authentication | Signed alert provenance and cross-source corroboration |
| Agent failure/overconfidence | Recommendation safety; code/logic defect | Per-agent exception isolation, failed/skipped records, zero confidence, review | Rule errors without exception can remain plausible | Calibration, diverse checks, formal policy constraints, red teaming |
| Unsafe transfer recommendation | Synthetic planning output; simplified capacity graph | Spare-capacity/status constraints and explicit human review | No travel, specialty, staffing, clinical, consent, or real capacity validation | Rich constraints and authorized operational validation |
| Observability failure | Audit trail; exporter/collector outage | Fail-open execution, status endpoint, trace IDs, no secret exposure | Missing trace may obscure diagnosis; health remains green | Exporter alerts, durable buffering, audit-store policy |
| Dashboard URL injection | Browser/user trust; unsafe `VITE_SIGNOZ_DASHBOARD_URL` | Build-time config and normal link behavior | Public build variable can point to malicious URL if deployment compromised | Strict URL validation/allowlist and rel/noopener tests |
| Secret leakage | OTLP/cloud credentials; Git/log/browser bundle | Scoped env examples, `VITE_*` warning, secret scan, safe status/meta | Pattern scan is not complete; provider/user error | Managed secret scanning, rotation, least privilege, SBOM |
| Simulation denial of service | Public API; repeated expensive requests/large bodies | 1 MiB body cap, bounded lists/ranges, provider controls, one worker | No app authentication/rate limiter; CPU exhaustion possible | Rate limiting, quotas, queue, caching, load testing |
| Dependency/supply-chain compromise | Build/runtime/browser | Lockfile, pinned container runtime, CI checks | No guarantee all advisories/artifacts are verified | Renovation policy, SBOM/signing, provenance, release review |

No real PHI or operational credentials belong in the system. If future data adapters are introduced, privacy, authorization, tenant isolation, audit, retention, and incident response require a new threat model.

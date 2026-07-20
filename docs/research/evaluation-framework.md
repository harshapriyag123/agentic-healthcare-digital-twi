# Evaluation framework

| Dimension | Research question | Metric / method | Acceptance criterion | Current evidence | Future study |
|---|---|---|---|---|---|
| Functional correctness | Do routes/models/services satisfy contracts? | Unit/API/UI tests | All required checks pass | pytest/Vitest/CI | Independent artifact reproduction |
| Determinism | Are modeled outputs stable for identical inputs? | Repeat result vectors excluding IDs/time | Exact modeled equality | Deterministic code and regression tests | Cross-platform/release study |
| Scenario sensitivity | Do scenarios respond differently? | Risk, resilience, states, integrity, decisions, counterfactual vectors | Not identical; expected qualitative ordering | Backend distinctiveness tests | Sensitivity/ablation analysis |
| Agent consistency | Are thresholds/evidence/failure policies stable? | Decision and injected-failure tests | Correct actions; failures explicit/safe | Agent tests | Property-based and mutation tests |
| Counterfactual distinctiveness | Are candidates exact-baseline and meaningfully different? | Baseline equality, deltas, applicability | Baseline exact; safe candidates evaluated | Counterfactual tests | Monte Carlo/cross-model comparison |
| Trust calibration | Does score correspond to justified trust? | Calibration/error study against expert labels | To be defined with experts | Factor arithmetic/policy tests only | Expert-labeled calibration study |
| Evidence traceability | Can decisions resolve evidence and parents? | Reference completeness and lineage audit | No unexplained references or explicit partial warning | Trust API/tests | Tamper-evident provenance evaluation |
| Human-review correctness | Are risky/incomplete cases flagged? | Scenario/failure policy matrix | All defined policy cases flag correctly | Trust/agent tests | Human-factors and false-positive study |
| Failure safety | Do component/export failures avoid unsafe success? | Fault injection and recovery | Failed records, constrained output, no silent authorization | Agent/telemetry tests | Chaos/load/security exercises |
| Observability completeness | Can one run be correlated? | Required span/attribute/log/metric checklist | Trace links intended workflow | Instrumentation/tests; local trace context | Verified SigNoz completeness/retention study |
| Latency | Is interaction demo-usable? | p50/p95 run/counterfactual duration | Define per target environment | Response duration exposed; no benchmark claim | Controlled load/scale benchmark |
| Accessibility | Can non-map/keyboard users access state? | WCAG audit, keyboard/screen-reader tasks | Target WCAG 2.2 AA where feasible | Semantic tables/fallbacks/tests; no audit | Independent accessibility review |
| Usability | Can reviewers understand uncertainty/action limits? | Task success, time, comprehension | Pre-register study thresholds | Demo script and explanatory UI | Judge/practitioner study |

Completed automated evidence must not be relabeled as clinical validation, causal evidence, usability evidence, security assurance, or regulatory compliance.

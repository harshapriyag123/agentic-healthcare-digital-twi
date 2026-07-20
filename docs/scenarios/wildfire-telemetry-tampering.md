# Wildfire + Telemetry Tampering

> **Primary demo scenario. Synthetic data only.** No condition, facility, or result represents live operations.

## Purpose and initial conditions

This 18-hour trust-focused scenario combines smoke/heat pressure with adversarial evidence degradation. Inputs are demand multiplier 1.15; heat index 108; flood severity 0; air quality index 220; grid outage probability 0.20; telemetry-tampering attack severity 0.55 targeting `HOSP-DFW-004`; telemetry tampering 0.75; and missing telemetry 0.35.

It is the primary demo because one execution visibly connects a physical hazard, targeted cyber/evidence pressure, integrity-agent constraint, trust degradation, human review, telemetry-verification counterfactual, and trace correlation.

## Expected guide

- Hazard: wildfire is represented through extreme smoke/air quality and heat; there is no fire-spread model.
- Cyber/integrity: high configured tampering plus missing signals should produce suspected-tampering/conflict/missing evidence, lower telemetry integrity, and warnings.
- Hospitals: target `HOSP-DFW-004` should show cyber/integrity effects; graph neighbors show regional propagation. Read current states instead of promising a fixed critical count.
- Agents: the detector assesses compound pressure; the Telemetry Integrity Agent should select `quarantine-and-require-human-review` when integrity is below 0.65; planner confidence is constrained by trust; the orchestrator records human review.
- Human review: expected because evidence integrity is intentionally degraded and policies prevent automatic acceptance.
- Most useful intervention: **Telemetry Verification**; Combined Intervention can show broader trade-offs if time permits.
- Trust: expected to be the lowest/most constrained of the three configured scenarios, with evidence-improvement actions and integrity/policy review reasons.
- SigNoz: filter scenario `wildfire-telemetry`, simulation ID, `agent.execute` for the integrity agent, trust calculation spans, and telemetry-verification counterfactual work.

## Demo invariants

Use the committed JSON without editing. Hospital names/catalog relationships and modeled values remain stable for the same input; UUIDs, timestamps, duration, and trace identifiers vary. If an implementation change alters thresholds, update this guide and tests together.

## Interpretation and limitations

Integrity findings are deterministic rule checks against configured synthetic signals. They are not ML anomaly detection, forensic verification, signed provenance, or a live cyber defense. Telemetry Verification is a model transformation, not proof that a real feed can be restored.

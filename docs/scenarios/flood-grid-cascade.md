# Flood Grid Cascade

> Synthetic scenario. No condition, facility, or result represents live operations.

## Purpose and initial conditions

This 48-hour infrastructure scenario studies cascading power/dependency pressure and bounded regional capacity transfers. Configured inputs are demand multiplier 1.20; heat index 92; flood severity 0.90; air quality index 70; grid outage probability 0.80; credential-abuse severity 0.25 targeting `HOSP-DFW-004`; telemetry tampering 0.15; and missing telemetry 0.20.

The hospital catalog supplies synthetic capacity, occupancy, criticality, dependencies, referral neighbors, and coordinates. Grid/fuel dependencies raise pressure across facilities; the targeted facility also receives modeled cyber loss.

## Expected guide

- Hazard: severe flood plus high grid-outage probability.
- Cyber/integrity: lower-severity credential abuse; telemetry is incomplete but less adversarial than the wildfire scenario.
- Hospitals: states and transfers vary by graph position/capacity; inspect `HOSP-DFW-004` and referral neighbors rather than memorizing an exact count.
- Agents: compound detector should explain joint pressure; integrity agent should reflect incomplete/degraded evidence; planner should respond to calculated regional risk; the response record requires review when risk/action policy warrants it.
- Most useful intervention: **Backup Power Activation**; surge/rerouting may expose capacity trade-offs.
- Trust: completeness is reduced by missing telemetry, but integrity should be stronger than Wildfire + Telemetry Tampering.
- SigNoz: filter scenario `flood-grid-cascade`; show `digital_twin.run`, `agent.execute`, trust work, and backup-power counterfactual spans.

Expected invariants are scenario identity, grid/flood dominance, distinct outcome vector, agent explanations tied to calculated values, and an exact stored baseline for counterfactual comparison. UUIDs, timestamps, durations, and trace IDs change every run.

## Interpretation and limitations

Backup power is a bounded parameter transformation, not a validated generator/fuel model. Dependencies are simplified graph relationships; flooding has no hydraulic or road-network model. Transfers are simulated planning estimates requiring authorized human review.

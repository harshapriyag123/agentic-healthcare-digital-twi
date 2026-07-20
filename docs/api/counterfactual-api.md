# Counterfactual API

`GET /api/v1/counterfactuals/interventions` returns the implemented baseline, Network Segmentation, Backup Power Activation, Surge Capacity Expansion, Ambulance Rerouting, Telemetry Verification, and Combined Intervention definitions with mechanism, applicability, delay, complexity, and safety constraints.

`POST /api/v1/counterfactuals/run` requires a simulation ID from the same live API process and one to six unique candidates:

```json
{
  "simulation_id": "replace-with-current-simulation-id",
  "interventions": [
    {"intervention_id":"telemetry-verification","parameters":{"integrity_recovery_level":0.9}},
    {"intervention_id":"network-segmentation","parameters":{"cyber_loss_reduction":0.65}}
  ],
  "include_hospital_states": true,
  "include_transfer_plans": true
}
```

Unknown/expired baselines return 404; duplicate, unknown, or invalid candidates/parameters return 422. Individual evaluation errors may instead appear as failed outcomes so other candidates remain inspectable.

The response includes comparison/scenario IDs, the exact stored baseline, candidate outcome metrics, hospital/transfer details when requested, deltas, trade-offs/warnings, server ranking, recommendation, default ranking weights, optional trace ID, partial warnings, and limitations. All candidates require human authorization.

Transformations modify bounded model parameters and rerun the same simulation/trust logic. Ranking balances normalized risk, resilience, critical-hospital, unserved-demand, trust/confidence benefits against transfer burden, delay, complexity, and safety. Frontend weight controls recalculate priority over existing outcomes: **changing ranking weights changes prioritization, not simulated outcomes**. This is deterministic sensitivity analysis inside a simplified model, not causal validation.

# Simulation and catalog API

## Catalogs

`GET /api/v1/scenarios` returns objects with `id`, `name`, `category`, `description`, `tags`, `severity`, and a complete validated `request`. `GET /api/v1/scenarios/{id}` returns one or `404 {"detail":"Scenario not found"}`. `GET /api/v1/hospitals` returns synthetic identifiers, names, coordinates, bed counts, occupancy/readiness, backup hours, referral neighbors, and critical dependencies.

## Run simulation

`POST /api/v1/simulations/run`

```json
{
  "scenario_name": "wildfire-telemetry",
  "horizon_hours": 18,
  "demand_multiplier": 1.15,
  "hazard": {"heat_index": 108, "flood_severity": 0, "air_quality_index": 220, "grid_outage_probability": 0.2},
  "cyber_event": {"target_hospital_id": "HOSP-DFW-004", "severity": 0.55, "attack_type": "telemetry-tampering", "telemetry_tampering": 0.75},
  "missing_telemetry_ratio": 0.35,
  "enable_counterfactuals": true
}
```

Validation: horizon 1–168 hours; demand 0.5–3; heat index 40–150; AQI 0–500; probability/fraction values 0–1 except missing ratio max 0.9; target must exist in the synthetic hospital catalog. Unknown targets return 422.

The response contains `simulation_id`, `scenario_name`, calculated regional risk/resilience, `affected_hospitals`, bounded `transfer_plan`, evidence, agent decisions, compact default counterfactuals, backend `explanation`, rich `trust`, optional `trace_id`, and `duration_ms`. Example excerpt (values shown are structural, not a promise for future model versions):

```json
{
  "simulation_id": "00000000-0000-4000-8000-000000000000",
  "scenario_name": "wildfire-telemetry",
  "regional_risk_score": 0.5,
  "resilience_score": 0.4,
  "affected_hospitals": [{"hospital_id":"HOSP-DFW-001","status":"degraded","disruption_probability":0.5}],
  "agent_decisions": [{"agent":"telemetry-integrity-agent","action":"quarantine-and-require-human-review","human_review_required":true}],
  "explanation": "The regional twin estimates ... All actions ... require authorized human approval.",
  "trace_id": null
}
```

The real response contains all fields defined in OpenAPI; omitted arrays/fields above are intentional brevity. Same request/model version yields the same modeled results, excluding IDs, timestamps, tracing, and timing. `digital_twin.run` is the primary domain span.

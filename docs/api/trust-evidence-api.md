# Trust and evidence API

`GET /api/v1/trust/{simulation_id}` returns the final trust/evidence/agent view for a simulation stored in the current process. Missing/expired IDs return `404 {"detail":"Simulation not found in this server process"}`.

Top-level fields are `simulation_id`, `scenario_name`, `trust`, `evidence`, `agent_decisions`, `trace_id`, `partial`, and `warnings`. `partial=true` means an agent referenced an evidence ID absent from the returned inventory; it does not silently fill the gap.

The `trust` record includes core completeness/integrity/uncertainty/coverage/policy/confidence fields, trust score, reliability/provenance/freshness/consistency, factor contributions, review reasons, warnings, passed/failed checks, improvement actions, policy checks, anomalies, and calculation version. Evidence items expose source metadata, signal/value/unit, reliability/confidence, integrity/provenance/freshness states, times/scope, hospital/scenario/agent relationships, parents, warnings, and validations.

```bash
curl --fail-with-body "http://127.0.0.1:8000/api/v1/trust/$SIMULATION_ID"
```

This endpoint provides basic metadata lineage and deterministic integrity/policy checks. It does not provide signed provenance, immutability, ML anomaly detection, identity/approval records, or proof that evidence is true. Use its `trace_id` plus simulation ID to correlate trust calculation and agent execution in SigNoz.

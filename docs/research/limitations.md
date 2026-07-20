# Limitations and safety boundary

> Research decision-support prototype using synthetic data. Outputs are simulated estimates intended for authorized human review and are not clinical, cybersecurity, transfer, infrastructure-control, or emergency-response instructions.

- Synthetic hospital, hazard, cyber, telemetry, and dependency data only; no patient data or live monitoring.
- Simplified hospital capacity, occupancy, demand, patient redistribution, infrastructure graph, cyber-loss, hazard-fusion, and intervention models.
- Rule-based deterministic agents and integrity checks; no LLM reasoning, ML anomaly detection, empirical confidence calibration, or formal verification.
- No clinical validation, operational trial, validated intervention-effect estimate, causal guarantee, or guaranteed resilience improvement.
- No clinical/transfer/emergency authorization, hospital control, emergency-service integration, identity/approval workflow, or real incident response.
- Basic metadata evidence lineage only; no cryptographic provenance, immutable ledger, source attestation, or forensic verification.
- No regulatory certification, medical-device approval, HIPAA compliance claim, security certification, or production healthcare readiness.
- Process-local bounded simulation history; restart/redeploy loses IDs and multiple workers cannot share baselines.
- No authentication or application rate limiter on the public-demo API; input bounds and provider controls are partial mitigations.
- External map tiles can fail; SigNoz access, ingestion, retention, and dashboard availability depend on configuration/service plans.
- Free-tier cloud deployments can cold-start and provide no uptime, backup, disaster-recovery, or multi-region guarantee.
- Accessibility includes semantic controls/tables and a non-map fallback but has not received an independent WCAG audit; map, dense tables, focus behavior, and charts need specialist review.
- Automated tests establish selected functional invariants only, not correctness against real healthcare outcomes or adversarial security.

These limits must remain linked from the README, demo, submission copy, and application. Future work does not erase them without evidence.

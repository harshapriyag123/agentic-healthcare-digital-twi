# Click-by-click demo runbook

## Before

- Choose mode: verified cloud, local full, or clearly labeled backup recording/screenshots.
- Check frontend, `GET <backend>/health`, `/ready`, and `/health/observability`; do not treat observability-disabled as API failure.
- Load the map and confirm tiles; keep the Hospital Impact table available.
- Open tabs in order: app Overview, Command Center, Agent Console, Counterfactuals, Trust & Evidence, SigNoz trace search, Architecture.
- Clear/reload browser session state, select Wildfire + Telemetry Tampering, run one rehearsal, copy its trace ID, and confirm telemetry visibility where configured.
- Set browser zoom near 90–100%, fit the projector, silence notifications, close personal tabs, and keep a terminal ready with health and curl commands.

## During

1. Overview: state the safety boundary.
2. Command Center: select Wildfire + Telemetry Tampering; point to tampering/missing telemetry; click **Run Simulation** once.
3. Point to actual risk/resilience, simulation ID, trace ID, and backend explanation. Avoid memorized exact scores.
4. GIS: **Fit hospitals**, select the targeted or critical facility, inspect details, then close.
5. Agent Console: select Telemetry Integrity Agent; point to evidence, warning/review, confidence, trace/span IDs.
6. Counterfactuals: select Telemetry Verification and applicable defaults; run once; point to baseline, trust/risk change, transfer burden, and rank.
7. Trust & Evidence: point to version, integrity band, review reasons, contributions, and one evidence lineage item.
8. SigNoz: search the copied trace ID; show request, twin, agent, trust, and counterfactual work if received; return to the app via the prepared tab.
9. Close with the exact sentence in [demo script](demo-script.md).

Do not call synthetic hospitals real, call agents autonomous operators, claim cryptographic provenance, claim causal validity, or present a stored artifact as a live run.

## After

Record the simulation and trace IDs, capture only sanitized screenshots, note timing/failures, restore the primary scenario and starting tab, and avoid retaining private SigNoz URLs or tokens in submission material.

# Heatwave Ransomware

> Synthetic scenario. No condition, facility, or result represents live operations.

## Purpose and initial conditions

This 24-hour cyber-physical scenario studies simultaneous demand surge and capacity loss. Inputs are demand multiplier 1.35; heat index 112; flood severity 0.10; air quality index 155; grid outage probability 0.35; ransomware severity 0.85 targeting `HOSP-DFW-002`; telemetry tampering 0.20; and missing telemetry 0.10.

The high demand multiplier and ransomware severity should make overload and cyber loss more prominent than in the flood scenario, especially at the target and constrained referral facilities.

## Expected guide

- Hazard: extreme heat and degraded air quality with moderate grid pressure.
- Cyber/integrity: severe ransomware; limited configured telemetry manipulation and missingness.
- Hospitals: higher load/capacity pressure and critical/degraded states are expected; exact counts should be read from the current response.
- Agents: compound pressure should escalate when its threshold is crossed; planning should discuss regional risk and bounded transfer count; all consequential actions remain review-only.
- Useful interventions: **Network Segmentation**, **Surge Capacity Expansion**, and **Ambulance Rerouting**. Each exposes different risk, capacity, delay, transfer, and operational-cost trade-offs.
- Trust: evidence completeness/integrity should generally exceed the wildfire/tampering case even when operational risk is high, illustrating that risk and trust are different axes.
- SigNoz: filter scenario `heatwave-ransomware`, target hospital attribute, `agent.execute`, and network/surge/rerouting counterfactual spans.

Stable behavior means the same input produces the same modeled numeric state, excluding IDs/timing/trace context. Ranking weights may reorder candidates but cannot change these outcomes.

## Interpretation and limitations

Ransomware is represented as bounded operational capacity loss; there is no malware, network topology, recovery workflow, or adversary simulation. Demand is a simplified multiplier, not patient-flow forecasting. Recommendations are not cybersecurity or transfer instructions.

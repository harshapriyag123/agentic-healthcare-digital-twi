# Judge demo scripts

Primary scenario: **Wildfire + Telemetry Tampering**. Recommended mode: live cloud after health rehearsal; use local full demo when public hosting or SigNoz access is uncertain; use clearly labeled recording/screenshots only as the safe backup.

## Three-minute script (target 2:45)

| Time | Exact narration | Exact action and expected response | Slow-response backup / transition |
|---|---|---|---|
| 0:00–0:18 | “Healthcare disruptions compound: wildfire smoke can increase demand while manipulated telemetry makes the response itself less trustworthy. GeoTwin Sentinel is a synthetic-data research prototype for testing that decision problem—not an autonomous hospital controller.” | Start on **Overview**. Point to synthetic-data banner and capability cards. | “Everything shown is a bounded simulation for authorized human review.” Select **Command Center**. |
| 0:18–0:35 | “A React geospatial command center calls one FastAPI digital twin. The same run feeds the GIS, agents, counterfactuals, trust model, and OpenTelemetry.” | Open **Command Center**; choose **Wildfire + Telemetry Tampering**. Scenario details show smoke/tampering inputs. | If catalogs load slowly: “The architecture view remains available while the API wakes.” |
| 0:35–0:58 | “I’ll run a deterministic input with severe smoke, configured telemetry tampering, and missing signals.” | Click **Run Simulation** once. Wait for success. Point to actual simulation ID, regional risk/resilience, backend explanation, and trace ID. | “The hosted backend may be waking. While it finishes, notice that loading is explicit rather than replaced by cached results.” If still blocked, use recovery guide. |
| 0:58–1:22 | “The map turns regional calculations into hospital-level state: capacity, demand, cyber loss, dependency pressure, and disruption probability remain inspectable.” | Fit hospitals; select the target/critical marker; open hospital details. Point to status plus numeric evidence, then close. | If tiles fail, use **Hospital Impact** table: “The table is the accessible non-map equivalent.” Open **Agent Console**. |
| 1:22–1:43 | “These are transparent rule-based agents. The integrity agent sees degraded evidence, constrains the recommendation, and requires human review; the response orchestrator never executes an action.” | In **Agent Console**, select Telemetry Integrity Agent; point to status, action, confidence, evidence dependencies, and trace/span IDs. | “A component failure becomes an explicit failed record and downstream work fails safe.” Open **Counterfactuals**. |
| 1:43–2:08 | “Counterfactuals rerun the same evaluator against the exact baseline. I’ll compare telemetry verification and the applicable controls.” | Select **Telemetry Verification** (plus defaults if time), click **Run selected counterfactuals**. Point to risk/trust deltas and ranking. | “Ranking weights change prioritization, not simulated outcomes.” If lookup expired, rerun the scenario and return. |
| 2:08–2:31 | “Trust is not a decorative score. Versioned factor contributions link to evidence lineage, integrity checks, policy results, anomalies, and specific reasons for human review.” | Open **Trust & Evidence**. Point to trust band, integrity, review banner, evidence inventory, and one warning/lineage record. | “This is metadata lineage and rule-based integrity assessment—not cryptographic provenance or ML anomaly detection.” |
| 2:31–2:43 | “The simulation trace ID correlates API, twin, agent, trust, and counterfactual work in SigNoz, making observability part of the trust story.” | Open configured SigNoz link/tab and filter by trace ID. | If unavailable: “Telemetry access is delayed or private, so I’ll use the visible trace ID and architecture flow without claiming a live trace.” |
| 2:43–2:45 | “GeoTwin Sentinel makes compound-risk recommendations spatial, comparable, evidence-linked, observable, and explicitly subject to authorized human review.” | Return to app overview/command center. | Exact final sentence; stop. |

Leave the remaining 15 seconds for loading variability. Never click Run twice, imply real data, or call a ranking an authorized action.

## Five-minute script

Use the same exact opening and closing. Optional cut points are marked.

| Time | Narration and action |
|---|---|
| 0:00–0:30 | Use the three-minute opening; identify compound physical, infrastructure, cyber, and evidence risk. |
| 0:30–0:55 | On **Architecture**, trace browser → API → twin/agents/counterfactual/trust → OTel/SigNoz. Explain packaged synthetic inputs and process-local history. **Cut here** by returning to Command Center. |
| 0:55–1:30 | Select Wildfire + Telemetry Tampering, state the deterministic input values qualitatively, run once, and point to simulation/trace IDs and backend explanation. |
| 1:30–2:10 | On GIS, fit facilities and open the target hospital. Explain load, effective capacity, dependency pressure, cyber loss, and risk. Use table if map tiles fail. |
| 2:10–2:45 | On Agent Console, inspect detector, integrity agent, planner, and orchestrator. Emphasize rule-based execution, evidence IDs, confidence limits, and failure isolation. **Cut here** by summarizing the last two records. |
| 2:45–3:30 | Run Telemetry Verification plus one applicable candidate. Compare baseline/outcomes, hospital diffs, transfer burden, safety warnings, and ranking. Move one ranking slider and state that only priority changes. |
| 3:30–4:10 | On Trust & Evidence, show version, factor contributions, evidence detail/lineage, policy checks, anomaly warning, and review rationale. Distinguish lineage from cryptographic provenance. |
| 4:10–4:35 | In SigNoz, search the trace ID and show API → digital twin → agents/trust/counterfactual spans. If access is unavailable, show the Observability panel and diagram honestly. **Cut here** if time. |
| 4:35–4:50 | Return to Architecture. State the research questions: compound-twin representation, evidence-dependent confidence, counterfactual prioritization, and observability for audit. |
| 4:50–5:00 | State limitations, then use the exact three-minute closing sentence. |

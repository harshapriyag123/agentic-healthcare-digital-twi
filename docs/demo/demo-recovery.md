# Demo failure recovery

| Symptom | Likely cause | Immediate demo-safe response | Honest backup | Post-demo fix |
|---|---|---|---|---|
| Health/call waits on first request | Free-tier cold start | “The hosted backend is waking from a free-tier cold start. While it initializes, I’ll show the architecture and exact simulation flow.” | Architecture tab; then retry health once | Inspect provider events; consider always-on plan |
| Simulation error/timeout | API unavailable, validation, network | Keep error visible briefly; explain explicit fail state | Local demo or labeled recording; never invent output | Correlate request logs/trace; rerun smoke test |
| Blank/broken map | Tile/CSP/WebGL outage | “The simulation is independent of tile rendering; this table is the accessible spatial equivalent.” | Hospital Impact table | Check style URL, CSP, WebGL, tile provider |
| Counterfactual 404 | API restarted or different worker | “The baseline is process-local and expired; I’ll rerun the scenario to create a fresh baseline.” | Explain stored comparison screenshot as stored | Keep one worker; add persistence later |
| Counterfactual candidate fails | Isolated model error | Show failed outcome and exclusion from ranking | Compare remaining completed candidates | Inspect candidate span and validation |
| Trust panel missing | No completed baseline / lookup failure | Return to Command Center and confirm a successful current run | Use simulation trust summary | Check simulation ID/store/API response |
| SigNoz telemetry delayed | Batch/export/ingestion delay | “Telemetry receipt is delayed, so I won’t claim this trace is visible yet; the app still exposes its correlation ID.” | Observability diagram and trace ID | Check endpoint, TLS, headers, exporter logs |
| Trace not found | Invalid filter, unsampled/disabled export | Search exact 32-character ID and service | Explain span plan without fabricated trace | Verify OTel enabled/configured and retention |
| Frontend deep-link 404 | Missing host rewrite | Open root URL, then navigate in-app | Prepared root tab | Validate `vercel.json` rewrite |
| CORS browser error | Frontend origin absent | Switch to matched local pair or prepared deployment | Curl API output plus architecture | Correct exact origin and redeploy API |
| Public deployment down | Provider/network outage | “The public deployment is unavailable, so I’m switching to the same locally built artifact.” | Local full demo; labeled recording last | Provider status/logs, smoke and rollback |
| Browser crash | Browser/resource issue | Reopen prepared URLs; resume from last named section | Secondary browser/profile | Reduce tabs/extensions; rehearse recovery |
| Network loss | Venue connectivity | State that live cloud/SigNoz requires network | Local API/UI; stored, labeled video/screenshots | Restore network and revalidate URLs |
| Projector/layout problem | Resolution/zoom | Use browser zoom and table views; avoid map detail | Five key sanitized screenshots | Rehearse at 1280×720 and 1920×1080 |

Never describe cached, recorded, or stored output as a live execution.

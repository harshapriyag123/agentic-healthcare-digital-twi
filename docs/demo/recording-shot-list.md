# Demo recording and screenshot plan

## Main video shot list (2:45–3:00)

| Shot | Duration | Screen/action and narration focus | Crop/transition | Retake when |
|---|---:|---|---|---|
| Title | 5s | Project name, tagline, synthetic prototype | Clean 16:9 card → dissolve | Wrong name/disclaimer absent |
| Problem | 12s | Overview; compound hazard + unreliable evidence | Crop hero | Cursor distracts |
| Scenario | 12s | Select Wildfire + Telemetry Tampering | Zoom scenario panel | Wrong scenario |
| Execute | 22s | Click Run once; show real progress/result IDs | Keep full command center | Error/loading dominates |
| GIS impact | 25s | Fit map, open target hospital | Crop map/detail | Tiles/labels broken |
| Agent timeline | 22s | Select integrity agent; evidence/review | Crop selected record | Text unreadable |
| Counterfactual | 30s | Run verification; compare baseline/rank | Pan outcome then ranking | Baseline/result mismatch |
| Trust overview | 22s | Score, version, factors, review reasons | Crop overview | Empty/partial panel |
| Evidence | 14s | Open one warning and lineage | Tight readable crop | Sensitive URLs visible |
| SigNoz trace | 15s | Search trace ID; show span tree | Hide account details | Trace unrelated/not found |
| Architecture | 10s | Trace system diagram | Slow zoom | Diagram clipped |
| Closing | 6s | Exact closing value + safety footer | Return to title | Over 3:00 |

For a five-minute version, expand architecture, hospital metrics, all agent records, trade-offs, factor contributions, and limitations; keep the same opening/closing.

## Screenshot checklist

Capture PNG at 1920×1080 (also inspect at 1280×720), browser chrome hidden, 100% zoom where legible. Use the primary scenario after a successful current run; remove secrets, personal tabs/emails, local paths, account identifiers, and private dashboard URLs.

| Filename | State/caption | README placement |
|---|---|---|
| `01-landing.png` | Landing page — synthetic research framing and live catalog status | Hero after publication |
| `02-command-center.png` | Crisis Command Center — completed wildfire/tampering run | Capabilities |
| `03-gis-map.png` | Regional GIS — synthetic hospital impact | GIS capability |
| `04-hospital-detail.png` | Hospital detail — state and contributing pressures | Scenario section |
| `05-agent-console.png` | Agent Console — evidence-linked integrity decision | Agent workflow |
| `06-counterfactual-comparison.png` | Baseline versus intervention outcomes | Counterfactual section |
| `07-intervention-ranking.png` | Research prioritization with trade-offs | Counterfactual section |
| `08-trust-overview.png` | Versioned trust factors and human-review policy | Trust section |
| `09-evidence-inventory.png` | Evidence lineage and integrity warning | Trust section |
| `10-signoz-trace.png` | Correlated simulation trace in SigNoz | Observability section |
| `11-signoz-metrics.png` | Synthetic risk/integrity metric dashboard | Observability section |
| `12-architecture.png` | Rendered system architecture | Architecture section |
| `13-cloud-deployment.png` | Verified provider deployment status, no secrets | Deployment section |

Automation was not added because the repository has no Playwright dependency. Manual capture avoids adding a browser framework solely for documentation. All screenshots and the video are currently **pending**.

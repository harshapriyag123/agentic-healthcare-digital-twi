# Judge Q&A

| Question | Concise, honest answer |
|---|---|
| What problem are you solving? | How to reason transparently about regional healthcare infrastructure when climate, infrastructure, cyber, and evidence-quality disruptions compound. |
| Why a digital twin? | It provides a shared, inspectable state model for facility capacity, demand, dependencies, referrals, cyber loss, and interventions. This twin is synthetic and simplified. |
| Why is this agentic? | Specialized rule-based components detect compound pressure, assess evidence integrity, plan bounded responses, and coordinate a review record with explicit evidence and failure policy. |
| What do agents actually do? | They convert calculated context into action categories, confidence, explanations, warnings, and evidence dependencies. They do not execute actions. |
| Is any data real? | No patient or live hospital data. The packaged hospital catalog and every scenario are synthetic research inputs. |
| How are interventions modeled? | Bounded parameter transformations are applied to a copy of the baseline request, then the same evaluator is rerun. |
| Why trust a recommendation? | Do not trust it blindly. Inspect factor contributions, evidence lineage, uncertainty, policies, anomalies, agent records, and the trace; authorized human review remains required. |
| What happens when telemetry is manipulated? | Rule checks reduce integrity/trust, add evidence warnings and review reasons, constrain the integrity agent, and make telemetry verification applicable. |
| What role does SigNoz play? | It correlates the API, twin, agent, trust, and counterfactual execution through traces, metrics, and logs. It improves auditability, not model correctness by itself. |
| How is this more than a dashboard? | A run changes hospital state through a graph simulation, produces agent decisions, evaluates counterfactuals against an exact baseline, and creates evidence/trust records. |
| Does it autonomously control hospitals? | No. There are no integrations or operational permissions, and every output is simulated decision support for authorized review. |
| How do you prevent unsafe recommendations? | Bounded schemas, transfer constraints, evidence policy, review flags, agent failure isolation, and explicit non-operational framing. These reduce risk but do not constitute validated safety. |
| What is technically novel? | The artifact integrates spatial dependency simulation, evidence-dependent agents, counterfactual comparison, versioned trust factors, and OTel auditability in one reproducible workflow. |
| What is the research contribution? | A testbed and evaluation framework for studying compound disruption, evidence dependencies, human-review policy, counterfactual prioritization, and observability as a trust mechanism. |
| What is production-ready? | The repository has deployable demo configuration, health checks, validation, CI, smoke tests, and a non-root container. It is not healthcare-production ready. |
| What remains future work? | Persistence, calibration, probabilistic uncertainty, security hardening, cryptographic provenance, privacy architecture, expert studies, and real-world governance. |
| How would it scale? | First externalize baseline/history state, then add workers/queues and load testing; catalog and graph partitioning would follow for multi-region studies. |
| How could hospitals adopt it? | Only through staged co-design, approved aggregate adapters, calibration, security/privacy review, human-factors evaluation, governance, and regulatory assessment. |
| How do you evaluate correctness? | Existing automated tests cover functional invariants and scenario distinctiveness. Proposed studies address calibration, usability, trust, safety, and latency. |
| How is prompt injection handled? | Current agents accept typed numeric context, not free-form prompts or tools, so that path is absent. Future LLM/tool adapters would need strict isolation and untrusted-content controls. |
| Why should this win? | It is an end-to-end, inspectable implementation: compound scenarios flow through a spatial twin, evidence-aware agents, counterfactuals, explicit review, and full observability, with honest research boundaries. |

## Why this should win

GeoTwin Sentinel connects nine usually separate concerns—compound climate/cyber scenarios, infrastructure dependencies, hospital-level GIS, agent orchestration, counterfactual interventions, evidence-linked trust, human review, OpenTelemetry/SigNoz, and reproducible deployment—into one inspectable artifact. Its value is technical completeness and research extensibility, not a claim of guaranteed health outcomes.

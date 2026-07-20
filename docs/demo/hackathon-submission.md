# Hackathon submission copy

## Identity

**Title:** GeoTwin Sentinel  
**Tagline:** An observable agentic digital twin for healthcare infrastructure resilience under compound disruptions.

Links: source repository (current Git remote) · live demo **pending verification** · video **pending recording** · documentation [`docs/README.md`](../README.md).

## Summary variants

### 50 words

GeoTwin Sentinel is a synthetic-data, geospatial healthcare infrastructure digital twin. It simulates compound climate, infrastructure, cyber, and telemetry disruptions; exposes evidence-linked rule-agent decisions; compares counterfactual interventions; requires human review; and correlates the workflow with OpenTelemetry and SigNoz. It is a research prototype, not an operational healthcare controller.

### 100 words

GeoTwin Sentinel explores a difficult resilience question: what happens when hospitals face physical hazards, infrastructure dependencies, cyber disruption, and unreliable telemetry at once? Its FastAPI digital twin evaluates a synthetic regional hospital graph and powers a React GIS command center. Deterministic agents detect compound pressure, assess telemetry integrity, and propose bounded recommendations for authorized review. A counterfactual explorer reruns interventions against the exact baseline, while a versioned trust dashboard exposes factor contributions, evidence lineage, policy checks, and uncertainty. OpenTelemetry traces, metrics, and logs make the complete workflow inspectable in SigNoz. It is not clinically or operationally validated.

### 250 words

Regional healthcare resilience is a compound-systems problem. A wildfire, flood, or heatwave may raise demand while power dependencies, ransomware, or manipulated telemetry reduce capacity and confidence in the response. GeoTwin Sentinel turns that problem into an inspectable synthetic experiment.

The application combines a FastAPI geospatial digital twin with a React Crisis Command Center. Three deterministic scenarios drive a five-hospital synthetic dependency and referral graph. The engine calculates hospital demand, effective capacity, cyber loss, dependency pressure, disruption probability, regional risk, resilience, and bounded transfer suggestions.

Specialized rule-based agents detect compound pressure, assess telemetry integrity, and plan regional readiness. Every decision exposes confidence, explanation, evidence dependencies, human-review status, and trace context. The Counterfactual Explorer applies bounded interventions—such as network segmentation, backup power, surge capacity, rerouting, and telemetry verification—then reruns the same evaluator against the exact baseline. Rankings make benefits and trade-offs visible; changing ranking weights never changes simulated outcomes.

The Trust and Evidence Dashboard records versioned factor contributions, evidence inventory and lineage, freshness, consistency, anomalies, policy checks, uncertainty, and reasons for authorized human review. OpenTelemetry instruments API, simulation, agent, counterfactual, and trust work for trace, metric, and log analysis in SigNoz.

GeoTwin Sentinel is deployable as a non-root Render API and Vercel SPA, with CI, tests, health checks, and smoke validation. It uses synthetic data only. It has no clinical validation, real hospital integration, operational authority, or validated causal intervention effects.

## Full Devpost-style draft

### Inspiration

Healthcare infrastructure is usually monitored in separate views: weather, power, hospital capacity, cyber alerts, and application telemetry. Real disruption can cross all of them. We wanted a research artifact that makes compound effects, evidence quality, intervention trade-offs, and agent execution inspectable in one place.

### What it does

GeoTwin Sentinel runs three synthetic regional scenarios: Flood Grid Cascade, Heatwave Ransomware, and Wildfire + Telemetry Tampering. A graph-based digital twin estimates hospital and regional state. A GIS view explains spatial impact; an Agent Activity Console exposes detection, security, planning, and orchestration records; a Counterfactual Explorer compares interventions; and a Trust Dashboard shows evidence, policies, uncertainty, and human-review reasons. Each run returns a trace ID for correlation in SigNoz.

### How it was built

The backend uses FastAPI, Pydantic, NetworkX, packaged JSON/GeoJSON catalogs, and OpenTelemetry. The frontend uses React, TypeScript, Vite, and MapLibre. pytest/Vitest/Ruff/ESLint/type checks and a deployment smoke script validate behavior. Docker runs the API as a non-root user; Render and Vercel files define the reference cloud topology; OTLP connects to SigNoz.

### Challenges

The main challenge was keeping one baseline consistent across GIS, agents, counterfactuals, and trust while preserving explainability. A second was degrading safely when telemetry or an agent is unreliable. A third was making observability domain-relevant without making export availability a dependency of the simulation.

### Accomplishments

- End-to-end scenario-to-trace workflow rather than disconnected mock screens.
- Distinct scenario results from one simulation engine.
- Evidence-linked agent records and explicit failure isolation.
- Exact-baseline counterfactual comparison with visible trade-offs.
- Versioned trust contributions and basic evidence lineage.
- Vendor-neutral observability and deployable demo configuration.

### What we learned

Observability can be more than operations plumbing: correlation identifiers, execution spans, structured decision records, and evidence-quality metrics help reviewers audit an agentic workflow. We also learned that a trustworthy demo must foreground what the model cannot establish—especially causal validity and operational authority.

### What is next

Persistent experiment history, probabilistic uncertainty, calibrated data adapters, policy-constrained planning, cryptographic evidence provenance, privacy-preserving telemetry, multi-region studies, formal threat testing, and expert-in-the-loop evaluation.

### Technology stack

React, TypeScript, Vite, MapLibre GL, FastAPI, Pydantic, NetworkX, OpenTelemetry, SigNoz, pytest, Vitest, Ruff, Docker, Render, Vercel, and GitHub Actions.

### Safety disclaimer

Research decision-support prototype using synthetic data. Outputs are simulated estimates intended for authorized human review and are not clinical, cybersecurity, transfer, infrastructure-control, or emergency-response instructions.

## Reusable pitches

**One sentence:** GeoTwin Sentinel is an observable agentic geospatial digital twin for comparing healthcare infrastructure responses to compound climate, cyber, and telemetry disruptions using synthetic data and explicit human review.

**15 seconds:** When hazards and cyber incidents compound, the evidence can fail too. GeoTwin Sentinel simulates a synthetic hospital network, exposes what its agents saw, compares interventions, and traces the whole decision workflow in SigNoz for human review.

**30 seconds:** GeoTwin Sentinel is a geospatial healthcare infrastructure digital twin for compound disruptions such as wildfire plus telemetry tampering. It calculates hospital impact, runs transparent rule-based agents, compares bounded counterfactual interventions, and explains trust through evidence lineage and policy checks. OpenTelemetry and SigNoz make every stage auditable. It is a synthetic research prototype, not a hospital controller.

**60 seconds:** Regional healthcare disruption can combine physical hazards, grid dependencies, cyber loss, demand surge, and unreliable telemetry. GeoTwin Sentinel puts those pressures into one synthetic geospatial digital twin. The command center shows hospital-level state and dependencies. Rule-based agents detect compound pressure, assess integrity, and propose bounded actions with evidence and confidence. The counterfactual explorer reruns interventions against the exact baseline and shows benefits and trade-offs. The trust dashboard exposes factor contributions, evidence lineage, uncertainty, policy checks, and human-review reasons. OpenTelemetry correlates the API, simulation, agents, trust, and counterfactuals in SigNoz. This is a deployable, testable research artifact—not a clinically validated or autonomous system.

**Three minutes:** Use the exact timed script in [`demo-script.md`](demo-script.md); keeping one canonical version prevents narrative drift.

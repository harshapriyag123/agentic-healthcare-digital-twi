# GeoTwin Sentinel

> **Agentic Digital Twin for Secure, Trustworthy and Observable Healthcare Infrastructure**

GeoTwin Sentinel is a research-oriented, geospatial digital twin that models how hospitals, referral networks, shared infrastructure, environmental hazards, cyber incidents and AI agents interact during regional healthcare disruptions.

It is designed for the SigNoz hackathon and as the foundation of a publishable research study. Every simulation emits OpenTelemetry traces and metrics so SigNoz can expose the complete evidence-to-decision lineage.

## Why this is different

Most observability systems detect that a service failed. GeoTwin Sentinel asks a harder public-impact question: **how will a cyber-physical failure cascade across a regional healthcare network, which communities may lose access, and which constrained intervention improves resilience without hiding uncertainty?**

## Implemented research capabilities

- directed graph model for hospitals, referral links and shared dependencies;
- compound hazard fusion: heat, air quality, flood, grid and cyber disruption;
- graph-centrality-weighted regional risk and resilience scores;
- multi-agent workflow: detection, telemetry-integrity and resilience planning;
- adversarial telemetry tampering and missing-data simulation;
- bounded patient redistribution using spare-capacity and safety constraints;
- counterfactual intervention comparison;
- explicit evidence, uncertainty, provenance, policy and human-review records;
- OpenTelemetry-native traces and custom metrics for SigNoz;
- reproducible synthetic scenarios and automated tests.

## Architecture

```text
Aggregate/public data + synthetic scenarios
                 │
                 ▼
      Evidence & integrity assessment
                 │
                 ▼
 Geospatial dependency/referral graph twin
                 │
        ┌────────┼─────────┐
        ▼        ▼         ▼
 Detection   Security   Planning agents
        └────────┼─────────┘
                 ▼
 Trust record + counterfactual interventions
                 │
                 ▼
 OpenTelemetry → Collector → SigNoz
```

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8000/docs`.

Run the flagship scenario:

```bash
curl -X POST http://localhost:8000/api/v1/simulations/run \\
  -H 'Content-Type: application/json' \\
  --data @scenarios/heatwave-ransomware.json
```

## API

- `GET /api/v1/health`
- `GET /api/v1/hospitals`
- `POST /api/v1/simulations/run`

## Research framing

**Working paper:** *GeoTwin Sentinel: An Observable Agentic Digital Twin for Cyber-Resilient Healthcare Infrastructure under Compound Disruptions.*

The evaluation compares threshold monitoring, facility-local prediction, a graph twin without trust controls, and the complete agentic system. Planned metrics include disruption AUROC/F1, warning lead time, calibration error, unsafe-action rate, resilience gain and trace completeness.

See [`research/RESEARCH_PLAN.md`](research/RESEARCH_PLAN.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## Safety boundary

This software uses synthetic or aggregate infrastructure data. It is not a medical device and must not perform patient-specific diagnosis, treatment, triage or autonomous emergency dispatch. Every operational recommendation requires authorized human review.

## License

Apache-2.0.

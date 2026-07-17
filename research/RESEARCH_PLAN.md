# Research plan

## Working title

**GeoTwin Sentinel: An Observable Agentic Digital Twin for Cyber-Resilient Healthcare Infrastructure under Compound Disruptions**

## Core hypothesis

A trust-aware geospatial digital twin combining infrastructure dependencies, environmental hazards, cyber telemetry and uncertainty will detect cascading regional healthcare disruption earlier and produce safer response plans than isolated threshold monitoring.

## Research questions

- RQ1: Does graph-aware fusion improve disruption detection over independent facility thresholds?
- RQ2: How does telemetry tampering affect recommendation calibration and safety?
- RQ3: Which counterfactual interventions produce the largest resilience gain under compound events?
- RQ4: Can OpenTelemetry traces provide reproducible evidence lineage for agent decisions?

## Experimental baselines

1. fixed capacity thresholds;
2. facility-local logistic risk model;
3. graph-aware digital twin without trust layer;
4. full agentic twin with integrity and counterfactual planning.

## Metrics

AUROC/F1 for disruption detection, warning lead time, expected calibration error, unsafe-action rate, resilience gain, time-to-explanation, trace completeness and robustness under missing/tampered telemetry.

## Dataset strategy

The hackathon uses synthetic DFW facilities. The research phase can integrate public aggregate sources such as HHS hospital capacity, NOAA heat/flood hazards, EPA air quality, FEMA resilience indicators and public cyber incident reports. No protected health information is required.

## Ablations

Remove dependency graph, integrity agent, counterfactual planner, centrality weighting and hazard fusion independently.

## Ethics

This is infrastructure decision support, not clinical decision support. All operational recommendations require authorized human approval and must be evaluated for geographic equity and rural/underserved-area impact.

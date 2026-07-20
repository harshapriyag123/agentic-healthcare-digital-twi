# Data flow

```mermaid
sequenceDiagram
  actor R as Reviewer
  participant UI as React UI
  participant API as FastAPI
  participant T as Digital twin
  participant A as Agent orchestrator
  participant Trust as Trust engine
  participant Store as Process-local store
  participant OTel as OpenTelemetry
  R->>UI: Select scenario and Run Simulation
  UI->>API: POST /api/v1/simulations/run
  API->>T: Validate and evaluate request
  T->>Trust: Initial evidence/trust assessment
  T->>A: Execute detector, integrity, planning
  A-->>T: Decision records
  T->>Trust: Final assessment with agent reliability
  T->>Store: Save request and response
  T->>OTel: Record spans, metrics, structured logs
  API-->>UI: Simulation response + trace_id
  UI-->>R: GIS, states, decisions, trust, explanation
```

Scenario JSON is both the catalog source and the request shape delivered by the browser. Hospital GeoJSON supplies identifiers, coordinates, capacities, dependencies, and referral neighbors. Calculations use only these synthetic packaged inputs. Counterfactual calls reference the stored simulation UUID, transform a copy of its original request, rerun the same evaluator, and compare it with the exact stored response.

No patient records, user identity, browser fingerprint, or personal analytics enter this flow. Standard server access logs may contain request paths; production container access logging is disabled by default.

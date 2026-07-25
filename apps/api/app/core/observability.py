"""Bounded application instruments shared by the simulation components.

Metric dimensions intentionally exclude simulation, trace, hospital, and free-form
request identifiers so a public demo cannot create unbounded time series.
"""

from opentelemetry import metrics

meter = metrics.get_meter("geotwin.application")

simulation_runs = meter.create_counter("simulation_runs_total")
simulation_failures = meter.create_counter("simulation_failures_total")
simulation_duration = meter.create_histogram("simulation_duration_ms", unit="ms")
active_simulations = meter.create_up_down_counter("active_simulations")
agent_executions = meter.create_counter("agent_executions_total")
agent_failures = meter.create_counter("agent_failures_total")
agent_duration = meter.create_histogram("agent_duration_ms", unit="ms")
agent_low_confidence = meter.create_counter("agent_low_confidence_total")
counterfactual_evaluations = meter.create_counter("counterfactual_evaluations_total")
counterfactual_failures = meter.create_counter("counterfactual_failures_total")
counterfactual_duration = meter.create_histogram("counterfactual_duration_ms", unit="ms")
human_review_required = meter.create_counter("human_review_required_total")
trust_score = meter.create_histogram("trust_score")
critical_hospitals = meter.create_histogram("critical_hospitals")
degraded_hospitals = meter.create_histogram("degraded_hospitals")
telemetry_integrity_failures = meter.create_counter("telemetry_integrity_failures_total")
evidence_missing = meter.create_counter("evidence_missing_total")
evidence_stale = meter.create_counter("evidence_stale_total")
api_request_duration = meter.create_histogram("api_request_duration_ms", unit="ms")
api_errors = meter.create_counter("api_errors_total")


def scenario_type(name: str) -> str:
    """Map packaged scenario names to a small, stable metric dimension."""
    normalized = name.lower()
    for value in ("wildfire", "heatwave", "flood"):
        if value in normalized:
            return value
    return "other"


def confidence_band(value: float) -> str:
    if value < 0.4:
        return "low"
    if value < 0.7:
        return "medium"
    return "high"

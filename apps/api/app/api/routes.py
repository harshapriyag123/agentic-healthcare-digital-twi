from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.telemetry import telemetry_status
from app.models.domain import (
    CounterfactualExplorerResponse,
    CounterfactualRunRequest,
    Hospital,
    InterventionDefinition,
    ScenarioCatalogItem,
    SimulationRequest,
    SimulationResponse,
    TrustDashboardResponse,
)
from app.services.catalog import HOSPITALS
from app.services.counterfactuals import intervention_catalog, run_counterfactual_comparison
from app.services.scenarios import get_scenario_by_id, get_scenario_catalog
from app.services.signoz_traces import TraceStoreUnavailable, get_trace_waterfall
from app.services.simulation_store import get_simulation
from app.services.twin import run_simulation

router = APIRouter(prefix="/api/v1")


@router.get(
    "/health",
    tags=["Service"],
    summary="Check API liveness",
    description="Returns liveness and safe public build metadata. Observability export is not a liveness dependency.",
)
def health():
    return {"status": "ok", **settings.public_metadata}


@router.get(
    "/ready",
    tags=["Service"],
    summary="Check catalog readiness",
    responses={503: {"description": "Required packaged synthetic catalogs are unavailable."}},
)
def ready():
    ready_state = bool(HOSPITALS and get_scenario_catalog())
    if not ready_state:
        raise HTTPException(status_code=503, detail="Required synthetic catalogs are unavailable")
    return {
        "status": "ready",
        "catalogs": {"hospitals": len(HOSPITALS), "scenarios": len(get_scenario_catalog())},
    }


@router.get(
    "/health/observability",
    tags=["Service"],
    summary="Inspect safe observability status",
    description="Reports whether OpenTelemetry is enabled/configured without returning endpoints, headers, or secrets.",
)
def observability_health():
    return {"status": "ok", "required_for_readiness": False, **telemetry_status()}


@router.get(
    "/observability/traces/{trace_id}",
    tags=["Service"],
    summary="Read a local SigNoz trace waterfall",
)
def trace_waterfall(trace_id: str):
    try:
        result = get_trace_waterfall(trace_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TraceStoreUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not result["spans"]:
        raise HTTPException(status_code=404, detail="Trace not found in SigNoz")
    return result


@router.get("/meta", tags=["Service"], summary="Read safe deployment metadata")
def metadata():
    return {
        **settings.public_metadata,
        "synthetic_data": True,
        "persistence": "process-local-bounded",
    }


@router.get(
    "/hospitals",
    response_model=list[Hospital],
    tags=["Catalogs"],
    summary="List synthetic hospitals",
)
def hospitals():
    return HOSPITALS


@router.get(
    "/scenarios",
    response_model=list[ScenarioCatalogItem],
    tags=["Catalogs"],
    summary="List executable synthetic scenarios",
)
def scenarios():
    return get_scenario_catalog()


@router.get(
    "/scenarios/{scenario_id}",
    response_model=ScenarioCatalogItem,
    tags=["Catalogs"],
    summary="Get one synthetic scenario",
    responses={404: {"description": "Scenario ID was not found."}},
)
def scenario_detail(scenario_id: str):
    scenario = get_scenario_by_id(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.post(
    "/simulations/run",
    response_model=SimulationResponse,
    tags=["Simulations"],
    summary="Run a compound-disruption simulation",
    description="Validates a synthetic scenario request, evaluates the shared graph digital twin and rule-based agents, records trust/evidence, and returns a trace correlation ID when available.",
    responses={422: {"description": "Schema validation failed or the target hospital is unknown."}},
)
def simulate(request: SimulationRequest):
    try:
        return run_simulation(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get(
    "/counterfactuals/interventions",
    response_model=list[InterventionDefinition],
    tags=["Catalogs", "Counterfactuals"],
    summary="List modeled interventions",
)
def counterfactual_interventions():
    return intervention_catalog()


@router.post(
    "/counterfactuals/run",
    response_model=CounterfactualExplorerResponse,
    tags=["Counterfactuals"],
    summary="Compare interventions with a stored baseline",
    description="Applies bounded transformations and reruns the same evaluator. Outcomes are within-model estimates, not validated causal effects.",
    responses={
        404: {"description": "The process-local baseline was not found or expired."},
        422: {"description": "Interventions or parameters are invalid."},
    },
)
def counterfactual_run(request: CounterfactualRunRequest):
    try:
        return run_counterfactual_comparison(request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get(
    "/trust/{simulation_id}",
    response_model=TrustDashboardResponse,
    tags=["Trust and evidence"],
    summary="Inspect trust, evidence, and agent lineage",
    description="Returns versioned trust factors, basic metadata lineage, deterministic integrity/policy checks, agent records, and human-review reasons. This is not cryptographic provenance.",
    responses={404: {"description": "The process-local simulation was not found or expired."}},
)
def trust_dashboard(simulation_id: str):
    stored = get_simulation(simulation_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Simulation not found in this server process")
    _, response = stored
    missing_references = sorted(
        {
            evidence_id
            for decision in response.agent_decisions
            for evidence_id in decision.evidence_ids
            if evidence_id not in {item.evidence_id for item in response.evidence}
        }
    )
    warnings = [
        f"Agent evidence reference not found: {evidence_id}" for evidence_id in missing_references
    ]
    return TrustDashboardResponse(
        simulation_id=response.simulation_id,
        scenario_name=response.scenario_name,
        trust=response.trust,
        evidence=response.evidence,
        agent_decisions=response.agent_decisions,
        trace_id=response.trace_id,
        partial=bool(warnings),
        warnings=warnings,
    )

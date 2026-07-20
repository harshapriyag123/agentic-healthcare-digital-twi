import logging
from datetime import UTC, datetime
from math import hypot
from uuid import uuid4

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from app.models.domain import (
    CounterfactualExplorerResponse,
    CounterfactualOutcome,
    CounterfactualRanking,
    CounterfactualRecommendation,
    CounterfactualResult,
    CounterfactualRunRequest,
    FacilityStatus,
    InterventionDefinition,
    InterventionParameters,
    InterventionSelection,
    SimulationRequest,
    SimulationResponse,
    TransferAction,
)
from app.services.catalog import HOSPITALS, hospital_map
from app.services.integrity import assess_integrity
from app.services.simulation_store import get_simulation
from app.services.trust import evaluate_trust
from app.services.twin import (
    _evaluate_states,
    _plan_transfers,
    _regional_risk,
    _resilience,
)

logger = logging.getLogger(__name__)
tracer = trace.get_tracer("geotwin.counterfactuals")

DEFAULT_RANKING_WEIGHTS = {
    "risk": 0.28,
    "resilience": 0.16,
    "demand": 0.14,
    "critical_hospitals": 0.10,
    "trust": 0.12,
    "transfer_burden": 0.07,
    "speed": 0.06,
    "complexity": 0.04,
    "safety": 0.03,
}

INTERVENTIONS = {
    definition.id: definition for definition in [
        InterventionDefinition(id="no-intervention", name="No Intervention", category="baseline", description="Preserve the completed simulation exactly as the comparison baseline.", affected_parameters=[], applicable_scenarios=["all"], mechanism="No simulation inputs are transformed.", complexity="low", activation_delay_minutes=0, safety_constraints=["Baseline only; not submitted as a candidate."], executable=True),
        InterventionDefinition(id="network-segmentation", name="Network Segmentation", category="cyber", description="Reduce modeled cyber capacity loss while accounting for short-term coordination overhead.", affected_parameters=["cyber_event.severity", "effective_capacity"], applicable_scenarios=["all scenarios with a cyber event"], mechanism="Reduces attack severity before the same hospital evaluator is rerun.", complexity="moderate", activation_delay_minutes=20, safety_constraints=["Preserve emergency communications", "Authorized cybersecurity approval"], executable=True),
        InterventionDefinition(id="backup-power-activation", name="Backup Power Activation", category="infrastructure", description="Reduce modeled grid exposure for the configured effective backup duration.", affected_parameters=["hazard.grid_outage_probability"], applicable_scenarios=["flood-grid-cascade", "scenarios with grid exposure"], mechanism="Reduces grid-outage pressure before hospital capacity is reevaluated.", complexity="moderate", activation_delay_minutes=15, safety_constraints=["Fuel and generator readiness", "Do not exceed modeled duration"], executable=True),
        InterventionDefinition(id="regional-surge-capacity", name="Regional Surge Capacity", category="capacity", description="Add temporary staffed capacity across the synthetic regional network.", affected_parameters=["effective_capacity"], applicable_scenarios=["all"], mechanism="Applies a staffing-constrained capacity multiplier inside the hospital evaluator.", complexity="high", activation_delay_minutes=90, safety_constraints=["Staffing availability", "Supply and bed constraints"], executable=True),
        InterventionDefinition(id="ambulance-rerouting", name="Ambulance Rerouting", category="transport", description="Redistribute modeled demand from the target facility to referral neighbors with spare capacity.", affected_parameters=["estimated_demand", "transfer_plan"], applicable_scenarios=["all"], mechanism="Applies deterministic demand offsets and reruns hospital risk evaluation.", complexity="moderate", activation_delay_minutes=10, safety_constraints=["Destination spare capacity", "Maximum distance and patient limits"], executable=True),
        InterventionDefinition(id="telemetry-verification", name="Telemetry Verification", category="telemetry", description="Improve modeled evidence integrity while adding verification delay.", affected_parameters=["cyber_event.telemetry_tampering", "missing_telemetry_ratio"], applicable_scenarios=["wildfire-telemetry", "scenarios with degraded telemetry"], mechanism="Reduces missing and tampered telemetry before trust is reassessed.", complexity="low", activation_delay_minutes=30, safety_constraints=["Preserve provenance", "Human validation of recovered signals"], executable=True),
        InterventionDefinition(id="combined-intervention", name="Combined Intervention", category="combined", description="Apply compatible cyber, power, surge, and telemetry controls once with coordination overhead.", affected_parameters=["cyber_event.severity", "hazard.grid_outage_probability", "effective_capacity", "telemetry integrity"], applicable_scenarios=["all"], mechanism="Composes bounded transformations once, then reruns the same evaluator and trust model.", complexity="high", activation_delay_minutes=120, safety_constraints=["Cross-team authorization", "No double-counting of capacity or integrity recovery"], executable=True),
    ]
}

_COSTS = {
    "no-intervention": "No incremental modeled activation cost",
    "network-segmentation": "Moderate synthetic coordination cost",
    "backup-power-activation": "Moderate synthetic fuel and readiness cost",
    "regional-surge-capacity": "High synthetic staffing and supply cost",
    "ambulance-rerouting": "Moderate synthetic transport burden",
    "telemetry-verification": "Low synthetic verification cost",
    "combined-intervention": "High synthetic multi-team coordination cost",
}


def intervention_catalog() -> list[InterventionDefinition]:
    return list(INTERVENTIONS.values())


def _applicable(intervention_id: str, request: SimulationRequest) -> tuple[bool, str | None]:
    if intervention_id == "network-segmentation" and request.cyber_event.severity <= 0:
        return False, "No cyber severity is present in the baseline request."
    if intervention_id == "backup-power-activation" and request.hazard.grid_outage_probability <= 0:
        return False, "No grid-outage exposure is present in the baseline request."
    if intervention_id == "telemetry-verification" and request.cyber_event.telemetry_tampering <= 0 and request.missing_telemetry_ratio <= 0:
        return False, "The baseline does not contain missing or tampered telemetry."
    return True, None


def _unserved(states, transfers: list[TransferAction]) -> float:
    gross = sum(max(0, state.estimated_demand - state.effective_capacity) for state in states)
    served_by_transfer = sum(action.patients for action in transfers if action.safety_constraints_satisfied)
    return round(max(0, gross - served_by_transfer), 2)


def _baseline_outcome(response: SimulationResponse, include_states: bool = True, include_transfers: bool = True) -> CounterfactualOutcome:
    return CounterfactualOutcome(
        intervention_id="no-intervention",
        intervention_name="No Intervention / Baseline",
        category="baseline",
        regional_risk_score=response.regional_risk_score,
        resilience_score=response.resilience_score,
        recommendation_confidence=response.trust.recommendation_confidence,
        telemetry_integrity=response.trust.telemetry_integrity,
        uncertainty=response.trust.uncertainty,
        evidence_completeness=response.trust.evidence_completeness,
        critical_hospital_count=sum(state.status == FacilityStatus.CRITICAL for state in response.affected_hospitals),
        degraded_hospital_count=sum(state.status == FacilityStatus.DEGRADED for state in response.affected_hospitals),
        unserved_demand=_unserved(response.affected_hospitals, response.transfer_plan),
        total_transfer_patients=sum(action.patients for action in response.transfer_plan),
        estimated_operational_cost=_COSTS["no-intervention"],
        estimated_activation_delay_minutes=0,
        complexity="low",
        human_review_required=response.trust.human_review_required,
        transfer_plan_safe=all(action.safety_constraints_satisfied for action in response.transfer_plan),
        hospital_states=response.affected_hospitals if include_states else [],
        transfer_plan=response.transfer_plan if include_transfers else [],
        trade_offs=["Preserves current modeled disruption and unmet demand."],
        warnings=["No intervention is a comparison baseline, not a recommended action."],
    )


def _rerouting_offsets(baseline: SimulationResponse, parameters: InterventionParameters) -> tuple[dict[str, float], list[TransferAction]]:
    source_id = baseline.affected_hospitals[0].hospital_id
    baseline_by_id = {state.hospital_id: state for state in baseline.affected_hospitals}
    source = max(baseline.affected_hospitals, key=lambda state: max(0, state.estimated_demand-state.effective_capacity))
    if max(0, source.estimated_demand-source.effective_capacity) > 0:
        source_id = source.hospital_id
    catalog = hospital_map()
    origin = catalog[source_id]
    remaining = min(parameters.maximum_transfer_patients or 80, int(max(0, source.estimated_demand-source.effective_capacity)))
    maximum_distance = parameters.maximum_transfer_distance_miles or 80
    offsets: dict[str, float] = {}
    transfers: list[TransferAction] = []
    candidates = []
    for neighbor_id in sorted(catalog):
        if neighbor_id == source_id:
            continue
        neighbor = catalog[neighbor_id]
        state = baseline_by_id[neighbor_id]
        distance = hypot(neighbor.latitude-origin.latitude, neighbor.longitude-origin.longitude) * 69
        spare = max(0, int(state.effective_capacity-state.estimated_demand))
        if distance <= maximum_distance and spare:
            candidates.append((state.disruption_probability, neighbor_id, spare, distance))
    for _, destination_id, spare, distance in sorted(candidates):
        patients = min(remaining, spare)
        if patients <= 0:
            continue
        offsets[source_id] = offsets.get(source_id, 0)-patients
        offsets[destination_id] = offsets.get(destination_id, 0)+patients
        transfers.append(TransferAction(from_hospital_id=source_id, to_hospital_id=destination_id, patients=patients, rationale=f"Simulated rerouting across {distance:.1f} miles to modeled spare capacity", safety_constraints_satisfied=True))
        remaining -= patients
        if remaining <= 0:
            break
    return offsets, transfers


def _transform(selection: InterventionSelection, request: SimulationRequest, baseline: SimulationResponse):
    transformed = request.model_copy(deep=True)
    transformed.enable_counterfactuals = False
    parameters = selection.parameters
    capacity_scale = 1.0
    demand_offsets: dict[str, float] = {}
    forced_transfers: list[TransferAction] | None = None
    warnings: list[str] = []
    identifier = selection.intervention_id
    if identifier == "network-segmentation":
        transformed.cyber_event.severity *= 1-(parameters.cyber_loss_reduction or .65)
        capacity_scale *= .99
        warnings.append("Short-term coordination overhead reduces modeled capacity by 1%.")
    elif identifier == "backup-power-activation":
        duration_ratio = min(1, (parameters.backup_duration_hours or 48)/max(transformed.horizon_hours, 1))
        transformed.hazard.grid_outage_probability *= 1-(parameters.backup_capacity_coverage or .8)*duration_ratio
        warnings.append("Benefit is limited by synthetic duration and coverage assumptions.")
    elif identifier == "regional-surge-capacity":
        regional_beds = sum(hospital.staffed_beds for hospital in HOSPITALS)
        capacity_scale += (parameters.added_temporary_beds or 120)/regional_beds*(parameters.staffing_availability or .8)
        warnings.append("Temporary capacity depends on modeled staffing availability.")
    elif identifier == "ambulance-rerouting":
        demand_offsets, forced_transfers = _rerouting_offsets(baseline, parameters)
        if not forced_transfers:
            warnings.append("No safe rerouting opportunity was available within configured constraints.")
    elif identifier == "telemetry-verification":
        current_integrity, _ = assess_integrity(transformed)
        target = max(current_integrity, parameters.integrity_recovery_level or .9)
        remaining_error_ratio = (1-target)/max(1-current_integrity, .001)
        transformed.cyber_event.telemetry_tampering *= remaining_error_ratio
        transformed.missing_telemetry_ratio *= remaining_error_ratio
        warnings.append("Trust improvement does not reduce the physical hazard directly.")
    elif identifier == "combined-intervention":
        transformed.cyber_event.severity *= .35
        transformed.hazard.grid_outage_probability *= .25
        regional_beds = sum(hospital.staffed_beds for hospital in HOSPITALS)
        capacity_scale = (1+120/regional_beds*.8)*.98
        current_integrity, _ = assess_integrity(transformed)
        remaining_error_ratio = (1-max(current_integrity, .9))/max(1-current_integrity, .001)
        transformed.cyber_event.telemetry_tampering *= remaining_error_ratio
        transformed.missing_telemetry_ratio *= remaining_error_ratio
        warnings.append("A 2% synthetic coordination cost is applied after composing controls once.")
    else:
        raise ValueError("Unknown intervention")
    return transformed, capacity_scale, demand_offsets, forced_transfers, warnings


def _evaluate_intervention(selection: InterventionSelection, request: SimulationRequest, baseline_response: SimulationResponse, baseline: CounterfactualOutcome, include_states: bool, include_transfers: bool) -> CounterfactualOutcome:
    definition = INTERVENTIONS[selection.intervention_id]
    transformed, capacity_scale, demand_offsets, forced_transfers, warnings = _transform(selection, request, baseline_response)
    with tracer.start_as_current_span("counterfactual.twin.evaluate"):
        states = _evaluate_states(transformed, capacity_scale=capacity_scale, demand_offsets=demand_offsets)
        risk = _regional_risk(states)
    with tracer.start_as_current_span("counterfactual.transfer.plan"):
        transfers = forced_transfers if forced_transfers is not None else _plan_transfers(states, transformed.cyber_event.target_hospital_id)
    with tracer.start_as_current_span("counterfactual.trust.evaluate"):
        integrity, _ = assess_integrity(transformed)
        trust, _ = evaluate_trust(transformed, f"counterfactual:{baseline_response.simulation_id}:{definition.id}", states, transfers, risk)
        resilience = _resilience(risk, integrity)
    unsafe = not all(action.safety_constraints_satisfied for action in transfers)
    unserved = round(sum(max(0, state.estimated_demand-state.effective_capacity) for state in states),2) if forced_transfers is not None else _unserved(states,transfers)
    baseline_risk = baseline.regional_risk_score or 0
    risk_reduction = baseline_risk-risk
    trade_offs = list(warnings)
    additional_transfers = sum(action.patients for action in transfers)-(baseline.total_transfer_patients or 0)
    if additional_transfers > 0:
        trade_offs.append(f"Adds {additional_transfers} simulated transfer patients.")
    if definition.activation_delay_minutes:
        trade_offs.append(f"Assumes a {definition.activation_delay_minutes}-minute synthetic activation delay.")
    if unsafe:
        warnings.append("Unsafe transfer constraint detected; this outcome is excluded from ranking.")
    return CounterfactualOutcome(
        intervention_id=definition.id, intervention_name=definition.name, category=definition.category,
        regional_risk_score=round(risk,3), resilience_score=round(resilience,3), recommendation_confidence=trust.recommendation_confidence,
        telemetry_integrity=trust.telemetry_integrity, uncertainty=trust.uncertainty, evidence_completeness=trust.evidence_completeness,
        critical_hospital_count=sum(state.status == FacilityStatus.CRITICAL for state in states), degraded_hospital_count=sum(state.status == FacilityStatus.DEGRADED for state in states),
        unserved_demand=unserved, total_transfer_patients=sum(action.patients for action in transfers), estimated_operational_cost=_COSTS[definition.id],
        estimated_activation_delay_minutes=definition.activation_delay_minutes, complexity=definition.complexity, human_review_required=True, transfer_plan_safe=not unsafe,
        hospital_states=states if include_states else [], transfer_plan=transfers if include_transfers else [], absolute_risk_reduction=round(risk_reduction,3),
        relative_risk_reduction=round(risk_reduction/max(baseline_risk,.001),3), resilience_improvement=round(resilience-(baseline.resilience_score or 0),3),
        critical_hospitals_avoided=(baseline.critical_hospital_count or 0)-sum(state.status == FacilityStatus.CRITICAL for state in states),
        unserved_demand_reduction=round((baseline.unserved_demand or 0)-unserved,2), additional_transfers=additional_transfers,
        confidence_change=round(trust.recommendation_confidence-(baseline.recommendation_confidence or 0),3), trade_offs=trade_offs, warnings=warnings,
    )


def rank_outcomes(outcomes: list[CounterfactualOutcome], baseline: CounterfactualOutcome, weights: dict[str, float] | None = None) -> list[CounterfactualRanking]:
    configured = weights or DEFAULT_RANKING_WEIGHTS
    complexity_penalty = {"low": .2, "moderate": .55, "high": .85}
    scored = []
    for outcome in outcomes:
        if outcome.status != "completed" or not outcome.transfer_plan_safe:
            continue
        benefits = {
            "risk": max(0, outcome.relative_risk_reduction or 0),
            "resilience": max(0, (outcome.resilience_improvement or 0)/max(1-(baseline.resilience_score or 0),.001)),
            "demand": max(0, (outcome.unserved_demand_reduction or 0)/max(baseline.unserved_demand or 1,1)),
            "critical_hospitals": max(0, (outcome.critical_hospitals_avoided or 0)/max(baseline.critical_hospital_count or 1,1)),
            "trust": outcome.recommendation_confidence or 0,
        }
        penalties = {
            "transfer_burden": max(0, outcome.additional_transfers or 0)/max(sum(hospital.staffed_beds for hospital in HOSPITALS),1),
            "speed": (outcome.estimated_activation_delay_minutes or 0)/120,
            "complexity": complexity_penalty.get(outcome.complexity or "high",.85),
            "safety": 0 if outcome.transfer_plan_safe else 1,
        }
        score = sum(configured[key]*value for key,value in benefits.items())-sum(configured[key]*value for key,value in penalties.items())
        main_benefit = max(benefits,key=benefits.get).replace("_"," ")
        main_trade_off = max(penalties,key=penalties.get).replace("_"," ")
        scored.append((max(0,min(1,score)),outcome,main_benefit,main_trade_off))
    scored.sort(key=lambda item:(-item[0],item[1].intervention_id))
    return [CounterfactualRanking(rank=index+1,intervention_id=outcome.intervention_id,overall_score=round(score,3),main_benefit=benefit,main_trade_off=trade_off,confidence=outcome.recommendation_confidence or 0,explanation=f"Ranked on normalized {benefit} benefit with {trade_off} treated as a penalty.") for index,(score,outcome,benefit,trade_off) in enumerate(scored)]


def _recommendation(ranking: list[CounterfactualRanking], outcomes: list[CounterfactualOutcome], baseline: CounterfactualOutcome) -> CounterfactualRecommendation:
    if not ranking:
        return CounterfactualRecommendation(label="No rankable intervention", rationale="No successful intervention satisfied comparison safety constraints.", suggested_review_action="Review failures and baseline assumptions.", insufficient_confidence=True)
    top = ranking[0]
    outcome = next(item for item in outcomes if item.intervention_id == top.intervention_id)
    insufficient = (baseline.telemetry_integrity or 0) < .5 or (outcome.recommendation_confidence or 0) < .4
    return CounterfactualRecommendation(intervention_id=None if insufficient else outcome.intervention_id,label="Insufficient confidence for automated prioritization" if insufficient else f"{outcome.intervention_name} — recommended for human review",rationale="Low telemetry integrity or recommendation confidence prevents strong prioritization." if insufficient else f"Highest research ranking score ({top.overall_score:.2f}) after benefit, trust, delay, complexity, transfer, and safety trade-offs.",suggested_review_action="Validate evidence quality before reviewing operational trade-offs." if insufficient else "Review constraints, hospital effects, and transfer burden before authorization.",insufficient_confidence=insufficient)


def run_counterfactual_comparison(request: CounterfactualRunRequest) -> CounterfactualExplorerResponse:
    stored = get_simulation(request.simulation_id)
    if stored is None:
        raise LookupError("Baseline simulation not found in this server process")
    original_request, baseline_response = stored
    identifiers = [item.intervention_id for item in request.interventions]
    unknown = [identifier for identifier in identifiers if identifier not in INTERVENTIONS or identifier == "no-intervention"]
    if unknown:
        raise ValueError(f"Unknown or non-candidate intervention: {unknown[0]}")
    comparison_id = str(uuid4())
    with tracer.start_as_current_span("counterfactual.run") as span:
        context = span.get_span_context()
        trace_id = f"{context.trace_id:032x}" if context.is_valid else None
        span.set_attributes({"simulation.id":request.simulation_id,"comparison.id":comparison_id,"scenario.name":original_request.scenario_name,"baseline.risk":baseline_response.regional_risk_score,"human_review_required":True})
        logger.info("Counterfactual comparison started",extra={"simulation_id":request.simulation_id,"comparison_id":comparison_id,"intervention_id":"multiple","counterfactual_status":"running","human_review_required":True})
        with tracer.start_as_current_span("counterfactual.baseline.load"):
            baseline = _baseline_outcome(baseline_response,request.include_hospital_states,request.include_transfer_plans)
        outcomes=[]
        for selection in request.interventions:
            definition=INTERVENTIONS[selection.intervention_id]
            applicable,reason=_applicable(selection.intervention_id,original_request)
            if not applicable:
                logger.warning("Intervention validation failed",extra={"simulation_id":request.simulation_id,"comparison_id":comparison_id,"intervention_id":selection.intervention_id,"counterfactual_status":"failed","human_review_required":True})
                outcomes.append(CounterfactualOutcome(intervention_id=definition.id,intervention_name=definition.name,category=definition.category,status="failed",error=reason,human_review_required=True,warnings=[reason or "Intervention is not applicable."]))
                continue
            with tracer.start_as_current_span("counterfactual.intervention.apply") as intervention_span:
                intervention_span.set_attributes({"simulation.id":request.simulation_id,"comparison.id":comparison_id,"intervention.id":definition.id,"intervention.category":definition.category})
                try:
                    outcome=_evaluate_intervention(selection,original_request,baseline_response,baseline,request.include_hospital_states,request.include_transfer_plans)
                    intervention_span.set_attributes({"intervention.status":"completed","counterfactual.risk":outcome.regional_risk_score or 0,"risk.reduction":outcome.absolute_risk_reduction or 0,"resilience.improvement":outcome.resilience_improvement or 0,"human_review_required":True})
                    outcomes.append(outcome)
                    logger.info("Counterfactual evaluation completed",extra={"simulation_id":request.simulation_id,"comparison_id":comparison_id,"intervention_id":definition.id,"counterfactual_status":"completed","risk_reduction":outcome.absolute_risk_reduction,"human_review_required":True})
                except Exception as exc:
                    intervention_span.record_exception(exc)
                    intervention_span.set_status(Status(StatusCode.ERROR,"Counterfactual intervention failed"))
                    outcomes.append(CounterfactualOutcome(intervention_id=definition.id,intervention_name=definition.name,category=definition.category,status="failed",error="Intervention evaluation failed safely. Review backend telemetry.",human_review_required=True))
                    logger.exception("Counterfactual comparison failed",extra={"simulation_id":request.simulation_id,"comparison_id":comparison_id,"intervention_id":definition.id,"counterfactual_status":"failed","human_review_required":True})
        with tracer.start_as_current_span("counterfactual.rank") as rank_span:
            ranking=rank_outcomes(outcomes,baseline)
            for item in ranking:
                rank_span.set_attribute(f"intervention.{item.intervention_id}.rank",item.rank)
        recommendation=_recommendation(ranking,outcomes,baseline)
        incomplete=any(outcome.status == "failed" for outcome in outcomes)
        warnings=["Comparison is incomplete; failed interventions were excluded from ranking."] if incomplete else []
        logger.info("Intervention ranking completed",extra={"simulation_id":request.simulation_id,"comparison_id":comparison_id,"intervention_id":ranking[0].intervention_id if ranking else "none","counterfactual_status":"completed","human_review_required":True})
        return CounterfactualExplorerResponse(comparison_id=comparison_id,simulation_id=request.simulation_id,scenario_name=original_request.scenario_name,created_at=datetime.now(UTC).isoformat(),baseline=baseline,interventions=outcomes,ranking=ranking,recommendation=recommendation,default_ranking_weights=DEFAULT_RANKING_WEIGHTS,trace_id=trace_id,incomplete=incomplete,warnings=warnings,limitations=["Synthetic deterministic estimates; not validated operational forecasts.","Simulation and comparison history is process-local and bounded.","Costs and activation delays are synthetic planning metadata."])


def default_counterfactual_results(request: SimulationRequest, baseline_response: SimulationResponse) -> list[CounterfactualResult]:
    baseline=_baseline_outcome(baseline_response)
    selections=[InterventionSelection(intervention_id=identifier) for identifier in ("network-segmentation","regional-surge-capacity","combined-intervention") if _applicable(identifier,request)[0]]
    outcomes=[]
    for selection in selections:
        outcome=_evaluate_intervention(selection,request,baseline_response,baseline,False,False)
        outcomes.append(CounterfactualResult(intervention=outcome.intervention_name,regional_risk_score=outcome.regional_risk_score or baseline_response.regional_risk_score,risk_reduction=max(0,outcome.absolute_risk_reduction or 0)))
    return sorted(outcomes,key=lambda item:item.risk_reduction,reverse=True)

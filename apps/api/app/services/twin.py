from math import exp
from uuid import uuid4
from opentelemetry import metrics, trace
from app.agents.orchestrator import AgentOrchestrator
from app.models.domain import CounterfactualResult, FacilityStatus, HospitalState, SimulationRequest, SimulationResponse, TransferAction, TrustRecord, EvidenceItem
from app.services.catalog import HOSPITALS, hospital_map
from app.services.graph import build_infrastructure_graph, centrality_scores, dependency_pressure
from app.services.integrity import assess_integrity

tracer = trace.get_tracer("geotwin.digital-twin")
meter = metrics.get_meter("geotwin.digital-twin")
simulation_counter = meter.create_counter("geotwin.simulations.total")
risk_histogram = meter.create_histogram("geotwin.regional_risk.score")
integrity_histogram = meter.create_histogram("geotwin.telemetry.integrity")
GRAPH = build_infrastructure_graph(HOSPITALS)
CENTRALITY = centrality_scores(GRAPH)


def _sigmoid(value: float) -> float:
    return 1 / (1 + exp(-value))


def _hazard_pressure(request: SimulationRequest) -> float:
    heat = max(0, (request.hazard.heat_index - 90) / 45)
    air = max(0, (request.hazard.air_quality_index - 100) / 300)
    return min(1, .38*heat + .27*request.hazard.flood_severity + .2*air + .15*request.hazard.grid_outage_probability)


def _evaluate_states(request: SimulationRequest, cyber_scale: float = 1, demand_scale: float = 1) -> list[HospitalState]:
    hazard = _hazard_pressure(request)
    failed_dependencies = {"GRID-CENTRAL"} if request.hazard.grid_outage_probability > .65 else set()
    states=[]
    for hospital in HOSPITALS:
        with tracer.start_as_current_span("twin.evaluate_facility") as span:
            attacked = hospital.hospital_id == request.cyber_event.target_hospital_id
            cyber_loss = request.cyber_event.severity * cyber_scale * (1-hospital.cyber_readiness) * (.9 if attacked else .08)
            dep = dependency_pressure(GRAPH, hospital.hospital_id, failed_dependencies)
            power_penalty = max(0, request.horizon_hours-hospital.backup_power_hours)/max(request.horizon_hours,1) * request.hazard.grid_outage_probability
            effective = hospital.staffed_beds * max(.08, 1-cyber_loss-.25*dep-.2*power_penalty)
            demand = hospital.staffed_beds*hospital.baseline_occupancy*request.demand_multiplier*demand_scale*(1+.42*hazard)
            load = demand/max(effective,1)
            criticality = CENTRALITY.get(hospital.hospital_id,.5)
            probability = _sigmoid(4.1*(load-1)+2.3*cyber_loss+1.4*hazard+1.1*dep+.6*criticality-1.35)
            status = FacilityStatus.CRITICAL if probability>=.75 else FacilityStatus.DEGRADED if probability>=.4 else FacilityStatus.STABLE
            span.set_attributes({"healthcare.facility.id":hospital.hospital_id,"healthcare.load.ratio":load,"geotwin.cyber.loss":cyber_loss,"geotwin.hazard.pressure":hazard,"geotwin.disruption.probability":probability,"geotwin.facility.status":status.value})
            states.append(HospitalState(hospital_id=hospital.hospital_id,effective_capacity=round(effective,2),estimated_demand=round(demand,2),load_ratio=round(load,3),cyber_loss=round(cyber_loss,3),hazard_pressure=round(hazard,3),dependency_pressure=round(dep,3),disruption_probability=round(probability,3),status=status))
    return states


def _regional_risk(states: list[HospitalState]) -> float:
    weighted=sum(s.disruption_probability*(.55+.45*CENTRALITY.get(s.hospital_id,.5)) for s in states)
    denom=sum(.55+.45*CENTRALITY.get(s.hospital_id,.5) for s in states)
    return min(1, weighted/max(denom,.001))


def _plan_transfers(states: list[HospitalState], source_id: str) -> list[TransferAction]:
    by_id={s.hospital_id:s for s in states}; hospitals=hospital_map(); source=by_id[source_id]
    overflow=max(0, round(source.estimated_demand-source.effective_capacity)); actions=[]
    candidates=[]
    for neighbor in hospitals[source_id].referral_neighbors:
        target=by_id[neighbor]; spare=max(0, int(target.effective_capacity-target.estimated_demand))
        if spare and target.status != FacilityStatus.CRITICAL:
            candidates.append((neighbor, spare, target.disruption_probability))
    for target_id, spare, risk in sorted(candidates,key=lambda item:item[2]):
        count=min(overflow,spare); overflow-=count
        if count:
            actions.append(TransferAction(from_hospital_id=source_id,to_hospital_id=target_id,patients=count,rationale=f"Spare simulated capacity with downstream risk {risk:.2f}",safety_constraints_satisfied=True))
        if overflow<=0: break
    return actions


def _counterfactuals(request: SimulationRequest, baseline: float) -> list[CounterfactualResult]:
    variants=[("segment compromised network",.35,1.0),("activate regional surge capacity",1.0,.82),("combined cyber containment and surge",.35,.82)]
    results=[]
    for name, cyber_scale, demand_scale in variants:
        risk=_regional_risk(_evaluate_states(request,cyber_scale,demand_scale))
        results.append(CounterfactualResult(intervention=name,regional_risk_score=round(risk,3),risk_reduction=round(max(0,baseline-risk),3)))
    return sorted(results,key=lambda item:item.risk_reduction,reverse=True)


def run_simulation(request: SimulationRequest) -> SimulationResponse:
    simulation_id=str(uuid4())
    with tracer.start_as_current_span("digital_twin.run") as span:
        span.set_attributes({"geotwin.simulation.id":simulation_id,"geotwin.scenario.name":request.scenario_name,"geotwin.cyber.attack_type":request.cyber_event.attack_type,"geotwin.cyber.target":request.cyber_event.target_hospital_id,"ai.decision.human_review_required":True})
        if request.cyber_event.target_hospital_id not in hospital_map():
            raise ValueError("Unknown target hospital")
        integrity, integrity_evidence=assess_integrity(request)
        states=_evaluate_states(request)
        risk=_regional_risk(states)
        transfers=_plan_transfers(states,request.cyber_event.target_hospital_id)
        completeness=max(0,1-request.missing_telemetry_ratio)
        uncertainty=min(1,.08+.42*(1-integrity)+.3*(1-completeness)+.2*_hazard_pressure(request))
        confidence=max(0,completeness*integrity*(1-uncertainty))
        policy=all(a.safety_constraints_satisfied for a in transfers)
        evidence=integrity_evidence+[
            EvidenceItem(source="digital-twin",signal="regional_risk",value=round(risk,3),reliability=confidence),
            EvidenceItem(source="hazard-fusion",signal="compound_hazard_pressure",value=round(_hazard_pressure(request),3),reliability=.88),
        ]
        context={"hazard_pressure":_hazard_pressure(request),"cyber_severity":request.cyber_event.severity,"telemetry_integrity":integrity,"regional_risk":risk,"transfer_count":len(transfers),"trust_confidence":confidence}
        decisions=AgentOrchestrator().run(context)
        counterfactuals=_counterfactuals(request,risk) if request.enable_counterfactuals else []
        resilience=max(0,1-risk*(1+.35*(1-integrity)))
        best=counterfactuals[0].intervention if counterfactuals else "no counterfactual evaluated"
        explanation=f"The regional twin estimates risk {risk:.2f} and resilience {resilience:.2f}. Telemetry integrity is {integrity:.2f}. The strongest simulated intervention is '{best}'. All actions are planning recommendations and require authorized human approval."
        simulation_counter.add(1,{"scenario":request.scenario_name})
        risk_histogram.record(risk,{"scenario":request.scenario_name})
        integrity_histogram.record(integrity,{"scenario":request.scenario_name})
        span.set_attributes({"geotwin.regional_risk.score":risk,"geotwin.resilience.score":resilience,"ai.decision.confidence":confidence,"security.telemetry.integrity":integrity})
        return SimulationResponse(simulation_id=simulation_id,scenario_name=request.scenario_name,regional_risk_score=round(risk,3),resilience_score=round(resilience,3),affected_hospitals=states,transfer_plan=transfers,evidence=evidence,agent_decisions=decisions,counterfactuals=counterfactuals,explanation=explanation,trust=TrustRecord(evidence_completeness=round(completeness,3),telemetry_integrity=round(integrity,3),uncertainty=round(uncertainty,3),geographic_coverage=1.0,policy_compliance=policy,recommendation_confidence=round(confidence,3)))

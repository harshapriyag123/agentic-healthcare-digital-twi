from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class FacilityStatus(StrEnum):
    STABLE = "stable"
    DEGRADED = "degraded"
    CRITICAL = "critical"
    ISOLATED = "isolated"


class Hospital(BaseModel):
    hospital_id: str
    name: str
    latitude: float
    longitude: float
    staffed_beds: int = Field(gt=0)
    icu_beds: int = Field(gt=0)
    baseline_occupancy: float = Field(ge=0, le=1)
    cyber_readiness: float = Field(ge=0, le=1)
    backup_power_hours: float = Field(ge=0)
    referral_neighbors: list[str] = []
    critical_dependencies: list[str] = []


class HazardInput(BaseModel):
    heat_index: float = Field(default=95, ge=40, le=150)
    flood_severity: float = Field(default=0, ge=0, le=1)
    air_quality_index: int = Field(default=60, ge=0, le=500)
    grid_outage_probability: float = Field(default=0, ge=0, le=1)


class CyberEvent(BaseModel):
    target_hospital_id: str
    severity: float = Field(default=0, ge=0, le=1)
    attack_type: str = "ransomware"
    telemetry_tampering: float = Field(default=0, ge=0, le=1)


class SimulationRequest(BaseModel):
    scenario_name: str = "compound-disruption"
    horizon_hours: int = Field(default=12, ge=1, le=168)
    demand_multiplier: float = Field(default=1.0, ge=0.5, le=3)
    hazard: HazardInput = HazardInput()
    cyber_event: CyberEvent
    missing_telemetry_ratio: float = Field(default=0, ge=0, le=0.9)
    enable_counterfactuals: bool = True
    demo_fault: Literal["none", "security-agent-failure", "security-agent-delay"] = "none"


class HospitalState(BaseModel):
    hospital_id: str
    effective_capacity: float
    estimated_demand: float
    load_ratio: float
    cyber_loss: float
    hazard_pressure: float
    dependency_pressure: float
    disruption_probability: float
    status: FacilityStatus


class TransferAction(BaseModel):
    from_hospital_id: str
    to_hospital_id: str
    patients: int = Field(ge=0)
    rationale: str
    safety_constraints_satisfied: bool


class EvidenceItem(BaseModel):
    evidence_id: str
    source: str
    signal: str
    value: float | str | bool
    reliability: float = Field(ge=0, le=1)
    source_id: str | None = None
    source_name: str | None = None
    source_type: str = "synthetic-telemetry"
    unit: str | None = None
    integrity_status: Literal[
        "verified",
        "acceptable",
        "degraded",
        "missing",
        "stale",
        "conflicting",
        "suspected-tampering",
        "rejected",
        "unknown",
    ] = "unknown"
    provenance_status: Literal["validated-lineage", "basic-lineage", "gap", "unknown"] = "unknown"
    freshness_status: Literal["current", "stale", "unknown"] = "unknown"
    observed_at: str | None = None
    received_at: str | None = None
    age_seconds: float | None = Field(default=None, ge=0)
    location_scope: str | None = None
    hospital_id: str | None = None
    scenario_id: str | None = None
    agent_ids: list[str] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=1)
    warning: str | None = None
    parent_evidence_ids: list[str] = Field(default_factory=list)
    validation_checks: list[str] = Field(default_factory=list)


class TrustFactorContribution(BaseModel):
    factor: str
    raw_value: float = Field(ge=0, le=1)
    normalized_value: float = Field(ge=0, le=1)
    weight: float
    weighted_contribution: float
    status: str
    explanation: str
    supporting_evidence_count: int = Field(ge=0)
    warning_count: int = Field(ge=0)


class ReviewReason(BaseModel):
    code: str
    explanation: str
    severity: Literal["advisory", "warning", "critical"]
    affected_component: str
    recommended_action: str


class PolicyCheck(BaseModel):
    policy_id: str
    name: str
    status: Literal["passed", "failed", "unknown"]
    explanation: str
    related_evidence_ids: list[str] = Field(default_factory=list)
    related_agent_id: str | None = None
    required_action: str | None = None


class TrustAnomaly(BaseModel):
    anomaly_type: str
    severity: Literal["advisory", "warning", "critical"]
    evidence_ids: list[str]
    explanation: str
    trust_impact: str
    affected_agent_ids: list[str] = Field(default_factory=list)
    required_action: str


class TrustImprovementAction(BaseModel):
    action: str
    trigger: str
    affected_evidence_ids: list[str]
    expected_effect: str
    priority: Literal["low", "medium", "high"]
    suggested_role: str
    resimulation_recommended: bool


class TrustRecord(BaseModel):
    evidence_completeness: float = Field(ge=0, le=1)
    telemetry_integrity: float = Field(ge=0, le=1)
    uncertainty: float = Field(ge=0, le=1)
    geographic_coverage: float = Field(ge=0, le=1)
    policy_compliance: bool
    recommendation_confidence: float = Field(ge=0, le=1)
    human_review_required: bool = True
    trust_score: float | None = Field(default=None, ge=0, le=1)
    evidence_reliability: float | None = Field(default=None, ge=0, le=1)
    provenance_strength: float | None = Field(default=None, ge=0, le=1)
    freshness_score: float | None = Field(default=None, ge=0, le=1)
    consistency_score: float | None = Field(default=None, ge=0, le=1)
    factor_contributions: list[TrustFactorContribution] = Field(default_factory=list)
    review_reasons: list[ReviewReason] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    failed_checks: list[str] = Field(default_factory=list)
    passed_checks: list[str] = Field(default_factory=list)
    improvement_actions: list[TrustImprovementAction] = Field(default_factory=list)
    policy_checks: list[PolicyCheck] = Field(default_factory=list)
    anomalies: list[TrustAnomaly] = Field(default_factory=list)
    calculation_version: str = "legacy-v1"


class CounterfactualResult(BaseModel):
    intervention: str
    regional_risk_score: float
    risk_reduction: float


class InterventionParameters(BaseModel):
    cyber_loss_reduction: float | None = Field(default=None, ge=0.1, le=0.95)
    backup_capacity_coverage: float | None = Field(default=None, ge=0.1, le=1)
    backup_duration_hours: float | None = Field(default=None, ge=1, le=168)
    added_temporary_beds: int | None = Field(default=None, ge=10, le=500)
    staffing_availability: float | None = Field(default=None, ge=0.25, le=1)
    maximum_transfer_distance_miles: float | None = Field(default=None, ge=5, le=250)
    maximum_transfer_patients: int | None = Field(default=None, ge=1, le=500)
    integrity_recovery_level: float | None = Field(default=None, ge=0.5, le=1)


class InterventionSelection(BaseModel):
    intervention_id: str
    parameters: InterventionParameters = Field(default_factory=InterventionParameters)


class CounterfactualRunRequest(BaseModel):
    simulation_id: str
    interventions: list[InterventionSelection] = Field(min_length=1, max_length=6)
    include_hospital_states: bool = True
    include_transfer_plans: bool = True

    @model_validator(mode="after")
    def validate_unique_interventions(self):
        identifiers = [item.intervention_id for item in self.interventions]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("Duplicate intervention IDs are not allowed")
        return self


class InterventionDefinition(BaseModel):
    id: str
    name: str
    category: Literal[
        "baseline", "cyber", "capacity", "infrastructure", "transport", "telemetry", "combined"
    ]
    description: str
    affected_parameters: list[str]
    applicable_scenarios: list[str]
    mechanism: str
    complexity: Literal["low", "moderate", "high"]
    activation_delay_minutes: int = Field(ge=0)
    safety_constraints: list[str]
    human_authorization_required: bool = True
    executable: bool = True


class CounterfactualOutcome(BaseModel):
    intervention_id: str
    intervention_name: str
    category: str
    status: Literal["completed", "failed"] = "completed"
    error: str | None = None
    regional_risk_score: float | None = Field(default=None, ge=0, le=1)
    resilience_score: float | None = Field(default=None, ge=0, le=1)
    recommendation_confidence: float | None = Field(default=None, ge=0, le=1)
    telemetry_integrity: float | None = Field(default=None, ge=0, le=1)
    uncertainty: float | None = Field(default=None, ge=0, le=1)
    evidence_completeness: float | None = Field(default=None, ge=0, le=1)
    critical_hospital_count: int | None = Field(default=None, ge=0)
    degraded_hospital_count: int | None = Field(default=None, ge=0)
    unserved_demand: float | None = Field(default=None, ge=0)
    total_transfer_patients: int | None = Field(default=None, ge=0)
    estimated_operational_cost: str | None = None
    estimated_activation_delay_minutes: int | None = Field(default=None, ge=0)
    complexity: str | None = None
    human_review_required: bool = True
    transfer_plan_safe: bool = True
    hospital_states: list[HospitalState] = Field(default_factory=list)
    transfer_plan: list[TransferAction] = Field(default_factory=list)
    absolute_risk_reduction: float | None = None
    relative_risk_reduction: float | None = None
    resilience_improvement: float | None = None
    critical_hospitals_avoided: int | None = None
    unserved_demand_reduction: float | None = None
    additional_transfers: int | None = None
    confidence_change: float | None = None
    trade_offs: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    proposed_by: str | None = None
    evaluated_by: str = "digital-twin-system"
    ranked_by: str = "counterfactual-ranking-system"


class CounterfactualRanking(BaseModel):
    rank: int = Field(ge=1)
    intervention_id: str
    overall_score: float = Field(ge=0, le=1)
    main_benefit: str
    main_trade_off: str
    confidence: float = Field(ge=0, le=1)
    explanation: str


class CounterfactualRecommendation(BaseModel):
    intervention_id: str | None = None
    label: str
    rationale: str
    suggested_review_action: str
    insufficient_confidence: bool
    human_review_required: bool = True


class CounterfactualExplorerResponse(BaseModel):
    comparison_id: str
    simulation_id: str
    scenario_name: str
    created_at: str
    baseline: CounterfactualOutcome
    interventions: list[CounterfactualOutcome]
    ranking: list[CounterfactualRanking]
    recommendation: CounterfactualRecommendation
    default_ranking_weights: dict[str, float]
    trace_id: str | None = None
    incomplete: bool = False
    warnings: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class ScenarioCatalogItem(BaseModel):
    id: str
    name: str
    category: str
    description: str
    tags: list[str]
    severity: str
    request: SimulationRequest


class AgentDecision(BaseModel):
    agent: str
    action: str
    confidence: float = Field(ge=0, le=1)
    explanation: str
    agent_id: str | None = None
    agent_name: str | None = None
    component_type: Literal["agent", "system"] = "agent"
    purpose: str | None = None
    stage: str | None = None
    status: Literal[
        "queued", "running", "completed", "warning", "failed", "skipped", "human-review-required"
    ] = "completed"
    sequence: int | None = Field(default=None, ge=1)
    evidence_ids: list[str] = Field(default_factory=list)
    started_at: str | None = None
    completed_at: str | None = None
    duration_ms: float | None = Field(default=None, ge=0)
    human_review_required: bool = False
    warning: str | None = None
    error: str | None = None
    trace_id: str | None = None
    span_id: str | None = None
    attributes: dict[str, str | int | float | bool] = Field(default_factory=dict)


class TrustDashboardResponse(BaseModel):
    simulation_id: str
    scenario_name: str
    trust: TrustRecord
    evidence: list[EvidenceItem]
    agent_decisions: list[AgentDecision]
    trace_id: str | None = None
    partial: bool = False
    warnings: list[str] = Field(default_factory=list)


class SimulationResponse(BaseModel):
    simulation_id: str
    scenario_name: str
    regional_risk_score: float
    resilience_score: float
    affected_hospitals: list[HospitalState]
    transfer_plan: list[TransferAction]
    evidence: list[EvidenceItem]
    agent_decisions: list[AgentDecision]
    counterfactuals: list[CounterfactualResult]
    explanation: str
    trust: TrustRecord
    trace_id: str | None = None
    duration_ms: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_scores(self):
        if not 0 <= self.regional_risk_score <= 1:
            raise ValueError("regional_risk_score must be in [0, 1]")
        return self

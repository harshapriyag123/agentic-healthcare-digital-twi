from enum import StrEnum
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
    source: str
    signal: str
    value: float | str | bool
    reliability: float = Field(ge=0, le=1)


class TrustRecord(BaseModel):
    evidence_completeness: float = Field(ge=0, le=1)
    telemetry_integrity: float = Field(ge=0, le=1)
    uncertainty: float = Field(ge=0, le=1)
    geographic_coverage: float = Field(ge=0, le=1)
    policy_compliance: bool
    recommendation_confidence: float = Field(ge=0, le=1)
    human_review_required: bool = True


class CounterfactualResult(BaseModel):
    intervention: str
    regional_risk_score: float
    risk_reduction: float


class AgentDecision(BaseModel):
    agent: str
    action: str
    confidence: float = Field(ge=0, le=1)
    explanation: str


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

    @model_validator(mode="after")
    def validate_scores(self):
        if not 0 <= self.regional_risk_score <= 1:
            raise ValueError("regional_risk_score must be in [0, 1]")
        return self

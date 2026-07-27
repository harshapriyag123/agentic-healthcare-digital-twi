export type FacilityStatus = 'stable' | 'degraded' | 'critical' | 'isolated';

export type SimulationRequest = {
    scenario_name: string;
    horizon_hours: number;
    demand_multiplier: number;
    hazard: {
        heat_index: number;
        flood_severity: number;
        air_quality_index: number;
        grid_outage_probability: number;
    };
    cyber_event: {
        target_hospital_id: string;
        severity: number;
        attack_type: string;
        telemetry_tampering: number;
    };
    missing_telemetry_ratio: number;
    enable_counterfactuals: boolean;
};

export type Scenario = {
    id: string;
    name: string;
    category: string;
    description: string;
    tags: string[];
    severity: string;
    request: SimulationRequest;
};

export type Hospital = {
    hospital_id: string;
    name: string;
    latitude: number;
    longitude: number;
    staffed_beds: number;
    icu_beds: number;
    baseline_occupancy: number;
    cyber_readiness: number;
    backup_power_hours: number;
    referral_neighbors: string[];
    critical_dependencies: string[];
};

export type HospitalState = {
    hospital_id: string;
    effective_capacity: number;
    estimated_demand: number;
    load_ratio: number;
    cyber_loss: number;
    hazard_pressure: number;
    dependency_pressure: number;
    disruption_probability: number;
    status: FacilityStatus;
};

export type TransferAction = {
    from_hospital_id: string;
    to_hospital_id: string;
    patients: number;
    rationale: string;
    safety_constraints_satisfied: boolean;
};

export type AgentStatus = 'queued' | 'running' | 'completed' | 'warning' | 'failed' | 'skipped' | 'human-review-required';

export type EvidenceItem = {
    evidence_id: string;
    source: string;
    signal: string;
    value: number | string | boolean;
    reliability: number;
    source_id?: string | null; source_name?: string | null; source_type?: string; unit?: string | null;
    integrity_status?: import('./trustTypes').IntegrityStatus; provenance_status?: string; freshness_status?: string;
    observed_at?: string | null; received_at?: string | null; age_seconds?: number | null; location_scope?: string | null;
    hospital_id?: string | null; scenario_id?: string | null; agent_ids?: string[]; confidence?: number | null;
    warning?: string | null; parent_evidence_ids?: string[]; validation_checks?: string[];
};

export type AgentDecision = {
    agent: string;
    action: string;
    confidence: number;
    explanation: string;
    agent_id?: string | null;
    agent_name?: string | null;
    component_type?: 'agent' | 'system';
    purpose?: string | null;
    stage?: string | null;
    status?: AgentStatus;
    sequence?: number | null;
    evidence_ids?: string[];
    started_at?: string | null;
    completed_at?: string | null;
    duration_ms?: number | null;
    human_review_required?: boolean;
    warning?: string | null;
    error?: string | null;
    trace_id?: string | null;
    span_id?: string | null;
    attributes?: Record<string, string | number | boolean>;
};

export type SimulationResult = {
    simulation_id: string;
    scenario_name: string;
    regional_risk_score: number;
    resilience_score: number;
    affected_hospitals: HospitalState[];
    transfer_plan: TransferAction[];
    evidence: EvidenceItem[];
    agent_decisions: AgentDecision[];
    counterfactuals: Array<{
        intervention: string;
        regional_risk_score: number;
        risk_reduction: number;
    }>;
    explanation: string;
    trust: import('./trustTypes').TrustRecord;
    trace_id?: string | null;
    duration_ms?: number | null;
};

export type Health = { status: string; service: string };
export type ObservabilityHealth = {
    status: string;
    enabled: boolean;
    configured: boolean;
    exporter_active: boolean;
    service: string;
    required_for_readiness: boolean;
};
export type RequestState = 'idle' | 'loading' | 'success' | 'error';

export type TraceSpan = {
    name: string; span_id: string; parent_span_id: string; service_name: string;
    timestamp_nano: number; duration_nano: number; offset_nano: number;
    has_error: boolean; status_code_string: string;
};
export type TraceWaterfall = {
    trace_id: string; span_count: number; duration_nano: number;
    start_timestamp_nano: number; spans: TraceSpan[];
};

export type CompletedRun = {
    result: SimulationResult;
    request: SimulationRequest;
    scenario: Scenario;
    durationMs: number;
    completedAt: string;
};

export type AgentMapFocus = 'hazard' | 'cyber' | 'transfers' | null;

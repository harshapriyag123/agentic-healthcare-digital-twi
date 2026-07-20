import type { HospitalState, TransferAction } from './types';

export type InterventionCategory = 'baseline' | 'cyber' | 'capacity' | 'infrastructure' | 'transport' | 'telemetry' | 'combined';
export type InterventionComplexity = 'low' | 'moderate' | 'high';

export type InterventionDefinition = {
    id: string;
    name: string;
    category: InterventionCategory;
    description: string;
    affected_parameters: string[];
    applicable_scenarios: string[];
    mechanism: string;
    complexity: InterventionComplexity;
    activation_delay_minutes: number;
    safety_constraints: string[];
    human_authorization_required: boolean;
    executable: boolean;
};

export type InterventionParameters = {
    cyber_loss_reduction?: number;
    backup_capacity_coverage?: number;
    backup_duration_hours?: number;
    added_temporary_beds?: number;
    staffing_availability?: number;
    maximum_transfer_distance_miles?: number;
    maximum_transfer_patients?: number;
    integrity_recovery_level?: number;
};

export type InterventionSelection = { intervention_id: string; parameters?: InterventionParameters };
export type CounterfactualRunRequest = { simulation_id: string; interventions: InterventionSelection[]; include_hospital_states: boolean; include_transfer_plans: boolean };

export type CounterfactualOutcome = {
    intervention_id: string;
    intervention_name: string;
    category: string;
    status: 'completed' | 'failed';
    error?: string | null;
    regional_risk_score?: number | null;
    resilience_score?: number | null;
    recommendation_confidence?: number | null;
    telemetry_integrity?: number | null;
    uncertainty?: number | null;
    evidence_completeness?: number | null;
    critical_hospital_count?: number | null;
    degraded_hospital_count?: number | null;
    unserved_demand?: number | null;
    total_transfer_patients?: number | null;
    estimated_operational_cost?: string | null;
    estimated_activation_delay_minutes?: number | null;
    complexity?: string | null;
    human_review_required: boolean;
    transfer_plan_safe: boolean;
    hospital_states: HospitalState[];
    transfer_plan: TransferAction[];
    absolute_risk_reduction?: number | null;
    relative_risk_reduction?: number | null;
    resilience_improvement?: number | null;
    critical_hospitals_avoided?: number | null;
    unserved_demand_reduction?: number | null;
    additional_transfers?: number | null;
    confidence_change?: number | null;
    trade_offs: string[];
    warnings: string[];
    proposed_by?: string | null;
    evaluated_by: string;
    ranked_by: string;
};

export type CounterfactualRanking = { rank: number; intervention_id: string; overall_score: number; main_benefit: string; main_trade_off: string; confidence: number; explanation: string };
export type CounterfactualRecommendation = { intervention_id?: string | null; label: string; rationale: string; suggested_review_action: string; insufficient_confidence: boolean; human_review_required: boolean };
export type RankingWeights = Record<'risk' | 'resilience' | 'demand' | 'critical_hospitals' | 'trust' | 'transfer_burden' | 'speed' | 'complexity' | 'safety', number>;

export type CounterfactualExplorerResponse = {
    comparison_id: string;
    simulation_id: string;
    scenario_name: string;
    created_at: string;
    baseline: CounterfactualOutcome;
    interventions: CounterfactualOutcome[];
    ranking: CounterfactualRanking[];
    recommendation: CounterfactualRecommendation;
    default_ranking_weights: RankingWeights;
    trace_id?: string | null;
    incomplete: boolean;
    warnings: string[];
    limitations: string[];
};

export type MapComparisonMode = 'baseline' | 'intervention' | 'side-by-side' | 'difference';

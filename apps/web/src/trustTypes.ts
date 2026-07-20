import type { AgentDecision, EvidenceItem } from './types';

export type IntegrityStatus = 'verified' | 'acceptable' | 'degraded' | 'missing' | 'stale' | 'conflicting' | 'suspected-tampering' | 'rejected' | 'unknown';

export type TrustFactor = { factor: string; raw_value: number; normalized_value: number; weight: number; weighted_contribution: number; status: string; explanation: string; supporting_evidence_count: number; warning_count: number };
export type ReviewReason = { code: string; explanation: string; severity: 'advisory' | 'warning' | 'critical'; affected_component: string; recommended_action: string };
export type PolicyCheck = { policy_id: string; name: string; status: 'passed' | 'failed' | 'unknown'; explanation: string; related_evidence_ids: string[]; related_agent_id?: string | null; required_action?: string | null };
export type TrustAnomaly = { anomaly_type: string; severity: 'advisory' | 'warning' | 'critical'; evidence_ids: string[]; explanation: string; trust_impact: string; affected_agent_ids: string[]; required_action: string };
export type TrustImprovementAction = { action: string; trigger: string; affected_evidence_ids: string[]; expected_effect: string; priority: 'low' | 'medium' | 'high'; suggested_role: string; resimulation_recommended: boolean };

export type TrustRecord = {
    evidence_completeness: number; telemetry_integrity: number; uncertainty: number; geographic_coverage: number;
    policy_compliance: boolean; recommendation_confidence: number; human_review_required: boolean;
    trust_score?: number | null; evidence_reliability?: number | null; provenance_strength?: number | null;
    freshness_score?: number | null; consistency_score?: number | null; factor_contributions?: TrustFactor[];
    review_reasons?: ReviewReason[]; warnings?: string[]; failed_checks?: string[]; passed_checks?: string[];
    improvement_actions?: TrustImprovementAction[]; policy_checks?: PolicyCheck[]; anomalies?: TrustAnomaly[];
    calculation_version?: string;
};

export type TrustDashboardResponse = { simulation_id: string; scenario_name: string; trust: TrustRecord; evidence: EvidenceItem[]; agent_decisions: AgentDecision[]; trace_id?: string | null; partial: boolean; warnings: string[] };

export type EvidenceFiltersState = { search: string; sourceType: string; integrity: string; reliability: string; agent: string; hospital: string; problematicOnly: boolean };

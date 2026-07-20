import type { AgentDecision, EvidenceItem } from './types';
import type { EvidenceFiltersState, TrustRecord } from './trustTypes';

export function trustBand(value: number | null | undefined) {
    if (value == null) return { label: 'Not evaluated', className: 'unknown' };
    if (value < .4) return { label: 'Untrusted', className: 'critical' };
    if (value < .6) return { label: 'Weak', className: 'warning' };
    if (value < .75) return { label: 'Caution', className: 'caution' };
    if (value < .9) return { label: 'Strong', className: 'good' };
    return { label: 'Very strong', className: 'good' };
}

export function uncertaintyBand(value: number | null | undefined) {
    if (value == null) return 'Not evaluated';
    if (value < .2) return 'Low'; if (value < .4) return 'Moderate'; if (value < .7) return 'High'; return 'Severe';
}

export function filterEvidence(items: EvidenceItem[], filters: EvidenceFiltersState) {
    const query = filters.search.trim().toLowerCase();
    return items.filter((item) => {
        const text = [item.evidence_id, item.source, item.source_name, item.source_type, item.signal, item.hospital_id, item.warning].join(' ').toLowerCase();
        const reliability = item.reliability < .5 ? 'low' : item.reliability < .75 ? 'medium' : 'high';
        const problematic = !['verified', 'acceptable'].includes(item.integrity_status ?? 'unknown') || Boolean(item.warning);
        return (!query || text.includes(query)) && (!filters.sourceType || item.source_type === filters.sourceType) && (!filters.integrity || item.integrity_status === filters.integrity) && (!filters.reliability || reliability === filters.reliability) && (!filters.agent || item.agent_ids?.includes(filters.agent)) && (!filters.hospital || item.hospital_id === filters.hospital) && (!filters.problematicOnly || problematic);
    });
}

export function evidenceForAgent(evidence: EvidenceItem[], decision: AgentDecision) {
    const ids = new Set(decision.evidence_ids ?? []);
    return { found: evidence.filter((item) => ids.has(item.evidence_id)), missing: [...ids].filter((id) => !evidence.some((item) => item.evidence_id === id)) };
}

export function trustExplanation(trust: TrustRecord, evidence: EvidenceItem[]) {
    const factors = trust.factor_contributions ?? [];
    const positive = factors.filter((item) => item.weighted_contribution >= 0).sort((a, b) => b.weighted_contribution-a.weighted_contribution);
    const available = evidence.filter((item) => item.integrity_status !== 'missing');
    const strongest = [...available].sort((a, b) => b.reliability-a.reliability)[0];
    const weakest = [...evidence].sort((a, b) => a.reliability-b.reliability)[0];
    return {
        summary: `The ${trust.calculation_version ?? 'current'} assessment combines ${factors.length} visible factors. ${trust.review_reasons?.length ?? 0} human-review condition(s) apply.`,
        strongestFactor: positive[0]?.factor.replaceAll('_', ' ') ?? 'Unavailable',
        strongestEvidence: strongest?.evidence_id ?? 'Unavailable', weakestEvidence: weakest?.evidence_id ?? 'Unavailable',
        uncertainty: factors.find((item) => item.factor === 'uncertainty_penalty')?.explanation ?? 'Unavailable',
        constraint: trust.policy_checks?.find((item) => item.status === 'failed')?.name ?? 'No failed prototype safety policy',
        nextAction: trust.improvement_actions?.[0]?.action ?? 'Continue evidence validation',
    };
}

export function hospitalTrustStatus(evidence: EvidenceItem[], hospitalId: string) {
    const scoped = evidence.filter((item) => item.hospital_id === hospitalId);
    const order = ['rejected', 'suspected-tampering', 'conflicting', 'missing', 'stale', 'degraded', 'unknown', 'acceptable', 'verified'];
    return scoped.sort((a, b) => order.indexOf(a.integrity_status ?? 'unknown')-order.indexOf(b.integrity_status ?? 'unknown'))[0]?.integrity_status ?? 'unknown';
}

import type { AgentDecision, AgentMapFocus, AgentStatus } from './types';

export type DecisionPresentation = { label: string; severity: 'neutral' | 'info' | 'warning' | 'danger'; description: string; nextStep: string };

const decisions: Record<string, DecisionPresentation> = {
    observe: { label: 'Observe', severity: 'neutral', description: 'Continue evidence collection.', nextStep: 'Monitor the synthetic scenario.' },
    escalate: { label: 'Escalate', severity: 'warning', description: 'Compound pressure exceeded the research escalation rule.', nextStep: 'Request authorized review.' },
    'continue-with-provenance': { label: 'Continue with provenance', severity: 'info', description: 'Evidence is usable with provenance constraints.', nextStep: 'Preserve evidence lineage.' },
    'quarantine-and-require-human-review': { label: 'Quarantine evidence', severity: 'danger', description: 'Telemetry reliability is insufficient for an unconstrained recommendation.', nextStep: 'Require authorized human review.' },
    'activate-regional-load-balancing': { label: 'Evaluate load balancing', severity: 'warning', description: 'The planner produced bounded simulated transfer actions.', nextStep: 'Validate capacity and safety constraints.' },
    'maintain-readiness': { label: 'Maintain readiness', severity: 'neutral', description: 'No elevated planning intervention was selected.', nextStep: 'Continue monitoring.' },
    'coordinate-validated-response': { label: 'Coordinate reviewed response', severity: 'info', description: 'The system assembled bounded outputs from the execution record.', nextStep: 'Submit recommendations for authorization.' },
    'maintain-observability': { label: 'Maintain observability', severity: 'neutral', description: 'The system retained monitoring posture.', nextStep: 'Continue evidence collection.' },
    'defer-to-human-review': { label: 'Defer to human review', severity: 'danger', description: 'Incomplete execution prevents a confident recommendation.', nextStep: 'Inspect the failure and do not automate intervention.' },
};

export function decisionPresentation(action: string): DecisionPresentation {
    return decisions[action] ?? { label: action.replaceAll('-', ' '), severity: 'neutral', description: 'Backend decision category.', nextStep: 'Review the backend explanation.' };
}

export function agentStatus(record: AgentDecision): AgentStatus { return record.status ?? 'completed'; }
export function agentLabel(record: AgentDecision): string { return record.agent_name ?? record.agent; }
export function confidenceBand(value: number): 'Low' | 'Moderate' | 'High' | 'Very high' {
    if (value < .4) return 'Low';
    if (value < .7) return 'Moderate';
    if (value < .9) return 'High';
    return 'Very high';
}
export function agentMapFocus(record: AgentDecision): AgentMapFocus {
    if (record.stage === 'detection') return 'hazard';
    if (record.stage === 'security-assessment') return 'cyber';
    if (record.stage === 'planning') return 'transfers';
    return null;
}

export function orderedAgents(records: AgentDecision[]) {
    return [...records].sort((left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER));
}

export function agentMetrics(records: AgentDecision[]) {
    const executed = records.filter((record) => (record.component_type ?? 'agent') === 'agent' && agentStatus(record) !== 'skipped');
    const durations = executed.filter((record) => typeof record.duration_ms === 'number');
    const slowest = durations.length ? [...durations].sort((a, b) => (b.duration_ms ?? 0) - (a.duration_ms ?? 0))[0] : null;
    const conservative = executed.length ? [...executed].sort((a, b) => a.confidence - b.confidence)[0] : null;
    return {
        executed: executed.length,
        completed: executed.filter((record) => agentStatus(record) === 'completed').length,
        warnings: records.filter((record) => ['warning', 'human-review-required'].includes(agentStatus(record))).length,
        failed: records.filter((record) => agentStatus(record) === 'failed').length,
        humanReview: records.filter((record) => record.human_review_required).length,
        averageConfidence: executed.length ? executed.reduce((sum, record) => sum + record.confidence, 0) / executed.length : null,
        slowest,
        conservative,
        totalDurationMs: executed.length > 0 && durations.length === executed.length ? durations.reduce((sum, record) => sum + (record.duration_ms ?? 0), 0) : null,
    };
}

export function buildSigNozTraceLink(baseUrl: string | undefined, traceId: string | null | undefined): string | null {
    if (!baseUrl || !traceId) return null;
    try {
        const url = new URL(baseUrl.includes('{traceId}') ? baseUrl.replace('{traceId}', encodeURIComponent(traceId)) : baseUrl);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        if (!baseUrl.includes('{traceId}')) url.searchParams.set('traceId', traceId);
        return url.toString();
    } catch { return null; }
}

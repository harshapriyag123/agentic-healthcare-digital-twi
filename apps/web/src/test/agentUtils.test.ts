import { agentMetrics, buildSigNozTraceLink, confidenceBand, decisionPresentation } from '../agentUtils';
import { result } from './fixtures';

describe('agent presentation utilities', () => {
    it('uses non-clinical confidence interpretation bands', () => {
        expect([confidenceBand(.2), confidenceBand(.5), confidenceBand(.8), confidenceBand(.95)]).toEqual(['Low', 'Moderate', 'High', 'Very high']);
    });

    it('normalizes known decisions without changing backend values', () => {
        expect(decisionPresentation('quarantine-and-require-human-review')).toMatchObject({ label: 'Quarantine evidence', severity: 'danger' });
        expect(decisionPresentation('backend-new-action').label).toBe('backend new action');
    });

    it('calculates only supported duration aggregates', () => {
        const records = result().agent_decisions;
        expect(agentMetrics(records).executed).toBe(3);
        expect(agentMetrics(records).totalDurationMs).toBeCloseTo(2.09);
        expect(agentMetrics(records.map((record) => ({ ...record, duration_ms: null }))).totalDurationMs).toBeNull();
    });

    it('builds safe configurable SigNoz trace links', () => {
        expect(buildSigNozTraceLink('https://signoz.example/traces/{traceId}', 'abc123')).toBe('https://signoz.example/traces/abc123');
        expect(buildSigNozTraceLink('https://signoz.example/explorer', 'abc123')).toBe('https://signoz.example/explorer?traceId=abc123');
        expect(buildSigNozTraceLink('javascript:alert(1)', 'abc123')).toBeNull();
        expect(buildSigNozTraceLink(undefined, 'abc123')).toBeNull();
    });
});

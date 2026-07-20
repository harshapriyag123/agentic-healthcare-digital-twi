import type { CompletedRun } from '../types';
import { integrityBand, percent, riskBand } from '../utils';
import { RiskGauge } from './RiskGauge';

export function OperationalMetrics({ run }: { run: CompletedRun | null }) {
    const result = run?.result;
    const critical = result?.affected_hospitals.filter((hospital) => hospital.status === 'critical').length ?? null;
    return <section className="panel intelligence-panel">
        <div className="section-heading"><div><span className="eyebrow">03 · Interpret</span><h2>Operational Intelligence</h2></div></div>
        <div className="gauge-grid"><RiskGauge label="Regional risk" value={result?.regional_risk_score ?? null} classification={result ? riskBand(result.regional_risk_score) : undefined} /><RiskGauge label="Resilience" value={result?.resilience_score ?? null} classification={result ? riskBand(1 - result.resilience_score) === 'Low' ? 'Strong' : 'Under pressure' : undefined} /><RiskGauge label="Confidence" value={result?.trust.recommendation_confidence ?? null} classification={result ? integrityBand(result.trust.recommendation_confidence) : undefined} /></div>
        <div className="metric-cards"><div><span>Telemetry integrity</span><strong>{result ? percent(result.trust.telemetry_integrity) : 'Not evaluated'}</strong><small>{result ? integrityBand(result.trust.telemetry_integrity) : 'Run a scenario to calculate'}</small></div><div><span>Critical hospitals</span><strong>{critical ?? 'Not evaluated'}</strong><small>Backend facility status</small></div><div><span>Recommended transfers</span><strong>{result?.transfer_plan.length ?? 'Not evaluated'}</strong><small>Simulated planning actions</small></div></div>
        <p className="interpretation-note">Bands are interface interpretations for this research prototype, not validated clinical thresholds.</p>
    </section>;
}

import { percent } from '../utils';

export function RiskGauge({ label, value, classification }: { label: string; value: number | null; classification?: string }) {
    if (value === null) return <div className="gauge gauge--empty"><span>{label}</span><strong>Not evaluated</strong><small>Run a scenario to calculate</small></div>;
    const degrees = Math.max(0, Math.min(1, value)) * 360;
    return <div className="gauge" aria-label={`${label}: ${percent(value)} ${classification ?? ''}`}>
        <div className="gauge__ring" style={{ background: `conic-gradient(var(--accent) ${degrees}deg, #1e293b ${degrees}deg)` }}><div><strong>{percent(value)}</strong><small>{classification}</small></div></div><span>{label}</span>
    </div>;
}

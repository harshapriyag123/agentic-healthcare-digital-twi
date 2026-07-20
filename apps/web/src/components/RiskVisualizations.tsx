import type { CompletedRun, Hospital } from '../types';
import { percent, riskFactors, sortedHospitals } from '../utils';

function Bars({ title, items }: { title: string; items: Array<{ label: string; value: number; text?: string }> }) {
    return <div className="chart" role="img" aria-label={`${title}. ${items.map((item) => `${item.label} ${item.text ?? percent(item.value)}`).join(', ')}`}><h3>{title}</h3>{items.length === 0 ? <p className="muted">No data to chart.</p> : items.map((item) => <div className="bar" key={item.label}><span>{item.label}</span><div><i style={{ width: `${Math.min(100, Math.max(0, item.value * 100))}%` }} /></div><strong>{item.text ?? percent(item.value)}</strong></div>)}</div>;
}

export function RiskVisualizations({ run, hospitals }: { run: CompletedRun | null; hospitals: Hospital[] }) {
    if (!run) return <section className="panel"><div className="section-heading"><h2>Risk visualizations</h2></div><div className="empty-state">Run a simulation to populate charts.</div></section>;
    const states = sortedHospitals(run.result.affected_hospitals);
    const name = (id: string) => hospitals.find((item) => item.hospital_id === id)?.name ?? id;
    return <section className="panel visualizations"><div className="section-heading"><div><span className="eyebrow">Derived UI summaries</span><h2>Risk Visualizations</h2></div></div><div className="chart-grid">
        <Bars title="Hospital load comparison" items={states.map((state) => ({ label: name(state.hospital_id), value: state.load_ratio / 2, text: `${state.load_ratio.toFixed(2)}×` }))} />
        <Bars title="Disruption probability ranking" items={states.map((state) => ({ label: name(state.hospital_id), value: state.disruption_probability }))} />
        <Bars title="Risk-factor breakdown (hospital average)" items={riskFactors(states, run.result.trust.uncertainty)} />
    </div></section>;
}

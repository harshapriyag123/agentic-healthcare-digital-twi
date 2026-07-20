import type { CompletedRun } from '../types';
import { percent, sortedCounterfactuals } from '../utils';

export function CounterfactualSummary({ run }: { run: CompletedRun | null }) {
    const items = run ? sortedCounterfactuals(run.result) : [];
    return <section className="panel" id="counterfactuals"><div className="section-heading"><div><span className="eyebrow">Simulated estimates</span><h2>Counterfactual Interventions</h2></div>{run && <Link className="button button--ghost" to={`/counterfactuals/${run.result.simulation_id}`}>Open Counterfactual Explorer</Link>}</div>
        {!run ? <div className="empty-state">Run a simulation with counterfactuals enabled to compare interventions.</div> : items.length === 0 ? <div className="empty-state">No counterfactual results were returned.</div> : <div className="counterfactual-grid">{items.map((item, index) => <article className={index === 0 ? 'counterfactual--best' : ''} key={item.intervention}><span>#{index + 1}{index === 0 ? ' · Best estimated outcome' : ''}</span><h3>{item.intervention}</h3><dl><div><dt>Counterfactual risk</dt><dd>{percent(item.regional_risk_score)}</dd></div><div><dt>Risk reduction</dt><dd>{percent(item.risk_reduction)}</dd></div></dl><p>{item.risk_reduction > 0 ? 'Estimated to reduce regional risk relative to this simulation baseline.' : 'No estimated risk reduction from this baseline.'}</p></article>)}</div>}
    </section>;
}
import { Link } from 'react-router-dom';

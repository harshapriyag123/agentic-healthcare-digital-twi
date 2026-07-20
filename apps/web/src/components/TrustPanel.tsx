import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { CompletedRun } from '../types';
import { percent } from '../utils';

export function TrustPanel({ run }: { run: CompletedRun | null }) {
    const [expanded, setExpanded] = useState(false);
    return <section className="panel" id="trust-evidence"><div className="section-heading"><div><span className="eyebrow">Trustworthy AI controls</span><h2>Trust & Evidence</h2></div></div>
        {!run ? <div className="empty-state">Trust assessment has not been calculated.</div> : <><div className="trust-grid"><div><span>Evidence completeness</span><strong>{percent(run.result.trust.evidence_completeness)}</strong></div><div><span>Telemetry integrity</span><strong>{percent(run.result.trust.telemetry_integrity)}</strong></div><div><span>Uncertainty</span><strong>{percent(run.result.trust.uncertainty)}</strong></div><div><span>Geographic coverage</span><strong>{percent(run.result.trust.geographic_coverage)}</strong></div><div><span>Policy compliance</span><strong>{run.result.trust.policy_compliance ? 'Satisfied' : 'Review required'}</strong></div><div><span>Recommendation confidence</span><strong>{percent(run.result.trust.recommendation_confidence)}</strong></div></div>
            <button type="button" className="link-button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>How the trust assessment affects recommendations</button>{expanded && <p className="explanation">Lower data integrity and higher uncertainty reduce recommendation confidence. The integrity agent may quarantine evidence and require authorized human review before any operational action.</p>}
            <Link className="button button--primary" to={`/trust/${run.result.simulation_id}`}>Open Trust Dashboard</Link>
            <h3>Evidence signals</h3>{run.result.evidence.length === 0 ? <p>No evidence items were returned.</p> : <div className="evidence-list">{run.result.evidence.map((item) => <article id={`evidence-${item.evidence_id}`} className={item.reliability < 0.65 ? 'evidence--weak' : ''} key={item.evidence_id}><div><strong>{item.signal.replaceAll('_', ' ')}</strong><span>{item.source}</span></div><code>{String(item.value)}</code><span>Reliability {percent(item.reliability)}</span></article>)}</div>}
        </>}
    </section>;
}

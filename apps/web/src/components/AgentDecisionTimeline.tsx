import type { CompletedRun } from '../types';
import { percent } from '../utils';

export function AgentDecisionTimeline({ run }: { run: CompletedRun | null }) {
    return <section className="panel" id="agent-decisions"><div className="section-heading"><div><span className="eyebrow">Agentic workflow</span><h2>Agent Decision Activity</h2></div></div>
        {!run ? <div className="empty-state">Agent decisions appear after simulation.</div> : run.result.agent_decisions.length === 0 ? <div className="empty-state">No agent decisions were returned.</div> : <ol className="timeline">{run.result.agent_decisions.map((decision) => <li key={decision.agent}><span className="timeline__dot" /><div><span className="status status--info">{decision.action.replaceAll('-', ' ')}</span><h3>{decision.agent}</h3><strong>Confidence {percent(decision.confidence)}</strong><p>{decision.explanation}</p>{run.result.trust.human_review_required && <small>Human review applies to this recommendation.</small>}</div></li>)}</ol>}
    </section>;
}

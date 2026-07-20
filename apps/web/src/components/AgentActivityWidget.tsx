import { useNavigate } from 'react-router-dom';

import { agentLabel, agentMapFocus, agentMetrics, agentStatus, orderedAgents } from '../agentUtils';
import { useSimulation } from '../SimulationContext';
import type { CompletedRun } from '../types';
import { percent } from '../utils';

export function AgentActivityWidget({ run }: { run: CompletedRun | null }) {
    const navigate = useNavigate();
    const { runState, setSelectedAgentId, setAgentMapFocus, setSelectedHospitalId } = useSimulation();
    if (runState === 'loading') return <section className="panel agent-widget" id="agent-decisions"><span className="eyebrow">Expected processing sequence</span><h2>Agent Activity</h2><p>Expected workflow only; live agent status is not streamed.</p><div className="agent-widget__skeleton">Detection → Security → Twin → Planning → Trust → Response</div></section>;
    if (!run) return <section className="panel agent-widget" id="agent-decisions"><span className="eyebrow">Agent execution record</span><h2>Agent Activity</h2><div className="empty-state">Run a simulation to inspect agent execution.</div></section>;
    const records = orderedAgents(run.result.agent_decisions);
    const metrics = agentMetrics(records);
    const latest = records.at(-1);
    const open = (record = latest) => {
        if (record) {
            setSelectedAgentId(record.agent_id ?? record.agent);
            const focus = agentMapFocus(record);
            setAgentMapFocus(focus);
            if (focus === 'cyber') setSelectedHospitalId(run.request.cyber_event.target_hospital_id);
        }
        navigate(`/agents/${run.result.simulation_id}`);
    };
    return <section className="panel agent-widget" id="agent-decisions"><div className="section-heading"><div><span className="eyebrow">Agent execution record</span><h2>Agent Activity</h2></div><button className="button button--ghost" type="button" onClick={() => open()}>Open Agent Console</button></div><div className="agent-widget__metrics"><div><span>Agents executed</span><strong>{metrics.executed}</strong></div><div><span>Warnings</span><strong>{metrics.warnings}</strong></div><div><span>Average confidence</span><strong>{metrics.averageConfidence === null ? 'Unavailable' : percent(metrics.averageConfidence)}</strong></div><div><span>Human review</span><strong>{metrics.humanReview ? 'Required' : 'No component flag'}</strong></div></div>{latest && <button type="button" className={`agent-widget__latest agent-widget__latest--${agentStatus(latest)}`} onClick={() => open(latest)}><span>Latest decision</span><strong>{agentLabel(latest)}</strong><small>{latest.action.replaceAll('-', ' ')}</small></button>}</section>;
}

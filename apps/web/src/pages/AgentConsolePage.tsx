import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { agentLabel, agentMapFocus, agentMetrics, buildSigNozTraceLink, orderedAgents } from '../agentUtils';
import { AgentDetailPanel, AgentErrorPanel, AgentExecutionGraph, AgentSummaryMetrics, AgentTimeline, ExpectedWorkflowSkeleton, PlannedAgentsRoadmap } from '../components/AgentConsole';
import { useSimulation } from '../SimulationContext';
import type { AgentDecision } from '../types';

export function AgentConsolePage() {
    const { simulationId } = useParams();
    const navigate = useNavigate();
    const context = useSimulation();
    const run = simulationId ? context.runs.find((item) => item.result.simulation_id === simulationId) ?? null : context.activeRun;
    const records = orderedAgents(run?.result.agent_decisions ?? []);
    const selected = records.find((record) => (record.agent_id ?? record.agent) === context.selectedAgentId) ?? records[0] ?? null;
    const metrics = agentMetrics(records);
    const configuredSigNozUrl = import.meta.env.VITE_SIGNOZ_DASHBOARD_URL as string | undefined;
    const traceLink = buildSigNozTraceLink(configuredSigNozUrl, run?.result.trace_id);

    useEffect(() => {
        if (selected && !context.selectedAgentId) context.setSelectedAgentId(selected.agent_id ?? selected.agent);
    }, [selected, context]);

    const select = (record: AgentDecision) => {
        context.setSelectedAgentId(record.agent_id ?? record.agent);
        const focus = agentMapFocus(record);
        context.setAgentMapFocus(focus);
        if (focus === 'cyber' && run) context.setSelectedHospitalId(run.request.cyber_event.target_hospital_id);
    };

    if (context.catalogState === 'loading') return <div className="page-state" role="status">Loading agent console…</div>;
    if (context.runState === 'loading' && !run) return <ExpectedWorkflowSkeleton />;
    if (!run) return <div className="page-state"><h1>Agent execution record unavailable</h1><p>{simulationId ? 'This simulation is not available in the current browser session.' : 'Run a synthetic scenario before opening the Agent Activity Console.'}</p><Link className="button button--primary" to="/command-center">Open Command Center</Link></div>;

    return <div className="agent-console-page"><header className="page-header"><div><span className="eyebrow">Orchestration observability</span><h1>Agent Activity Console</h1><p>Inspect completed decision-support execution records. This page does not expose private reasoning or imply autonomous clinical action.</p><div className="button-row"><Link className="button button--ghost" to={`/counterfactuals/${run.result.simulation_id}`}>Open Counterfactual Explorer</Link><Link className="button button--ghost" to={`/trust/${run.result.simulation_id}`}>Open Trust Dashboard</Link></div></div><label className="simulation-selector">Simulation<select aria-label="Simulation selector" value={run.result.simulation_id} onChange={(event) => navigate(`/agents/${event.target.value}`)}>{context.runs.map((item) => <option value={item.result.simulation_id} key={item.result.simulation_id}>{item.scenario.name} · {item.result.simulation_id.slice(0, 8)}</option>)}</select></label></header>
        {context.runState === 'loading' && <ExpectedWorkflowSkeleton />}
        <div className="warning"><strong>Authorized human review required</strong><span>Agent outputs are simulated research recommendations, not clinical or emergency-response instructions.</span></div>
        <AgentSummaryMetrics records={records} />
        <AgentExecutionGraph records={records} selectedId={selected?.agent_id ?? selected?.agent ?? null} onSelect={select} />
        <div className="agent-console-grid"><AgentTimeline records={records} selectedId={selected?.agent_id ?? selected?.agent ?? null} onSelect={select} /><AgentDetailPanel record={selected} run={run} /></div>
        <section className="panel agent-observability" id="agent-observability"><div className="section-heading"><div><span className="eyebrow">OpenTelemetry correlation</span><h2>Execution Observability</h2></div></div><dl className="metric-list"><div><dt>Simulation ID</dt><dd><code>{run.result.simulation_id}</code></dd></div><div><dt>Trace ID</dt><dd><code>{run.result.trace_id ?? 'Not exposed'}</code></dd></div><div><dt>Backend simulation duration</dt><dd>{run.result.duration_ms === null || run.result.duration_ms === undefined ? 'Not exposed by backend' : `${run.result.duration_ms.toFixed(3)} ms`}</dd></div><div><dt>Slowest agent span</dt><dd>{metrics.slowest ? `${agentLabel(metrics.slowest)} · ${metrics.slowest.duration_ms?.toFixed(3)} ms` : 'Not exposed by backend'}</dd></div><div><dt>Failed execution records</dt><dd>{metrics.failed}</dd></div><div><dt>Records with span IDs</dt><dd>{records.filter((record) => record.span_id).length} of {records.length}</dd></div></dl>{traceLink ? <a className="button button--primary" href={traceLink} target="_blank" rel="noreferrer">Open correlated trace in SigNoz</a> : <button className="button button--ghost" type="button" disabled>{!configuredSigNozUrl ? 'SigNoz dashboard URL not configured' : !run.result.trace_id ? 'Trace ID not exposed by backend' : 'SigNoz trace URL is invalid'}</button>}{!run.result.trace_id && <p className="muted">Trace correlation is recorded by the backend but is not currently exposed through the API for this run.</p>}</section>
        <AgentErrorPanel records={records} />
        <PlannedAgentsRoadmap />
        <section className="panel safety-boundary"><h2>Research safety boundary</h2><p>Research decision-support prototype using synthetic data. Agent outputs are simulated recommendations, require authorized human review, and are not clinical instructions.</p></section>
        <div className="sr-only" aria-live="polite">Loaded {records.length} execution records for {run.scenario.name}.</div>
    </div>;
}

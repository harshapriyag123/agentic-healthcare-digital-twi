import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmbeddedTraceDashboard } from '../components/EmbeddedTraceDashboard';
import { useSimulation } from '../SimulationContext';
import type { CompletedRun, ObservabilityHealth } from '../types';

type WorkspaceModule = 'overview' | 'trace' | 'logs' | 'service-map';

function validatedWorkspaceUrl() {
    const raw = import.meta.env.VITE_SIGNOZ_APP_URL?.trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        if (parsed.protocol === 'https:') return parsed.toString();
        if (import.meta.env.DEV && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) return parsed.toString();
    } catch {
        // Invalid public configuration is represented safely by the readiness view.
    }
    return '';
}

function configuredMode() {
    const mode = import.meta.env.VITE_SIGNOZ_MODE?.trim().toLowerCase();
    if (mode === 'simulation') return 'simulation';
    if (mode === 'external' && validatedWorkspaceUrl()) return 'external';
    return validatedWorkspaceUrl() ? 'external' : 'readiness';
}

function SimulationWorkspace({ run, observabilityHealth, onRun, running, canRun }: {
    run: CompletedRun | null;
    observabilityHealth: ObservabilityHealth | null;
    onRun: () => void;
    running: boolean;
    canRun: boolean;
}) {
    const [module, setModule] = useState<WorkspaceModule>('overview');
    const records = useMemo(
        () => [...(run?.result.agent_decisions ?? [])].sort((left, right) => (left.sequence ?? 99) - (right.sequence ?? 99)),
        [run],
    );
    const durations = records.map((record) => record.duration_ms).filter((value): value is number => value != null);
    const slowest = records.reduce<(typeof records)[number] | null>((current, record) => (
        (record.duration_ms ?? -1) > (current?.duration_ms ?? -1) ? record : current
    ), null);
    const attention = records.filter((record) => ['warning', 'failed', 'human-review-required'].includes(record.status ?? '')).length;
    const totalDuration = run?.result.duration_ms ?? durations.reduce((sum, value) => sum + value, 0);
    const maxDuration = Math.max(...durations, 1);

    return <div className="signoz-native">
        <header className="page-header">
            <div>
                <span className="eyebrow">Interactive observability demonstration</span>
                <h1>SigNoz Simulation Workspace</h1>
                <p>Explore trace-shaped execution evidence, correlated event logs, service flow, and trust signals produced by the latest real GeoTwin simulation.</p>
            </div>
            <div className="button-row">
                <span className="connection connection--pending">Simulation mode</span>
                <button className="button button--primary" type="button" onClick={onRun} disabled={running || !canRun}>{running ? 'Running…' : run ? 'Run new simulation' : 'Run simulation'}</button>
            </div>
        </header>

        <div className="warning signoz-simulation-notice">
            <strong>Authentic simulation boundary</strong>
            <span>This is a SigNoz-style visualization of actual browser-session execution records. It is not a SigNoz Cloud instance and does not claim persisted telemetry.</span>
        </div>

        <nav className="signoz-workspace__modules" aria-label="SigNoz simulation modules">
            {([
                ['overview', 'Overview'],
                ['trace', 'Traces'],
                ['logs', 'Logs'],
                ['service-map', 'Service Map'],
            ] as const).map(([id, label]) => <button key={id} type="button" className={module === id ? 'active' : ''} aria-pressed={module === id} onClick={() => setModule(id)}>{label}</button>)}
        </nav>

        {!run ? <section className="panel empty-state">
            <h2>No execution evidence yet</h2>
            <p>Run a synthetic scenario to populate the simulated service overview, spans, structured logs, and trust-aware agent activity.</p>
            <button className="button button--primary" type="button" onClick={onRun} disabled={running || !canRun}>{running ? 'Running simulation…' : 'Generate observability data'}</button>
        </section> : <section className="signoz-native__content">
            {module === 'overview' && <>
                <div className="signoz-native-kpis">
                    <article><span>Service</span><strong>{observabilityHealth?.service ?? 'geotwin-api'}</strong></article>
                    <article><span>Simulation latency</span><strong>{totalDuration.toFixed(2)} ms</strong></article>
                    <article><span>Execution records</span><strong>{records.length}</strong></article>
                    <article><span>Review signals</span><strong>{attention}</strong></article>
                </div>
                <article className="signoz-native-service">
                    <span>Service overview</span>
                    <h2>{run.scenario.name}</h2>
                    <dl>
                        <div><dt>Regional risk</dt><dd>{Math.round(run.result.regional_risk_score * 100)}%</dd></div>
                        <div><dt>Resilience</dt><dd>{Math.round(run.result.resilience_score * 100)}%</dd></div>
                        <div><dt>Trust</dt><dd>{Math.round((run.result.trust.trust_score ?? run.result.trust.recommendation_confidence) * 100)}%</dd></div>
                        <div><dt>Critical hospitals</dt><dd>{run.result.affected_hospitals.filter((hospital) => hospital.status === 'critical').length}</dd></div>
                        <div><dt>Slowest stage</dt><dd>{slowest?.agent_name ?? slowest?.agent ?? 'Unavailable'}</dd></div>
                        <div><dt>Human review</dt><dd>{run.result.trust.human_review_required ? 'Required' : 'Not triggered'}</dd></div>
                    </dl>
                </article>
            </>}

            {module === 'trace' && <div className="embedded-trace__dashboard" role="region" aria-label="Simulated SigNoz trace dashboard">
                <header><div><span className="eyebrow">Session execution correlation</span><h2>Simulation trace preview</h2></div><span className="connection connection--pending">Not persisted</span></header>
                <dl className="embedded-trace__identity">
                    <div><dt>Simulation ID</dt><dd><code>{run.result.simulation_id}</code></dd></div>
                    <div><dt>Cloud trace ID</dt><dd><code>{run.result.trace_id ?? 'Unavailable in simulation mode'}</code></dd></div>
                    <div><dt>Root duration</dt><dd>{totalDuration.toFixed(3)} ms</dd></div>
                    <div><dt>Child records</dt><dd>{records.length}</dd></div>
                </dl>
                <div className="trace-waterfall__rows">
                    {records.map((record, index) => {
                        const width = Math.max(8, ((record.duration_ms ?? 0) / maxDuration) * 100);
                        return <div className="trace-waterfall__row" key={record.agent_id ?? `${record.agent}-${index}`}>
                            <div><strong>{record.agent_name ?? record.agent}</strong><small>{record.stage ?? 'execution'} · {record.span_id ? `span ${record.span_id}` : 'session record'}</small></div>
                            <div className="trace-waterfall__track"><i className={record.status === 'failed' ? 'trace-waterfall__bar--error' : ''} style={{ left: '0%', width: `${width}%` }} /></div>
                            <b>{record.duration_ms == null ? 'n/a' : `${record.duration_ms.toFixed(3)} ms`}</b>
                        </div>;
                    })}
                </div>
            </div>}

            {module === 'logs' && <div className="signoz-native-logs" role="region" aria-label="Simulated structured logs">
                {records.map((record, index) => <article key={record.agent_id ?? `${record.agent}-${index}`}>
                    <time>{record.completed_at ? new Date(record.completed_at).toLocaleTimeString() : `event ${index + 1}`}</time>
                    <strong>{record.agent_name ?? record.agent}</strong>
                    <span className={`agent-status agent-status--${record.status ?? 'completed'}`}>{record.status ?? 'completed'}</span>
                    <p><code>agent.decision.completed</code> · {record.action} · confidence {Math.round(record.confidence * 100)}% · {record.explanation}</p>
                </article>)}
            </div>}

            {module === 'service-map' && <div className="signoz-native-map" role="region" aria-label="Simulated service map">
                <article><strong>GeoTwin Web</strong><small>React command center</small></article><i aria-hidden="true">→</i>
                <article><strong>GeoTwin API</strong><small>FastAPI · {totalDuration.toFixed(2)} ms</small></article><i aria-hidden="true">→</i>
                <article><strong>Digital Twin</strong><small>{run.result.affected_hospitals.length} hospitals</small></article><i aria-hidden="true">→</i>
                <article><strong>Agent + Trust</strong><small>{records.length} execution records</small></article>
            </div>}
        </section>}

        {run?.result.trace_id && observabilityHealth?.exporter_active && <section className="panel">
            <div className="section-heading"><div><span className="eyebrow">Configured exporter</span><h2>Persisted Trace Query</h2></div></div>
            <EmbeddedTraceDashboard simulationId={run.result.simulation_id} traceId={run.result.trace_id} stages={records.map((record) => ({ name: record.agent_name ?? record.agent, status: record.status, durationMs: record.duration_ms, spanId: record.span_id }))} />
        </section>}
    </div>;
}

export function SigNozWorkspacePage() {
    const { activeRun, catalogState, configuration, health, observabilityHealth, runSimulation, runState } = useSimulation();
    const signozAppUrl = validatedWorkspaceUrl();
    const mode = configuredMode();
    const records = activeRun?.result.agent_decisions ?? [];
    const completed = records.filter((record) => record.status === 'completed').length;
    const attention = records.filter((record) => ['warning', 'failed', 'human-review-required'].includes(record.status ?? '')).length;

    if (mode === 'external' && signozAppUrl) {
        return <div className="signoz-native">
            <section className="panel signoz-workspace__header">
                <div><span className="eyebrow">Configured external workspace</span><h1>SigNoz Cloud</h1><p>Open the authenticated workspace to verify persisted traces, metrics, logs, dashboards, and alerts.</p></div>
                <a className="button button--secondary" href={signozAppUrl} target="_blank" rel="noreferrer">Open SigNoz</a>
            </section>
            <SimulationWorkspace run={activeRun} observabilityHealth={observabilityHealth} onRun={() => void runSimulation()} running={runState === 'loading'} canRun={Boolean(configuration)} />
        </div>;
    }

    if (mode === 'simulation') {
        return <SimulationWorkspace run={activeRun} observabilityHealth={observabilityHealth} onRun={() => void runSimulation()} running={runState === 'loading'} canRun={Boolean(configuration)} />;
    }

    return <div className="signoz-native">
        <header className="page-header">
            <div><span className="eyebrow">Observable by design · honest about deployment state</span><h1>Observability Readiness</h1><p>The application remains usable without an external telemetry vendor. This view separates live execution evidence from capabilities that require a configured SigNoz deployment.</p></div>
            <Link className="button button--primary" to="/command-center">Run a simulation</Link>
        </header>

        <section className="panel">
            <div className="section-heading"><div><span className="eyebrow">Live deployment facts</span><h2>Telemetry Status</h2></div></div>
            <div className="signoz-native-kpis">
                <article><span>API</span><strong>{catalogState === 'loading' ? 'Waking…' : health?.status === 'ok' ? 'Healthy' : 'Unavailable'}</strong></article>
                <article><span>OpenTelemetry SDK</span><strong>{observabilityHealth?.enabled ? 'Enabled' : observabilityHealth ? 'Disabled' : 'Unknown'}</strong></article>
                <article><span>OTLP exporter</span><strong>{observabilityHealth?.exporter_active ? 'Active' : 'Not active'}</strong></article>
                <article><span>Persisted SigNoz data</span><strong>{observabilityHealth?.exporter_active ? 'Exporter active; verify receipt' : 'Not claimed'}</strong></article>
            </div>
            {!observabilityHealth?.exporter_active && <div className="warning"><strong>SigNoz is not connected in this deployment</strong><span>Simulations still run fail-open. No persisted trace, dashboard, alert, or export-success claim is made.</span></div>}
        </section>

        <section className="panel">
            <div className="section-heading"><div><span className="eyebrow">Latest browser-session result</span><h2>Execution Evidence</h2></div></div>
            {activeRun ? <>
                <dl className="metric-list"><div><dt>Simulation</dt><dd><code>{activeRun.result.simulation_id}</code></dd></div><div><dt>Scenario</dt><dd>{activeRun.scenario.name}</dd></div><div><dt>Backend duration</dt><dd>{activeRun.result.duration_ms == null ? 'Not exposed' : `${activeRun.result.duration_ms.toFixed(3)} ms`}</dd></div><div><dt>Execution records</dt><dd>{records.length}</dd></div><div><dt>Completed</dt><dd>{completed}</dd></div><div><dt>Needs attention</dt><dd>{attention}</dd></div></dl>
                <EmbeddedTraceDashboard simulationId={activeRun.result.simulation_id} traceId={activeRun.result.trace_id} stages={records.map((record) => ({ name: record.agent_name ?? record.agent, status: record.status, durationMs: record.duration_ms, spanId: record.span_id }))} />
                {!activeRun.result.trace_id && <p className="muted">The API returned decision records and measured durations, but no trace ID because telemetry export is disabled or unavailable. These records are not presented as persisted SigNoz spans.</p>}
            </> : <div className="empty-state"><h3>No execution selected</h3><p>Run a scenario to populate auditable agent records, durations, evidence links, and review flags.</p></div>}
        </section>

        <section className="panel observability-boundary">
            <div className="section-heading"><div><span className="eyebrow">Authenticity boundary</span><h2>What Works vs. What Requires Configuration</h2></div></div>
            <div className="observability-facts">
                <article><strong>Implemented now</strong><p>Structured event logs, bounded metrics, nested span instrumentation, trace-safe attributes, execution durations, and fail-open behavior.</p></article>
                <article><strong>Verified in the app</strong><p>Simulation IDs, ordered agent records, evidence dependencies, human-review reasons, and measured backend/client durations.</p></article>
                <article><strong>Requires SigNoz</strong><p>Persisted traces, cross-request search, dashboards, alert rules, retention, and exporter delivery verification.</p></article>
            </div>
            <p className="disclaimer-inline">Never place OTLP ingestion keys or private dashboard tokens in <code>VITE_*</code> variables. Export credentials belong only in the backend deployment secret store.</p>
        </section>
    </div>;
}

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { EmbeddedTraceDashboard } from '../components/EmbeddedTraceDashboard';
import { useSimulation } from '../SimulationContext';

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

const signozAppUrl = validatedWorkspaceUrl();

export function SigNozWorkspacePage() {
    const [loading, setLoading] = useState(true);
    const { activeRun, catalogState, health, observabilityHealth } = useSimulation();
    const records = activeRun?.result.agent_decisions ?? [];
    const completed = records.filter((record) => record.status === 'completed').length;
    const attention = records.filter((record) => ['warning', 'failed', 'human-review-required'].includes(record.status ?? '')).length;

    if (signozAppUrl) {
        return (
            <div className="signoz-workspace">
                <header className="signoz-workspace__header">
                    <div>
                        <span className="eyebrow">Configured observability workspace</span>
                        <h1>SigNoz</h1>
                        <p>Open the access-appropriate workspace to inspect persisted traces, metrics, and logs.</p>
                    </div>
                    <a className="button button--secondary" href={signozAppUrl} target="_blank" rel="noreferrer">Open SigNoz</a>
                </header>
                <div className="signoz-workspace__frame">
                    {loading && <div className="signoz-workspace__loading">Loading the configured SigNoz workspace…</div>}
                    <iframe src={signozAppUrl} title="Configured SigNoz application" onLoad={() => setLoading(false)} allow="clipboard-read; clipboard-write; fullscreen" />
                </div>
            </div>
        );
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
                <article><span>Persisted SigNoz data</span><strong>{observabilityHealth?.exporter_active ? 'Query enabled' : 'Not claimed'}</strong></article>
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

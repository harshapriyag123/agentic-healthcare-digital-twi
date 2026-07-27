import type { CompletedRun, RequestState } from '../types';
import { EmbeddedTraceDashboard } from './EmbeddedTraceDashboard';

export function ObservabilityPanel({ run, requestState }: { run: CompletedRun | null; requestState: RequestState }) {
    const url = import.meta.env.VITE_SIGNOZ_DASHBOARD_URL as string | undefined;
    return <section className="panel observability" id="observability"><div className="section-heading"><div><span className="eyebrow">Evidence-to-decision lineage</span><h2>Observability powered by SigNoz</h2></div></div><dl className="metric-list"><div><dt>Simulation ID</dt><dd>{run?.result.simulation_id ?? 'Not available'}</dd></div><div><dt>Scenario</dt><dd>{run?.scenario.name ?? 'Not evaluated'}</dd></div><div><dt>API request state</dt><dd>{requestState}</dd></div><div><dt>Client duration</dt><dd>{run ? `${run.durationMs.toFixed(0)} ms` : 'Not measured'}</dd></div><div><dt>Telemetry configuration</dt><dd>{url ? 'Dashboard URL configured' : 'SigNoz dashboard URL not configured'}</dd></div><div><dt>Trace correlation</dt><dd>{run?.result.trace_id ?? 'Trace correlation is recorded by the backend but is not currently exposed through the API.'}</dd></div></dl>
        {url ? <EmbeddedTraceDashboard simulationId={run?.result.simulation_id} traceId={run?.result.trace_id} stages={run?.result.agent_decisions.map((record) => ({ name: record.agent_name ?? record.agent, status: record.status, durationMs: record.duration_ms, spanId: record.span_id }))} /> : <button className="button button--ghost" type="button" disabled>SigNoz dashboard URL not configured</button>}
    </section>;
}

import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../api';
import type { TraceWaterfall } from '../types';

type TraceStage = {
    name: string;
    status?: string;
    durationMs?: number | null;
    spanId?: string | null;
};

export function EmbeddedTraceDashboard({
    simulationId,
    traceId,
    stages = [],
}: {
    simulationId: string | null | undefined;
    traceId: string | null | undefined;
    stages?: TraceStage[];
}) {
    const [expanded, setExpanded] = useState(true);
    const [waterfall, setWaterfall] = useState<TraceWaterfall | null>(null);
    const [traceState, setTraceState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
    const [refreshToken, setRefreshToken] = useState(0);
    const completed = stages.filter((stage) => stage.status === 'completed').length;
    const attention = stages.filter((stage) => ['warning', 'failed', 'human-review-required'].includes(stage.status ?? '')).length;

    const loadTrace = useCallback(async (active: () => boolean) => {
        if (!traceId) return;
        setTraceState('loading');
        for (let attempt = 0; attempt < 6; attempt += 1) {
            try {
                const result = await api.trace(traceId);
                if (!active()) return;
                setWaterfall(result);
                setTraceState('ready');
                return;
            } catch {
                if (!active()) return;
                if (attempt < 5) await new Promise((resolve) => globalThis.setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
        if (active()) {
            setWaterfall(null);
            setTraceState('unavailable');
        }
    }, [traceId]);

    useEffect(() => {
        if (!traceId) {
            setWaterfall(null);
            setTraceState('idle');
            return;
        }
        let active = true;
        void loadTrace(() => active);
        return () => { active = false; };
    }, [traceId, refreshToken, loadTrace]);

    const traceMetrics = useMemo(() => {
        if (!waterfall) return null;
        const errors = waterfall.spans.filter((span) => span.has_error).length;
        const services = [...new Set(waterfall.spans.map((span) => span.service_name))];
        const operationCounts = waterfall.spans.reduce<Record<string, number>>((counts, span) => {
            counts[span.name] = (counts[span.name] ?? 0) + 1;
            return counts;
        }, {});
        const operations = Object.entries(operationCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const longest = [...waterfall.spans].sort((a, b) => b.duration_nano - a.duration_nano).slice(0, 8);
        return { errors, services, operations, longest };
    }, [waterfall]);

    if (!simulationId || !traceId) {
        return <button className="button button--ghost" type="button" disabled>Embedded trace is available after a telemetry-enabled simulation</button>;
    }

    return <div className="embedded-trace">
        <button
            className="button button--primary"
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
        >
            {expanded ? 'Hide embedded trace dashboard' : 'Show embedded trace dashboard'}
        </button>
        {expanded && <section className="embedded-trace__dashboard" aria-label="Embedded SigNoz trace dashboard">
            <header>
                <div><span className="eyebrow">In-app telemetry correlation</span><h3>Simulation trace</h3></div>
                <span className={`connection ${waterfall ? 'connection--ok' : 'connection--down'}`}>{waterfall ? 'SigNoz persisted' : 'Awaiting SigNoz'}</span>
            </header>
            <dl className="embedded-trace__identity">
                <div><dt>Simulation ID</dt><dd><code>{simulationId}</code></dd></div>
                <div><dt>Trace ID</dt><dd><code>{traceId}</code></dd></div>
                <div><dt>Recorded stages</dt><dd>{stages.length || 'Trace-level correlation'}</dd></div>
                <div><dt>Needs attention</dt><dd>{attention}</dd></div>
            </dl>
            <div className="trace-waterfall" aria-label="SigNoz span waterfall">
                <div className="trace-waterfall__heading">
                    <strong>Persisted SigNoz spans</strong>
                    <div><span>{traceState === 'loading' ? 'Waiting for SigNoz ingestion…' : waterfall ? `${waterfall.span_count} spans · ${(waterfall.duration_nano / 1_000_000).toFixed(2)} ms` : 'Trace data unavailable'}</span><button className="link-button" type="button" onClick={() => setRefreshToken((value) => value + 1)} disabled={traceState === 'loading'}>Refresh trace</button></div>
                </div>
                {traceMetrics && <>
                    <div className="signoz-kpis">
                        <article><span>Total spans</span><strong>{waterfall?.span_count}</strong></article>
                        <article><span>Trace latency</span><strong>{((waterfall?.duration_nano ?? 0) / 1_000_000).toFixed(2)} ms</strong></article>
                        <article><span>Errors</span><strong>{traceMetrics.errors}</strong></article>
                        <article><span>Services</span><strong>{traceMetrics.services.length}</strong></article>
                    </div>
                    <div className="signoz-charts">
                        <section aria-label="Span volume by operation"><h4>Span volume by operation</h4>{traceMetrics.operations.map(([name, count]) => <div className="signoz-chart-row" key={name}><span>{name}</span><i><b style={{ width: `${count / Math.max(...traceMetrics.operations.map((item) => item[1])) * 100}%` }} /></i><strong>{count}</strong></div>)}</section>
                        <section aria-label="Longest spans"><h4>Longest spans</h4>{traceMetrics.longest.map((span) => <div className="signoz-chart-row" key={span.span_id}><span>{span.name}</span><i><b style={{ width: `${span.duration_nano / Math.max(...traceMetrics.longest.map((item) => item.duration_nano)) * 100}%` }} /></i><strong>{(span.duration_nano / 1_000_000).toFixed(2)} ms</strong></div>)}</section>
                    </div>
                </>}
                {waterfall && <div className="trace-waterfall__rows">
                    {waterfall.spans.map((span) => {
                        const total = Math.max(waterfall.duration_nano, 1);
                        const left = Math.min(99, span.offset_nano / total * 100);
                        const width = Math.max(.35, Math.min(100 - left, span.duration_nano / total * 100));
                        return <div className="trace-waterfall__row" key={span.span_id} title={`${span.name} · ${(span.duration_nano / 1_000_000).toFixed(3)} ms`}>
                            <div><strong>{span.name}</strong><small>{span.service_name} · {span.span_id}</small></div>
                            <div className="trace-waterfall__track"><i className={span.has_error ? 'trace-waterfall__bar--error' : ''} style={{ left: `${left}%`, width: `${width}%` }} /></div>
                            <b>{(span.duration_nano / 1_000_000).toFixed(3)} ms</b>
                        </div>;
                    })}
                </div>}
                {traceState === 'loading' && <p className="muted">SigNoz batches telemetry before persistence. This dashboard will retry automatically for up to 15 seconds.</p>}
                {traceState === 'unavailable' && <p className="muted">Persisted SigNoz spans could not be queried after retries. Confirm the collector and ClickHouse are running, then select Refresh trace.</p>}
            </div>
            {stages.length > 0 && <>
                <div className="embedded-trace__summary">
                    <span>{completed} completed</span>
                    <span>{attention} warning/review</span>
                </div>
                <ol className="embedded-trace__timeline">
                    {stages.map((stage, index) => <li key={`${stage.name}-${index}`}>
                        <i aria-hidden="true" />
                        <div><strong>Stage: {stage.name}</strong><small>{stage.spanId ? `Span ${stage.spanId}` : 'Correlated execution stage'}</small></div>
                        <span className={`agent-status agent-status--${stage.status ?? 'completed'}`}>{stage.status ?? 'completed'}</span>
                        <b>{stage.durationMs == null ? 'Duration unavailable' : `${stage.durationMs.toFixed(1)} ms`}</b>
                    </li>)}
                </ol>
            </>}
            <p className="disclaimer-inline">Displayed inside GeoTwin to avoid redirecting operators to a separate SigNoz login. The configured OTLP collector remains the telemetry destination.</p>
        </section>}
    </div>;
}

import { useEffect, useState } from 'react';

import type { RequestState } from '../types';

const stages = ['Validating scenario', 'Assessing telemetry integrity', 'Building healthcare dependency graph', 'Evaluating facility capacity', 'Running agent decisions', 'Calculating transfer plan', 'Testing counterfactual interventions', 'Publishing OpenTelemetry signals', 'Simulation complete'];

export function SimulationProgress({ state, scenarioName }: { state: RequestState; scenarioName: string }) {
    const [stage, setStage] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (state !== 'loading') {
            if (state === 'success') setStage(stages.length - 1);
            return;
        }
        setStage(0); setElapsed(0);
        const started = performance.now();
        const timer = window.setInterval(() => {
            setElapsed(performance.now() - started);
            setStage((current) => Math.min(current + 1, stages.length - 2));
        }, 450);
        return () => window.clearInterval(timer);
    }, [state]);
    if (state === 'idle') return null;
    return <section className="panel progress-panel" aria-live="polite">
        <div><span className="eyebrow">Simulation processing stages</span><strong>{scenarioName}</strong><small>Client-side stage indicator; the API returns a completed response.</small></div>
        <div className="progress-track"><span style={{ width: `${((stage + 1) / stages.length) * 100}%` }} /></div>
        <div className="progress-meta"><span>{state === 'error' ? 'Simulation interrupted' : stages[stage]}</span><span>{(elapsed / 1000).toFixed(1)}s elapsed</span></div>
    </section>;
}

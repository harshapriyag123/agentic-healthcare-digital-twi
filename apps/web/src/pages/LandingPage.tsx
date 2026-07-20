import { Link, useNavigate } from 'react-router-dom';

import { useSimulation } from '../SimulationContext';

const flow = ['Healthcare Network', 'Compound Disruption', 'Digital Twin', 'Agent Analysis', 'Trust Evaluation', 'Resilience Intervention', 'SigNoz Observability'];

export function LandingPage() {
    const { hospitals, scenarios, runs, health, setSelectedScenario, runSimulation, runState } = useSimulation();
    const navigate = useNavigate();
    const runDemo = async () => {
        const demo = scenarios.find((scenario) => scenario.id === 'wildfire-telemetry');
        if (!demo || runState === 'loading') return;
        setSelectedScenario(demo);
        navigate('/command-center');
        const run = await runSimulation(demo.request);
        if (run) navigate(`/simulations/${run.result.simulation_id}`);
    };
    return <div className="landing">
        <section className="hero"><span className="eyebrow">Geospatial · Trustworthy · Observable</span><h1>Agentic Digital Twin for Healthcare Infrastructure Resilience</h1><p>Explore synthetic compound climate, infrastructure, cyber, and telemetry disruptions with evidence-linked agents, counterfactual interventions, explicit human review, and OpenTelemetry auditability.</p><p className="disclaimer-inline"><strong>Research prototype using synthetic data.</strong> Outputs are simulated estimates and are not clinical, cybersecurity, transfer, infrastructure-control, or emergency-response instructions.</p><div className="button-row"><Link className="button button--primary" to="/command-center">Launch Crisis Command Center</Link><button className="button button--secondary" type="button" onClick={() => void runDemo()} disabled={runState === 'loading' || scenarios.length === 0}>Run Wildfire + Telemetry Demo</button><Link className="button button--ghost" to="/architecture">About & Architecture</Link><a className="button button--ghost" href="https://github.com/harshapriyag123/agentic-healthcare-digital-twi" target="_blank" rel="noreferrer">GitHub & Documentation</a></div></section>
        <section className="system-flow" aria-label="System workflow">{flow.map((item, index) => <div key={item}><span>{item}</span>{index < flow.length - 1 && <b>→</b>}</div>)}</section>
        <section><div className="section-heading"><div><span className="eyebrow">Live application summary</span><h2>Research platform status</h2></div></div><div className="summary-grid"><div><strong>{hospitals.length}</strong><span>Hospitals represented</span><small>Current synthetic catalog</small></div><div><strong>{scenarios.length}</strong><span>Available crisis scenarios</span><small>Current scenario catalog</small></div><div><strong>4</strong><span>Decision agents</span><small>3 implemented agents + meta-orchestrator</small></div><div><strong>{runs.length}</strong><span>Simulations run</span><small>Current browser session</small></div><div><strong>{health?.status === 'ok' ? 'Healthy' : 'Unavailable'}</strong><span>Backend status</span><small>Live API health check</small></div><div><strong>{import.meta.env.VITE_SIGNOZ_DASHBOARD_URL ? 'Configured' : 'Not configured'}</strong><span>Telemetry dashboard</span><small>Frontend environment configuration</small></div></div></section>
    </div>;
}

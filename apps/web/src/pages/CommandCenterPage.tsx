import { lazy, Suspense, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { AgentActivityWidget } from '../components/AgentActivityWidget';
import { CounterfactualSummary } from '../components/CounterfactualSummary';
import { HospitalDetailsDialog } from '../components/HospitalDetailsDialog';
import { HospitalImpactTable } from '../components/HospitalImpactTable';
import { ObservabilityPanel } from '../components/ObservabilityPanel';
import { OperationalMetrics } from '../components/OperationalMetrics';
import { RiskVisualizations } from '../components/RiskVisualizations';
import { ScenarioControlPanel } from '../components/ScenarioControlPanel';
import { SimulationProgress } from '../components/SimulationProgress';
import { TransferPlanPanel } from '../components/TransferPlanPanel';
import { TrustPanel } from '../components/TrustPanel';
import { useSimulation } from '../SimulationContext';

const HealthcareMap = lazy(() => import('../components/HealthcareMap').then((module) => ({ default: module.HealthcareMap })));

export function CommandCenterPage() {
    const context = useSimulation();
    useEffect(() => {
        if (window.location.hash) window.setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth' }), 0);
    }, []);
    if (context.catalogState === 'loading') return <div className="page-state" role="status"><span className="spinner" />Loading command-center catalogs…</div>;
    if (context.catalogState === 'error') return <div className="page-state page-state--error" role="alert"><h1>Command center unavailable</h1><p>{context.catalogError}</p><button className="button button--primary" type="button" onClick={() => void context.retryCatalog()}>Retry</button></div>;
    if (context.scenarios.length === 0) return <div className="page-state"><h1>No scenarios available</h1><p>Add a validated scenario before launching the command center.</p></div>;
    const result = context.activeRun?.result;
    const selectedHospital = context.hospitals.find((hospital) => hospital.hospital_id === context.selectedHospitalId);
    const selectedState = result?.affected_hospitals.find((state) => state.hospital_id === context.selectedHospitalId);
    return <div className="command-page">
        <header className="page-header"><div><span className="eyebrow">Regional healthcare operations</span><h1>Crisis Command Center</h1><p>Configure compound disruptions, evaluate the synthetic healthcare twin, and inspect trustworthy agent recommendations.</p></div>{context.activeRun && <div className="run-identity"><span>Simulation complete</span><code>{context.activeRun.result.simulation_id}</code><strong>{context.activeRun.durationMs.toFixed(0)} ms client duration</strong><small>{new Date(context.activeRun.completedAt).toLocaleString()}</small></div>}</header>
        {context.runState === 'error' && <div className="warning warning--danger" role="alert"><strong>Simulation API failure</strong><span>{context.runError}</span><button type="button" className="button button--ghost" onClick={() => void context.runSimulation()}>Retry simulation</button></div>}
        {result?.trust.human_review_required && <div className="warning"><strong>Human review required</strong><span>All operational recommendations require authorized review.</span></div>}
        {result && result.trust.telemetry_integrity < 0.5 && <div className="warning warning--danger"><strong>Telemetry integrity is low</strong><span>Evidence is classified as untrusted by the interface.</span></div>}
        {result && result.trust.recommendation_confidence < 0.5 && <div className="warning"><strong>Recommendation confidence is low</strong><span>Review evidence quality and uncertainty before action.</span></div>}
        {result?.affected_hospitals.some((hospital) => hospital.status === 'critical') && <div className="warning warning--danger"><strong>Critical hospital state detected</strong><span>Inspect facility impacts and transfer constraints.</span></div>}
        {result && <section className="panel run-explanation" aria-label="Backend simulation explanation"><span className="eyebrow">Backend explanation</span><p>{result.explanation}</p></section>}
        <SimulationProgress state={context.runState} scenarioName={context.selectedScenario?.name ?? 'Scenario'} />
        <div className="command-grid"><ScenarioControlPanel /><Suspense fallback={<section className="panel map-panel" role="status">Loading spatial digital twin…</section>}><HealthcareMap hospitals={context.hospitals} run={context.activeRun} /></Suspense><OperationalMetrics run={context.activeRun} /></div>
        <RiskVisualizations run={context.activeRun} hospitals={context.hospitals} />
        <HospitalImpactTable run={context.activeRun} hospitals={context.hospitals} />
        <div className="two-column"><TransferPlanPanel run={context.activeRun} hospitals={context.hospitals} /><AgentActivityWidget run={context.activeRun} /></div>
        <div className="two-column"><TrustPanel run={context.activeRun} /><CounterfactualSummary run={context.activeRun} /></div>
        <ObservabilityPanel run={context.activeRun} requestState={context.runState} />
        <section className="panel" id="simulation-history"><div className="section-heading"><h2>Simulation History</h2></div>{context.runs.length === 0 ? <p>No simulations have been run in this browser session.</p> : <div className="history-list">{context.runs.map((run) => <Link key={run.result.simulation_id} to={`/simulations/${run.result.simulation_id}`}><strong>{run.scenario.name}</strong><code>{run.result.simulation_id}</code><span>Risk {(run.result.regional_risk_score * 100).toFixed(0)}%</span></Link>)}</div>}</section>
        {selectedHospital && <HospitalDetailsDialog hospital={selectedHospital} state={selectedState} run={context.activeRun} onClose={() => context.setSelectedHospitalId(null)} />}
    </div>;
}

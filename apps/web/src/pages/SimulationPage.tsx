import { Link, useParams } from 'react-router-dom';

import { AgentDecisionTimeline } from '../components/AgentDecisionTimeline';
import { CounterfactualSummary } from '../components/CounterfactualSummary';
import { HospitalImpactTable } from '../components/HospitalImpactTable';
import { ObservabilityPanel } from '../components/ObservabilityPanel';
import { OperationalMetrics } from '../components/OperationalMetrics';
import { TransferPlanPanel } from '../components/TransferPlanPanel';
import { TrustPanel } from '../components/TrustPanel';
import { useSimulation } from '../SimulationContext';

export function SimulationPage() {
    const { simulationId } = useParams();
    const { runs, hospitals, runState } = useSimulation();
    const run = runs.find((item) => item.result.simulation_id === simulationId) ?? null;
    if (!run) return <div className="page-state"><h1>Simulation result is not available</h1><p>Results are stored only for this browser session. Run a scenario from the command center.</p><Link className="button button--primary" to="/command-center">Open Command Center</Link></div>;
    return <div className="result-page"><header className="page-header"><div><span className="eyebrow">Completed simulation</span><h1>{run.scenario.name}</h1><p>{run.result.explanation}</p></div><div className="run-identity"><code>{run.result.simulation_id}</code><span>{run.durationMs.toFixed(0)} ms client duration</span><small>{new Date(run.completedAt).toLocaleString()}</small></div></header><OperationalMetrics run={run} /><HospitalImpactTable run={run} hospitals={hospitals} /><div className="two-column"><TransferPlanPanel run={run} hospitals={hospitals} /><AgentDecisionTimeline run={run} /></div><div className="two-column"><TrustPanel run={run} /><CounterfactualSummary run={run} /></div><ObservabilityPanel run={run} requestState={runState} /></div>;
}

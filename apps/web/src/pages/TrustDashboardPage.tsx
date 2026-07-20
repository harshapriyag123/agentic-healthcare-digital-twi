import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api';
import { useSimulation } from '../SimulationContext';
import { AgentEvidenceMatrix, AnomalyPolicyPanels, CounterfactualTrustComparison, EvidenceInventory, EvidenceQuality, HumanReviewPanel, ImprovementExplainability, ProvenanceLineage, TrustFactorBreakdown, TrustMap, TrustObservability, TrustOverview } from '../components/TrustDashboard';
import type { TrustDashboardResponse } from '../trustTypes';

function fromRun(run: NonNullable<ReturnType<typeof useSimulation>['activeRun']>): TrustDashboardResponse {
    return { simulation_id: run.result.simulation_id, scenario_name: run.result.scenario_name, trust: run.result.trust, evidence: run.result.evidence, agent_decisions: run.result.agent_decisions, trace_id: run.result.trace_id, partial: false, warnings: [] };
}

export function TrustDashboardPage() {
    const { simulationId } = useParams();
    const { activeRun, runs, hospitals, comparisons, selectedAgentId, setSelectedAgentId, selectedHospitalId, setSelectedHospitalId } = useSimulation();
    const run = runs.find((item) => item.result.simulation_id === simulationId) ?? (!simulationId ? activeRun : null);
    const [remote, setRemote] = useState<TrustDashboardResponse | null>(null); const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle'); const [error, setError] = useState('');
    useEffect(() => {
        if (run || !simulationId) { setRemote(null); setState('idle'); return; }
        let current = true; setState('loading'); setError('');
        void api.trust(simulationId).then((value) => { if (current) { setRemote(value); setState('success'); } }).catch((reason: unknown) => { if (current) { setError(reason instanceof Error ? reason.message : 'Trust assessment could not be loaded.'); setState('error'); } });
        return () => { current = false; };
    }, [run, simulationId]);
    const data = useMemo(() => run ? fromRun(run) : remote, [run, remote]);
    const comparison = comparisons.find((item) => item.simulation_id === data?.simulation_id);
    if (!data) return <div className="trust-dashboard-page"><header className="page-header"><div><span className="eyebrow">Trust and evidence</span><h1>Trust Dashboard</h1></div></header>{state === 'loading' ? <section className="panel" role="status"><h2>Loading trust assessment…</h2></section> : <section className="panel empty-state"><h2>{state === 'error' ? 'Trust assessment unavailable' : 'No completed simulation selected'}</h2><p>{error || 'Run a simulation before evaluating evidence and trust.'}</p><Link className="button button--primary" to="/command-center">Open Command Center</Link></section>}<ResearchDisclaimer /></div>;
    return <div className="trust-dashboard-page"><header className="page-header"><div><span className="eyebrow">Telemetry → integrity → lineage → uncertainty → agent evidence → confidence → human review</span><h1>Trust and Evidence Dashboard</h1><p>Explainable, deterministic assessment for simulation <code>{data.simulation_id}</code>.</p></div><div className="button-row"><Link className="button button--ghost" to={`/agents/${data.simulation_id}`}>Open Agent Console</Link><Link className="button button--ghost" to={`/counterfactuals/${data.simulation_id}`}>Open Counterfactuals</Link><Link className="button button--ghost" to="/command-center#digital-twin">Open GIS Map</Link></div></header>{data.partial && <section className="warning warning--danger" role="alert"><strong>Partial trust assessment</strong><span>{data.warnings.join(' ')}</span></section>}<ResearchDisclaimer /><TrustOverview trust={data.trust} /><HumanReviewPanel trust={data.trust} /><TrustFactorBreakdown trust={data.trust} /><EvidenceInventory data={data} hospitals={hospitals} selectedAgent={selectedAgentId} selectedHospital={selectedHospitalId} onAgent={setSelectedAgentId} onHospital={setSelectedHospitalId} /><EvidenceQuality evidence={data.evidence} /><ProvenanceLineage evidence={data.evidence} /><AnomalyPolicyPanels trust={data.trust} /><AgentEvidenceMatrix data={data} selectedAgent={selectedAgentId} onSelect={setSelectedAgentId} />{run && <TrustMap run={run} hospitals={hospitals} evidence={data.evidence} />}<CounterfactualTrustComparison comparison={comparison} /><ImprovementExplainability trust={data.trust} evidence={data.evidence} /><TrustObservability data={data} /><ResearchDisclaimer /></div>;
}

function ResearchDisclaimer() {
    return <p className="trust-persistent-disclaimer">Research decision-support prototype using synthetic data. Trust scores, evidence assessments, and recommendations are simulated estimates, require authorized human review, and are not clinical, cybersecurity, transfer, or emergency-response instructions.</p>;
}

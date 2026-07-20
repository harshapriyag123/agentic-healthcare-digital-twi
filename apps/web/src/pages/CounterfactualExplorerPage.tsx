import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { CounterfactualMapComparison, CounterfactualObservability, CounterfactualProcessingState, CounterfactualReport, ComparisonCharts, HospitalComparison, InterventionSelector, OutcomeComparison, RankingPanel, TradeOffMatrix, TransferComparison } from '../components/CounterfactualExplorer';
import { createSelections, DEFAULT_RANKING_WEIGHTS, interventionApplicability, outcomeAsRun, rankingFor, selectedHospitalState } from '../counterfactualUtils';
import type { InterventionParameters, MapComparisonMode, RankingWeights } from '../counterfactualTypes';
import { useSimulation } from '../SimulationContext';
import { percent } from '../utils';
import { HospitalDetailsDialog } from '../components/HospitalDetailsDialog';

function recommendedDefaults(scenarioId: string) {
    if (scenarioId.includes('flood')) return ['backup-power-activation', 'ambulance-rerouting', 'combined-intervention'];
    if (scenarioId.includes('wildfire')) return ['telemetry-verification', 'network-segmentation', 'combined-intervention'];
    return ['network-segmentation', 'regional-surge-capacity', 'ambulance-rerouting', 'combined-intervention'];
}

export function CounterfactualExplorerPage() {
    const { simulationId } = useParams();
    const navigate = useNavigate();
    const context = useSimulation();
    const run = simulationId ? context.runs.find((item) => item.result.simulation_id === simulationId) ?? null : context.activeRun;
    const comparison = context.comparisons.find((item) => item.simulation_id === run?.result.simulation_id) ?? null;
    const [selected, setSelected] = useState<string[]>([]);
    const [parameters, setParameters] = useState<Record<string, InterventionParameters>>({});
    const [weights, setWeights] = useState<RankingWeights>(DEFAULT_RANKING_WEIGHTS);
    const [mapMode, setMapMode] = useState<MapComparisonMode>('difference');

    useEffect(() => {
        if (!run || context.interventionDefinitions.length === 0) return;
        const defaults = recommendedDefaults(run.scenario.id).filter((id) => {
            const definition = context.interventionDefinitions.find((item) => item.id === id);
            return definition && interventionApplicability(definition, run).applicable;
        });
        setSelected(defaults);
    }, [run, context.interventionDefinitions]);
    useEffect(() => { if (comparison) setWeights(comparison.default_ranking_weights); }, [comparison]);

    const ranking = useMemo(() => comparison ? rankingFor(comparison, weights, context.hospitals) : [], [comparison, weights, context.hospitals]);
    const selectedOutcome = comparison?.interventions.find((item) => item.intervention_id === context.selectedInterventionId && item.status === 'completed') ?? comparison?.interventions.find((item) => item.status === 'completed') ?? null;
    const selectedHospital = context.hospitals.find((hospital) => hospital.hospital_id === context.selectedHospitalId);
    const outcomeRun = run && selectedOutcome ? outcomeAsRun(run, selectedOutcome, mapMode) : null;

    if (context.catalogState === 'loading') return <div className="page-state" role="status">Loading Counterfactual Explorer…</div>;
    if (!run) return <div className="page-state"><h1>Counterfactual baseline unavailable</h1><p>{simulationId ? 'This baseline is not present in the current browser session.' : 'Run a synthetic scenario before comparing interventions.'}</p><Link className="button button--primary" to="/command-center">Open Command Center</Link></div>;

    const runComparison = () => void context.runCounterfactuals({ simulation_id: run.result.simulation_id, interventions: createSelections(selected, parameters), include_hospital_states: true, include_transfer_plans: true });
    const selectAll = () => setSelected(context.interventionDefinitions.filter((definition) => interventionApplicability(definition, run).applicable).map((definition) => definition.id));
    const reset = () => setSelected(recommendedDefaults(run.scenario.id).filter((id) => { const definition = context.interventionDefinitions.find((item) => item.id === id); return Boolean(definition && interventionApplicability(definition, run).applicable); }));

    return <div className="counterfactual-page"><header className="page-header"><div><span className="eyebrow">Simulated intervention comparison</span><h1>Counterfactual Explorer</h1><p>Compare a completed no-intervention baseline with deterministic synthetic intervention outcomes and transparent trade-offs.</p></div><label className="simulation-selector">Baseline simulation<select aria-label="Counterfactual simulation selector" value={run.result.simulation_id} onChange={(event) => navigate(`/counterfactuals/${event.target.value}`)}>{context.runs.map((item) => <option value={item.result.simulation_id} key={item.result.simulation_id}>{item.scenario.name} · {item.result.simulation_id.slice(0, 8)}</option>)}</select></label></header>
        <div className="warning"><strong>Authorized human review required</strong><span>Counterfactual outcomes are simulated estimates, not guaranteed outcomes or authorized operational instructions.</span></div>
        <section className="panel simulation-context"><div className="section-heading"><div><span className="eyebrow">Valid comparison baseline</span><h2>Simulation Context</h2></div><div className="button-row"><Link className="button button--ghost" to="/command-center">Return to Command Center</Link><Link className="button button--ghost" to="/command-center#digital-twin">Open GIS Map</Link><Link className="button button--ghost" to={`/agents/${run.result.simulation_id}`}>Open Agent Console</Link><Link className="button button--ghost" to={`/trust/${run.result.simulation_id}`}>Open Trust Dashboard</Link><Link className="button button--ghost" to="/command-center#scenario-configuration">Run New Simulation</Link></div></div><dl className="context-grid"><div><dt>Scenario</dt><dd>{run.scenario.name}</dd></div><div><dt>Simulation ID</dt><dd><code>{run.result.simulation_id}</code></dd></div><div><dt>Completed</dt><dd>{new Date(run.completedAt).toLocaleString()}</dd></div><div><dt>Regional risk</dt><dd>{percent(run.result.regional_risk_score)}</dd></div><div><dt>Resilience</dt><dd>{percent(run.result.resilience_score)}</dd></div><div><dt>Telemetry integrity</dt><dd>{percent(run.result.trust.telemetry_integrity)}</dd></div><div><dt>Critical hospitals</dt><dd>{run.result.affected_hospitals.filter((state) => state.status === 'critical').length}</dd></div><div><dt>Primary hazard</dt><dd>Heat {run.request.hazard.heat_index} · flood {percent(run.request.hazard.flood_severity)} · AQI {run.request.hazard.air_quality_index}</dd></div><div><dt>Cyber event</dt><dd>{run.request.cyber_event.attack_type} · target {run.request.cyber_event.target_hospital_id}</dd></div><div><dt>Human review</dt><dd>{run.result.trust.human_review_required ? 'Required' : 'Not flagged'}</dd></div></dl></section>
        {context.counterfactualCatalogError ? <div className="warning warning--danger" role="alert"><strong>Intervention catalog unavailable</strong><span>{context.counterfactualCatalogError}</span></div> : <InterventionSelector definitions={context.interventionDefinitions} run={run} selected={selected} parameters={parameters} onToggle={(id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onParameters={(id, values) => setParameters((current) => ({ ...current, [id]: values }))} onSelectAll={selectAll} onClear={() => setSelected([])} onReset={reset} onRun={runComparison} loading={context.counterfactualState === 'loading'} />}
        {context.counterfactualState === 'loading' && <CounterfactualProcessingState />}
        {context.counterfactualState === 'error' && <div className="warning warning--danger" role="alert"><strong>Counterfactual comparison failed</strong><span>{context.counterfactualError}</span><button type="button" className="button button--ghost" onClick={runComparison}>Retry</button></div>}
        {!comparison ? <section className="panel empty-state"><h2>No comparison has been run</h2><p>Select applicable interventions and run one coherent backend comparison. The completed simulation above remains the baseline.</p></section> : <>
            {comparison.incomplete && <div className="warning warning--danger" role="alert"><strong>Partial comparison</strong><span>Successful results are preserved. Failed interventions are visible and excluded from ranking.</span></div>}
            <OutcomeComparison comparison={comparison} /><ComparisonCharts comparison={comparison} />
            <RankingPanel comparison={comparison} ranking={ranking} weights={weights} onWeight={(key, value) => setWeights((current) => ({ ...current, [key]: value }))} onReset={() => setWeights({ ...DEFAULT_RANKING_WEIGHTS })} />
            <TradeOffMatrix comparison={comparison} ranking={ranking} />
            {selectedOutcome && <><section className="panel outcome-selector"><label>Detailed intervention<select aria-label="Detailed intervention" value={selectedOutcome.intervention_id} onChange={(event) => context.setSelectedInterventionId(event.target.value)}>{comparison.interventions.filter((item) => item.status === 'completed').map((item) => <option value={item.intervention_id} key={item.intervention_id}>{item.intervention_name}</option>)}</select></label><p><strong>Evaluated by:</strong> {selectedOutcome.evaluated_by} · <strong>Ranked by:</strong> {selectedOutcome.ranked_by} · <strong>Proposed by:</strong> {selectedOutcome.proposed_by ?? 'Not attributed to an autonomous agent'}</p><Link className="button button--ghost" to={`/agents/${run.result.simulation_id}`}>Inspect related agent execution</Link></section><CounterfactualMapComparison run={run} comparison={comparison} intervention={selectedOutcome} hospitals={context.hospitals} mode={mapMode} onMode={setMapMode} /><HospitalComparison comparison={comparison} intervention={selectedOutcome} hospitals={context.hospitals} selectedId={context.selectedHospitalId} onSelect={context.setSelectedHospitalId} /><TransferComparison comparison={comparison} intervention={selectedOutcome} hospitals={context.hospitals} /></>}
            <section className="panel counterfactual-trust"><span className="eyebrow">Trust and uncertainty</span><h2>Trust-Constrained Comparison</h2><div className="trust-grid"><div><span>Baseline telemetry integrity</span><strong>{percent(comparison.baseline.telemetry_integrity ?? 0)}</strong></div><div><span>Selected integrity</span><strong>{percent(selectedOutcome?.telemetry_integrity ?? 0)}</strong></div><div><span>Evidence completeness</span><strong>{percent(selectedOutcome?.evidence_completeness ?? comparison.baseline.evidence_completeness ?? 0)}</strong></div><div><span>Recommendation confidence</span><strong>{percent(selectedOutcome?.recommendation_confidence ?? 0)}</strong></div><div><span>Remaining uncertainty</span><strong>{percent(selectedOutcome?.uncertainty ?? 0)}</strong></div><div><span>Human review</span><strong>Required</strong></div></div>{comparison.recommendation.insufficient_confidence && <div className="warning warning--danger"><strong>Insufficient confidence for automated prioritization</strong><span>{comparison.recommendation.rationale}</span></div>}</section>
            <CounterfactualObservability comparison={comparison} /><CounterfactualReport run={run} comparison={comparison} ranking={ranking} />
        </>}
        <section className="panel safety-boundary"><h2>Research safety boundary</h2><p>Research decision-support prototype using synthetic data. Counterfactual outcomes are simulated estimates, require authorized human review, and are not clinical, transfer, cybersecurity, or emergency-response instructions.</p></section>
        {selectedHospital && selectedOutcome && outcomeRun && <HospitalDetailsDialog hospital={selectedHospital} state={selectedHospitalState(selectedOutcome, selectedHospital.hospital_id)} run={outcomeRun} onClose={() => context.setSelectedHospitalId(null)} />}
        <div className="sr-only" aria-live="polite">{comparison ? `Counterfactual comparison loaded with ${comparison.interventions.length} candidate outcomes.` : 'Counterfactual baseline loaded. Awaiting comparison.'}</div>
    </div>;
}

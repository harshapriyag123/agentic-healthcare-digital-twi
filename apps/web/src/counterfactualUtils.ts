import type { CompletedRun, Hospital, HospitalState, TransferAction } from './types';
import type { CounterfactualExplorerResponse, CounterfactualOutcome, CounterfactualRanking, InterventionDefinition, InterventionParameters, InterventionSelection, MapComparisonMode, RankingWeights } from './counterfactualTypes';

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = { risk: .28, resilience: .16, demand: .14, critical_hospitals: .10, trust: .12, transfer_burden: .07, speed: .06, complexity: .04, safety: .03 };

export function interventionApplicability(definition: InterventionDefinition, run: CompletedRun): { applicable: boolean; reason: string } {
    if (definition.id === 'no-intervention') return { applicable: false, reason: 'The no-intervention outcome is always included as the baseline.' };
    if (definition.id === 'network-segmentation' && run.request.cyber_event.severity <= 0) return { applicable: false, reason: 'No cyber severity is present.' };
    if (definition.id === 'backup-power-activation' && run.request.hazard.grid_outage_probability <= 0) return { applicable: false, reason: 'No grid-outage exposure is present.' };
    if (definition.id === 'telemetry-verification' && run.request.cyber_event.telemetry_tampering <= 0 && run.request.missing_telemetry_ratio <= 0) return { applicable: false, reason: 'No missing or tampered telemetry is present.' };
    return { applicable: definition.executable, reason: definition.executable ? 'Applicable to this synthetic baseline.' : 'Planned capability — not executable.' };
}

export function normalizeWeights(weights: RankingWeights): RankingWeights {
    const entries = Object.entries(weights) as Array<[keyof RankingWeights, number]>;
    const total = entries.reduce((sum, [, value]) => sum + Math.max(0, Number.isFinite(value) ? value : 0), 0);
    if (total <= 0) return { ...DEFAULT_RANKING_WEIGHTS };
    return Object.fromEntries(entries.map(([key, value]) => [key, Math.max(0, value) / total])) as RankingWeights;
}

export function rankCounterfactuals(outcomes: CounterfactualOutcome[], baseline: CounterfactualOutcome, weights: RankingWeights, hospitals: Hospital[]): CounterfactualRanking[] {
    const configured = normalizeWeights(weights);
    const totalBeds = hospitals.reduce((sum, hospital) => sum + hospital.staffed_beds, 0) || 1;
    const complexity = { low: .2, moderate: .55, high: .85 } as const;
    const scored = outcomes.filter((outcome) => outcome.status === 'completed' && outcome.transfer_plan_safe).map((outcome) => {
        const benefits = {
            risk: Math.max(0, outcome.relative_risk_reduction ?? 0),
            resilience: Math.max(0, (outcome.resilience_improvement ?? 0) / Math.max(1 - (baseline.resilience_score ?? 0), .001)),
            demand: Math.max(0, (outcome.unserved_demand_reduction ?? 0) / Math.max(baseline.unserved_demand ?? 1, 1)),
            critical_hospitals: Math.max(0, (outcome.critical_hospitals_avoided ?? 0) / Math.max(baseline.critical_hospital_count ?? 1, 1)),
            trust: outcome.recommendation_confidence ?? 0,
        };
        const penalties = {
            transfer_burden: Math.max(0, outcome.additional_transfers ?? 0) / totalBeds,
            speed: (outcome.estimated_activation_delay_minutes ?? 0) / 120,
            complexity: complexity[outcome.complexity as keyof typeof complexity] ?? .85,
            safety: outcome.transfer_plan_safe ? 0 : 1,
        };
        const score = Math.max(0, Math.min(1, Object.entries(benefits).reduce((sum, [key, value]) => sum + configured[key as keyof RankingWeights] * value, 0) - Object.entries(penalties).reduce((sum, [key, value]) => sum + configured[key as keyof RankingWeights] * value, 0)));
        const mainBenefit = Object.entries(benefits).sort((a, b) => b[1] - a[1])[0][0].replaceAll('_', ' ');
        const mainTradeOff = Object.entries(penalties).sort((a, b) => b[1] - a[1])[0][0].replaceAll('_', ' ');
        return { outcome, score, mainBenefit, mainTradeOff };
    }).sort((left, right) => right.score - left.score || left.outcome.intervention_id.localeCompare(right.outcome.intervention_id));
    return scored.map((item, index) => ({ rank: index + 1, intervention_id: item.outcome.intervention_id, overall_score: Number(item.score.toFixed(3)), main_benefit: item.mainBenefit, main_trade_off: item.mainTradeOff, confidence: item.outcome.recommendation_confidence ?? 0, explanation: `Ranked on normalized ${item.mainBenefit} benefit with ${item.mainTradeOff} treated as a penalty.` }));
}

export type HospitalOutcomeDiff = { hospitalId: string; baseline: HospitalState; intervention: HospitalState; riskChange: number; capacityChange: number; statusTransition: string; direction: 'improved' | 'unchanged' | 'deteriorated' };
export function hospitalOutcomeDiffs(baseline: CounterfactualOutcome, intervention: CounterfactualOutcome): HospitalOutcomeDiff[] {
    const current = new Map(intervention.hospital_states.map((state) => [state.hospital_id, state]));
    return baseline.hospital_states.flatMap((base) => {
        const next = current.get(base.hospital_id);
        if (!next) return [];
        const riskChange = next.disruption_probability - base.disruption_probability;
        return [{ hospitalId: base.hospital_id, baseline: base, intervention: next, riskChange, capacityChange: next.effective_capacity - base.effective_capacity, statusTransition: base.status === next.status ? `No change (${base.status})` : `${base.status} → ${next.status}`, direction: riskChange < -.005 ? 'improved' : riskChange > .005 ? 'deteriorated' : 'unchanged' }];
    });
}

const transferKey = (transfer: TransferAction) => `${transfer.from_hospital_id}|${transfer.to_hospital_id}`;
export function transferPlanDiff(baseline: TransferAction[], intervention: TransferAction[]) {
    const base = new Map(baseline.map((item) => [transferKey(item), item]));
    const current = new Map(intervention.map((item) => [transferKey(item), item]));
    const keys = new Set([...base.keys(), ...current.keys()]);
    return [...keys].map((key) => ({ key, baseline: base.get(key) ?? null, intervention: current.get(key) ?? null, patientChange: (current.get(key)?.patients ?? 0) - (base.get(key)?.patients ?? 0), status: !base.has(key) ? 'added' : !current.has(key) ? 'removed' : 'changed' as 'added' | 'removed' | 'changed' }));
}

export function outcomeAsRun(run: CompletedRun, outcome: CounterfactualOutcome, mode: MapComparisonMode): CompletedRun {
    return { ...run, result: { ...run.result, regional_risk_score: outcome.regional_risk_score ?? run.result.regional_risk_score, resilience_score: outcome.resilience_score ?? run.result.resilience_score, affected_hospitals: outcome.hospital_states, transfer_plan: outcome.transfer_plan, trust: { ...run.result.trust, telemetry_integrity: outcome.telemetry_integrity ?? run.result.trust.telemetry_integrity, uncertainty: outcome.uncertainty ?? run.result.trust.uncertainty, recommendation_confidence: outcome.recommendation_confidence ?? run.result.trust.recommendation_confidence } }, scenario: { ...run.scenario, name: `${run.scenario.name} · ${mode === 'baseline' ? 'Baseline' : outcome.intervention_name}` } };
}

export function selectedHospitalState(outcome: CounterfactualOutcome, hospitalId: string | null) { return outcome.hospital_states.find((state) => state.hospital_id === hospitalId); }
export function createSelections(ids: string[], parameters: Record<string, InterventionParameters>): InterventionSelection[] { return [...new Set(ids)].map((intervention_id) => ({ intervention_id, parameters: parameters[intervention_id] ?? {} })); }
export function rankingFor(comparison: CounterfactualExplorerResponse, weights: RankingWeights, hospitals: Hospital[]) { return rankCounterfactuals(comparison.interventions, comparison.baseline, weights, hospitals); }

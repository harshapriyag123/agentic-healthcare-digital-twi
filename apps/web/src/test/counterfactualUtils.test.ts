import { createSelections, hospitalOutcomeDiffs, normalizeWeights, rankCounterfactuals, transferPlanDiff, DEFAULT_RANKING_WEIGHTS } from '../counterfactualUtils';
import { comparison, hospitals } from './fixtures';

describe('counterfactual comparison utilities', () => {
    it('normalizes weights and safely resets an invalid total', () => {
        const normalized = normalizeWeights({ ...DEFAULT_RANKING_WEIGHTS, risk: 2 });
        expect(Object.values(normalized).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
        expect(normalizeWeights(Object.fromEntries(Object.keys(DEFAULT_RANKING_WEIGHTS).map((key) => [key, 0])) as typeof DEFAULT_RANKING_WEIGHTS)).toEqual(DEFAULT_RANKING_WEIGHTS);
    });

    it('ranks benefits in the correct direction and penalizes transfer, delay, and complexity', () => {
        const data = comparison();
        const riskFocused = rankCounterfactuals(data.interventions, data.baseline, { ...DEFAULT_RANKING_WEIGHTS, risk: 1, trust: 0, speed: 0, complexity: 0, transfer_burden: 0 }, hospitals);
        expect(riskFocused[0].intervention_id).toBe('regional-surge-capacity');
        const speedFocused = rankCounterfactuals(data.interventions, data.baseline, { ...DEFAULT_RANKING_WEIGHTS, risk: 0, resilience: 0, demand: 0, trust: 0, speed: 1 }, hospitals);
        expect(speedFocused[0].intervention_id).toBe('network-segmentation');
    });

    it('excludes failed and unsafe outcomes from frontend reranking', () => {
        const data = comparison();
        const outcomes = data.interventions.map((item, index) => index === 0 ? { ...item, transfer_plan_safe: false } : item);
        expect(rankCounterfactuals(outcomes, data.baseline, DEFAULT_RANKING_WEIGHTS, hospitals).map((item) => item.intervention_id)).toEqual(['regional-surge-capacity']);
    });

    it('computes hospital status and risk differences', () => {
        const data = comparison();
        const diff = hospitalOutcomeDiffs(data.baseline, data.interventions[1])[0];
        expect(diff.statusTransition).toBe('degraded → stable');
        expect(diff.direction).toBe('improved');
        expect(diff.capacityChange).toBe(50);
    });

    it('computes added and removed transfer routes', () => {
        const data = comparison();
        const added = transferPlanDiff(data.baseline.transfer_plan, data.interventions[1].transfer_plan)[0];
        expect(added).toMatchObject({ status: 'added', patientChange: 8 });
        const removed = transferPlanDiff(data.interventions[1].transfer_plan, data.baseline.transfer_plan)[0];
        expect(removed).toMatchObject({ status: 'removed', patientChange: -8 });
    });

    it('deduplicates intervention selections without inventing outcome values', () => {
        expect(createSelections(['network-segmentation', 'network-segmentation'], {})).toEqual([{ intervention_id: 'network-segmentation', parameters: {} }]);
    });
});

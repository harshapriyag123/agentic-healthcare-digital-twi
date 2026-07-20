import { integrityBand, riskBand, riskFactors, sortedCounterfactuals } from '../utils';
import { result } from './fixtures';

it('classifies score bands at documented interface boundaries', () => {
    expect(riskBand(0.29)).toBe('Low'); expect(riskBand(0.6)).toBe('High');
    expect(integrityBand(0.49)).toBe('Untrusted'); expect(integrityBand(0.9)).toBe('Strong');
});

it('derives risk factors only from hospital response fields', () => {
    expect(riskFactors(result().affected_hospitals, 0.42).map((item) => item.label)).toEqual(['Hazard pressure', 'Cyber loss', 'Dependency pressure', 'Capacity overload', 'Telemetry uncertainty']);
});

it('sorts counterfactuals without mutating the response', () => {
    const response = result(); const first = response.counterfactuals[0].intervention;
    expect(sortedCounterfactuals(response)[0].intervention).toBe('combined containment');
    expect(response.counterfactuals[0].intervention).toBe(first);
});

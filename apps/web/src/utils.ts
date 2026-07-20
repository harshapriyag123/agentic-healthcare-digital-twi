import type { HospitalState, SimulationResult } from './types';

export const percent = (value: number) => `${Math.round(value * 100)}%`;
export const decimal = (value: number) => value.toFixed(2);

export function riskBand(value: number): string {
    if (value < 0.3) return 'Low';
    if (value < 0.6) return 'Moderate';
    if (value < 0.8) return 'High';
    return 'Critical';
}

export function integrityBand(value: number): string {
    if (value < 0.5) return 'Untrusted';
    if (value < 0.75) return 'Degraded';
    if (value < 0.9) return 'Acceptable';
    return 'Strong';
}

export function sortedHospitals(states: HospitalState[]): HospitalState[] {
    return [...states].sort((left, right) => right.disruption_probability - left.disruption_probability);
}

export function sortedCounterfactuals(result: SimulationResult) {
    return [...result.counterfactuals].sort((left, right) => right.risk_reduction - left.risk_reduction);
}

export function riskFactors(states: HospitalState[], telemetryUncertainty?: number) {
    if (states.length === 0) return [];
    const average = (pick: (state: HospitalState) => number) => states.reduce((sum, state) => sum + pick(state), 0) / states.length;
    const factors = [
        { label: 'Hazard pressure', value: average((state) => state.hazard_pressure) },
        { label: 'Cyber loss', value: average((state) => state.cyber_loss) },
        { label: 'Dependency pressure', value: average((state) => state.dependency_pressure) },
        { label: 'Capacity overload', value: average((state) => Math.max(0, state.load_ratio - 1)) },
    ];
    if (telemetryUncertainty !== undefined) factors.push({ label: 'Telemetry uncertainty', value: telemetryUncertainty });
    return factors;
}

export const statusClass = (status: string) => `status status--${status}`;

import { calculateMapBounds, createDependencyFeatureCollection, createHazardFeatureCollection, createHospitalFeatureCollection, createRiskFeatureCollection, createTransferFeatureCollection } from '../geojson';
import type { Hospital } from '../types';
import { hospitals, result, scenarios } from './fixtures';

const completed = { result: result(), request: scenarios[0].request, scenario: scenarios[0], durationMs: 10, completedAt: '2026-01-01T00:00:00Z' };

it('converts valid hospital coordinates to typed GeoJSON points', () => {
    const data = createHospitalFeatureCollection(hospitals, completed, 'HOSP-DFW-001');
    expect(data.features[0].geometry.coordinates).toEqual([-97.2, 32.9]);
    expect(data.features[0].properties).toMatchObject({ status: 'degraded', selected: true, attacked: true });
});

it('safely excludes invalid coordinates and bounds them', () => {
    const invalid: Hospital = { ...hospitals[0], hospital_id: 'INVALID', latitude: 190 };
    expect(createHospitalFeatureCollection([invalid], null, null).features).toHaveLength(0);
    expect(calculateMapBounds([invalid])).toBeNull();
});

it('connects transfer source and destination coordinates', () => {
    const run = { ...completed, result: result({ transfer_plan: [{ from_hospital_id: 'HOSP-DFW-001', to_hospital_id: 'HOSP-DFW-002', patients: 7, rationale: 'Test', safety_constraints_satisfied: true }] }) };
    expect(createTransferFeatureCollection(hospitals, run).features[0].geometry.coordinates).toEqual([[-97.2, 32.9], [-97, 32.82]]);
});

it('generates deterministic hazard geometry whose size changes with severity', () => {
    const request = scenarios[0].request;
    const first = createHazardFeatureCollection(request, hospitals);
    expect(createHazardFeatureCollection(request, hospitals)).toEqual(first);
    const stronger = createHazardFeatureCollection({ ...request, hazard: { ...request.hazard, flood_severity: 1 } }, hospitals);
    expect(stronger.features[0].geometry.coordinates[0][0]).not.toEqual(first.features[0].geometry.coordinates[0][0]);
});

it('creates distinct flood, heat, and smoke hazard map states', () => {
    expect(scenarios.map((scenario) => createHazardFeatureCollection(scenario.request, hospitals).features[0].properties.hazardType)).toEqual(['flood', 'heat', 'smoke']);
});

it('creates deterministic dependency and risk collections from real fields', () => {
    const dependencies = createDependencyFeatureCollection(hospitals, scenarios[0].request);
    expect(dependencies.features.some((feature) => feature.properties.affected)).toBe(true);
    expect(createRiskFeatureCollection(hospitals, completed).features[0].properties.weight).toBe(0.72);
});

it('classifies counterfactual marker differences against baseline states', () => {
    const intervention = { ...completed, result: result({ affected_hospitals: [{ ...result().affected_hospitals[0], disruption_probability: .3, status: 'stable' }] }) };
    const data = createHospitalFeatureCollection(hospitals, intervention, null, result().affected_hospitals);
    expect(data.features[0].properties.difference).toBe('improved');
});

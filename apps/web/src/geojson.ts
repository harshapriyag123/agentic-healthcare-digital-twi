import type { Feature, FeatureCollection, LineString, Point, Polygon, Position } from 'geojson';

import type { CompletedRun, EvidenceItem, FacilityStatus, Hospital, HospitalState, SimulationRequest } from './types';
import { hospitalTrustStatus } from './trustUtils';

export type HospitalFeatureProperties = {
    hospitalId: string;
    name: string;
    status: FacilityStatus | 'awaiting';
    attacked: boolean;
    selected: boolean;
    humanReviewRequired: boolean;
    uncertain: boolean;
    disruptionProbability: number;
    capacityGap: number;
    difference: 'improved' | 'unchanged' | 'deteriorated' | null;
    trustStatus: string | null;
};

export type TransferFeatureProperties = { sourceId: string; destinationId: string; patients: number; rationale: string; safe: boolean };
export type DependencyFeatureProperties = { sourceId: string; destinationId: string; dependencyType: 'referral' | 'infrastructure'; label: string; affected: boolean };
export type HazardFeatureProperties = { scenarioId: string; hazardType: 'flood' | 'heat' | 'smoke'; intensity: number; label: string };
export type RiskFeatureProperties = { hospitalId: string; weight: number; label: string };

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const hasValidCoordinates = (hospital: Hospital) => Number.isFinite(hospital.longitude) && Number.isFinite(hospital.latitude) && Math.abs(hospital.longitude) <= 180 && Math.abs(hospital.latitude) <= 90;
export const getHospitalCoordinates = (hospitals: Hospital[], id: string): Position | null => {
    const hospital = hospitals.find((item) => item.hospital_id === id);
    return hospital && hasValidCoordinates(hospital) ? [hospital.longitude, hospital.latitude] : null;
};
export const getCapacityGap = (state?: HospitalState) => state ? Math.max(0, state.estimated_demand - state.effective_capacity) : 0;
export const getHospitalRiskWeight = (state?: HospitalState) => state ? clamp(state.disruption_probability) : 0;

export function createHospitalFeatureCollection(hospitals: Hospital[], run: CompletedRun | null, selectedId: string | null, comparisonBaseline: HospitalState[] = [], trustEvidence: EvidenceItem[] = []): FeatureCollection<Point, HospitalFeatureProperties> {
    const states = new Map(run?.result.affected_hospitals.map((state) => [state.hospital_id, state]) ?? []);
    const baselineStates = new Map(comparisonBaseline.map((state) => [state.hospital_id, state]));
    const features = hospitals.filter(hasValidCoordinates).map<Feature<Point, HospitalFeatureProperties>>((hospital) => {
        const state = states.get(hospital.hospital_id);
        const baseline = baselineStates.get(hospital.hospital_id);
        const change = state && baseline ? state.disruption_probability-baseline.disruption_probability : 0;
        const difference = state && baseline ? change < -.005 ? 'improved' : change > .005 ? 'deteriorated' : 'unchanged' : null;
        return { type: 'Feature', id: hospital.hospital_id, geometry: { type: 'Point', coordinates: [hospital.longitude, hospital.latitude] }, properties: { hospitalId: hospital.hospital_id, name: hospital.name, status: state?.status ?? 'awaiting', attacked: run?.request.cyber_event.target_hospital_id === hospital.hospital_id, selected: selectedId === hospital.hospital_id, humanReviewRequired: run?.result.trust.human_review_required ?? false, uncertain: (run?.result.trust.telemetry_integrity ?? 1) < 0.5, disruptionProbability: getHospitalRiskWeight(state), capacityGap: getCapacityGap(state), difference, trustStatus: trustEvidence.length ? hospitalTrustStatus(trustEvidence, hospital.hospital_id) : null } };
    });
    return { type: 'FeatureCollection', features };
}

export function createTransferFeatureCollection(hospitals: Hospital[], run: CompletedRun | null): FeatureCollection<LineString, TransferFeatureProperties> {
    if (!run) return { type: 'FeatureCollection', features: [] };
    const features = run.result.transfer_plan.flatMap<Feature<LineString, TransferFeatureProperties>>((transfer) => {
        const source = getHospitalCoordinates(hospitals, transfer.from_hospital_id);
        const destination = getHospitalCoordinates(hospitals, transfer.to_hospital_id);
        return source && destination ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [source, destination] }, properties: { sourceId: transfer.from_hospital_id, destinationId: transfer.to_hospital_id, patients: transfer.patients, rationale: transfer.rationale, safe: transfer.safety_constraints_satisfied } }] : [];
    });
    return { type: 'FeatureCollection', features };
}

function dependencyCoordinate(origin: Position, dependency: string): Position {
    const hash = [...dependency].reduce((value, character) => value + character.charCodeAt(0), 0);
    const angle = (hash % 360) * Math.PI / 180;
    return [origin[0] + Math.cos(angle) * 0.055, origin[1] + Math.sin(angle) * 0.04];
}

export function createDependencyFeatureCollection(hospitals: Hospital[], request?: SimulationRequest): FeatureCollection<LineString, DependencyFeatureProperties> {
    const features: Array<Feature<LineString, DependencyFeatureProperties>> = [];
    for (const hospital of hospitals.filter(hasValidCoordinates)) {
        const origin: Position = [hospital.longitude, hospital.latitude];
        for (const neighborId of hospital.referral_neighbors) {
            const destination = getHospitalCoordinates(hospitals, neighborId);
            if (destination) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [origin, destination] }, properties: { sourceId: hospital.hospital_id, destinationId: neighborId, dependencyType: 'referral', label: 'Referral relationship', affected: false } });
        }
        for (const dependency of hospital.critical_dependencies) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [dependencyCoordinate(origin, dependency), origin] }, properties: { sourceId: dependency, destinationId: hospital.hospital_id, dependencyType: 'infrastructure', label: dependency, affected: Boolean(request?.scenario_name.includes('flood') && dependency.includes('GRID')) } });
    }
    return { type: 'FeatureCollection', features };
}

function circle(center: Position, radiusLongitude: number, radiusLatitude: number, points = 48): Position[] {
    return Array.from({ length: points + 1 }, (_, index) => {
        const angle = index / points * Math.PI * 2;
        return [center[0] + Math.cos(angle) * radiusLongitude, center[1] + Math.sin(angle) * radiusLatitude];
    });
}

export function createHazardFeatureCollection(request: SimulationRequest, hospitals: Hospital[]): FeatureCollection<Polygon, HazardFeatureProperties> {
    const valid = hospitals.filter(hasValidCoordinates);
    if (valid.length === 0) return { type: 'FeatureCollection', features: [] };
    const target = getHospitalCoordinates(valid, request.cyber_event.target_hospital_id) ?? [valid[0].longitude, valid[0].latitude];
    let hazardType: HazardFeatureProperties['hazardType']; let intensity: number; let center: Position; let radii: [number, number]; let label: string;
    if (request.scenario_name.includes('flood')) {
        hazardType = 'flood'; intensity = clamp(request.hazard.flood_severity); center = [-97.06, 32.84]; radii = [0.13 + intensity * 0.15, 0.08 + intensity * 0.1]; label = 'Demonstration flood and grid-impact zone';
    } else if (request.scenario_name.includes('wildfire')) {
        hazardType = 'smoke'; intensity = clamp(request.hazard.air_quality_index / 300); center = [-96.76, 32.88]; radii = [0.18 + intensity * 0.2, 0.055 + intensity * 0.07]; label = 'Demonstration wildfire smoke-impact zone';
    } else {
        hazardType = 'heat'; intensity = clamp((request.hazard.heat_index - 80) / 70); center = target; radii = [0.28 + intensity * 0.25, 0.2 + intensity * 0.18]; label = 'Demonstration regional heat-impact zone';
    }
    return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circle(center, radii[0], radii[1])] }, properties: { scenarioId: request.scenario_name, hazardType, intensity, label } }] };
}

export function createRiskFeatureCollection(hospitals: Hospital[], run: CompletedRun | null): FeatureCollection<Point, RiskFeatureProperties> {
    if (!run) return { type: 'FeatureCollection', features: [] };
    return { type: 'FeatureCollection', features: run.result.affected_hospitals.flatMap<Feature<Point, RiskFeatureProperties>>((state) => {
        const coordinates = getHospitalCoordinates(hospitals, state.hospital_id);
        return coordinates ? [{ type: 'Feature', geometry: { type: 'Point', coordinates }, properties: { hospitalId: state.hospital_id, weight: getHospitalRiskWeight(state), label: 'Estimated visual risk derived from simulation output' } }] : [];
    }) };
}

export type MapBounds = [[number, number], [number, number]];
export function calculateMapBounds(hospitals: Hospital[]): MapBounds | null {
    const valid = hospitals.filter(hasValidCoordinates);
    if (valid.length === 0) return null;
    return [[Math.min(...valid.map((item) => item.longitude)), Math.min(...valid.map((item) => item.latitude))], [Math.max(...valid.map((item) => item.longitude)), Math.max(...valid.map((item) => item.latitude))]];
}

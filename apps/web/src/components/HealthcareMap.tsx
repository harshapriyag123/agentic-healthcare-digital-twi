import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Map, { FullscreenControl, Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre';

import { createDependencyFeatureCollection, createHazardFeatureCollection, createHospitalFeatureCollection, createRiskFeatureCollection, createTransferFeatureCollection, calculateMapBounds } from '../geojson';
import { useSimulation } from '../SimulationContext';
import type { CompletedRun, EvidenceItem, Hospital, HospitalState } from '../types';
import { decimal, percent, statusClass } from '../utils';

type LayerVisibility = { hospitals: boolean; transfers: boolean; dependencies: boolean; hazard: boolean; risk: boolean; labels: boolean };
const defaultLayers: LayerVisibility = { hospitals: true, transfers: true, dependencies: true, hazard: true, risk: true, labels: true };
const styleUrl = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

class MapErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() { this.props.onError(); }
    render() { return this.state.failed ? null : this.props.children; }
}

function readLayerPreferences(): LayerVisibility {
    try { return { ...defaultLayers, ...JSON.parse(window.localStorage.getItem('geotwin.mapLayers') ?? '{}') as Partial<LayerVisibility> }; }
    catch { return defaultLayers; }
}

function MapLegend() {
    return <div className="map-legend" aria-label="Map legend"><strong>Legend</strong><span><i className="legend-dot legend-dot--stable" />Stable hospital</span><span><i className="legend-dot legend-dot--degraded" />Degraded hospital</span><span><i className="legend-dot legend-dot--critical" />Critical hospital</span><span><i className="legend-ring" />Cyber-compromised</span><span><i className="legend-dot legend-dot--awaiting" />Awaiting simulation</span><span><i className="legend-line legend-line--transfer" />Simulated transfer route</span><span><i className="legend-line" />Dependency</span><span><i className="legend-zone" />Demonstration hazard zone</span><span><i className="legend-risk" />Estimated risk surface</span></div>;
}

function MapFallback({ hospitals, run, reason, onSelect }: { hospitals: Hospital[]; run: CompletedRun | null; reason: string; onSelect: (hospitalId: string) => void }) {
    const states = new globalThis.Map(run?.result.affected_hospitals.map((state) => [state.hospital_id, state]) ?? []);
    return <div className="map-fallback" role="alert"><h3>Interactive map unavailable</h3><p>{reason} The command center remains available through this accessible facility list.</p><div>{hospitals.map((hospital) => { const state = states.get(hospital.hospital_id); return <button type="button" key={hospital.hospital_id} onClick={() => onSelect(hospital.hospital_id)}><strong>{hospital.name}</strong><span className={state ? statusClass(state.status) : 'status status--unknown'}>{state?.status ?? 'Awaiting simulation'}</span><small>{state ? `Capacity ${decimal(state.effective_capacity)} · Demand ${decimal(state.estimated_demand)} · Risk ${percent(state.disruption_probability)}` : 'Synthetic facility metadata only'}</small></button>; })}</div>{run?.result.transfer_plan.length === 0 && <p>No patient transfers were recommended for this simulation.</p>}</div>;
}

export function HealthcareMap({ hospitals, run, comparisonBaseline = [], comparisonLabel, trustEvidence = [] }: { hospitals: Hospital[]; run: CompletedRun | null; comparisonBaseline?: HospitalState[]; comparisonLabel?: string; trustEvidence?: EvidenceItem[] }) {
    const { configuration, selectedHospitalId, setSelectedHospitalId, runState, agentMapFocus } = useSimulation();
    const mapRef = useRef<MapRef>(null);
    const [layers, setLayers] = useState<LayerVisibility>(readLayerPreferences);
    const [mapFailed, setMapFailed] = useState('');
    const [mapLoaded, setMapLoaded] = useState(false);
    const request = run?.request ?? configuration;
    const hospitalGeoJSON = useMemo(() => createHospitalFeatureCollection(hospitals, run, selectedHospitalId, comparisonBaseline, trustEvidence), [hospitals, run, selectedHospitalId, comparisonBaseline, trustEvidence]);
    const transferGeoJSON = useMemo(() => createTransferFeatureCollection(hospitals, run), [hospitals, run]);
    const dependencyGeoJSON = useMemo(() => createDependencyFeatureCollection(hospitals, request ?? undefined), [hospitals, request]);
    const hazardGeoJSON = useMemo(() => request ? createHazardFeatureCollection(request, hospitals) : { type: 'FeatureCollection' as const, features: [] }, [request, hospitals]);
    const riskGeoJSON = useMemo(() => createRiskFeatureCollection(hospitals, run), [hospitals, run]);
    const bounds = useMemo(() => calculateMapBounds(hospitals), [hospitals]);
    const selectedHospital = hospitals.find((hospital) => hospital.hospital_id === selectedHospitalId);

    const fitHospitals = useCallback(() => { if (bounds) mapRef.current?.fitBounds(bounds, { padding: 70, duration: 650 }); }, [bounds]);
    const resetView = useCallback(() => mapRef.current?.flyTo({ center: [-96.99, 32.87], zoom: 8.7, duration: 650 }), []);
    useEffect(() => { if (run?.result.simulation_id && mapLoaded) fitHospitals(); }, [run?.result.simulation_id, mapLoaded, fitHospitals]);
    useEffect(() => { if (selectedHospital && mapLoaded) mapRef.current?.flyTo({ center: [selectedHospital.longitude, selectedHospital.latitude], zoom: Math.max(mapRef.current.getZoom(), 10), duration: 500 }); }, [selectedHospital, mapLoaded]);
    useEffect(() => {
        if (!agentMapFocus) return;
        const key = agentMapFocus === 'cyber' ? 'hospitals' : agentMapFocus === 'hazard' ? 'hazard' : 'transfers';
        setLayers((current) => current[key] ? current : { ...current, [key]: true });
    }, [agentMapFocus]);
    const toggleLayer = (key: keyof LayerVisibility) => setLayers((current) => { const next = { ...current, [key]: !current[key] }; window.localStorage.setItem('geotwin.mapLayers', JSON.stringify(next)); return next; });

    if (hospitals.length === 0) return <section className="panel map-panel"><MapFallback hospitals={hospitals} run={run} reason="The hospital catalog is empty." onSelect={setSelectedHospitalId} /></section>;
    if (hospitalGeoJSON.features.length === 0) return <section className="panel map-panel"><MapFallback hospitals={hospitals} run={run} reason="No valid synthetic coordinates were returned." onSelect={setSelectedHospitalId} /></section>;
    return <section className={`panel map-panel ${agentMapFocus ? `map-panel--agent-${agentMapFocus}` : ''}`} id="digital-twin" aria-labelledby="map-title">
        <div className="section-heading"><div><span className="eyebrow">02 · Geospatial evaluation</span><h2 id="map-title">Spatial Digital Twin</h2></div><span className="synthetic-label">{comparisonLabel ?? 'Synthetic North Texas demonstration region'}</span></div>
        <p id="map-description" className="sr-only">Interactive map of synthetic hospitals, simulated hazards, infrastructure dependencies, patient transfers, and estimated visual risk.</p>
        <div className="map-toolbar"><button type="button" onClick={fitHospitals}>Fit hospitals</button><button type="button" onClick={resetView}>Reset view</button><span>{request?.scenario_name.replaceAll('-', ' ') ?? 'No scenario selected'}{runState === 'loading' ? ' · processing' : ''}</span><span>{selectedHospital ? `Selected: ${selectedHospital.name}` : 'No hospital selected'}</span>{agentMapFocus && <b className="map-agent-focus">Agent focus: {agentMapFocus}</b>}</div>
        <fieldset className="layer-control"><legend>Map layers</legend>{(Object.keys(layers) as Array<keyof LayerVisibility>).map((key) => <label key={key}><input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} />{key === 'risk' ? 'Regional risk' : key}</label>)}</fieldset>
        {mapFailed ? <MapFallback hospitals={hospitals} run={run} reason={mapFailed} onSelect={setSelectedHospitalId} /> : <div className="map-canvas" aria-describedby="map-description">
            <MapErrorBoundary onError={() => setMapFailed('The browser WebGL context could not be initialized.')}><Map ref={mapRef} mapStyle={styleUrl} initialViewState={{ longitude: -96.99, latitude: 32.87, zoom: 8.7 }} reuseMaps onStyleData={() => setMapLoaded(true)} onLoad={() => { setMapLoaded(true); fitHospitals(); }} onError={() => setMapFailed('The basemap style or browser WebGL context could not be loaded.')}>
                <NavigationControl position="top-right" showCompass={false} /><FullscreenControl position="top-right" />
                {layers.hazard && <Source id="hazard" type="geojson" data={hazardGeoJSON}><Layer id="hazard-fill" type="fill" paint={{ 'fill-color': ['match', ['get', 'hazardType'], 'flood', '#38bdf8', 'smoke', '#a78bfa', '#fb923c'], 'fill-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0, agentMapFocus === 'hazard' ? 0.25 : 0.12, 1, agentMapFocus === 'hazard' ? 0.48 : 0.3] }} /><Layer id="hazard-outline" type="line" paint={{ 'line-color': '#e2e8f0', 'line-width': agentMapFocus === 'hazard' ? 3 : 1.2, 'line-dasharray': [3, 2] }} /></Source>}
                {layers.risk && <Source id="risk" type="geojson" data={riskGeoJSON}><Layer id="risk-surface" type="circle" paint={{ 'circle-radius': ['interpolate', ['linear'], ['get', 'weight'], 0, 16, 1, 72], 'circle-color': ['interpolate', ['linear'], ['get', 'weight'], 0, '#22c55e', 0.5, '#f59e0b', 1, '#ef4444'], 'circle-opacity': 0.2, 'circle-blur': 0.6 }} /></Source>}
                {layers.dependencies && <Source id="dependencies" type="geojson" data={dependencyGeoJSON}><Layer id="dependency-lines" type="line" paint={{ 'line-color': ['case', ['get', 'affected'], '#f43f5e', '#64748b'], 'line-width': ['case', ['get', 'affected'], 2.5, 1], 'line-opacity': 0.62, 'line-dasharray': [2, 2] }} /></Source>}
                {layers.transfers && transferGeoJSON.features.length > 0 && <Source id="transfers" type="geojson" data={transferGeoJSON}><Layer id="transfer-lines" type="line" paint={{ 'line-color': '#22d3ee', 'line-width': ['interpolate', ['linear'], ['get', 'patients'], 0, agentMapFocus === 'transfers' ? 4 : 2, 50, agentMapFocus === 'transfers' ? 10 : 7], 'line-opacity': 0.92, 'line-dasharray': [2, 1] }} /><Layer id="transfer-direction" type="symbol" layout={{ 'symbol-placement': 'line', 'symbol-spacing': 75, 'text-field': '▶', 'text-size': agentMapFocus === 'transfers' ? 17 : 13, 'text-keep-upright': false }} paint={{ 'text-color': '#cffafe', 'text-halo-color': '#083344', 'text-halo-width': 1 }} /></Source>}
                {layers.hospitals && hospitalGeoJSON.features.map((feature) => <Marker key={feature.properties.hospitalId} longitude={feature.geometry.coordinates[0]} latitude={feature.geometry.coordinates[1]} anchor="center"><button type="button" aria-label={`${feature.properties.name}: ${feature.properties.status}${feature.properties.attacked ? ', cyber-compromised target' : ''}${feature.properties.uncertain ? ', reduced-confidence state' : ''}${feature.properties.trustStatus ? `, trust evidence ${feature.properties.trustStatus}` : ''}${feature.properties.difference ? `, ${feature.properties.difference} versus baseline` : ''}`} className={`map-marker map-marker--${feature.properties.status} ${feature.properties.attacked ? 'map-marker--attacked' : ''} ${feature.properties.selected ? 'map-marker--selected' : ''} ${feature.properties.uncertain ? 'map-marker--uncertain' : ''} ${feature.properties.trustStatus ? `map-marker--trust-${feature.properties.trustStatus}` : ''} ${feature.properties.difference ? `map-marker--difference-${feature.properties.difference}` : ''}`} style={{ width: `${30 + feature.properties.disruptionProbability * 20}px`, height: `${30 + feature.properties.disruptionProbability * 20}px` }} onClick={() => setSelectedHospitalId(feature.properties.hospitalId)}><span>H</span>{feature.properties.humanReviewRequired && <b title="Human review required">!</b>}{layers.labels && <em>{feature.properties.name}</em>}</button></Marker>)}
            </Map></MapErrorBoundary>
            {!mapLoaded && <div className="map-loading" role="status">Loading keyless basemap…</div>}<MapLegend />
        </div>}
        <p className="map-risk-note">Estimated visual risk surface derived from simulation outputs. It is a deterministic visual approximation, not measured real-world risk.</p>
        <p className="disclaimer-inline">All facility locations, hazard zones, and routes shown in this research prototype are synthetic or simulated.</p>
        <div className="sr-only" aria-live="polite">{run ? `Simulation results rendered for ${run.scenario.name}. ${run.result.affected_hospitals.filter((state) => state.status === 'critical').length} critical hospitals.` : 'Hospital catalog loaded. Awaiting simulation.'}</div>
    </section>;
}

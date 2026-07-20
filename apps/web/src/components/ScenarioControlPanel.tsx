import type { FormEvent } from 'react';

import { useSimulation } from '../SimulationContext';
import type { SimulationRequest } from '../types';
import { percent } from '../utils';

function RangeField({ label, value, max = 1, step = 0.01, onChange }: { label: string; value: number; max?: number; step?: number; onChange: (value: number) => void }) {
    return <label className="field"><span>{label} <output>{max === 1 ? percent(value) : value}</output></span><input type="range" min="0" max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export function ScenarioControlPanel() {
    const { scenarios, selectedScenario, configuration, setSelectedScenario, setConfiguration, resetConfiguration, runSimulation, runState } = useSimulation();
    if (!selectedScenario || !configuration) return <section className="panel empty-state">No scenario configuration is available.</section>;

    const update = (change: Partial<SimulationRequest>) => setConfiguration({ ...configuration, ...change });
    const updateHazard = (change: Partial<SimulationRequest['hazard']>) => update({ hazard: { ...configuration.hazard, ...change } });
    const updateCyber = (change: Partial<SimulationRequest['cyber_event']>) => update({ cyber_event: { ...configuration.cyber_event, ...change } });
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (event.currentTarget.reportValidity()) void runSimulation();
    };

    return <section className="panel control-panel" id="scenario-configuration">
        <div className="section-heading"><div><span className="eyebrow">01 · Configure</span><h2>Scenario Configuration</h2></div><span className={`severity severity--${selectedScenario.severity}`}>{selectedScenario.severity}</span></div>
        <form onSubmit={submit}>
            <label className="field"><span>Scenario</span><select aria-label="Scenario" value={selectedScenario.id} onChange={(event) => {
                const scenario = scenarios.find((item) => item.id === event.target.value);
                if (scenario) setSelectedScenario(scenario);
            }}>{scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label>
            <p className="muted small">{selectedScenario.description}</p>
            <div className="tag-list">{selectedScenario.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <h3>Environmental hazard</h3>
            <RangeField label="Flood severity" value={configuration.hazard.flood_severity} onChange={(value) => updateHazard({ flood_severity: value })} />
            <RangeField label="Grid outage probability" value={configuration.hazard.grid_outage_probability} onChange={(value) => updateHazard({ grid_outage_probability: value })} />
            <label className="field field--split"><span>Heat index</span><input type="number" min="40" max="150" value={configuration.hazard.heat_index} onChange={(event) => updateHazard({ heat_index: Number(event.target.value) })} /></label>
            <label className="field field--split"><span>Air quality index</span><input type="number" min="0" max="500" value={configuration.hazard.air_quality_index} onChange={(event) => updateHazard({ air_quality_index: Number(event.target.value) })} /></label>
            <h3>Cyber event</h3>
            <label className="field"><span>Attack type</span><select value={configuration.cyber_event.attack_type} onChange={(event) => updateCyber({ attack_type: event.target.value })}><option value="ransomware">Ransomware</option><option value="credential-abuse">Credential abuse</option><option value="telemetry-tampering">Telemetry tampering</option></select></label>
            <RangeField label="Cyber severity" value={configuration.cyber_event.severity} onChange={(value) => updateCyber({ severity: value })} />
            <RangeField label="Telemetry tampering" value={configuration.cyber_event.telemetry_tampering} onChange={(value) => updateCyber({ telemetry_tampering: value })} />
            <RangeField label="Missing telemetry" value={configuration.missing_telemetry_ratio} max={0.9} onChange={(value) => update({ missing_telemetry_ratio: value })} />
            <h3>Simulation</h3>
            <label className="field field--split"><span>Horizon (hours)</span><input aria-label="Simulation horizon" type="number" min="1" max="168" value={configuration.horizon_hours} onChange={(event) => update({ horizon_hours: Number(event.target.value) })} /></label>
            <label className="field field--split"><span>Demand multiplier</span><input aria-label="Demand multiplier" type="number" min="0.5" max="3" step="0.05" value={configuration.demand_multiplier} onChange={(event) => update({ demand_multiplier: Number(event.target.value) })} /></label>
            <label className="toggle"><input type="checkbox" checked={configuration.enable_counterfactuals} onChange={(event) => update({ enable_counterfactuals: event.target.checked })} /><span>Enable counterfactuals</span></label>
            <div className="button-row"><button type="button" className="button button--ghost" onClick={resetConfiguration}>Reset</button><button type="submit" className="button button--primary" disabled={runState === 'loading'}>{runState === 'loading' ? 'Simulating…' : 'Run Simulation'}</button></div>
        </form>
    </section>;
}

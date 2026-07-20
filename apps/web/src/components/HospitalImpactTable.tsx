import { useEffect, useMemo, useState } from 'react';

import { useSimulation } from '../SimulationContext';
import type { CompletedRun, Hospital } from '../types';
import { decimal, percent, sortedHospitals, statusClass } from '../utils';

export function HospitalImpactTable({ run, hospitals }: { run: CompletedRun | null; hospitals: Hospital[] }) {
    const { selectedHospitalId, setSelectedHospitalId } = useSimulation();
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const rows = useMemo(() => {
        if (!run) return [];
        return sortedHospitals(run.result.affected_hospitals).filter((state) => {
            const hospital = hospitals.find((item) => item.hospital_id === state.hospital_id);
            return `${hospital?.name ?? ''} ${state.hospital_id}`.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || state.status === status);
        });
    }, [run, hospitals, query, status]);
    useEffect(() => {
        if (!query) return;
        const match = rows[0];
        if (match) setSelectedHospitalId(match.hospital_id);
    }, [query, rows, setSelectedHospitalId]);

    return <section className="panel impact-table" id="hospital-impact"><div className="section-heading"><div><span className="eyebrow">Facility-level output</span><h2>Hospital Impact</h2></div><div className="table-tools"><label>Search <input aria-label="Search hospitals" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label>Status <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All</option><option value="stable">Stable</option><option value="degraded">Degraded</option><option value="critical">Critical</option></select></label></div></div>
        {!run ? <div className="empty-state">Run a simulation to evaluate hospital impact.</div> : rows.length === 0 ? <div className="empty-state">No hospitals match the current filters.</div> : <div className="table-scroll"><table><thead><tr><th>Facility</th><th>Status</th><th>Effective capacity</th><th>Demand</th><th>Capacity gap</th><th>Load</th><th>Cyber loss</th><th>Hazard</th><th>Dependency</th><th>Disruption</th><th>Action</th></tr></thead><tbody>{rows.map((state) => {
            const hospital = hospitals.find((item) => item.hospital_id === state.hospital_id);
            return <tr key={state.hospital_id} className={selectedHospitalId === state.hospital_id ? 'table-row--selected' : ''} onClick={() => setSelectedHospitalId(state.hospital_id)}><td><strong>{hospital?.name ?? state.hospital_id}</strong><small>{state.hospital_id}</small></td><td><span className={statusClass(state.status)}>{state.status}</span></td><td>{decimal(Math.max(0, state.effective_capacity))}</td><td>{decimal(state.estimated_demand)}</td><td>{decimal(Math.max(0, state.estimated_demand - state.effective_capacity))}</td><td>{decimal(state.load_ratio)}×</td><td>{percent(state.cyber_loss)}</td><td>{percent(state.hazard_pressure)}</td><td>{percent(state.dependency_pressure)}</td><td>{percent(state.disruption_probability)}</td><td><button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); setSelectedHospitalId(state.hospital_id); }}>Inspect</button></td></tr>;
        })}</tbody></table></div>}
    </section>;
}

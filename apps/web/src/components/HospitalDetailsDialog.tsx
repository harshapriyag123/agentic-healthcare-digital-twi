import { useEffect, useRef } from 'react';

import type { CompletedRun, Hospital, HospitalState } from '../types';
import { decimal, percent, statusClass } from '../utils';

export function HospitalDetailsDialog({ hospital, state, run, onClose }: { hospital: Hospital; state?: HospitalState; run: CompletedRun | null; onClose: () => void }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    useEffect(() => { dialogRef.current?.showModal(); }, []);
    const incoming = run?.result.transfer_plan.filter((item) => item.to_hospital_id === hospital.hospital_id) ?? [];
    const outgoing = run?.result.transfer_plan.filter((item) => item.from_hospital_id === hospital.hospital_id) ?? [];
    return <dialog ref={dialogRef} className="drawer" aria-labelledby="hospital-details-title" onCancel={onClose}><div className="drawer__backdrop" onClick={onClose} /><article>
        <button type="button" className="drawer__close" onClick={onClose} aria-label="Close hospital details">×</button>
        <span className={state ? statusClass(state.status) : 'status status--unknown'}>{state?.status ?? 'Awaiting simulation'}</span><h2 id="hospital-details-title">{hospital.name}</h2><code>{hospital.hospital_id}</code>
        <p className="synthetic-label">Synthetic coordinates: {hospital.latitude.toFixed(4)}, {hospital.longitude.toFixed(4)}</p>
        {run?.result.trust.human_review_required && <div className="warning">Authorized human review is required for recommendations.</div>}
        <dl className="metric-list"><div><dt>Backup power</dt><dd>{hospital.backup_power_hours} hours</dd></div><div><dt>Staffed beds</dt><dd>{hospital.staffed_beds}</dd></div>{state ? <><div><dt>Effective capacity</dt><dd>{decimal(state.effective_capacity)}</dd></div><div><dt>Estimated demand</dt><dd>{decimal(state.estimated_demand)}</dd></div><div><dt>Capacity gap</dt><dd>{decimal(Math.max(0, state.estimated_demand - state.effective_capacity))}</dd></div><div><dt>Load ratio</dt><dd>{decimal(state.load_ratio)}×</dd></div><div><dt>Disruption probability</dt><dd>{percent(state.disruption_probability)}</dd></div><div><dt>Cyber loss</dt><dd>{percent(state.cyber_loss)}</dd></div><div><dt>Dependency pressure</dt><dd>{percent(state.dependency_pressure)}</dd></div></> : <div><dt>Dynamic state</dt><dd>Run a simulation to evaluate</dd></div>}</dl>
        <h3>Outgoing simulated transfers</h3>{outgoing.length === 0 ? <p className="muted">None recommended.</p> : outgoing.map((item) => <p key={`${item.from_hospital_id}-${item.to_hospital_id}`}>{item.patients} patients → {item.to_hospital_id}</p>)}
        <h3>Incoming simulated transfers</h3>{incoming.length === 0 ? <p className="muted">None recommended.</p> : incoming.map((item) => <p key={`${item.from_hospital_id}-${item.to_hospital_id}`}>{item.patients} patients ← {item.from_hospital_id}</p>)}
    </article></dialog>;
}

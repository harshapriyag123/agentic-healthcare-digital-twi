import type { CompletedRun, Hospital } from '../types';

export function TransferPlanPanel({ run, hospitals }: { run: CompletedRun | null; hospitals: Hospital[] }) {
    const name = (id: string) => hospitals.find((hospital) => hospital.hospital_id === id)?.name ?? id;
    return <section className="panel" id="transfer-plan"><div className="section-heading"><h2>Patient Transfer Recommendations</h2></div>
        {!run ? <div className="empty-state">Run a simulation to calculate transfer recommendations.</div> : run.result.transfer_plan.length === 0 ? <p>No patient transfers were recommended for this simulation.</p> : <div className="transfer-grid">{run.result.transfer_plan.map((transfer) => <article key={`${transfer.from_hospital_id}-${transfer.to_hospital_id}`}><span className={`status ${transfer.safety_constraints_satisfied ? 'status--stable' : 'status--critical'}`}>{transfer.safety_constraints_satisfied ? 'Safety constraints satisfied' : 'Constraint warning'}</span><h3>{name(transfer.from_hospital_id)} → {name(transfer.to_hospital_id)}</h3><strong>{transfer.patients} simulated patients</strong><p>{transfer.rationale}</p></article>)}</div>}
        <p className="disclaimer-inline">Simulated operational planning output. Not a clinical instruction or authorization to transfer patients.</p>
    </section>;
}

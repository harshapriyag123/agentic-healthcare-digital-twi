import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import App from '../App';
import { SimulationProvider } from '../SimulationContext';
import { comparison, hospitals, interventionDefinitions, result, scenarios } from './fixtures';

vi.mock('react-map-gl/maplibre', async () => import('./mapMock'));

function json(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function installFetch(simulation: () => Promise<Response> = () => json(result()), counterfactual: () => Promise<Response> = () => json(comparison())) {
    const mock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => {
        const path = String(input);
        if (path.endsWith('/health')) return json({ status: 'ok', service: 'geotwin-api' });
        if (path.endsWith('/hospitals')) return json(hospitals);
        if (path.endsWith('/scenarios')) return json(scenarios);
        if (path.endsWith('/counterfactuals/interventions')) return json(interventionDefinitions);
        if (path.endsWith('/simulations/run')) return simulation();
        if (path.endsWith('/counterfactuals/run')) return counterfactual();
        return json({ detail: 'Not found' }, 404);
    });
    vi.stubGlobal('fetch', mock);
    return mock;
}

function renderApp(path = '/command-center') {
    return render(<MemoryRouter initialEntries={[path]}><SimulationProvider><App /></SimulationProvider></MemoryRouter>);
}

async function ready() {
    await screen.findByRole('heading', { name: 'Crisis Command Center' });
}

async function run() {
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Run Simulation' }));
    await screen.findByText('Backend simulation explanation.');
}

async function openAgentConsole() {
    await run();
    await userEvent.click(screen.getByRole('button', { name: 'Open Agent Console' }));
    await screen.findByRole('heading', { name: 'Agent Activity Console' });
}

async function openCounterfactualExplorer() {
    await run();
    await userEvent.click(screen.getByRole('link', { name: 'Open Counterfactual Explorer' }));
    await screen.findByRole('heading', { name: 'Counterfactual Explorer' });
}

async function openTrustDashboard() {
    await run();
    await userEvent.click(screen.getByRole('link', { name: 'Open Trust Dashboard' }));
    await screen.findByRole('heading', { name: 'Trust and Evidence Dashboard' });
}

describe('GeoTwin command center', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('renders the command center and loads scenario configuration', async () => {
        installFetch(); renderApp(); await ready();
        expect(screen.getByRole('combobox', { name: 'Scenario' })).toHaveValue('flood-grid-cascade');
        expect(screen.getByLabelText('Simulation horizon')).toHaveValue(24);
    });

    it('sends the edited backend request and disables duplicate submission', async () => {
        let resolveRun!: (response: Response) => void;
        const pending = new Promise<Response>((resolve) => { resolveRun = resolve; });
        const fetchMock = installFetch(() => pending); renderApp(); await ready();
        await userEvent.clear(screen.getByLabelText('Simulation horizon'));
        await userEvent.type(screen.getByLabelText('Simulation horizon'), '36');
        await userEvent.click(screen.getByRole('button', { name: 'Run Simulation' }));
        expect(screen.getByRole('button', { name: 'Simulating…' })).toBeDisabled();
        const call = fetchMock.mock.calls.find(([path]) => String(path).endsWith('/simulations/run'));
        expect(JSON.parse(String((call?.[1] as RequestInit).body))).toMatchObject({ scenario_name: 'flood-grid-cascade', horizon_hours: 36 });
        await act(async () => resolveRun(await json(result())));
    });

    it('populates metrics and hospital results from the API', async () => {
        installFetch(); renderApp(); await run();
        expect(screen.getAllByText('58%').length).toBeGreaterThan(0);
        expect(screen.getAllByText('North Regional Medical Center').length).toBeGreaterThan(0);
        expect(screen.getAllByText('72%').length).toBeGreaterThan(0);
    });

    it('renders different values for different scenario responses', async () => {
        let count = 0;
        installFetch(() => json(result({ simulation_id: `sim-${count}`, regional_risk_score: count++ === 0 ? 0.58 : 0.29 })));
        renderApp(); await run(); expect(screen.getAllByText('58%').length).toBeGreaterThan(0);
        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Scenario' }), 'heatwave-ransomware');
        await userEvent.click(screen.getByRole('button', { name: 'Run Simulation' }));
        await waitFor(() => expect(screen.getAllByText('29%').length).toBeGreaterThan(0));
    });

    it('renders agent decisions, empty transfers, low-integrity and human-review warnings', async () => {
        installFetch(); renderApp(); await run();
        expect(screen.getByText('Response Orchestrator')).toBeInTheDocument();
        expect(screen.getByText('Agents executed')).toBeInTheDocument();
        expect(screen.getByText('No patient transfers were recommended for this simulation.')).toBeInTheDocument();
        expect(screen.getByText('Telemetry integrity is low')).toBeInTheDocument();
        expect(screen.getByText('Human review required')).toBeInTheDocument();
    });

    it('sorts counterfactuals by risk reduction', async () => {
        installFetch(); renderApp(); await run();
        const panel = screen.getByRole('heading', { name: 'Counterfactual Interventions' }).closest('section');
        const headings = within(panel as HTMLElement).getAllByRole('heading', { level: 3 });
        expect(headings.map((heading) => heading.textContent)).toEqual(['combined containment', 'segment network']);
    });

    it('shows retry UI after a simulation failure', async () => {
        installFetch(() => json({ detail: 'Simulation service unavailable' }, 500)); renderApp(); await ready();
        await userEvent.click(screen.getByRole('button', { name: 'Run Simulation' }));
        expect(await screen.findByText('Simulation service unavailable')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry simulation' })).toBeInTheDocument();
    });

    it('disables the SigNoz link when its URL is missing', async () => {
        installFetch(); renderApp(); await ready();
        expect(screen.getByRole('button', { name: 'SigNoz dashboard URL not configured' })).toBeDisabled();
    });

    it('runs the Wildfire + Telemetry Tampering demonstration exactly once', async () => {
        const fetchMock = installFetch(); renderApp('/');
        await screen.findByRole('heading', { name: /Agentic Digital Twin for Healthcare Infrastructure Resilience/ });
        await userEvent.click(screen.getByRole('button', { name: 'Run Wildfire + Telemetry Demo' }));
        await screen.findByText('Backend simulation explanation.');
        const calls = fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/simulations/run'));
        expect(calls).toHaveLength(1);
        expect(JSON.parse(String((calls[0][1] as RequestInit).body)).scenario_name).toBe('wildfire-telemetry');
    });

    it('shows a recoverable catalog error', async () => {
        const mock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) => String(input).endsWith('/health') ? json({ status: 'ok', service: 'geotwin-api' }) : json({ detail: 'Backend unavailable' }, 503));
        vi.stubGlobal('fetch', mock); renderApp();
        expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
});

describe('Spatial digital twin', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('renders synthetic hospital markers in awaiting state before simulation', async () => {
        installFetch(); renderApp(); await ready();
        expect(screen.getByTestId('healthcare-map')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'North Regional Medical Center: awaiting' })).toBeInTheDocument();
    });

    it('updates marker status and compromised styling from the result', async () => {
        installFetch(); renderApp(); await run();
        const marker = screen.getByRole('button', { name: /North Regional Medical Center: degraded, cyber-compromised target/ });
        expect(marker).toHaveClass('map-marker--degraded', 'map-marker--attacked');
    });

    it('renders no transfer source for an empty plan and renders backend routes when present', async () => {
        let response = result(); installFetch(() => json(response)); renderApp(); await run();
        expect(screen.queryByTestId('source-transfers')).not.toBeInTheDocument();
        response = result({ simulation_id: 'sim-transfer', transfer_plan: [{ from_hospital_id: 'HOSP-DFW-001', to_hospital_id: 'HOSP-DFW-002', patients: 12, rationale: 'Spare capacity', safety_constraints_satisfied: true }] });
        await userEvent.click(screen.getByRole('button', { name: 'Run Simulation' }));
        expect(await screen.findByTestId('source-transfers')).toBeInTheDocument();
    });

    it('synchronizes marker and table selection through one hospital ID', async () => {
        installFetch(); renderApp(); await run();
        await userEvent.click(screen.getByRole('button', { name: /North Regional Medical Center: degraded/ }));
        expect(await screen.findByRole('dialog')).toHaveTextContent('Synthetic coordinates');
        await userEvent.click(screen.getByRole('button', { name: 'Close hospital details' }));
        const row = screen.getByText('HOSP-DFW-001').closest('tr');
        await userEvent.click(row as HTMLElement);
        expect(screen.getByRole('button', { name: /North Regional Medical Center: degraded/ })).toHaveClass('map-marker--selected');
    });

    it('toggles native map layers and provides a map failure fallback', async () => {
        installFetch(() => json(result({ transfer_plan: [{ from_hospital_id: 'HOSP-DFW-001', to_hospital_id: 'HOSP-DFW-002', patients: 5, rationale: 'Capacity', safety_constraints_satisfied: true }] }))); renderApp(); await run();
        expect(screen.getByTestId('source-transfers')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('checkbox', { name: 'transfers' }));
        expect(screen.queryByTestId('source-transfers')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Trigger map failure' }));
        expect(screen.getByRole('heading', { name: 'Interactive map unavailable' })).toBeInTheDocument();
        expect(screen.getByText(/browser WebGL context/)).toBeInTheDocument();
    });
});

describe('Agent Activity Console', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('opens from the compact widget and renders only actual execution records in backend order', async () => {
        installFetch(); renderApp(); await openAgentConsole();
        const nodes = document.querySelectorAll('.agent-node strong');
        expect([...nodes].map((node) => node.textContent)).toEqual([
            'Compound Event Detector', 'Telemetry Integrity Agent', 'Resilience Planning Agent', 'Response Orchestrator',
        ]);
        expect(screen.getAllByText('Planned capability — not executed in this simulation.')).toHaveLength(4);
        expect(screen.getByText('System processing — not an agent')).toBeInTheDocument();
    });

    it('selects an agent and shows confidence, review state, evidence, and safe observability fields', async () => {
        installFetch(); renderApp(); await openAgentConsole();
        await userEvent.click(screen.getByRole('button', { name: /Select Telemetry Integrity Agent/ }));
        const detail = screen.getByText('Selected execution record').closest('aside') as HTMLElement;
        expect(within(detail).getByRole('heading', { name: 'Telemetry Integrity Agent' })).toBeInTheDocument();
        expect(within(detail).getByText('61% · Moderate')).toBeInTheDocument();
        expect(within(detail).getByText('Required')).toBeInTheDocument();
        expect(within(detail).getByText('telemetry integrity')).toBeInTheDocument();
        expect(within(detail).getByText('2222222222222222')).toBeInTheDocument();
        expect(within(detail).getByRole('link', { name: 'Open Trust & Evidence' })).toHaveAttribute('href', '/command-center#trust-evidence');
    });

    it('shows truthful duration and trace fallbacks and disables SigNoz without configuration', async () => {
        const withoutTrace = result({ trace_id: null, agent_decisions: result().agent_decisions.map((record) => ({ ...record, trace_id: null, span_id: null })) });
        installFetch(() => json(withoutTrace)); renderApp(); await openAgentConsole();
        await userEvent.click(screen.getByRole('button', { name: /Select Response Orchestrator/ }));
        expect(screen.getAllByText('Not exposed by backend').length).toBeGreaterThan(0);
        expect(screen.getByText('Trace correlation is recorded by the backend but is not currently exposed through the API for this run.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'SigNoz dashboard URL not configured' })).toBeDisabled();
    });

    it('renders failed agents prominently and does not expose raw prompts or hidden reasoning', async () => {
        const failed = result();
        failed.agent_decisions = failed.agent_decisions.map((record) => record.agent === 'resilience-planning-agent' ? { ...record, status: 'failed', action: 'defer-to-human-review', confidence: 0, error: 'Agent execution failed safely.', warning: null, human_review_required: true } : record);
        installFetch(() => json(failed)); renderApp(); await openAgentConsole();
        expect(screen.getByRole('button', { name: /Select Resilience Planning Agent, failed/ })).toBeInTheDocument();
        expect(screen.getByText('Agent execution failed safely.')).toBeInTheDocument();
        expect(screen.queryByText(/system prompt|chain-of-thought|hidden reasoning/i)).not.toBeInTheDocument();
    });

    it('shows a safe empty state when no agent records are returned', async () => {
        installFetch(() => json(result({ agent_decisions: [] }))); renderApp(); await openAgentConsole();
        expect(screen.getByText('No agent execution records were returned.')).toBeInTheDocument();
        expect(screen.getByText('No execution records match these filters.')).toBeInTheDocument();
    });

    it('labels pending work as an expected sequence rather than live execution', async () => {
        const pending = new Promise<Response>(() => undefined);
        installFetch(() => pending); renderApp(); await ready();
        await userEvent.click(screen.getByRole('button', { name: 'Run Simulation' }));
        expect(screen.getAllByText('Expected processing sequence').length).toBeGreaterThan(0);
        expect(screen.getByText('Expected workflow only; live agent status is not streamed.')).toBeInTheDocument();
    });

    it('uses agent selection to focus the existing map context', async () => {
        installFetch(); renderApp(); await openAgentConsole();
        await userEvent.click(screen.getByRole('button', { name: /Select Resilience Planning Agent/ }));
        await userEvent.click(screen.getByRole('link', { name: /Command Center/ }));
        expect(await screen.findByText('Agent focus: transfers')).toBeInTheDocument();
    });
});

describe('Counterfactual Explorer', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('opens from a valid completed baseline and renders intervention metadata', async () => {
        installFetch(); renderApp(); await openCounterfactualExplorer();
        expect(screen.getByText('Valid comparison baseline')).toBeInTheDocument();
        expect(screen.getByText('sim-123')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Backup Power Activation/ })).toBeChecked();
        expect(screen.getByText('The no-intervention outcome is always included as the exact simulation baseline.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open Agent Console' })).toHaveAttribute('href', '/agents/sim-123');
    });

    it('shows a safe missing-baseline state', async () => {
        installFetch(); renderApp('/counterfactuals/missing');
        expect(await screen.findByRole('heading', { name: 'Counterfactual baseline unavailable' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open Command Center' })).toBeInTheDocument();
    });

    it('submits one deduplicated comparison request and preserves processing labeling', async () => {
        let resolveComparison!: (response: Response) => void;
        const pending = new Promise<Response>((resolve) => { resolveComparison = resolve; });
        const fetchMock = installFetch(undefined, () => pending); renderApp(); await openCounterfactualExplorer();
        await userEvent.click(screen.getByRole('button', { name: /Run 3 selected counterfactuals/ }));
        expect(screen.getByRole('button', { name: 'Running comparison…' })).toBeDisabled();
        expect(screen.getByText('These are non-streaming processing stages, not live backend events.')).toBeInTheDocument();
        const call = fetchMock.mock.calls.find(([path]) => String(path).endsWith('/counterfactuals/run'));
        const body = JSON.parse(String((call?.[1] as RequestInit).body));
        expect(body.simulation_id).toBe('sim-123');
        expect(new Set(body.interventions.map((item: { intervention_id: string }) => item.intervention_id)).size).toBe(body.interventions.length);
        await act(async () => resolveComparison(await json(comparison())));
    });

    it('renders baseline, outcome charts, hospital transitions, transfers, trust, and report', async () => {
        installFetch(); renderApp(); await openCounterfactualExplorer();
        await userEvent.click(screen.getByRole('button', { name: /Run 3 selected counterfactuals/ }));
        expect(await screen.findByRole('heading', { name: 'Outcome Comparison' })).toBeInTheDocument();
        expect(screen.getByText('Baseline · No Intervention')).toBeInTheDocument();
        expect(screen.getByText('degraded → stable')).toBeInTheDocument();
        expect(screen.getByText('+8 simulated patients')).toBeInTheDocument();
        expect(screen.getAllByText('Insufficient confidence for automated prioritization')).not.toHaveLength(0);
        expect(screen.getByRole('heading', { name: 'Comparison Report' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'SigNoz dashboard URL not configured' })).toBeDisabled();
    });

    it('updates ranking weights without rerunning backend outcomes', async () => {
        const fetchMock = installFetch(); renderApp(); await openCounterfactualExplorer();
        await userEvent.click(screen.getByRole('button', { name: /Run 3 selected counterfactuals/ }));
        await screen.findByRole('heading', { name: 'Ranking Priorities' });
        const before = fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/counterfactuals/run')).length;
        fireEvent.change(screen.getByRole('slider', { name: /risk/ }), { target: { value: '0' } });
        fireEvent.change(screen.getByRole('slider', { name: /trust/ }), { target: { value: '1' } });
        expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/counterfactuals/run'))).toHaveLength(before);
        expect(screen.getByText('Changing ranking weights changes prioritization, not the simulated outcomes. Weights are normalized automatically.')).toBeInTheDocument();
    });

    it('switches the reused GIS map between baseline, intervention, and difference views', async () => {
        installFetch(); renderApp(); await openCounterfactualExplorer();
        await userEvent.click(screen.getByRole('button', { name: /Run 3 selected counterfactuals/ }));
        await screen.findByRole('heading', { name: 'GIS Comparison Mode' });
        expect(screen.getByRole('button', { name: /North Regional Medical Center: stable, cyber-compromised target, reduced-confidence state, improved versus baseline/ })).toHaveClass('map-marker--difference-improved');
        await userEvent.click(screen.getByRole('button', { name: 'baseline' }));
        expect(screen.getByRole('button', { name: /North Regional Medical Center: degraded/ })).not.toHaveClass('map-marker--difference-improved');
        await userEvent.click(screen.getByRole('button', { name: 'side by side' }));
        expect(screen.getAllByTestId('healthcare-map')).toHaveLength(2);
    });

    it('keeps partial failures visible, excludes them from rank, and supports print report', async () => {
        const failed = { ...comparison(), incomplete: true, interventions: [...comparison().interventions, { ...comparison().interventions[0], intervention_id: 'telemetry-verification', intervention_name: 'Telemetry Verification', status: 'failed' as const, error: 'Not applicable to this baseline.' }], warnings: ['Comparison incomplete.'] };
        const print = vi.fn(); vi.stubGlobal('print', print);
        installFetch(undefined, () => json(failed)); renderApp(); await openCounterfactualExplorer();
        await userEvent.click(screen.getByRole('button', { name: /Run 3 selected counterfactuals/ }));
        expect(await screen.findAllByText('Not applicable to this baseline.')).not.toHaveLength(0);
        const tradeOffSection = screen.getByRole('heading', { name: 'Trade-off Matrix' }).closest('section');
        const failedRow = within(tradeOffSection as HTMLElement).getByText('Telemetry Verification').closest('tr');
        expect(within(failedRow as HTMLElement).getByText('Excluded')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Print comparison report' }));
        expect(print).toHaveBeenCalledOnce();
    });
});

describe('Trust and Evidence Dashboard', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('renders an explainable assessment for a valid simulation without hidden default scores', async () => {
        installFetch(); renderApp(); await openTrustDashboard();
        expect(screen.getAllByText('geotwin-trust-v2.0')).not.toHaveLength(0);
        expect(screen.getByRole('heading', { name: 'Authorized human review required' })).toBeInTheDocument();
        expect(screen.getAllByText(/suspected tampering/i)).not.toHaveLength(0);
        expect(screen.getByText(/not private agent reasoning/)).toBeInTheDocument();
    });

    it('searches, filters, and opens evidence details', async () => {
        installFetch(); renderApp(); await openTrustDashboard();
        await userEvent.type(screen.getByRole('textbox', { name: 'Search evidence' }), 'regional-risk');
        expect(screen.getAllByText('regional-risk')).not.toHaveLength(0);
        expect(screen.queryByText('telemetry-integrity', { selector: 'code' })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Details' }));
        expect(screen.getByRole('dialog', { name: 'Evidence Detail' })).toBeInTheDocument();
        expect(screen.getAllByText(/basic lineage/)).not.toHaveLength(0);
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('links agents and hospital evidence and exposes missing references', async () => {
        const broken = result({ agent_decisions: [{ ...result().agent_decisions[0], evidence_ids: ['missing-reference'] }] });
        installFetch(() => json(broken)); renderApp(); await openTrustDashboard();
        expect(screen.getByText(/Missing references: missing-reference/)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Agent Evidence Dependencies' })).toBeInTheDocument();
    });

    it('shows lineage text fallback, policies, anomalies, GIS trust indicators, and disabled SigNoz', async () => {
        installFetch(); renderApp(); await openTrustDashboard();
        expect(screen.getByRole('heading', { name: 'Provenance and Evidence Lineage' })).toBeInTheDocument();
        expect(screen.getByText('Basic lineage, not cryptographic provenance')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Conflicts and Anomalies' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Policy Compliance' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /North Regional Medical Center: degraded.*trust evidence degraded/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'SigNoz dashboard URL not configured' })).toBeDisabled();
    });

    it('shows unknown state and no positive trust when simulation is missing', async () => {
        installFetch(); renderApp('/trust/not-found');
        expect(await screen.findByRole('heading', { name: 'Trust assessment unavailable' })).toBeInTheDocument();
        expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    });

    it('renders counterfactual trust comparison from the existing session result', async () => {
        installFetch(); renderApp(); await openCounterfactualExplorer();
        await userEvent.click(screen.getByRole('button', { name: /Run 3 selected counterfactuals/ }));
        await screen.findByRole('heading', { name: 'Outcome Comparison' });
        await userEvent.click(screen.getByRole('link', { name: 'Open Trust Dashboard' }));
        expect(await screen.findByRole('heading', { name: 'Counterfactual Trust Comparison' })).toBeInTheDocument();
        expect(screen.getByText('Network Segmentation')).toBeInTheDocument();
    });
});

/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from './api';
import type { CounterfactualExplorerResponse, CounterfactualRunRequest, InterventionDefinition } from './counterfactualTypes';
import type { AgentMapFocus, CompletedRun, Health, Hospital, ObservabilityHealth, RequestState, Scenario, SimulationRequest } from './types';

type SimulationContextValue = {
    scenarios: Scenario[];
    hospitals: Hospital[];
    health: Health | null;
    observabilityHealth: ObservabilityHealth | null;
    catalogState: RequestState;
    catalogError: string;
    selectedScenario: Scenario | null;
    configuration: SimulationRequest | null;
    runState: RequestState;
    runError: string;
    activeRun: CompletedRun | null;
    runs: CompletedRun[];
    selectedHospitalId: string | null;
    setSelectedHospitalId: (id: string | null) => void;
    selectedAgentId: string | null;
    setSelectedAgentId: (id: string | null) => void;
    agentMapFocus: AgentMapFocus;
    setAgentMapFocus: (focus: AgentMapFocus) => void;
    interventionDefinitions: InterventionDefinition[];
    counterfactualCatalogError: string;
    counterfactualState: RequestState;
    counterfactualError: string;
    comparisons: CounterfactualExplorerResponse[];
    selectedInterventionId: string | null;
    setSelectedInterventionId: (id: string | null) => void;
    runCounterfactuals: (request: CounterfactualRunRequest) => Promise<CounterfactualExplorerResponse | null>;
    setSelectedScenario: (scenario: Scenario) => void;
    setConfiguration: (request: SimulationRequest) => void;
    resetConfiguration: () => void;
    runSimulation: (request?: SimulationRequest) => Promise<CompletedRun | null>;
    retryCatalog: () => Promise<void>;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);
const LAST_RUN_STORAGE_KEY = 'geotwin.lastCompletedRun';

function message(error: unknown) {
    return error instanceof Error ? error.message : 'An unexpected request error occurred.';
}

function readStoredRun(scenarios: Scenario[]): CompletedRun | null {
    try {
        const raw = window.localStorage.getItem(LAST_RUN_STORAGE_KEY);
        if (!raw) return null;
        const stored = JSON.parse(raw) as CompletedRun;
        const scenario = scenarios.find((item) => item.id === stored.scenario?.id);
        if (!scenario || !stored.result?.simulation_id || !stored.result?.trust || !Array.isArray(stored.result.affected_hospitals)) return null;
        return { ...stored, scenario };
    } catch {
        window.localStorage.removeItem(LAST_RUN_STORAGE_KEY);
        return null;
    }
}

export function SimulationProvider({ children }: { children: React.ReactNode }) {
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [health, setHealth] = useState<Health | null>(null);
    const [observabilityHealth, setObservabilityHealth] = useState<ObservabilityHealth | null>(null);
    const [catalogState, setCatalogState] = useState<RequestState>('loading');
    const [catalogError, setCatalogError] = useState('');
    const [selectedScenario, setSelectedScenarioState] = useState<Scenario | null>(null);
    const [configuration, setConfiguration] = useState<SimulationRequest | null>(null);
    const [runState, setRunState] = useState<RequestState>('idle');
    const [runError, setRunError] = useState('');
    const [activeRun, setActiveRun] = useState<CompletedRun | null>(null);
    const [runs, setRuns] = useState<CompletedRun[]>([]);
    const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [agentMapFocus, setAgentMapFocus] = useState<AgentMapFocus>(null);
    const [interventionDefinitions, setInterventionDefinitions] = useState<InterventionDefinition[]>([]);
    const [counterfactualCatalogError, setCounterfactualCatalogError] = useState('');
    const [counterfactualState, setCounterfactualState] = useState<RequestState>('idle');
    const [counterfactualError, setCounterfactualError] = useState('');
    const [comparisons, setComparisons] = useState<CounterfactualExplorerResponse[]>([]);
    const [selectedInterventionId, setSelectedInterventionId] = useState<string | null>(null);

    const loadCatalog = useCallback(async () => {
        setCatalogState('loading');
        setCatalogError('');
        const [scenarioResult, hospitalResult, healthResult, observabilityResult, interventionResult] = await Promise.allSettled([
            api.scenarios(), api.hospitals(), api.health(), api.observabilityHealth(), api.interventions(),
        ]);
        if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
        else setHealth(null);
        if (observabilityResult.status === 'fulfilled') setObservabilityHealth(observabilityResult.value);
        else setObservabilityHealth(null);
        if (interventionResult.status === 'fulfilled') { setInterventionDefinitions(interventionResult.value); setCounterfactualCatalogError(''); }
        else { setInterventionDefinitions([]); setCounterfactualCatalogError(message(interventionResult.reason)); }
        if (scenarioResult.status === 'rejected' || hospitalResult.status === 'rejected') {
            setCatalogError(message(scenarioResult.status === 'rejected' ? scenarioResult.reason : hospitalResult.status === 'rejected' ? hospitalResult.reason : 'Catalog unavailable'));
            setCatalogState('error');
            return;
        }
        setScenarios(scenarioResult.value);
        setHospitals(hospitalResult.value);
        const savedId = window.localStorage.getItem('geotwin.selectedScenario');
        const initial = scenarioResult.value.find((scenario) => scenario.id === savedId) ?? scenarioResult.value[0] ?? null;
        const storedRun = readStoredRun(scenarioResult.value);
        setSelectedScenarioState(initial);
        setConfiguration(initial ? structuredClone(initial.request) : null);
        if (storedRun) {
            setActiveRun(storedRun);
            setRuns([storedRun]);
            setRunState('success');
            setSelectedAgentId(storedRun.result.agent_decisions[0]?.agent_id ?? storedRun.result.agent_decisions[0]?.agent ?? null);
        }
        setCatalogState('success');
    }, []);

    useEffect(() => { void loadCatalog(); }, [loadCatalog]);

    const setSelectedScenario = useCallback((scenario: Scenario) => {
        setSelectedScenarioState(scenario);
        setConfiguration(structuredClone(scenario.request));
        setRunState('idle');
        setRunError('');
        window.localStorage.setItem('geotwin.selectedScenario', scenario.id);
    }, []);

    const resetConfiguration = useCallback(() => {
        if (selectedScenario) setConfiguration(structuredClone(selectedScenario.request));
    }, [selectedScenario]);

    const runSimulation = useCallback(async (request?: SimulationRequest) => {
        const payload = request ?? configuration;
        if (!payload || runState === 'loading') return null;
        const scenario = scenarios.find((item) => item.id === payload.scenario_name) ?? selectedScenario;
        if (!scenario) return null;
        setRunState('loading');
        setRunError('');
        const startedAt = performance.now();
        try {
            const result = await api.runSimulation(payload);
            const completed: CompletedRun = {
                result,
                request: structuredClone(payload),
                scenario,
                durationMs: performance.now() - startedAt,
                completedAt: new Date().toISOString(),
            };
            setActiveRun(completed);
            setRuns((current) => [completed, ...current]);
            setSelectedAgentId(result.agent_decisions[0]?.agent_id ?? result.agent_decisions[0]?.agent ?? null);
            setAgentMapFocus(null);
            setSelectedInterventionId(null);
            setRunState('success');
            window.localStorage.setItem('geotwin.lastSimulationId', result.simulation_id);
            window.localStorage.setItem(LAST_RUN_STORAGE_KEY, JSON.stringify(completed));
            return completed;
        } catch (error) {
            setRunError(message(error));
            setRunState('error');
            return null;
        }
    }, [configuration, runState, scenarios, selectedScenario]);

    useEffect(() => {
        if (
            catalogState === 'success'
            && runState === 'idle'
            && !activeRun
            && configuration
            && window.localStorage.getItem('geotwin.lastSimulationId')
            && !window.localStorage.getItem(LAST_RUN_STORAGE_KEY)
        ) {
            void runSimulation(configuration);
        }
    }, [activeRun, catalogState, configuration, runSimulation, runState]);

    const runCounterfactuals = useCallback(async (request: CounterfactualRunRequest) => {
        if (counterfactualState === 'loading') return null;
        setCounterfactualState('loading');
        setCounterfactualError('');
        try {
            const comparison = await api.runCounterfactuals(request);
            setComparisons((current) => [comparison, ...current.filter((item) => item.comparison_id !== comparison.comparison_id)]);
            setSelectedInterventionId(comparison.ranking[0]?.intervention_id ?? comparison.interventions.find((item) => item.status === 'completed')?.intervention_id ?? null);
            setCounterfactualState('success');
            return comparison;
        } catch (error) {
            setCounterfactualError(message(error));
            setCounterfactualState('error');
            return null;
        }
    }, [counterfactualState]);

    const value = useMemo(() => ({
        scenarios, hospitals, health, observabilityHealth, catalogState, catalogError, selectedScenario, configuration,
        runState, runError, activeRun, runs, selectedHospitalId, setSelectedHospitalId, selectedAgentId, setSelectedAgentId,
        agentMapFocus, setAgentMapFocus, setSelectedScenario, setConfiguration,
        interventionDefinitions, counterfactualCatalogError, counterfactualState, counterfactualError,
        comparisons, selectedInterventionId, setSelectedInterventionId, runCounterfactuals,
        resetConfiguration, runSimulation, retryCatalog: loadCatalog,
    }), [scenarios, hospitals, health, observabilityHealth, catalogState, catalogError, selectedScenario, configuration,
        runState, runError, activeRun, runs, selectedHospitalId, selectedAgentId, agentMapFocus,
        interventionDefinitions, counterfactualCatalogError, counterfactualState, counterfactualError,
        comparisons, selectedInterventionId, setSelectedScenario, resetConfiguration, runSimulation, runCounterfactuals, loadCatalog]);

    return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
    const context = useContext(SimulationContext);
    if (!context) throw new Error('useSimulation must be used within SimulationProvider');
    return context;
}

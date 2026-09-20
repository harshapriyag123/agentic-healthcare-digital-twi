import type { Health, Hospital, ObservabilityHealth, Scenario, SimulationRequest, SimulationResult, TraceWaterfall } from './types';
import type { CounterfactualExplorerResponse, CounterfactualRunRequest, InterventionDefinition } from './counterfactualTypes';
import type { TrustDashboardResponse } from './trustTypes';
import { apiUrl } from './deploymentConfig';

const DEFAULT_TIMEOUT_MS = 20_000;
const COLD_START_TIMEOUT_MS = 60_000;

type RequestPolicy = { attempts?: number; timeoutMs?: number };

async function requestJson<T>(path: string, init?: RequestInit, policy: RequestPolicy = {}): Promise<T> {
    const attempts = policy.attempts ?? (!init?.method || init.method === 'GET' ? 2 : 1);
    const timeoutMs = policy.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(apiUrl(path), { ...init, signal: controller.signal });
        if (!response.ok) {
            let detail = `Request failed (${response.status})`;
            try {
                const body = await response.json() as { detail?: string | Array<{ msg?: string }> };
                if (typeof body.detail === 'string') detail = body.detail;
                else if (Array.isArray(body.detail)) detail = body.detail.map((item) => item.msg).filter(Boolean).join(', ') || detail;
            } catch {
                // Keep the safe status-based message when the response is not JSON.
            }
            throw new Error(detail);
        }
        return await response.json() as T;
      } catch (error) {
        lastError = error instanceof DOMException && error.name === 'AbortError' ? new Error('The backend request timed out.') : error;
      } finally {
        window.clearTimeout(timer);
      }
    }
    throw lastError;
}

export const api = {
    health: () => requestJson<Health>('/api/v1/health', undefined, { attempts: 1, timeoutMs: COLD_START_TIMEOUT_MS }),
    observabilityHealth: () => requestJson<ObservabilityHealth>('/api/v1/health/observability'),
    hospitals: () => requestJson<Hospital[]>('/api/v1/hospitals'),
    scenarios: () => requestJson<Scenario[]>('/api/v1/scenarios'),
    interventions: () => requestJson<InterventionDefinition[]>('/api/v1/counterfactuals/interventions'),
    trust: (simulationId: string) => requestJson<TrustDashboardResponse>(`/api/v1/trust/${encodeURIComponent(simulationId)}`),
    trace: (traceId: string) => requestJson<TraceWaterfall>(`/api/v1/observability/traces/${encodeURIComponent(traceId)}`),
    runSimulation: (request: SimulationRequest) => requestJson<SimulationResult>('/api/v1/simulations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    }),
    runCounterfactuals: (request: CounterfactualRunRequest) => requestJson<CounterfactualExplorerResponse>('/api/v1/counterfactuals/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    }),
};

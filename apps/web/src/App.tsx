import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { AgentConsolePage } from './pages/AgentConsolePage';
import { CommandCenterPage } from './pages/CommandCenterPage';
import { CounterfactualExplorerPage } from './pages/CounterfactualExplorerPage';
import { LandingPage } from './pages/LandingPage';
import { SimulationPage } from './pages/SimulationPage';
import { SigNozWorkspacePage } from './pages/SigNozWorkspacePage';
import { TrustDashboardPage } from './pages/TrustDashboardPage';

export default function App() {
    return (
        <Routes>
            <Route element={<AppShell />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/command-center" element={<CommandCenterPage />} />
                <Route path="/agents" element={<AgentConsolePage />} />
                <Route path="/agents/:simulationId" element={<AgentConsolePage />} />
                <Route path="/counterfactuals" element={<CounterfactualExplorerPage />} />
                <Route path="/counterfactuals/:simulationId" element={<CounterfactualExplorerPage />} />
                <Route path="/trust" element={<TrustDashboardPage />} />
                <Route path="/trust/:simulationId" element={<TrustDashboardPage />} />
                <Route path="/simulations/:simulationId" element={<SimulationPage />} />
                <Route path="/observability" element={<SigNozWorkspacePage />} />
                <Route path="/architecture" element={<ArchitecturePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useSimulation } from '../SimulationContext';
import { deploymentConfig } from '../deploymentConfig';

const commandLinks = [
    ['Scenarios', 'scenario-configuration'],
    ['SigNoz', 'observability'],
] as const;

export function AppShell() {
    const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem('geotwin.sidebarCollapsed') === 'true');
    const { health, selectedScenario, scenarios, setSelectedScenario, runSimulation, runState } = useSimulation();
    const navigate = useNavigate();

    const toggle = () => setCollapsed((current) => {
        window.localStorage.setItem('geotwin.sidebarCollapsed', String(!current));
        return !current;
    });

    const runDemo = async () => {
        const demo = scenarios.find((scenario) => scenario.id === 'wildfire-telemetry');
        if (!demo || runState === 'loading') return;
        setSelectedScenario(demo);
        navigate('/command-center');
        const completed = await runSimulation(demo.request);
        if (completed) navigate(`/simulations/${completed.result.simulation_id}`);
    };

    return (
        <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
            <aside className="sidebar" aria-label="Primary navigation">
                <button className="sidebar__toggle" type="button" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>☰</button>
                <Link className="brand" to="/" aria-label="GeoTwin Sentinel home"><span className="brand__mark">GT</span><span className="sidebar__label">GeoTwin Sentinel</span></Link>
                <nav>
                    <NavLink to="/command-center">◉ <span className="sidebar__label">Command Center</span></NavLink>
                    <NavLink to="/agents">◇ <span className="sidebar__label">Agent Activity</span></NavLink>
                    <NavLink to="/counterfactuals">◇ <span className="sidebar__label">Counterfactuals</span></NavLink>
                    <NavLink to="/trust">◇ <span className="sidebar__label">Trust & Evidence</span></NavLink>
                    {commandLinks.map(([label, anchor]) => <Link key={anchor} to={`/command-center#${anchor}`}>◇ <span className="sidebar__label">{label}</span></Link>)}
                    <Link to="/command-center#simulation-history">◷ <span className="sidebar__label">Simulation History</span></Link>
                    <NavLink to="/architecture">⌘ <span className="sidebar__label">Architecture</span></NavLink>
                </nav>
            </aside>
            <div className="app-frame">
                <header className="topbar">
                    <div><strong>GeoTwin Sentinel</strong><span>Healthcare Infrastructure Resilience</span></div>
                    <div className="topbar__status">
                        <span className={`connection ${health?.status === 'ok' ? 'connection--ok' : 'connection--down'}`}>Backend: {health?.status === 'ok' ? 'Healthy' : 'Unavailable'}</span>
                        <span>OTel: Runtime status not exposed</span>
                        <span>Scenario: {selectedScenario?.name ?? 'None'}</span>
                        <button type="button" className="button button--primary" onClick={() => void runDemo()} disabled={runState === 'loading' || scenarios.length === 0}>Run Demo</button>
                    </div>
                </header>
                <main className="main-content"><Outlet /></main>
                <footer className="statusbar">Research decision-support prototype using synthetic data. Outputs are simulated estimates intended for authorized human review and are not clinical, cybersecurity, transfer, infrastructure-control, or emergency-response instructions. <span>Environment: {deploymentConfig.appEnv} · Version: {deploymentConfig.appVersion} · Synthetic demo mode</span></footer>
            </div>
        </div>
    );
}

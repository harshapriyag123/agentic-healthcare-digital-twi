import { useState } from 'react';

const configuredSigNozUrl = import.meta.env.VITE_SIGNOZ_APP_URL?.trim();
const signozAppUrl = configuredSigNozUrl || (import.meta.env.DEV ? 'http://localhost:3301' : '');

export function SigNozWorkspacePage() {
    const [loading, setLoading] = useState(true);

    if (!signozAppUrl) {
        return (
            <section className="panel page-state">
                <span className="eyebrow">Observability deployment required</span>
                <h1>SigNoz workspace is not publicly configured</h1>
                <p>Set <code>VITE_SIGNOZ_APP_URL</code> to a public HTTPS SigNoz or published-dashboard URL during the web build. Localhost URLs are intentionally not used in production.</p>
            </section>
        );
    }

    return (
        <div className="signoz-workspace">
            <header className="signoz-workspace__header">
                <div>
                    <span className="eyebrow">Authenticated local observability</span>
                    <h1>SigNoz Community</h1>
                    <p>The complete local SigNoz application, including dashboards, services, logs, traces, metrics, alerts, and infrastructure.</p>
                </div>
                <a className="button button--secondary" href={signozAppUrl} target="_blank" rel="noreferrer">
                    Open SigNoz
                </a>
            </header>
            <div className="signoz-workspace__frame">
                {loading && <div className="signoz-workspace__loading">Loading authenticated SigNoz workspace…</div>}
                <iframe
                    src={signozAppUrl}
                    title="Authenticated SigNoz Community application"
                    onLoad={() => setLoading(false)}
                    allow="clipboard-read; clipboard-write; fullscreen"
                />
            </div>
        </div>
    );
}

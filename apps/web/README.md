# GeoTwin Sentinel web application

React/TypeScript/Vite command center for scenario execution, hospital GIS/table impact, agent activity, counterfactual comparison, trust/evidence, and trace correlation.

```bash
npm ci
cp .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 5173
```

Set `VITE_API_BASE_URL=http://127.0.0.1:8000` for a separately hosted local API. Every `VITE_*` value is public and must contain no secrets. Read [local setup](../../docs/guides/local-development.md), [accessibility](../../docs/guides/accessibility.md), and [demo script](../../docs/demo/demo-script.md).

The UI presents synthetic model estimates for authorized human review; it does not control healthcare infrastructure.

# Release checklist

- [ ] Select `APP_VERSION` / `VITE_APP_VERSION` and update `CHANGELOG.md`.
- [ ] Review the diff and confirm synthetic-data and safety disclaimers remain visible.
- [ ] Run backend Ruff and pytest checks.
- [ ] Run frontend lint, typecheck, tests, and production build.
- [ ] Build the backend image and verify it runs as UID 10001.
- [ ] Run container health, readiness, metadata, and local smoke tests.
- [ ] Review dependency advisories and the secret-pattern scan.
- [ ] Verify CORS origins, trusted hosts, request limits, and Vercel security headers.
- [ ] Verify Render and Vercel environment variables; confirm browser variables contain no secrets.
- [ ] Confirm the SigNoz ingestion header is only in Render's secret manager.
- [ ] Run Flood, Heatwave, and Wildfire scenarios and inspect GIS, agents, counterfactuals, and trust.
- [ ] Verify trace IDs and actual trace, metric, and log receipt before claiming observability success.
- [ ] Verify direct refresh for all routes and mobile/browser-console behavior.
- [ ] Record public frontend/backend URLs in release notes only after successful HTTPS smoke tests.
- [ ] Identify and test the paired prior healthy Render/Vercel deployment rollback path.

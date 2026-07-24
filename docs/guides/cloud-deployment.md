# Cloud deployment

The primary hackathon deployment can run as one Vercel project: the React SPA is
served from `apps/web/dist`, while `/api/*` is handled by the FastAPI Python Function in
`api/index.py`. The frontend uses same-origin API calls, so `VITE_API_BASE_URL` may remain
unset. Render remains an alternative long-running container backend. Follow the
authoritative [deployment and release guide](../DEPLOYMENT.md) and
[deployment architecture](../architecture/deployment.md).

Before publication, replace no URLs in documentation until both providers are deployed and opened. Record the verified frontend root, backend `/health`, `/ready`, `/api/v1/meta`, local-mode API docs behavior versus production docs-disabled behavior, and an access-appropriate SigNoz link. Then run `scripts/smoke_test.py`, review security headers/CORS, execute all three scenarios, and follow [release checklist](../RELEASE_CHECKLIST.md).

Public deployment is suitable only for a synthetic hackathon demonstration. Add provider protection/rate controls for abuse; do not upload real data; retain a single API worker until baseline storage is externalized.

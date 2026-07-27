# Cloud deployment

The primary hackathon deployment can run as one Vercel project: the React SPA is
served from `apps/web/dist`, while `/api/*` is handled by the FastAPI Python Function in
`api/index.py`. The frontend uses same-origin API calls, so `VITE_API_BASE_URL` may remain
unset. Render remains an alternative long-running container backend. Follow the
authoritative [deployment and release guide](../DEPLOYMENT.md) and
[deployment architecture](../architecture/deployment.md).

Before publication, replace no URLs in documentation until both providers are deployed and opened. Record the verified frontend root, backend `/health`, `/ready`, `/api/v1/meta`, local-mode API docs behavior versus production docs-disabled behavior, and an access-appropriate SigNoz link. Then run `scripts/smoke_test.py`, review security headers/CORS, execute all three scenarios, and follow [release checklist](../RELEASE_CHECKLIST.md).

Public deployment is suitable only for a synthetic hackathon demonstration. Add provider protection/rate controls for abuse; do not upload real data; retain a single API worker until baseline storage is externalized.

## Free hackathon demo from GitHub

The most direct free deployment is the repository's Render Blueprint:

1. Push the repository to GitHub without `.env` files or credentials.
2. In Render, choose **New → Blueprint**, connect the repository, and select `render.yaml`.
3. Create both `geotwin-sentinel-api` (free Docker web service) and
   `geotwin-sentinel-web` (free static site).
4. Set the web service's `VITE_API_BASE_URL` to the API's public HTTPS origin,
   for example `https://geotwin-sentinel-api.onrender.com`.
5. Set the API's `CORS_ALLOWED_ORIGINS` to the web site's exact HTTPS origin and
   keep `TRUSTED_HOSTS=*.onrender.com`.
6. Configure `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` only
   in Render's secret environment settings. Leave `OTEL_ENABLED=false` if no
   public OTLP destination is available.
7. Set `VITE_SIGNOZ_APP_URL` only when a public HTTPS SigNoz instance or
   published dashboard exists. Never use `localhost` or credentials in a
   browser-public `VITE_*` value.
8. Deploy the API first, update the frontend API URL if necessary, then deploy
   the static site and run `scripts/smoke_test.py` against both public URLs.

Render free web services can sleep during inactivity, so open the API health URL
before a judging session and allow for a cold start. GitHub Pages can host only
the static frontend and cannot run the FastAPI service.

## Complete local container stack

The repository also supports a complete local production-style stack:

```bash
docker compose up --build
```

Open `http://127.0.0.1:8080`. The Nginx web container serves React and proxies
same-origin `/api` requests to the non-root FastAPI container. Host ports can be
overridden with `WEB_PORT`, `API_PORT`, `OTEL_GRPC_PORT`, `OTEL_HTTP_PORT`, and
`OTEL_HEALTH_PORT`.

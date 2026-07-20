#!/usr/bin/env python3
"""Non-destructive deployment smoke tests using only the Python standard library."""
import argparse
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser()
parser.add_argument("--backend-only", action="store_true")
args = parser.parse_args()
backend = os.environ.get("BACKEND_URL", "").rstrip("/")
frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
origin = os.environ.get("EXPECTED_FRONTEND_ORIGIN", frontend)
allow_local = os.environ.get("SMOKE_ALLOW_LOCALHOST", "false").lower() == "true"
if not backend: raise SystemExit("BACKEND_URL is required")
for value, name in [(backend, "BACKEND_URL"), *([(frontend, "FRONTEND_URL")] if not args.backend_only else [])]:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc: raise SystemExit(f"{name} must be an absolute HTTP(S) URL")
    if not allow_local and parsed.hostname in {"localhost", "127.0.0.1"}: raise SystemExit(f"{name} points to localhost; set SMOKE_ALLOW_LOCALHOST=true only for local verification")

def call(path, method="GET", payload=None, headers=None):
    request = Request(f"{backend}{path}", method=method, data=json.dumps(payload).encode() if payload is not None else None, headers={"Accept":"application/json", **({"Content-Type":"application/json"} if payload is not None else {}), **(headers or {})})
    try:
        with urlopen(request, timeout=20) as response: return response.status, dict(response.headers), json.load(response)
    except (HTTPError, URLError) as exc: raise SystemExit(f"{method} {path} failed: {exc}") from exc

for path in ("/health", "/ready", "/health/observability", "/api/v1/meta", "/api/v1/hospitals", "/api/v1/scenarios"):
    status, _, _ = call(path)
    if status != 200: raise SystemExit(f"{path} returned {status}")
scenario = json.loads((Path(__file__).parents[1]/"scenarios"/"flood-grid-cascade.json").read_text())
_, _, simulation = call("/api/v1/simulations/run", "POST", scenario)
simulation_id = simulation.get("simulation_id")
if not simulation_id: raise SystemExit("Simulation response omitted simulation_id")
_, _, comparison = call("/api/v1/counterfactuals/run", "POST", {"simulation_id":simulation_id,"interventions":[{"intervention_id":"backup-power-activation","parameters":{}}]})
if comparison.get("simulation_id") != simulation_id: raise SystemExit("Counterfactual smoke test returned the wrong baseline")
_, _, trust = call(f"/api/v1/trust/{simulation_id}")
if trust.get("simulation_id") != simulation_id: raise SystemExit("Trust smoke test returned the wrong simulation")
if origin:
    _, headers, _ = call("/api/v1/health", headers={"Origin":origin})
    cors_headers = {key.lower(): value for key, value in headers.items()}
    if cors_headers.get("access-control-allow-origin") != origin: raise SystemExit("Configured frontend origin was not allowed by CORS")
if not args.backend_only:
    for route in ("/", "/command-center", f"/simulations/{simulation_id}", "/agents", f"/agents/{simulation_id}", "/counterfactuals", f"/counterfactuals/{simulation_id}", "/trust", f"/trust/{simulation_id}", "/architecture"):
        try:
            with urlopen(f"{frontend}{route}", timeout=15) as response:
                body = response.read().decode(errors="replace")
                if response.status != 200 or "GeoTwin Sentinel" not in body: raise SystemExit(f"Frontend route {route} failed SPA smoke validation")
        except (HTTPError, URLError) as exc: raise SystemExit(f"Frontend route {route} failed: {exc}") from exc
print(f"Smoke tests passed for simulation {simulation_id}.")

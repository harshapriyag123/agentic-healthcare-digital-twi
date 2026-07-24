#!/usr/bin/env python3
"""Run the deterministic judge scenario against an already-running API."""

import json
import os
import sys
import urllib.request
from pathlib import Path

base_url = os.getenv("GEOTWIN_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
payload = Path("scenarios/wildfire-telemetry.json").read_bytes()
request = urllib.request.Request(
    f"{base_url}/api/v1/simulations/run",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
except Exception as exc:
    print(f"Observability verification failed: {exc}", file=sys.stderr)
    raise SystemExit(1) from exc

agents = {
    item["agent"]: item["status"]
    for item in result["agent_decisions"]
    if item.get("component_type", "agent") == "agent"
}
required = {
    "compound-event-detector",
    "telemetry-integrity-agent",
    "resilience-planning-agent",
}
if not required <= agents.keys():
    raise SystemExit(f"Missing expected agent records: {sorted(required - agents.keys())}")
if not result["trust"]["human_review_required"]:
    raise SystemExit("Primary scenario did not require human review")
trace_id = result.get("trace_id")
if not trace_id:
    raise SystemExit("No recording trace ID returned; check OTEL endpoint and exporter status")

print(f"simulation_id={result['simulation_id']}")
print(f"trace_id={trace_id}")
print(f"agents={agents}")
print(
    "SigNoz: Traces Explorer → Traces view → "
    f"filter trace_id = '{trace_id}' → expand simulation.run"
)

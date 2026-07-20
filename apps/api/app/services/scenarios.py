import json
from pathlib import Path

from app.models.domain import ScenarioCatalogItem, SimulationRequest

REPO_ROOT = Path(__file__).resolve().parents[4]
SCENARIOS_DIR = REPO_ROOT / "scenarios"


def _load_scenarios() -> list[ScenarioCatalogItem]:
    scenarios: list[ScenarioCatalogItem] = []
    for path in sorted(SCENARIOS_DIR.glob("*.json")):
        with path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        request = SimulationRequest.model_validate(payload)
        scenarios.append(
            ScenarioCatalogItem(
                id=request.scenario_name,
                name=payload.get("display_name") or request.scenario_name.replace("-", " ").title(),
                category=payload.get("category", "compound-disruption"),
                description=payload.get(
                    "description", "Synthetic scenario for digital twin evaluation."
                ),
                tags=payload.get("tags", []),
                severity=payload.get("severity", "medium"),
                request=request,
            )
        )
    return scenarios


SCENARIOS = _load_scenarios()


def get_scenario_catalog() -> list[ScenarioCatalogItem]:
    return SCENARIOS


def get_scenario_by_id(scenario_id: str) -> ScenarioCatalogItem | None:
    return next((scenario for scenario in SCENARIOS if scenario.id == scenario_id), None)

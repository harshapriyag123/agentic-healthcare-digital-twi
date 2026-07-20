# Contributing

Thank you for improving GeoTwin Sentinel. Follow the [Code of Conduct](CODE_OF_CONDUCT.md) and use only synthetic or appropriately governed aggregate data.

## Workflow

1. Create a focused feature branch from the current integration branch.
2. Follow [local setup](docs/guides/local-development.md).
3. Preserve the API → shared digital twin → agent/counterfactual/trust architecture; do not add duplicate engines or mock backend values into the UI.
4. Add tests and update documentation for behavior or public claims.
5. Run `ruff check .`, `pytest`, and in `apps/web`: `npm run lint`, `npm run typecheck`, `npm test -- --run`, and `npm run build`.
6. Open a concise pull request using the template. Prefer descriptive imperative commits; repository maintainers may squash.

## Extension points

- Scenario: add validated JSON under `scenarios/`, route it through `services/scenarios.py`, prove distinct behavior, and add a scenario guide.
- Intervention: add one catalog definition and bounded transformation in `services/counterfactuals.py`; document applicability, constraints, trade-offs, and tests.
- Agent: implement the `Agent` interface, register intentionally in the orchestrator, expose evidence/failure/review behavior, and instrument execution.
- Evidence/trust: use canonical domain models and `services/trust.py`; maintain resolvable IDs, lineage, factor explanations, policy tests, and versioning.
- Telemetry: use low-cardinality attributes where possible; never record secrets, personal identifiers, PHI, raw sensitive input, or private dashboard URLs.

PRs should explain safety/trust and observability impacts, include screenshots for visible UI changes, and link new documentation. Never commit `.env` files, keys, tokens, real patient data, exploitable facility details, generated build output, or personal logs. Report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.

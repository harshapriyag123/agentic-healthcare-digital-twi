# Submission and rehearsal checklist

## Automated/repository validation

- [ ] README links and environment names pass `python scripts/check_docs.py`.
- [ ] Backend Ruff and pytest pass.
- [ ] Frontend lint, type check, tests, and production build pass.
- [ ] Secret scan and `git diff --check` pass.
- [ ] Docker image builds/runs non-root where Docker is available.
- [ ] Deployment smoke test passes against the release candidates.
- [ ] All three scenario outcome vectors remain distinct.
- [ ] API examples are exercised against the current backend.

## Manual live-demo validation

- [ ] Open verified frontend/backend URLs; health/readiness/meta are accurate.
- [ ] Open every primary route: Overview, Command Center, simulation detail, Agents, Counterfactuals, Trust, Architecture.
- [ ] Run all three scenarios; inspect GIS/table, agent records, counterfactuals, trust, trace ID.
- [ ] Find the rehearsal trace in the configured SigNoz environment and check expected spans/metrics/logs.
- [ ] Rehearse the exact three-minute script under 2:45 plus loading allowance.
- [ ] Walk through every recovery branch relevant to the venue.
- [ ] Capture/review screenshots and captions; record/edit/review video.
- [ ] Confirm public links, map tiles, responsive/projector layout, keyboard path, and no private data/tokens.
- [ ] Confirm README, landing page, demo, submission, architecture, scenario, research, limitations, observability, and deployment language agree.
- [ ] Confirm license/copyright, changelog, release notes, repository metadata/social preview, and current Git status.

Unchecked manual items must remain disclosed; a repository file cannot prove provider access, a recorded video, a clean-clone rehearsal, or a live trace.

# Submission checklist

The operational checklist is maintained in
[demo/submission-checklist.md](demo/submission-checklist.md). Automated gates are
documented in [guides/testing.md](guides/testing.md); publication and provider work cannot
be truthfully automated.

- [ ] **Manual:** registration, team information, repository visibility and topics
- [x] **Automated:** license, README/docs links, secret-pattern scan
- [ ] **Manual:** deploy frontend/API; verify health, readiness, public URLs, and mobile view
- [ ] **Manual:** connect SigNoz, capture sanitized screenshots, configure/test alerts
- [ ] **Manual:** record/upload video, publish/submit blog, paste submission fields
- [ ] **Automated before tag:** backend tests, Ruff, frontend lint/typecheck/tests/build,
  Docker build, scenario smoke, docs check, secret scan
- [ ] **Manual:** rehearse the three-minute path and verify safety/limitations are visible

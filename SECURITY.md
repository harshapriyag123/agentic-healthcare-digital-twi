# Security policy

## Supported versions

Security fixes are applied to the latest code on the repository's active default branch. Historical prototype snapshots are not supported releases.

## Report privately

Use GitHub's private vulnerability reporting feature for this repository, if enabled, or contact the repository owner through a private GitHub channel. Do not open a public issue containing credentials, exploit instructions for identifiable facilities, private deployment/SigNoz URLs, or patient/health information. Maintainers will acknowledge and assess reports as capacity permits; this volunteer research project does not promise a fixed response or remediation time.

If a secret was exposed, revoke/rotate it with the provider first, preserve minimal non-sensitive evidence, then report the affected scope privately. Never include real PHI to demonstrate a finding.

## Scope and limitations

GeoTwin Sentinel uses synthetic data and is not approved for clinical, transfer, cybersecurity, infrastructure-control, or emergency operations. It makes no HIPAA, regulatory, penetration-test, or healthcare-production security claim. The public-demo API has no authentication or application rate limiter; trust lineage is not cryptographic; external map/telemetry/cloud services add their own risks. See the [threat model](docs/research/threat-model.md) and [limitations](docs/research/limitations.md).

All credentials belong in provider secret stores or ignored local environment files. `VITE_*` values are public browser configuration and must never contain secrets.

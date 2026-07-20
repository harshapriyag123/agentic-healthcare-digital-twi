from app.models.domain import EvidenceItem, SimulationRequest


def assess_integrity(request: SimulationRequest) -> tuple[float, list[EvidenceItem]]:
    missing = request.missing_telemetry_ratio
    tampering = request.cyber_event.telemetry_tampering
    integrity = max(0.0, 1 - (0.65 * tampering + 0.35 * missing))
    evidence = [
        EvidenceItem(evidence_id="telemetry-integrity", source="otel", signal="telemetry_integrity", value=round(integrity, 3), reliability=integrity),
        EvidenceItem(evidence_id="missing-telemetry", source="scenario", signal="missing_telemetry_ratio", value=missing, reliability=max(0, 1-missing)),
        EvidenceItem(evidence_id="tampering-probability", source="security-agent", signal="tampering_probability", value=tampering, reliability=0.86),
    ]
    return integrity, evidence

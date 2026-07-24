import logging
from datetime import UTC, datetime

from opentelemetry import trace

from app.core.observability import evidence_missing, evidence_stale, scenario_type
from app.models.domain import (
    AgentDecision,
    EvidenceItem,
    HospitalState,
    PolicyCheck,
    ReviewReason,
    SimulationRequest,
    TransferAction,
    TrustAnomaly,
    TrustFactorContribution,
    TrustImprovementAction,
    TrustRecord,
)
from app.services.catalog import HOSPITALS
from app.services.integrity import assess_integrity

logger = logging.getLogger(__name__)
tracer = trace.get_tracer("geotwin.trust")
CALCULATION_VERSION = "geotwin-trust-v2.0"

FACTOR_WEIGHTS = {
    "telemetry_integrity": 0.22,
    "evidence_completeness": 0.16,
    "evidence_reliability": 0.14,
    "provenance_strength": 0.10,
    "freshness": 0.08,
    "consistency": 0.14,
    "geographic_coverage": 0.06,
    "policy_compliance": 0.10,
    "uncertainty_penalty": -0.20,
}


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _agents_for(evidence_id: str) -> list[str]:
    dependencies = {
        "telemetry-integrity": ["telemetry-integrity-agent", "meta-orchestrator"],
        "missing-telemetry": ["telemetry-integrity-agent"],
        "tampering-probability": ["telemetry-integrity-agent"],
        "regional-risk": [
            "compound-event-detector",
            "resilience-planning-agent",
            "meta-orchestrator",
        ],
        "compound-hazard-pressure": ["compound-event-detector", "resilience-planning-agent"],
    }
    return dependencies.get(
        evidence_id, ["resilience-planning-agent"] if evidence_id.startswith("hospital-") else []
    )


def evidence_quality_dimensions(
    evidence: list[EvidenceItem], tampering: float = 0
) -> dict[str, float]:
    if not evidence:
        return {"reliability": 0, "provenance": 0, "freshness": 0, "consistency": 0}
    available = [item for item in evidence if item.integrity_status not in {"missing", "rejected"}]
    conflicts = [item for item in evidence if item.integrity_status == "conflicting"]
    return {
        "reliability": sum(item.reliability for item in available) / len(available)
        if available
        else 0,
        "provenance": sum(
            item.provenance_status in {"validated-lineage", "basic-lineage"} for item in evidence
        )
        / len(evidence),
        "freshness": sum(item.freshness_status == "current" for item in evidence) / len(evidence),
        "consistency": _clamp(1 - len(conflicts) / len(evidence) * 3 - tampering * 0.45),
    }


def collect_evidence(
    request: SimulationRequest,
    simulation_id: str,
    states: list[HospitalState],
    regional_risk: float,
    observed_at: str,
) -> list[EvidenceItem]:
    with tracer.start_as_current_span("trust.evidence.collect") as span:
        integrity, _ = assess_integrity(request)
        tampering = request.cyber_event.telemetry_tampering
        missing_count = round(request.missing_telemetry_ratio * len(HOSPITALS))
        records = [
            EvidenceItem(
                evidence_id="telemetry-integrity",
                source="telemetry-integrity-agent",
                source_id="rule-integrity-v2",
                source_name="Rule-based telemetry integrity check",
                source_type="agent-derived evidence",
                signal="telemetry_integrity",
                value=round(integrity, 3),
                unit="score",
                reliability=integrity,
                confidence=integrity,
                integrity_status="suspected-tampering"
                if tampering >= 0.4
                else "degraded"
                if integrity < 0.75
                else "verified",
                provenance_status="basic-lineage",
                freshness_status="current",
                observed_at=observed_at,
                received_at=observed_at,
                age_seconds=0,
                location_scope="synthetic region",
                scenario_id=request.scenario_name,
                agent_ids=_agents_for("telemetry-integrity"),
                warning="Scenario parameters indicate possible telemetry manipulation."
                if tampering
                else None,
                parent_evidence_ids=["missing-telemetry", "tampering-probability"],
                validation_checks=[
                    "bounded-value-check",
                    "missing-signal-check",
                    "tampering-flag-check",
                ],
            ),
            EvidenceItem(
                evidence_id="missing-telemetry",
                source="scenario-configuration",
                source_id="scenario-input",
                source_name="Synthetic scenario configuration",
                source_type="scenario configuration",
                signal="missing_telemetry_ratio",
                value=request.missing_telemetry_ratio,
                unit="fraction",
                reliability=_clamp(1 - request.missing_telemetry_ratio),
                confidence=1,
                integrity_status="missing" if request.missing_telemetry_ratio > 0 else "verified",
                provenance_status="basic-lineage",
                freshness_status="current",
                observed_at=observed_at,
                received_at=observed_at,
                age_seconds=0,
                location_scope="synthetic region",
                scenario_id=request.scenario_name,
                agent_ids=_agents_for("missing-telemetry"),
                warning="Expected synthetic telemetry is incomplete."
                if request.missing_telemetry_ratio
                else None,
                validation_checks=["bounded-value-check"],
            ),
            EvidenceItem(
                evidence_id="tampering-probability",
                source="scenario-configuration",
                source_id="synthetic-cyber-event",
                source_name="Synthetic cyber alert",
                source_type="cyber alert",
                signal="telemetry_tampering",
                value=tampering,
                unit="probability",
                reliability=0.86,
                confidence=0.86,
                integrity_status="suspected-tampering" if tampering >= 0.4 else "acceptable",
                provenance_status="basic-lineage",
                freshness_status="current",
                observed_at=observed_at,
                received_at=observed_at,
                age_seconds=0,
                location_scope=request.cyber_event.target_hospital_id,
                hospital_id=request.cyber_event.target_hospital_id,
                scenario_id=request.scenario_name,
                agent_ids=_agents_for("tampering-probability"),
                warning="Rule-based check detected a configured tampering indicator."
                if tampering >= 0.4
                else None,
                validation_checks=["bounded-value-check", "tampering-flag-check"],
            ),
            EvidenceItem(
                evidence_id="regional-risk",
                source="digital-twin",
                source_id="regional-twin-v1",
                source_name="Synthetic regional digital twin",
                source_type="agent-derived evidence",
                signal="regional_risk",
                value=round(regional_risk, 3),
                unit="probability",
                reliability=_clamp(integrity * (1 - request.missing_telemetry_ratio)),
                confidence=_clamp(integrity * (1 - request.missing_telemetry_ratio)),
                integrity_status="degraded" if integrity < 0.75 else "acceptable",
                provenance_status="basic-lineage",
                freshness_status="current",
                observed_at=observed_at,
                received_at=observed_at,
                age_seconds=0,
                location_scope="synthetic region",
                scenario_id=request.scenario_name,
                agent_ids=_agents_for("regional-risk"),
                parent_evidence_ids=["telemetry-integrity", "compound-hazard-pressure"],
                validation_checks=["digital-twin-bounds-check"],
            ),
            EvidenceItem(
                evidence_id="compound-hazard-pressure",
                source="hazard-fusion",
                source_id="synthetic-hazard-fusion",
                source_name="Synthetic hazard fusion",
                source_type="infrastructure telemetry"
                if request.hazard.grid_outage_probability
                >= max(request.hazard.flood_severity, request.hazard.air_quality_index / 500)
                else "weather feed",
                signal="compound_hazard_pressure",
                value=round(states[0].hazard_pressure if states else 0, 3),
                unit="score",
                reliability=0.88,
                confidence=0.88,
                integrity_status="acceptable",
                provenance_status="basic-lineage",
                freshness_status="current",
                observed_at=observed_at,
                received_at=observed_at,
                age_seconds=0,
                location_scope="synthetic region",
                scenario_id=request.scenario_name,
                agent_ids=_agents_for("compound-hazard-pressure"),
                parent_evidence_ids=["scenario-hazard-configuration"],
                validation_checks=["bounded-value-check"],
            ),
        ]
        for index, state in enumerate(states):
            missing = index >= len(states) - missing_count if missing_count else False
            attacked = state.hospital_id == request.cyber_event.target_hospital_id
            status = (
                "suspected-tampering"
                if attacked and tampering >= 0.4
                else "missing"
                if missing
                else "degraded"
                if state.load_ratio > 1
                else "verified"
            )
            evidence_id = f"hospital-{state.hospital_id}-capacity"
            records.append(
                EvidenceItem(
                    evidence_id=evidence_id,
                    source=f"hospital-{state.hospital_id}",
                    source_id=f"synthetic-{state.hospital_id}",
                    source_name="Synthetic hospital telemetry",
                    source_type="hospital telemetry",
                    signal="effective_capacity",
                    value="unavailable" if missing else state.effective_capacity,
                    unit="synthetic beds",
                    reliability=0 if missing else _clamp(0.92 - state.cyber_loss * 0.5),
                    confidence=0 if missing else _clamp(0.9 - state.cyber_loss),
                    integrity_status=status,
                    provenance_status="gap" if missing else "basic-lineage",
                    freshness_status="unknown" if missing else "current",
                    observed_at=None if missing else observed_at,
                    received_at=observed_at,
                    age_seconds=None if missing else 0,
                    location_scope=state.hospital_id,
                    hospital_id=state.hospital_id,
                    scenario_id=request.scenario_name,
                    agent_ids=_agents_for(evidence_id),
                    warning="Expected hospital capacity signal is missing."
                    if missing
                    else "Target hospital telemetry may be manipulated."
                    if status == "suspected-tampering"
                    else None,
                    validation_checks=["capacity-nonnegative-check", "hospital-catalog-link-check"]
                    if not missing
                    else ["expected-signal-present-check:failed"],
                )
            )
        if tampering >= 0.4:
            records.append(
                EvidenceItem(
                    evidence_id="target-capacity-conflict",
                    source="synthetic-cyber-alert",
                    source_id="synthetic-cyber-event",
                    source_name="Synthetic conflicting telemetry copy",
                    source_type="cyber alert",
                    signal="effective_capacity_conflict",
                    value="conflicting duplicate",
                    reliability=0.2,
                    confidence=0.25,
                    integrity_status="conflicting",
                    provenance_status="gap",
                    freshness_status="current",
                    observed_at=observed_at,
                    received_at=observed_at,
                    age_seconds=0,
                    location_scope=request.cyber_event.target_hospital_id,
                    hospital_id=request.cyber_event.target_hospital_id,
                    scenario_id=request.scenario_name,
                    agent_ids=["telemetry-integrity-agent"],
                    warning="Duplicate signal conflicts with the synthetic hospital capacity record.",
                    parent_evidence_ids=[
                        f"hospital-{request.cyber_event.target_hospital_id}-capacity"
                    ],
                    validation_checks=["duplicate-signal-consistency-check:failed"],
                )
            )
        identifiers = [record.evidence_id for record in records]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("Duplicate evidence IDs detected")
        span.set_attributes(
            {
                "simulation.id": simulation_id,
                "evidence.total": len(records),
                "evidence.missing": sum(item.integrity_status == "missing" for item in records),
                "evidence.degraded": sum(item.integrity_status == "degraded" for item in records),
                "evidence.tampering_suspected": sum(
                    item.integrity_status == "suspected-tampering" for item in records
                ),
            }
        )
        logger.info(
            "Evidence collected",
            extra={
                "simulation_id": simulation_id,
                "evidence_count": len(records),
                "trust_status": "collected",
            },
        )
        dimensions = {"scenario.type": scenario_type(request.scenario_name)}
        missing_total = sum(item.integrity_status == "missing" for item in records)
        stale_total = sum(item.freshness_status == "stale" for item in records)
        if missing_total:
            evidence_missing.add(missing_total, dimensions)
        if stale_total:
            evidence_stale.add(stale_total, dimensions)
        return records


def evaluate_trust(
    request: SimulationRequest,
    simulation_id: str,
    states: list[HospitalState],
    transfers: list[TransferAction],
    regional_risk: float,
    decisions: list[AgentDecision] | None = None,
    observed_at: str | None = None,
) -> tuple[TrustRecord, list[EvidenceItem]]:
    timestamp = observed_at or datetime.now(UTC).isoformat()
    logger.info(
        "Trust evaluation started",
        extra={"simulation_id": simulation_id, "trust_status": "running"},
    )
    with tracer.start_as_current_span("trust.evaluate") as span:
        try:
            evidence = collect_evidence(request, simulation_id, states, regional_risk, timestamp)
            with tracer.start_as_current_span("trust.integrity.assess"):
                integrity, _ = assess_integrity(request)
            completeness = _clamp(1 - request.missing_telemetry_ratio)
            quality = evidence_quality_dimensions(evidence, request.cyber_event.telemetry_tampering)
            reliability = quality["reliability"]
            provenance = quality["provenance"]
            freshness = quality["freshness"]
            consistency = quality["consistency"]
            covered = {
                item.hospital_id
                for item in evidence
                if item.hospital_id and item.integrity_status != "missing"
            }
            geographic = len(covered) / len(HOSPITALS) if HOSPITALS else 0
            failed_agents = [item for item in decisions or [] if item.status == "failed"]
            unsafe_transfers = [item for item in transfers if not item.safety_constraints_satisfied]
            preliminary_uncertainty = _clamp(
                0.32 * (1 - integrity)
                + 0.22 * (1 - completeness)
                + 0.18 * (1 - reliability)
                + 0.16 * (1 - consistency)
                + 0.12 * regional_risk
            )

            policies = [
                PolicyCheck(
                    policy_id="synthetic-data-only",
                    name="Synthetic-data-only policy",
                    status="passed",
                    explanation="All exposed evidence is labeled as synthetic or derived from synthetic inputs.",
                ),
                PolicyCheck(
                    policy_id="traceability",
                    name="Traceability requirement",
                    status="passed" if all(item.evidence_id for item in evidence) else "failed",
                    explanation="Evidence records use stable identifiers and basic lineage; no cryptographic verification is claimed.",
                ),
                PolicyCheck(
                    policy_id="minimum-completeness",
                    name="Minimum evidence-completeness threshold",
                    status="passed" if completeness >= 0.7 else "failed",
                    explanation=f"Evidence completeness is {completeness:.2f}; the prototype threshold is 0.70.",
                    required_action="Re-request missing synthetic signals."
                    if completeness < 0.7
                    else None,
                ),
                PolicyCheck(
                    policy_id="tampering-constraint",
                    name="No action under suspected tampering",
                    status="failed" if request.cyber_event.telemetry_tampering >= 0.4 else "passed",
                    explanation="Suspected tampering requires evidence quarantine and human validation.",
                    related_evidence_ids=["tampering-probability"]
                    if request.cyber_event.telemetry_tampering >= 0.4
                    else [],
                    related_agent_id="telemetry-integrity-agent",
                    required_action="Validate the telemetry source and compare a secondary signal."
                    if request.cyber_event.telemetry_tampering >= 0.4
                    else None,
                ),
                PolicyCheck(
                    policy_id="critical-agent",
                    name="No recommendation from failed critical agent",
                    status="failed" if failed_agents else "passed",
                    explanation="Critical agent failures prevent confident automated prioritization.",
                    related_agent_id=failed_agents[0].agent if failed_agents else None,
                    required_action="Review the failed component trace before re-running."
                    if failed_agents
                    else None,
                ),
                PolicyCheck(
                    policy_id="safe-transfer",
                    name="No autonomous transfer authorization",
                    status="failed" if unsafe_transfers else "passed",
                    explanation="Transfer outputs are simulated and require authorized review; unsafe candidates are rejected.",
                    required_action="Reject unsafe transfer output." if unsafe_transfers else None,
                ),
                PolicyCheck(
                    policy_id="no-clinical-instruction",
                    name="No clinical instruction policy",
                    status="passed",
                    explanation="The response contains research planning estimates, not clinical instructions.",
                ),
            ]
            policy_score = sum(item.status == "passed" for item in policies) / len(policies)
            values = {
                "telemetry_integrity": integrity,
                "evidence_completeness": completeness,
                "evidence_reliability": reliability,
                "provenance_strength": provenance,
                "freshness": freshness,
                "consistency": consistency,
                "geographic_coverage": geographic,
                "policy_compliance": policy_score,
                "uncertainty_penalty": preliminary_uncertainty,
            }
            explanations = {
                "telemetry_integrity": "Rule-based missing and tampering indicators.",
                "evidence_completeness": "Expected synthetic signals available.",
                "evidence_reliability": "Mean reliability of available evidence.",
                "provenance_strength": "Records with basic evidence lineage.",
                "freshness": "Records marked current at simulation time.",
                "consistency": "Penalty for conflicts and configured tampering.",
                "geographic_coverage": "Hospitals with available scoped evidence.",
                "policy_compliance": "Prototype safety policies passed.",
                "uncertainty_penalty": "Conservative penalty from integrity, completeness, reliability, consistency, and risk.",
            }
            factors = []
            for name, weight in FACTOR_WEIGHTS.items():
                raw = _clamp(values[name])
                contribution = weight * raw
                factors.append(
                    TrustFactorContribution(
                        factor=name,
                        raw_value=round(raw, 4),
                        normalized_value=round(raw, 4),
                        weight=weight,
                        weighted_contribution=round(contribution, 4),
                        status="warning"
                        if (name == "uncertainty_penalty" and raw >= 0.4)
                        or (name != "uncertainty_penalty" and raw < 0.7)
                        else "acceptable",
                        explanation=explanations[name],
                        supporting_evidence_count=len(evidence),
                        warning_count=sum(bool(item.warning) for item in evidence),
                    )
                )
            trust_score = _clamp(sum(item.weighted_contribution for item in factors))
            confidence = _clamp(trust_score * (1 - 0.35 * preliminary_uncertainty))

            reasons: list[ReviewReason] = []

            def reason(
                code: str, explanation: str, severity: str, component: str, action: str
            ) -> None:
                reasons.append(
                    ReviewReason(
                        code=code,
                        explanation=explanation,
                        severity=severity,
                        affected_component=component,
                        recommended_action=action,
                    )
                )

            if integrity < 0.65:
                reason(
                    "LOW_TELEMETRY_INTEGRITY",
                    "Telemetry integrity is below the 0.65 prototype threshold.",
                    "critical",
                    "telemetry-integrity-agent",
                    "Quarantine affected evidence and validate a secondary source.",
                )
            if request.cyber_event.telemetry_tampering >= 0.4:
                reason(
                    "SUSPECTED_TAMPERING",
                    "Scenario telemetry contains a material tampering indicator.",
                    "critical",
                    request.cyber_event.target_hospital_id,
                    "Require data-quality and cybersecurity review.",
                )
            if completeness < 0.7:
                reason(
                    "LOW_EVIDENCE_COMPLETENESS",
                    "Expected synthetic evidence is incomplete.",
                    "warning",
                    "evidence-collection",
                    "Re-request missing hospital or infrastructure signals.",
                )
            if confidence < 0.6:
                reason(
                    "LOW_RECOMMENDATION_CONFIDENCE",
                    "Recommendation confidence is below the 0.60 prototype threshold.",
                    "warning",
                    "recommendation",
                    "Delay prioritization until evidence quality improves.",
                )
            review_agents = [
                item
                for item in decisions or []
                if item.human_review_required and item.status != "failed"
            ]
            if review_agents:
                reason(
                    "AGENT_REQUESTED_REVIEW",
                    "One or more bounded agent recommendations require authorized human review.",
                    "warning",
                    review_agents[0].agent,
                    "Review the supporting evidence and constraints before acting.",
                )
            for failed in failed_agents:
                reason(
                    "FAILED_CRITICAL_AGENT",
                    f"{failed.agent_name or failed.agent} failed safely.",
                    "critical",
                    failed.agent,
                    "Inspect the component trace and require manual review.",
                )
            if unsafe_transfers:
                reason(
                    "UNSAFE_TRANSFER",
                    "At least one simulated transfer failed a safety constraint.",
                    "critical",
                    "transfer-plan",
                    "Reject the transfer recommendation.",
                )
            for policy in policies:
                if policy.status == "failed":
                    logger.warning(
                        "Policy check failed",
                        extra={
                            "simulation_id": simulation_id,
                            "trust_status": "policy-failed",
                            "policy_id": policy.policy_id,
                        },
                    )

            anomalies: list[TrustAnomaly] = []
            for item in evidence:
                if item.integrity_status in {
                    "missing",
                    "stale",
                    "conflicting",
                    "suspected-tampering",
                    "rejected",
                }:
                    anomalies.append(
                        TrustAnomaly(
                            anomaly_type=item.integrity_status,
                            severity="critical"
                            if item.integrity_status in {"suspected-tampering", "rejected"}
                            else "warning",
                            evidence_ids=[item.evidence_id],
                            explanation=item.warning
                            or f"Evidence status is {item.integrity_status}.",
                            trust_impact="Reduces one or more integrity, completeness, provenance, freshness, or consistency factors.",
                            affected_agent_ids=item.agent_ids,
                            required_action="Validate or replace this synthetic evidence before relying on dependent recommendations.",
                        )
                    )
            actions: list[TrustImprovementAction] = []
            if any(item.integrity_status == "missing" for item in evidence):
                actions.append(
                    TrustImprovementAction(
                        action="Re-request missing hospital signal",
                        trigger="Missing expected evidence",
                        affected_evidence_ids=[
                            item.evidence_id
                            for item in evidence
                            if item.integrity_status == "missing"
                        ],
                        expected_effect="May improve completeness and geographic coverage after validation.",
                        priority="high",
                        suggested_role="Data-quality reviewer",
                        resimulation_recommended=True,
                    )
                )
            if request.cyber_event.telemetry_tampering >= 0.4:
                actions.append(
                    TrustImprovementAction(
                        action="Verify telemetry against a secondary source",
                        trigger="Suspected tampering or conflicting signal",
                        affected_evidence_ids=[
                            item.evidence_id
                            for item in evidence
                            if item.integrity_status in {"suspected-tampering", "conflicting"}
                        ],
                        expected_effect="May improve integrity and consistency if the replacement evidence validates.",
                        priority="high",
                        suggested_role="Cybersecurity incident lead",
                        resimulation_recommended=True,
                    )
                )
            if confidence < 0.6:
                actions.append(
                    TrustImprovementAction(
                        action="Delay automated prioritization",
                        trigger="Low recommendation confidence",
                        affected_evidence_ids=[],
                        expected_effect="Prevents overconfident use while evidence is reviewed; no score increase is guaranteed.",
                        priority="high",
                        suggested_role="Healthcare operations lead",
                        resimulation_recommended=False,
                    )
                )
            if not actions:
                actions.append(
                    TrustImprovementAction(
                        action="Confirm infrastructure status before action",
                        trigger="Routine evidence validation",
                        affected_evidence_ids=["compound-hazard-pressure"],
                        expected_effect="May preserve or improve confidence if the secondary check agrees.",
                        priority="medium",
                        suggested_role="Infrastructure coordinator",
                        resimulation_recommended=False,
                    )
                )

            failed_checks = [item.policy_id for item in policies if item.status == "failed"]
            passed_checks = [item.policy_id for item in policies if item.status == "passed"]
            warnings = sorted({item.warning for item in evidence if item.warning})
            review_required = bool(reasons)
            trust = TrustRecord(
                evidence_completeness=round(completeness, 3),
                telemetry_integrity=round(integrity, 3),
                uncertainty=round(preliminary_uncertainty, 3),
                geographic_coverage=round(geographic, 3),
                policy_compliance=not failed_checks,
                recommendation_confidence=round(confidence, 3),
                human_review_required=review_required,
                trust_score=round(trust_score, 3),
                evidence_reliability=round(reliability, 3),
                provenance_strength=round(provenance, 3),
                freshness_score=round(freshness, 3),
                consistency_score=round(consistency, 3),
                factor_contributions=factors,
                review_reasons=reasons,
                warnings=warnings,
                failed_checks=failed_checks,
                passed_checks=passed_checks,
                improvement_actions=actions,
                policy_checks=policies,
                anomalies=anomalies,
                calculation_version=CALCULATION_VERSION,
            )
            span.set_attributes(
                {
                    "simulation.id": simulation_id,
                    "trust.score": trust.trust_score or 0,
                    "recommendation.confidence": trust.recommendation_confidence,
                    "telemetry.integrity": trust.telemetry_integrity,
                    "evidence.total": len(evidence),
                    "uncertainty.score": trust.uncertainty,
                    "policy.failed_count": len(failed_checks),
                    "human_review_required": review_required,
                    "calculation.version": CALCULATION_VERSION,
                }
            )
            if review_required:
                logger.warning(
                    "Human review required",
                    extra={
                        "simulation_id": simulation_id,
                        "trust_score": trust.trust_score,
                        "trust_status": "review-required",
                        "human_review_required": True,
                    },
                )
            logger.info(
                "Trust evaluation completed",
                extra={
                    "simulation_id": simulation_id,
                    "trust_score": trust.trust_score,
                    "trust_status": "completed",
                    "human_review_required": review_required,
                },
            )
            return trust, evidence
        except Exception:
            logger.exception(
                "Trust evaluation failed",
                extra={
                    "simulation_id": simulation_id,
                    "trust_status": "failed",
                    "human_review_required": True,
                },
            )
            fallback_reason = ReviewReason(
                code="TRUST_EVALUATION_FAILED",
                explanation="The trust calculation failed safely; no positive trust value was inferred.",
                severity="critical",
                affected_component="trust-evaluation",
                recommended_action="Inspect backend telemetry and require authorized review before re-running.",
            )
            fallback = TrustRecord(
                evidence_completeness=0,
                telemetry_integrity=0,
                uncertainty=1,
                geographic_coverage=0,
                policy_compliance=False,
                recommendation_confidence=0,
                human_review_required=True,
                trust_score=0,
                evidence_reliability=0,
                provenance_strength=0,
                freshness_score=0,
                consistency_score=0,
                review_reasons=[fallback_reason],
                warnings=["Trust evaluation failed safely."],
                failed_checks=["trust-evaluation"],
                improvement_actions=[
                    TrustImprovementAction(
                        action="Require manual evidence review",
                        trigger="Trust calculation failure",
                        affected_evidence_ids=[],
                        expected_effect="Prevents unsupported confidence; improvement is not guaranteed.",
                        priority="high",
                        suggested_role="Data-quality reviewer",
                        resimulation_recommended=True,
                    )
                ],
                calculation_version=CALCULATION_VERSION,
            )
            return fallback, locals().get("evidence", [])

from app.agents.base import Agent
from app.models.domain import AgentDecision


class SecurityAgent(Agent):
    name = "telemetry-integrity-agent"
    display_name = "Telemetry Integrity Agent"
    stage = "security-assessment"
    purpose = (
        "Assess telemetry provenance and constrain recommendations when evidence is unreliable."
    )
    evidence_ids = ["telemetry-integrity", "missing-telemetry", "tampering-probability"]

    def decide(self, context: dict) -> AgentDecision:
        integrity = context["telemetry_integrity"]
        action = (
            "quarantine-and-require-human-review"
            if integrity < 0.65
            else "continue-with-provenance"
        )
        return AgentDecision(
            agent=self.name,
            action=action,
            confidence=round(max(0.55, 1 - abs(0.8 - integrity)), 3),
            explanation=f"Telemetry integrity score is {integrity:.2f}; recommendations are constrained by evidence reliability.",
        )

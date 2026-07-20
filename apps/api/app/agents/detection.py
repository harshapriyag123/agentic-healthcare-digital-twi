from app.agents.base import Agent
from app.models.domain import AgentDecision


class DetectionAgent(Agent):
    name = "compound-event-detector"
    display_name = "Compound Event Detector"
    stage = "detection"
    purpose = "Detect correlated cyber-physical pressure in the synthetic scenario."
    evidence_ids = ["compound-hazard-pressure", "regional-risk"]

    def decide(self, context: dict) -> AgentDecision:
        hazard = context["hazard_pressure"]
        cyber = context["cyber_severity"]
        compound = 1 - (1 - hazard) * (1 - cyber)
        return AgentDecision(
            agent=self.name,
            action="escalate" if compound >= 0.55 else "observe",
            confidence=round(0.7 + 0.25 * compound, 3),
            explanation=f"Joint cyber-physical pressure is {compound:.2f}; correlated evaluation is required.",
        )

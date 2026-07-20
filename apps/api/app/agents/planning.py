from app.agents.base import Agent
from app.models.domain import AgentDecision


class PlanningAgent(Agent):
    name = "resilience-planning-agent"
    display_name = "Resilience Planning Agent"
    stage = "planning"
    purpose = "Recommend bounded regional readiness or load-balancing actions for human review."
    evidence_ids = ["regional-risk", "compound-hazard-pressure"]

    def decide(self, context: dict) -> AgentDecision:
        risk = context["regional_risk"]
        count = context["transfer_count"]
        return AgentDecision(
            agent=self.name,
            action="activate-regional-load-balancing" if risk >= 0.45 else "maintain-readiness",
            confidence=round(context["trust_confidence"], 3),
            explanation=f"Regional risk is {risk:.2f}; generated {count} bounded patient-transfer actions.",
        )

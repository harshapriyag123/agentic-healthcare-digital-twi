from app.agents.detection import DetectionAgent
from app.agents.security import SecurityAgent
from app.agents.planning import PlanningAgent


class AgentOrchestrator:
    def __init__(self) -> None:
        self.agents = [DetectionAgent(), SecurityAgent(), PlanningAgent()]

    def run(self, context: dict):
        return [agent.decide(context) for agent in self.agents]

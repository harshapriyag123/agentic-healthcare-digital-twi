from abc import ABC, abstractmethod
from app.models.domain import AgentDecision


class Agent(ABC):
    name: str

    @abstractmethod
    def decide(self, context: dict) -> AgentDecision:
        raise NotImplementedError

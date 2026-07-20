from collections import OrderedDict
from threading import Lock

from app.models.domain import SimulationRequest, SimulationResponse

_MAX_RESULTS = 100
_results: OrderedDict[str, tuple[SimulationRequest, SimulationResponse]] = OrderedDict()
_lock = Lock()


def store_simulation(request: SimulationRequest, response: SimulationResponse) -> None:
    with _lock:
        _results[response.simulation_id] = (
            request.model_copy(deep=True),
            response.model_copy(deep=True),
        )
        _results.move_to_end(response.simulation_id)
        while len(_results) > _MAX_RESULTS:
            _results.popitem(last=False)


def get_simulation(simulation_id: str) -> tuple[SimulationRequest, SimulationResponse] | None:
    with _lock:
        stored = _results.get(simulation_id)
        if stored is None:
            return None
        _results.move_to_end(simulation_id)
        request, response = stored
        return request.model_copy(deep=True), response.model_copy(deep=True)


def clear_simulations() -> None:
    with _lock:
        _results.clear()

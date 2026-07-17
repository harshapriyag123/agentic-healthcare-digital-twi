from fastapi import APIRouter, HTTPException
from app.models.domain import Hospital, SimulationRequest, SimulationResponse
from app.services.catalog import HOSPITALS
from app.services.twin import run_simulation

router=APIRouter(prefix="/api/v1")

@router.get("/health")
def health(): return {"status":"ok","service":"geotwin-api"}

@router.get("/hospitals",response_model=list[Hospital])
def hospitals(): return HOSPITALS

@router.post("/simulations/run",response_model=SimulationResponse)
def simulate(request:SimulationRequest):
    try: return run_simulation(request)
    except ValueError as exc: raise HTTPException(status_code=422,detail=str(exc)) from exc

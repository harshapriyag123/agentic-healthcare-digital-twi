from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from app.api.routes import router
from app.core.config import settings
from app.core.telemetry import configure_telemetry

configure_telemetry()
app=FastAPI(title="GeoTwin Sentinel API",version="0.1.0",description="Agentic digital twin for secure, trustworthy and observable healthcare infrastructure.")
app.add_middleware(CORSMiddleware,allow_origins=settings.cors_origin_list,allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
app.include_router(router)
FastAPIInstrumentor.instrument_app(app)

@app.get("/")
def root(): return {"name":"GeoTwin Sentinel","status":"research prototype","docs":"/docs","safety":"synthetic planning data only"}

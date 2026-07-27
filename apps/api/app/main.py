import logging
from contextlib import asynccontextmanager
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from app.api.routes import health, observability_health, ready, router
from app.core.config import settings
from app.core.observability import api_errors, api_request_duration
from app.core.telemetry import (
    configure_structured_logging,
    configure_telemetry,
    shutdown_telemetry,
)

configure_structured_logging()
configure_telemetry()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    shutdown_telemetry()


app = FastAPI(
    title="GeoTwin Sentinel API",
    version=settings.app_version,
    summary="Synthetic healthcare infrastructure resilience simulation API",
    description=(
        "Agentic geospatial digital twin for compound climate, infrastructure, cyber, and telemetry-disruption research. "
        "GeoTwin Sentinel is a research decision-support prototype using synthetic data. Its outputs are simulated estimates "
        "intended for authorized human review and are not clinical, transfer, cybersecurity, infrastructure-control, or "
        "emergency-response instructions."
    ),
    license_info={"name": "Apache License 2.0", "identifier": "Apache-2.0"},
    openapi_tags=[
        {
            "name": "Service",
            "description": "Safe liveness, readiness, observability, and build metadata.",
        },
        {
            "name": "Catalogs",
            "description": "Packaged synthetic hospital, scenario, and intervention catalogs.",
        },
        {
            "name": "Simulations",
            "description": "Run the shared healthcare infrastructure digital-twin evaluator and agents.",
        },
        {
            "name": "Counterfactuals",
            "description": "Compare bounded model interventions with an exact process-local baseline.",
        },
        {
            "name": "Trust and evidence",
            "description": "Inspect versioned trust factors, evidence lineage, policy, and human-review reasons.",
        },
    ],
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "Traceparent", "Tracestate"],
    expose_headers=["Traceparent", "X-Trace-Id"],
    max_age=600,
)


@app.middleware("http")
async def enforce_request_size(request: Request, call_next):
    started = perf_counter()
    metric_attributes = {
        "http.request.method": request.method,
        "deployment.environment": settings.app_env,
    }
    logger.info(
        "API request started",
        extra={"event_name": "api.request.started", "status": "running"},
    )
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > settings.max_request_body_bytes:
                response = JSONResponse(
                    status_code=413, content={"detail": "Request body exceeds the configured limit"}
                )
                api_errors.add(1, {**metric_attributes, "http.response.status_class": "4xx"})
                return response
        except ValueError:
            response = JSONResponse(
                status_code=400, content={"detail": "Invalid Content-Length header"}
            )
            api_errors.add(1, {**metric_attributes, "http.response.status_class": "4xx"})
            return response
    try:
        response = await call_next(request)
        status_class = f"{response.status_code // 100}xx"
        if response.status_code >= 400:
            api_errors.add(1, {**metric_attributes, "http.response.status_class": status_class})
        context = trace.get_current_span().get_span_context()
        if context.is_valid:
            response.headers["Traceparent"] = (
                f"00-{context.trace_id:032x}-{context.span_id:016x}-01"
            )
            response.headers["X-Trace-Id"] = f"{context.trace_id:032x}"
        logger.info(
            "API response completed",
            extra={
                "event_name": "api.response.completed",
                "status": status_class,
            },
        )
        return response
    except Exception:
        api_errors.add(1, {**metric_attributes, "http.response.status_class": "5xx"})
        logger.exception(
            "API request failed",
            extra={
                "event_name": "api.request.failed",
                "status": "failed",
                "error_code": "UNHANDLED_API_ERROR",
            },
        )
        raise
    finally:
        api_request_duration.record(
            (perf_counter() - started) * 1000,
            metric_attributes,
        )


app.include_router(router)
app.add_api_route("/health", health, methods=["GET"], include_in_schema=False)
app.add_api_route("/ready", ready, methods=["GET"], include_in_schema=False)
app.add_api_route(
    "/health/observability", observability_health, methods=["GET"], include_in_schema=False
)
if settings.otel_enabled:
    FastAPIInstrumentor.instrument_app(
        app, excluded_urls="/api/v1/health,/api/v1/ready,/api/v1/health/observability"
    )


@app.get("/", tags=["Service"], summary="Describe the research API", include_in_schema=False)
def root():
    return {
        "name": "GeoTwin Sentinel",
        "status": "research prototype",
        "docs": app.docs_url,
        "safety": "synthetic planning data only",
        **settings.public_metadata,
    }

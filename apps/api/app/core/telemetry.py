import logging
import socket
from urllib.parse import urlparse

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import settings

_configured = False


def _can_reach_otlp_endpoint(endpoint: str) -> bool:
    parsed = urlparse(endpoint)
    if not parsed.scheme or not parsed.netloc:
        return False
    hostname = parsed.hostname or ""
    if not hostname:
        return False
    port = parsed.port or 4317
    try:
        with socket.create_connection((hostname, port), timeout=0.3):
            return True
    except OSError:
        return False


def should_enable_telemetry(endpoint: str) -> bool:
    return _can_reach_otlp_endpoint(endpoint)


def configure_telemetry() -> None:
    global _configured
    if _configured:
        return
    resource = Resource.create({
        "service.name": settings.otel_service_name,
        "deployment.environment": settings.app_env,
        "service.namespace": "geotwin-sentinel",
    })

    endpoint = settings.otel_exporter_otlp_endpoint
    if not should_enable_telemetry(endpoint):
        logging.getLogger(__name__).info("Telemetry exporter disabled for endpoint '%s'; API will continue", endpoint)
        _configured = True
        return

    try:
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
            endpoint=endpoint,
            insecure=settings.otel_exporter_otlp_insecure,
        )))
        trace.set_tracer_provider(tracer_provider)
        reader = PeriodicExportingMetricReader(OTLPMetricExporter(
            endpoint=endpoint,
            insecure=settings.otel_exporter_otlp_insecure,
        ))
        metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[reader]))
    except Exception:
        logging.getLogger(__name__).exception("Telemetry exporter setup failed; API will continue")
    _configured = True

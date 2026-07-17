import logging
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


def configure_telemetry() -> None:
    global _configured
    if _configured:
        return
    resource = Resource.create({
        "service.name": settings.otel_service_name,
        "deployment.environment": settings.app_env,
        "service.namespace": "geotwin-sentinel",
    })
    try:
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
            endpoint=settings.otel_exporter_otlp_endpoint,
            insecure=settings.otel_exporter_otlp_insecure,
        )))
        trace.set_tracer_provider(tracer_provider)
        reader = PeriodicExportingMetricReader(OTLPMetricExporter(
            endpoint=settings.otel_exporter_otlp_endpoint,
            insecure=settings.otel_exporter_otlp_insecure,
        ))
        metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[reader]))
    except Exception:
        logging.getLogger(__name__).exception("Telemetry exporter setup failed; API will continue")
    _configured = True

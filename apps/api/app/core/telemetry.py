import json
import logging
import socket
from datetime import UTC, datetime
from urllib.parse import urlparse

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import settings

_configured = False
_enabled = False
_tracer_provider: TracerProvider | None = None
_meter_provider: MeterProvider | None = None
_logger_provider: LoggerProvider | None = None


class JsonFormatter(logging.Formatter):
    """Emit safe structured stdout logs with automatic trace correlation."""

    def format(self, record: logging.LogRecord) -> str:
        context = trace.get_current_span().get_span_context()
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "severity": record.levelname,
            "service.name": settings.otel_service_name,
            "deployment.environment": settings.app_env,
            "event.name": record.getMessage(),
        }
        if context.is_valid:
            payload["trace_id"] = f"{context.trace_id:032x}"
            payload["span_id"] = f"{context.span_id:016x}"
        for key in (
            "simulation_id",
            "scenario_id",
            "agent_name",
            "agent_stage",
            "agent_status",
            "agent_action",
            "counterfactual_name",
            "status",
            "error_code",
        ):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception.type"] = record.exc_info[0].__name__
            payload["exception.stacktrace"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, separators=(",", ":"))


def configure_structured_logging() -> None:
    root = logging.getLogger()
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.handlers[:] = [handler]
    root.setLevel(getattr(logging, settings.log_level))


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
    global _configured, _enabled, _tracer_provider, _meter_provider, _logger_provider
    if _configured:
        return
    if not settings.otel_enabled:
        logging.getLogger(__name__).info(
            "Telemetry export disabled by configuration; API will continue"
        )
        _configured = True
        return
    resource_attributes = {
        "service.name": settings.otel_service_name,
        "deployment.environment": settings.app_env,
        "service.version": settings.app_version,
        "service.namespace": "geotwin-sentinel",
    }
    for pair in settings.otel_resource_attributes.split(","):
        if "=" in pair:
            key, value = pair.split("=", 1)
            if key.strip() and value.strip():
                resource_attributes[key.strip()] = value.strip()
    resource = Resource.create(resource_attributes)

    endpoint = settings.otel_exporter_otlp_endpoint
    if not should_enable_telemetry(endpoint):
        logging.getLogger(__name__).warning(
            "Telemetry endpoint unavailable during startup; export disabled and API will continue",
            extra={"error_code": "OTLP_ENDPOINT_UNAVAILABLE"},
        )
        _configured = True
        return
    try:
        headers = dict(
            pair.split("=", 1)
            for pair in settings.otel_exporter_otlp_headers.split(",")
            if "=" in pair
        )
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(
                    endpoint=endpoint,
                    insecure=settings.otel_exporter_otlp_insecure,
                    headers=headers,
                )
            )
        )
        trace.set_tracer_provider(tracer_provider)
        reader = PeriodicExportingMetricReader(
            OTLPMetricExporter(
                endpoint=endpoint,
                insecure=settings.otel_exporter_otlp_insecure,
                headers=headers,
            )
        )
        meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
        metrics.set_meter_provider(meter_provider)
        logger_provider = LoggerProvider(resource=resource)
        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(
                OTLPLogExporter(
                    endpoint=endpoint,
                    insecure=settings.otel_exporter_otlp_insecure,
                    headers=headers,
                )
            )
        )
        logging.getLogger().addHandler(
            LoggingHandler(level=getattr(logging, settings.log_level), logger_provider=logger_provider)
        )
        _tracer_provider = tracer_provider
        _meter_provider = meter_provider
        _logger_provider = logger_provider
        _enabled = True
    except Exception:
        logging.getLogger(__name__).exception("Telemetry exporter setup failed; API will continue")
    _configured = True


def telemetry_status() -> dict[str, bool | str]:
    return {
        "enabled": settings.otel_enabled,
        "configured": _configured,
        "exporter_active": _enabled,
        "service": settings.otel_service_name,
    }


def shutdown_telemetry() -> None:
    for provider in (_logger_provider, _meter_provider, _tracer_provider):
        if provider is not None:
            try:
                provider.shutdown()
            except Exception:
                logging.getLogger(__name__).exception(
                    "Telemetry shutdown failed; process exit will continue"
                )

from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: Literal["local", "test", "staging", "production"] = "local"
    app_version: str = "0.1.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    otel_enabled: bool = True
    otel_service_name: str = "geotwin-api"
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    otel_exporter_otlp_insecure: bool = True
    otel_exporter_otlp_headers: str = ""
    otel_resource_attributes: str = ""
    cors_allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    trusted_hosts: str = "localhost,127.0.0.1,testserver"
    max_request_body_bytes: int = Field(default=1_048_576, ge=1024, le=10_485_760)
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    @field_validator("app_version", "otel_service_name")
    @classmethod
    def nonempty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("value must not be empty")
        return value.strip()

    @field_validator("otel_exporter_otlp_endpoint")
    @classmethod
    def valid_otlp_endpoint(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("OTEL_EXPORTER_OTLP_ENDPOINT must be an absolute HTTP(S) URL")
        return value.rstrip("/")

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [item.strip().rstrip("/") for item in self.cors_allowed_origins.split(",") if item.strip()]
        for origin in origins:
            parsed = urlparse(origin)
            if origin == "*" or parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path not in {"", "/"}:
                raise ValueError("CORS_ALLOWED_ORIGINS must contain explicit HTTP(S) origins without paths")
            if self.app_env in {"staging", "production"} and parsed.hostname in {"localhost", "127.0.0.1"}:
                raise ValueError("Localhost CORS origins are not allowed outside local/test environments")
        if self.app_env in {"staging", "production"} and not origins:
            raise ValueError("CORS_ALLOWED_ORIGINS is required for staging and production")
        return origins

    @property
    def trusted_host_list(self) -> list[str]:
        hosts = [item.strip() for item in self.trusted_hosts.split(",") if item.strip()]
        if not hosts:
            raise ValueError("TRUSTED_HOSTS must contain at least one hostname")
        return hosts

    @property
    def public_metadata(self) -> dict[str, str]:
        return {"environment": self.app_env, "version": self.app_version, "service": self.otel_service_name}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

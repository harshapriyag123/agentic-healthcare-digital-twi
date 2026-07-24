"""Vercel Python Function entrypoint for the GeoTwin Sentinel FastAPI API."""

import os
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
API_SOURCE = REPOSITORY_ROOT / "apps" / "api"
sys.path.insert(0, str(API_SOURCE))

# Safe, non-secret defaults for the co-located Vercel deployment. Project
# environment variables can override every value before this module is loaded.
os.environ.setdefault("APP_ENV", "production")
os.environ.setdefault("APP_VERSION", "0.1.0-vercel")
os.environ.setdefault(
    "CORS_ALLOWED_ORIGINS",
    "https://harshapriyag123-agentic-healthcare-digital-8dyxg5j7q.vercel.app",
)
os.environ.setdefault("TRUSTED_HOSTS", "*.vercel.app")
os.environ.setdefault("OTEL_ENABLED", "false")
os.environ.setdefault("OTEL_SERVICE_NAME", "geotwin-api")

from app.main import app  # noqa: E402, F401

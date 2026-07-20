FROM python:3.12.10-slim-bookworm AS builder
WORKDIR /build
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
COPY pyproject.toml README.md ./
COPY apps/api ./apps/api
RUN python -m pip wheel --wheel-dir /wheels .

FROM python:3.12.10-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/app/apps/api PORT=8000
WORKDIR /app
RUN groupadd --system --gid 10001 geotwin && useradd --system --uid 10001 --gid geotwin --home-dir /nonexistent --shell /usr/sbin/nologin geotwin
COPY --from=builder /wheels /wheels
RUN python -m pip install --no-cache-dir /wheels/* && rm -rf /wheels
COPY --chown=geotwin:geotwin apps/api ./apps/api
COPY --chown=geotwin:geotwin scenarios ./scenarios
COPY --chown=geotwin:geotwin data ./data
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 CMD ["python", "-c", "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8000')+'/health', timeout=2)"]
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --timeout-graceful-shutdown 15 --no-access-log"]

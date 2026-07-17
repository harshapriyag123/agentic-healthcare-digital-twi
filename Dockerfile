FROM python:3.12-slim
WORKDIR /workspace
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir .
COPY apps/api ./apps/api
COPY data ./data
COPY scenarios ./scenarios
ENV PYTHONPATH=/workspace/apps/api
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings

TRACE_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")


class TraceStoreUnavailable(RuntimeError):
    pass


def get_trace_waterfall(trace_id: str) -> dict:
    if not TRACE_ID_PATTERN.fullmatch(trace_id):
        raise ValueError("Trace ID must be 32 lowercase hexadecimal characters")
    if not settings.signoz_query_endpoint:
        raise TraceStoreUnavailable("SigNoz trace query endpoint is not configured")
    query = f"""
SELECT name, span_id, parent_span_id, serviceName AS service_name,
       toUnixTimestamp64Nano(timestamp) AS timestamp_nano,
       duration_nano, has_error, status_code_string
FROM signoz_traces.distributed_signoz_index_v3
WHERE trace_id = '{trace_id}'
ORDER BY timestamp
LIMIT 1000
FORMAT JSONEachRow
""".strip()
    request = Request(
        settings.signoz_query_endpoint,
        data=query.encode("utf-8"),
        headers={"Content-Type": "text/plain; charset=utf-8"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=5) as response:
            rows = [
                json.loads(line)
                for line in response.read().decode("utf-8").splitlines()
                if line.strip()
            ]
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        raise TraceStoreUnavailable("SigNoz trace store is unavailable") from exc
    if not rows:
        return {"trace_id": trace_id, "span_count": 0, "duration_nano": 0, "spans": []}
    start = min(int(row["timestamp_nano"]) for row in rows)
    end = max(int(row["timestamp_nano"]) + int(row["duration_nano"]) for row in rows)
    spans = [
        {
            **row,
            "timestamp_nano": int(row["timestamp_nano"]),
            "duration_nano": int(row["duration_nano"]),
            "offset_nano": int(row["timestamp_nano"]) - start,
        }
        for row in rows
    ]
    return {
        "trace_id": trace_id,
        "span_count": len(spans),
        "duration_nano": end - start,
        "start_timestamp_nano": start,
        "spans": spans,
    }

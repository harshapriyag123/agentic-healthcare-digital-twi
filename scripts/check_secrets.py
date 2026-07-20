#!/usr/bin/env python3
"""Lightweight release blocker for common committed credential formats."""
import re
import subprocess
from pathlib import Path

patterns = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "GitHub token": re.compile(r"gh[pousr]_[A-Za-z0-9_]{30,}"),
    "AWS access key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "embedded URL credentials": re.compile(r"https?://[^\s/:]+:[^\s/@]+@"),
    "SigNoz key value": re.compile(r"(?i)signoz(?:[-_]ingestion)?[-_]key\s*[:=]\s*['\"]?[A-Za-z0-9_-]{20,}"),
}
excluded = {"package-lock.json", "scripts/check_secrets.py"}
files = subprocess.check_output(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard"], text=True
).splitlines()
findings = []
for name in files:
    if Path(name).name in excluded:
        continue
    try: text = Path(name).read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError): continue
    for label, pattern in patterns.items():
        if pattern.search(text): findings.append(f"{name}: possible {label}")
if findings:
    raise SystemExit("\n".join(findings))
print(f"Secret-pattern scan passed for {len(files)} tracked and untracked repository files.")

#!/usr/bin/env python3
"""Validate repository-local Markdown links and key public documentation invariants."""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
MARKDOWN = sorted(path for path in ROOT.rglob("*.md") if not any(part in {".git", ".venv", "node_modules"} for part in path.parts))
LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
ENV_NAME = re.compile(r"`((?:APP|OTEL|VITE)_[A-Z0-9_]+|LOG_LEVEL|CORS_ALLOWED_ORIGINS|TRUSTED_HOSTS|MAX_REQUEST_BODY_BYTES)`")


def relative_target(source: Path, raw: str) -> Path | None:
    target = raw.strip().split(maxsplit=1)[0].strip("<>")
    if not target or target.startswith(("#", "http://", "https://", "mailto:")):
        return None
    return (source.parent / unquote(target.split("#", 1)[0])).resolve()


def documented_environment_names() -> set[str]:
    examples = [ROOT / ".env.example", ROOT / "apps/api/.env.example", ROOT / "apps/web/.env.example"]
    names: set[str] = set()
    for path in examples:
        for line in path.read_text().splitlines():
            if line and not line.startswith("#") and "=" in line:
                names.add(line.split("=", 1)[0])
    return names


def main() -> int:
    failures: list[str] = []
    for source in MARKDOWN:
        text = source.read_text()
        for raw in LINK.findall(text):
            target = relative_target(source, raw)
            if target is not None and not target.exists():
                failures.append(f"{source.relative_to(ROOT)}: broken link {raw}")

    known_env = documented_environment_names()
    public_docs = "\n".join(path.read_text() for path in [ROOT / "README.md", *sorted((ROOT / "docs").rglob("*.md"))])
    for name in sorted(set(ENV_NAME.findall(public_docs)) - known_env):
        failures.append(f"environment variable documented but absent from examples: {name}")

    required = [
        "Research decision-support prototype using synthetic data",
        "authorized human review",
        "not clinical",
    ]
    for phrase in required:
        if phrase not in (ROOT / "README.md").read_text():
            failures.append(f"README missing safety phrase: {phrase}")

    if failures:
        print("Documentation validation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print(f"Documentation validation passed for {len(MARKDOWN)} Markdown files and {len(known_env)} environment variables.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

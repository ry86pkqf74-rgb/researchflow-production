"""Cache helpers for online literature runs."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


def compute_cache_key(provider: str, query: str, params: Mapping[str, Any]) -> str:
    payload = {
        "provider": provider,
        "query": query,
        "params": dict(params),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def load_cache(cache_root: Path, cache_key: str) -> dict[str, Any] | None:
    cache_path = cache_root / f"{cache_key}.json"
    if not cache_path.exists():
        return None
    if not cache_path.is_file():
        return None

    try:
        return json.loads(cache_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def write_cache(cache_root: Path, cache_key: str, payload: dict[str, Any]) -> Path:
    cache_root.mkdir(parents=True, exist_ok=True)
    cache_path = cache_root / f"{cache_key}.json"

    payload = dict(payload)
    payload["cached_at"] = datetime.now(timezone.utc).isoformat()

    _atomic_write_json(cache_path, payload)
    return cache_path


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    tmp_path.replace(path)

"""Preview metadata store (PR9A-3)

Read-only helpers for listing and loading ingestion runtime preview artifacts.

Safety invariants:
- Reads only from .tmp/ ingestion_runtime previews
- Does not read source datasets
- No network usage

Last Updated: 2026-01-09
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Union


class PreviewStoreError(RuntimeError):
    """Raised when preview metadata access is blocked or invalid."""


@dataclass(frozen=True)
class PreviewMetadata:
    schema_name: str
    schema_version: str
    file_format: str
    input_file_hash: str
    row_count: int
    column_count: int
    columns: List[str]
    dtypes: Dict[str, str]
    null_counts: Dict[str, int]
    preview_id: str
    preview_relpath: str


def list_preview_relpaths(tmp_root: Union[str, Path] = ".tmp") -> List[str]:
    """List available preview artifacts under `.tmp/ingestion_runtime/previews/`."""

    previews_dir = _previews_dir(tmp_root)
    if not previews_dir.exists():
        return []

    files = sorted([p for p in previews_dir.glob("*.json") if p.is_file()])
    return [
        str(Path(".tmp") / "ingestion_runtime" / "previews" / p.name) for p in files
    ]


def load_preview(tmp_root: Union[str, Path], preview_relpath: str) -> PreviewMetadata:
    """Load a preview JSON artifact and validate schema (metadata-only)."""

    preview_abs = _preview_abs_path(tmp_root, preview_relpath)
    if not preview_abs.exists():
        raise PreviewStoreError(f"Preview not found: {preview_relpath}")

    try:
        payload = json.loads(preview_abs.read_text(encoding="utf-8"))
    except Exception as e:
        raise PreviewStoreError(f"Invalid preview JSON: {preview_relpath}") from e

    required = {
        "schema_name",
        "schema_version",
        "file_format",
        "input_file_hash",
        "row_count",
        "column_count",
        "columns",
        "dtypes",
        "null_counts",
    }
    missing = required - set(payload.keys())
    if missing:
        raise PreviewStoreError(f"Preview missing required keys: {sorted(missing)}")

    columns = [str(c) for c in payload.get("columns", [])]

    dtypes_raw = payload.get("dtypes", {})
    nulls_raw = payload.get("null_counts", {})

    dtypes = {str(k): str(v) for k, v in _as_dict(dtypes_raw).items()}
    null_counts = {str(k): int(v) for k, v in _as_dict(nulls_raw).items()}

    # Ensure maps don't contain keys outside columns (defense-in-depth)
    dtypes = {k: v for k, v in dtypes.items() if k in set(columns)}
    null_counts = {k: v for k, v in null_counts.items() if k in set(columns)}

    preview_id = Path(preview_relpath).stem

    return PreviewMetadata(
        schema_name=str(payload["schema_name"]),
        schema_version=str(payload["schema_version"]),
        file_format=str(payload["file_format"]),
        input_file_hash=str(payload["input_file_hash"]),
        row_count=int(payload["row_count"]),
        column_count=int(payload["column_count"]),
        columns=columns,
        dtypes=dtypes,
        null_counts=null_counts,
        preview_id=preview_id,
        preview_relpath=preview_relpath,
    )


def _previews_dir(tmp_root: Union[str, Path]) -> Path:
    tmp_root = Path(tmp_root).resolve()
    if ".tmp" not in tmp_root.parts:
        raise PreviewStoreError(f"tmp_root must be a .tmp/ directory: {tmp_root}")
    return (tmp_root / "ingestion_runtime" / "previews").resolve()


def _preview_abs_path(tmp_root: Union[str, Path], preview_relpath: str) -> Path:
    tmp_root = Path(tmp_root).resolve()
    if ".tmp" not in tmp_root.parts:
        raise PreviewStoreError(f"tmp_root must be a .tmp/ directory: {tmp_root}")

    rel = Path(preview_relpath)
    parts = list(rel.parts)

    if ".tmp" in parts:
        idx = parts.index(".tmp")
        rel = Path(*parts[idx + 1 :])
    else:
        # Require that relpath looks like ingestion_runtime/previews/<file>.json
        rel = rel

    candidate = (tmp_root / rel).resolve()
    if _previews_dir(tmp_root) not in candidate.parents and candidate != _previews_dir(
        tmp_root
    ):
        raise PreviewStoreError(
            "Preview path must be under .tmp/ingestion_runtime/previews/"
        )

    return candidate


def _as_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    raise PreviewStoreError("Expected dict value in preview payload")

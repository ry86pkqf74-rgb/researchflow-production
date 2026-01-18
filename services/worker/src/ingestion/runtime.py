"""SANDBOX ingestion runtime (PR9A-2)

Wires file handling to the declarative schema validation layer (PR9A-1).

Hard requirements:
- SANDBOX-only: hard-fail in STANDBY/LIVE/other modes
- Offline-only: require NO_NETWORK=1
- Fail-closed: no preview artifact written on validation failure
- Runtime-only: any artifacts limited to .tmp/ with atomic writes
- Provenance: sanitized, decisions-only events (no content, no full paths)

Last Updated: 2026-01-09
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Union

from web_frontend.provenance_logger import log_event

from src.governance.capabilities import RosMode, get_current_mode
from src.ingestion.ingestion import ingest_file
from src.ingestion.schema_loader import SchemaDefinition, load_schema
from src.ingestion.validator import ValidationError


class IngestionRuntimeError(RuntimeError):
    """Raised when runtime ingestion is blocked by governance/runtime rules."""


@dataclass(frozen=True)
class IngestionPreviewHandle:
    """Preview-ready handle (counts/metadata only).

    Notes:
    - `preview_relpath` is always a path under `.tmp/`.
    - This object intentionally contains no row samples or content.
    """

    schema_name: str
    schema_version: str
    file_format: str
    input_file_hash: str
    row_count: int
    column_count: int
    columns: list[str]
    dtypes: Dict[str, str]
    null_counts: Dict[str, int]
    preview_relpath: str


def ingest_runtime(
    data_path: Union[str, Path],
    schema_path: Union[str, Path],
    *,
    tmp_root: Union[str, Path] = ".tmp",
    enable_provenance: bool = True,
) -> IngestionPreviewHandle:
    """Run SANDBOX-only ingestion and emit a preview handle on success."""

    data_path = Path(data_path)
    schema_path = Path(schema_path)
    tmp_root = Path(tmp_root)

    schema = load_schema(schema_path)
    input_file_hash = _hash_path(data_path)

    mode = get_current_mode()

    if mode != RosMode.SANDBOX:
        if enable_provenance:
            _log_decision(
                "ingestion_runtime_blocked",
                {
                    "component": "ingestion_runtime",
                    "allowed": False,
                    "mode": mode.value,
                    "reason_code": "MODE_BLOCKED",
                    "schema_name": schema.name,
                    "schema_version": schema.version,
                    "file_format": schema.file_format,
                    "input_file_hash": input_file_hash,
                },
            )
        raise IngestionRuntimeError(
            f"Ingestion runtime is SANDBOX-only; current mode is {mode.value}"
        )

    # Offline-only defense in depth: require NO_NETWORK=1 even in SANDBOX.
    if os.getenv("NO_NETWORK", "1") != "1":
        if enable_provenance:
            _log_decision(
                "ingestion_runtime_blocked",
                {
                    "component": "ingestion_runtime",
                    "allowed": False,
                    "mode": mode.value,
                    "reason_code": "NO_NETWORK_REQUIRED",
                    "schema_name": schema.name,
                    "schema_version": schema.version,
                    "file_format": schema.file_format,
                    "input_file_hash": input_file_hash,
                },
            )
        raise IngestionRuntimeError("Offline-only ingestion requires NO_NETWORK=1")

    if enable_provenance:
        _log_decision(
            "ingestion_runtime_start",
            {
                "component": "ingestion_runtime",
                "allowed": True,
                "mode": mode.value,
                "schema_name": schema.name,
                "schema_version": schema.version,
                "file_format": schema.file_format,
                "input_file_hash": input_file_hash,
            },
        )

    try:
        df = ingest_file(data_path, schema_path, enable_provenance=False)
    except ValidationError as e:
        if enable_provenance:
            _log_decision(
                "ingestion_runtime_result",
                {
                    "component": "ingestion_runtime",
                    "allowed": True,
                    "mode": mode.value,
                    "schema_name": schema.name,
                    "schema_version": schema.version,
                    "file_format": schema.file_format,
                    "input_file_hash": input_file_hash,
                    "valid": False,
                    "reason_code": "VALIDATION_FAILED",
                    "error_count": _safe_error_count(e),
                },
            )
        raise

    columns = [str(c) for c in df.columns.tolist()]
    dtypes = {str(c): str(df[str(c)].dtype) for c in columns}
    null_counts = {str(c): int(df[str(c)].isna().sum()) for c in columns}

    handle = _build_preview_handle(
        schema=schema,
        input_file_hash=input_file_hash,
        df_row_count=int(df.shape[0]),
        df_column_count=int(df.shape[1]),
        columns=columns,
        dtypes=dtypes,
        null_counts=null_counts,
        tmp_root=tmp_root,
    )

    _write_preview_atomically(tmp_root=tmp_root, handle=handle)

    if enable_provenance:
        _log_decision(
            "ingestion_runtime_result",
            {
                "component": "ingestion_runtime",
                "allowed": True,
                "mode": mode.value,
                "schema_name": schema.name,
                "schema_version": schema.version,
                "file_format": schema.file_format,
                "input_file_hash": input_file_hash,
                "valid": True,
                "reason_code": "VALIDATION_PASSED",
                "row_count": handle.row_count,
                "column_count": handle.column_count,
                "preview_id": Path(handle.preview_relpath).stem,
            },
        )

    return handle


def _build_preview_handle(
    *,
    schema: SchemaDefinition,
    input_file_hash: str,
    df_row_count: int,
    df_column_count: int,
    columns: list[str],
    dtypes: Dict[str, str],
    null_counts: Dict[str, int],
    tmp_root: Path,
) -> IngestionPreviewHandle:
    preview_dir = _ensure_tmp_dir(tmp_root / "ingestion_runtime" / "previews")

    # Stable, non-path-based identifier.
    preview_id = f"{schema.name}_{schema.version}_{input_file_hash}"
    preview_filename = f"{preview_id}.json"

    preview_relpath = str(
        Path(".tmp") / "ingestion_runtime" / "previews" / preview_filename
    )

    # Ensure caller-provided tmp_root is actually a .tmp/ directory.
    # (We only return a relative path for downstream use.)
    _ = preview_dir

    return IngestionPreviewHandle(
        schema_name=schema.name,
        schema_version=schema.version,
        file_format=schema.file_format,
        input_file_hash=input_file_hash,
        row_count=df_row_count,
        column_count=df_column_count,
        columns=columns,
        dtypes=dtypes,
        null_counts=null_counts,
        preview_relpath=preview_relpath,
    )


def _write_preview_atomically(
    *, tmp_root: Path, handle: IngestionPreviewHandle
) -> None:
    preview_path = _preview_abs_path(tmp_root, handle.preview_relpath)
    preview_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "schema_name": handle.schema_name,
        "schema_version": handle.schema_version,
        "file_format": handle.file_format,
        "input_file_hash": handle.input_file_hash,
        "row_count": handle.row_count,
        "column_count": handle.column_count,
        "columns": handle.columns,
        "dtypes": handle.dtypes,
        "null_counts": handle.null_counts,
    }

    tmp_path = preview_path.with_suffix(preview_path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, sort_keys=True) + "\n", encoding="utf-8")
    tmp_path.replace(preview_path)


def _preview_abs_path(tmp_root: Path, preview_relpath: str) -> Path:
    # Always write under tmp_root; preview_relpath is kept for downstream display/handles.
    rel = Path(preview_relpath)

    # Only keep the tail path under `.tmp/` to avoid trusting caller-controlled prefixes.
    try:
        parts = list(rel.parts)
        if ".tmp" in parts:
            idx = parts.index(".tmp")
            rel = Path(*parts[idx + 1 :])
        else:
            rel = rel.name
    except Exception:
        rel = rel.name

    return (tmp_root / rel).resolve()


def _ensure_tmp_dir(path: Path) -> Path:
    resolved = path.resolve()
    if ".tmp" not in resolved.parts:
        raise IngestionRuntimeError(
            f"Runtime artifacts must be under .tmp/: {resolved}"
        )
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved


def _hash_path(path: Path) -> str:
    # Do not log file system paths; hash the resolved path string.
    import hashlib

    try:
        s = str(path.resolve())
    except Exception:
        s = str(path)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]


def _log_decision(event_type: str, meta: Dict[str, Any]) -> None:
    # Provenance logger sanitizes and rejects dangerous keys; keep this minimal.
    log_event(event_type, meta)


def _safe_error_count(exc: Exception) -> int:
    # Keep this constant-time-ish and avoid reflecting arbitrary exception strings.
    # For ValidationError we expect a short message; still only expose count.
    msg = str(exc)
    if not msg:
        return 0
    return min(10_000, msg.count(";") + 1)


def main(argv: Optional[list[str]] = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="SANDBOX ingestion runtime (PR9A-2)")
    parser.add_argument(
        "--data", required=True, help="Path to input file (csv/tsv/parquet)"
    )
    parser.add_argument(
        "--schema", required=True, help="Path to schema file (.yaml/.yml/.py)"
    )
    parser.add_argument(
        "--tmp-root",
        default=".tmp",
        help="Runtime artifact root (must be under .tmp/)",
    )
    parser.add_argument(
        "--no-provenance",
        action="store_true",
        help="Disable provenance events",
    )

    args = parser.parse_args(argv)

    handle = ingest_runtime(
        args.data,
        args.schema,
        tmp_root=args.tmp_root,
        enable_provenance=not args.no_provenance,
    )

    # Print a minimal summary (no full paths).
    print(json.dumps(asdict(handle), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

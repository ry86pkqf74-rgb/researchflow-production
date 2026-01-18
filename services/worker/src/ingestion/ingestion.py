"""High-level ingestion wrapper (PR9A-1)

Implements:
- Load schema (YAML or Python)
- Read input file (CSV/TSV/Parquet)
- Validate fail-closed (no preview/data returned on invalid)
- Emit sanitized provenance decision events via runtime logger

SAFETY INVARIANTS:
- No persistence outside .tmp/
- No network access
- No PHI handling

Last Updated: 2026-01-09
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path
from typing import Union

import pandas as pd

from .schema_loader import SchemaDefinition, load_schema
from .validator import ValidationError, ValidationResult, validate_dataframe


def ingest_file(
    data_path: Union[str, Path],
    schema_path: Union[str, Path],
    *,
    enable_provenance: bool = True,
) -> pd.DataFrame:
    """Ingest a file under a declarative schema.

    Returns the validated DataFrame if and only if validation passes.

    Raises:
        ValidationError: if schema invalid or data invalid.
    """
    data_path = Path(data_path)
    schema_path = Path(schema_path)

    schema = load_schema(schema_path)

    df = _read_file(data_path, schema.file_format)

    result = validate_dataframe(df, schema, coerce_types=True)

    if enable_provenance:
        _log_ingestion_decision(schema=schema, data_path=data_path, result=result)

    result.raise_if_invalid()

    return df


def _read_file(path: Path, file_format: str) -> pd.DataFrame:
    if not path.exists():
        raise ValidationError(f"Data file not found: {path}")

    if file_format == "csv":
        return pd.read_csv(path)

    if file_format == "tsv":
        return pd.read_csv(path, sep="\t")

    if file_format == "parquet":
        return pd.read_parquet(path)

    raise ValidationError(f"Unsupported file_format: {file_format}")


def _log_ingestion_decision(
    *, schema: SchemaDefinition, data_path: Path, result: ValidationResult
) -> None:
    # Decisions-only + sanitized metadata; do not include content, row samples, or full paths.
    try:
        from web_frontend.provenance_logger import log_event
    except Exception as e:
        sys.stderr.write(f"provenance logger unavailable: {e.__class__.__name__}\n")
        return

    metadata = {
        "component": "ingestion_schema",
        "schema_name": schema.name,
        "schema_version": schema.version,
        "file_format": schema.file_format,
        "input_file_hash": _hash_path(data_path),
        "valid": result.valid,
        "error_count": len(result.errors),
    }

    if not result.valid:
        # Keep errors bounded and sanitized
        metadata["errors"] = result.errors[:10]

    log_event("ingestion_validation", metadata)


def _hash_path(path: Path) -> str:
    # Do not log file system paths; hash the resolved path string.
    try:
        s = str(path.resolve())
    except Exception:
        s = str(path)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]

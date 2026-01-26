"""ACTIVE ingestion runtime for online workflow.

Hard requirements:
- Non-STANDBY mode enforcement (ACTIVE/SANDBOX)
- Network flag irrelevant (no network needed)
- Artifacts ONLY under .tmp/ingestion_runtime_active/{run_id}/
- Atomic writes
- Mandatory PHI scan (fail closed)
- Schema validation + preview metadata (no cell values)
- No raw content logging or persistence outside run folder

Last Updated: 2026-01-09
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

from src.governance.capabilities import RosMode, get_current_mode
from src.validation.phi_detector import PHIDetector, scan_dataframe


class ActiveIngestionError(RuntimeError):
    """Raised when ACTIVE ingestion is blocked."""


@dataclass(frozen=True)
class ActiveIngestionResult:
    """Result from ACTIVE ingestion runtime."""

    ok: bool
    run_id: str
    reason: Optional[str] = None

    # Metadata (populated on success)
    row_count: int = 0
    col_count: int = 0
    columns: List[str] = None
    dtypes: Dict[str, str] = None
    null_counts: Dict[str, int] = None

    # Report paths (relative to .tmp/)
    input_metadata_path: Optional[str] = None
    phi_scan_report_path: Optional[str] = None
    validation_report_path: Optional[str] = None
    preview_metadata_path: Optional[str] = None

    def __post_init__(self):
        if self.columns is None:
            object.__setattr__(self, "columns", [])
        if self.dtypes is None:
            object.__setattr__(self, "dtypes", {})
        if self.null_counts is None:
            object.__setattr__(self, "null_counts", {})


def run_active_ingestion_runtime(
    *,
    uploaded_bytes: bytes,
    original_filename: str,
    schema_profile: Optional[str] = None,
    tmp_root: str = ".tmp",
) -> ActiveIngestionResult:
    """Run ACTIVE ingestion with PHI scan + validation + preview.

    Steps:
    1. Enforce non-STANDBY mode (SANDBOX for Phase 1)
    2. Create run folder under .tmp/ingestion_runtime_active/{run_id}/
    3. Write input metadata (redacted filename, size, hash)
    4. Parse uploaded file
    5. **PHI SCAN (mandatory)**: Scan column names + sample values
       - If PHI detected: FAIL CLOSED, write phi_scan_report.json, return error
    6. Validation: Schema validation if profile provided, else generic
    7. Preview metadata: row_count, columns, dtypes, null_counts (NO VALUES)
    8. Write all reports atomically
    9. Return ActiveIngestionResult

    Args:
        uploaded_bytes: Raw file bytes from upload
        original_filename: Original filename (will be redacted)
        schema_profile: Optional schema name for validation
        tmp_root: Root .tmp directory

    Returns:
        ActiveIngestionResult with ok=True on success, ok=False on PHI detection
    """
    # Generate run ID
    run_id = str(uuid.uuid4())[:8]
    timestamp = datetime.now(timezone.utc).isoformat()

    # Create run directory
    run_dir = Path(tmp_root) / "ingestion_runtime_active" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    # Check mode (SANDBOX for Phase 1, STANDBY blocked)
    mode = get_current_mode()
    if mode == RosMode.STANDBY:
        raise ActiveIngestionError(
            "ACTIVE ingestion blocked in STANDBY mode; switch to ACTIVE or SANDBOX"
        )

    # Hash filename and bytes
    filename_hash = hashlib.sha256(original_filename.encode()).hexdigest()[:16]
    content_hash = hashlib.sha256(uploaded_bytes).hexdigest()

    # Write input metadata (redacted)
    input_metadata = {
        "run_id": run_id,
        "timestamp": timestamp,
        "filename_hash": filename_hash,
        "size_bytes": len(uploaded_bytes),
        "content_sha256": content_hash,
        "schema_profile": schema_profile,
    }
    input_metadata_path = run_dir / "input_metadata.json"
    _write_json_atomic(input_metadata_path, input_metadata)

    # Parse file
    try:
        df = _parse_uploaded_file(uploaded_bytes, original_filename)
    except Exception as e:
        return ActiveIngestionResult(
            ok=False,
            run_id=run_id,
            reason=f"File parse error: {str(e)[:200]}",
        )

    # ========================================================================
    # MANDATORY PHI SCAN (FAIL CLOSED)
    # ========================================================================
    detector = PHIDetector()

    # Scan column names first
    suspicious_columns = []
    for col in df.columns:
        col_lower = str(col).lower()
        if any(
            kw in col_lower
            for kw in [
                "patient",
                "mrn",
                "ssn",
                "dob",
                "birth",
                "address",
                "phone",
                "email",
                "name",
            ]
        ):
            suspicious_columns.append(str(col))

    # Scan sample values (first 100 rows)
    sample_size = min(100, len(df))
    scan_result = scan_dataframe(df.head(sample_size), detector)

    # Write PHI scan report (redacted - no raw strings)
    phi_scan_report = {
        "run_id": run_id,
        "timestamp": timestamp,
        "phi_detected": scan_result.phi_detected or len(suspicious_columns) > 0,
        "suspicious_column_count": len(suspicious_columns),
        "flagged_column_count": len(scan_result.flagged_columns),
        "flagged_row_count": len(scan_result.flagged_rows),
        "total_rows_scanned": scan_result.total_rows_scanned,
        "severity_counts": scan_result.severity_counts,
        "scan_timestamp": scan_result.scan_timestamp,
    }
    phi_scan_report_path = run_dir / "phi_scan_report.json"
    _write_json_atomic(phi_scan_report_path, phi_scan_report)

    # FAIL CLOSED if PHI detected
    if phi_scan_report["phi_detected"]:
        return ActiveIngestionResult(
            ok=False,
            run_id=run_id,
            reason="PHI detected in column names or values. Upload blocked for safety.",
            phi_scan_report_path=str(phi_scan_report_path.relative_to(tmp_root)),
        )

    # ========================================================================
    # VALIDATION
    # ========================================================================
    validation_result = _validate_dataframe(df, schema_profile)
    validation_report = {
        "run_id": run_id,
        "timestamp": timestamp,
        "schema_profile": schema_profile,
        "valid": validation_result["valid"],
        "errors": validation_result["errors"],
        "warnings": validation_result["warnings"],
    }
    validation_report_path = run_dir / "validation_report.json"
    _write_json_atomic(validation_report_path, validation_report)

    if not validation_result["valid"]:
        return ActiveIngestionResult(
            ok=False,
            run_id=run_id,
            reason=f"Validation failed: {'; '.join(validation_result['errors'][:3])}",
            phi_scan_report_path=str(phi_scan_report_path.relative_to(tmp_root)),
            validation_report_path=str(validation_report_path.relative_to(tmp_root)),
        )

    # ========================================================================
    # PREVIEW METADATA (NO CELL VALUES)
    # ========================================================================
    columns = [str(c) for c in df.columns.tolist()]
    dtypes = {str(c): str(df[c].dtype) for c in columns}
    null_counts = {str(c): int(df[c].isna().sum()) for c in columns}

    preview_metadata = {
        "run_id": run_id,
        "timestamp": timestamp,
        "row_count": int(len(df)),
        "col_count": int(len(df.columns)),
        "columns": columns,
        "dtypes": dtypes,
        "null_counts": null_counts,
    }
    preview_metadata_path = run_dir / "preview_metadata.json"
    _write_json_atomic(preview_metadata_path, preview_metadata)

    # Success
    return ActiveIngestionResult(
        ok=True,
        run_id=run_id,
        reason="Success",
        row_count=int(len(df)),
        col_count=int(len(df.columns)),
        columns=columns,
        dtypes=dtypes,
        null_counts=null_counts,
        input_metadata_path=str(input_metadata_path.relative_to(tmp_root)),
        phi_scan_report_path=str(phi_scan_report_path.relative_to(tmp_root)),
        validation_report_path=str(validation_report_path.relative_to(tmp_root)),
        preview_metadata_path=str(preview_metadata_path.relative_to(tmp_root)),
    )


def _parse_uploaded_file(uploaded_bytes: bytes, filename: str) -> pd.DataFrame:
    """Parse uploaded file to DataFrame."""
    buffer = BytesIO(uploaded_bytes)

    if filename.endswith(".csv"):
        return pd.read_csv(buffer)
    elif filename.endswith(".tsv"):
        return pd.read_csv(buffer, sep="\t")
    elif filename.endswith(".parquet"):
        return pd.read_parquet(buffer)
    else:
        # Try CSV as default
        return pd.read_csv(buffer)


def _validate_dataframe(df: pd.DataFrame, schema_profile: Optional[str]) -> Dict:
    """Validate DataFrame against schema or generic checks."""
    errors = []
    warnings = []

    # Generic validation (always run)
    if df.empty:
        errors.append("DataFrame is empty")

    # Check column names unique
    if len(df.columns) != len(set(df.columns)):
        errors.append("Column names are not unique")

    # Check parseable
    if df.shape[0] == 0:
        warnings.append("No rows in dataset")

    # If schema_profile provided, attempt schema validation
    if schema_profile:
        try:
            # Import schema validation dynamically
            from src.verification.schema_validator import SchemaValidator
            
            validator = SchemaValidator()
            result = validator.validate(df, schema_profile, strict=False)
            
            if result.status == "PASSED":
                # Schema validation passed
                pass
            elif result.status == "WARNING":
                warnings.extend(result.warnings)
            else:  # FAILED
                errors.extend(result.errors)
        except FileNotFoundError:
            warnings.append(f"Schema '{schema_profile}' not found in schemas/pandera/")
        except ImportError as e:
            warnings.append(f"Schema validation unavailable: {str(e)}")
        except Exception as e:
            errors.append(f"Schema validation error: {str(e)}")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


def _write_json_atomic(path: Path, data: Dict) -> None:
    """Write JSON atomically using temp file + rename."""
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp_path.write_text(
            json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        tmp_path.replace(path)
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass

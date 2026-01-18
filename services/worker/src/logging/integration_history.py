#!/usr/bin/env python3
"""Integration History Logger

Offline-first, PHI-safe audit logging for integration operations.

Features:
- Append-only JSONL logs (one file per day)
- Pure-Python validation (no external schema validator)
- PHI denylist enforcement
- Optional remote sink interface (disabled by default)
- NO_COLOR support for terminal output

Usage:
    from pathlib import Path
    from src.logging.integration_history import log_integration_event

    record = {
        "run_id": "20260106-143022-a1b2c3",
        "timestamp_utc": "2026-01-06T14:30:22.123Z",
        "operation": "link",
        "dataset": "thyroid_pilot",
        "entity": "imaging_to_surgery",
        "rule_version": "1.0.0",
        "rule_hash": "a3f5c9d2e1b4a6f8",
        "rows_in": 1247,
        "rows_out": 1189,
        "rows_affected": 1189,
        "warnings": [],
        "errors": [],
        "input_artifacts": ["interim/imaging_standardized.parquet"],
        "output_artifacts": ["processed/imaging_surgery_linked.parquet"]
    }

    log_integration_event(record, log_dir=Path("reports/integration_history"))
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# PHI denylist: keys that must never appear in records
PHI_DENYLIST = {
    "patient_id",
    "mrn",
    "medical_record_number",
    "ssn",
    "social_security",
    "dob",
    "date_of_birth",
    "birth_date",
    "patient_name",
    "full_name",
    "email",
    "phone",
    "telephone",
    "address",
    "zip",
    "postal_code",
}

# Patterns that look like PHI (for scanning free-text fields)
PHI_PATTERNS = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),  # SSN
    re.compile(r"\b\d{9}\b"),  # MRN-like (9 digits)
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),  # Email
    re.compile(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b"),  # Phone
    re.compile(
        r"\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b"
    ),  # ISO date (potential DOB)
]

ALLOWED_OPERATIONS = {"link", "dedupe", "validate", "quarantine", "pass", "fail"}
REQUIRED_FIELDS = {
    "run_id",
    "timestamp_utc",
    "operation",
    "dataset",
    "entity",
    "rule_version",
    "rule_hash",
    "rows_in",
    "rows_out",
    "rows_affected",
    "warnings",
    "errors",
    "input_artifacts",
    "output_artifacts",
}


def _use_color() -> bool:
    """Check if ANSI colors should be used."""
    return sys.stdout.isatty() and not os.environ.get("NO_COLOR")


def _colorize(text: str, code: str) -> str:
    """Apply ANSI color if appropriate."""
    if not _use_color():
        return text
    return f"\033[{code}m{text}\033[0m"


def _red(text: str) -> str:
    return _colorize(text, "91")


def _green(text: str) -> str:
    return _colorize(text, "92")


def _yellow(text: str) -> str:
    return _colorize(text, "93")


class ValidationError(Exception):
    """Raised when a record fails validation."""

    pass


class RemoteSink:
    """Interface for optional remote logging.

    Implementations should override emit() to send records to external systems.
    Default implementation is a no-op.
    """

    def emit(self, record: Dict[str, Any]) -> None:
        """Emit a record to remote logging system.

        Args:
            record: Validated integration history record
        """
        pass  # No-op by default


def _get_remote_sink() -> Optional[RemoteSink]:
    """Factory for remote sink (disabled unless explicitly enabled).

    Returns:
        RemoteSink instance if ROS_REMOTE_LOGGING=1 and ROS_REMOTE_LOGGER_TYPE set,
        otherwise None.
    """
    if os.environ.get("ROS_REMOTE_LOGGING") != "1":
        return None

    logger_type = os.environ.get("ROS_REMOTE_LOGGER_TYPE")
    if not logger_type:
        return None

    # Stub: return no-op sink
    # In production, implement specific sinks (e.g., CloudWatch, S3, etc.)
    return RemoteSink()


def _check_phi_in_text(text: str, field_name: str) -> None:
    """Check if text contains PHI-like patterns.

    Args:
        text: Text to scan
        field_name: Name of field (for error messages)

    Raises:
        ValidationError: If PHI-like pattern detected
    """
    for pattern in PHI_PATTERNS:
        if pattern.search(text):
            raise ValidationError(
                f"Field '{field_name}' contains PHI-like pattern: {pattern.pattern}"
            )


def _validate_record(record: Dict[str, Any]) -> None:
    """Validate integration history record.

    Args:
        record: Record dictionary to validate

    Raises:
        ValidationError: If validation fails
    """
    # Check for PHI keys
    for key in record.keys():
        if key.lower() in PHI_DENYLIST:
            raise ValidationError(f"Forbidden PHI key detected: {key}")

    # Check required fields
    missing = REQUIRED_FIELDS - set(record.keys())
    if missing:
        raise ValidationError(f"Missing required fields: {', '.join(sorted(missing))}")

    # Validate types and patterns
    if not isinstance(record["run_id"], str) or not re.match(
        r"^[a-zA-Z0-9_-]+$", record["run_id"]
    ):
        raise ValidationError(
            "run_id must be alphanumeric string with underscores/hyphens"
        )

    if not isinstance(record["timestamp_utc"], str):
        raise ValidationError("timestamp_utc must be ISO 8601 string")

    if record["operation"] not in ALLOWED_OPERATIONS:
        raise ValidationError(
            f"operation must be one of: {', '.join(ALLOWED_OPERATIONS)}"
        )

    if not isinstance(record["dataset"], str) or not re.match(
        r"^[a-z0-9_]+$", record["dataset"]
    ):
        raise ValidationError("dataset must be lowercase alphanumeric with underscores")

    if not isinstance(record["entity"], str) or not re.match(
        r"^[a-z0-9_]+$", record["entity"]
    ):
        raise ValidationError("entity must be lowercase alphanumeric with underscores")

    if not isinstance(record["rule_version"], str) or not re.match(
        r"^\d+\.\d+\.\d+$", record["rule_version"]
    ):
        raise ValidationError("rule_version must be semantic version (e.g., 1.0.0)")

    if not isinstance(record["rule_hash"], str) or not re.match(
        r"^[a-f0-9]{16}$", record["rule_hash"]
    ):
        raise ValidationError("rule_hash must be 16-char hex string")

    # Validate integer counts
    for field in ["rows_in", "rows_out", "rows_affected"]:
        if not isinstance(record[field], int) or record[field] < 0:
            raise ValidationError(f"{field} must be non-negative integer")

    # Validate arrays
    if not isinstance(record["warnings"], list):
        raise ValidationError("warnings must be array")
    if not isinstance(record["errors"], list):
        raise ValidationError("errors must be array")
    if not isinstance(record["input_artifacts"], list):
        raise ValidationError("input_artifacts must be array")
    if not isinstance(record["output_artifacts"], list):
        raise ValidationError("output_artifacts must be array")

    # Check PHI in free-text fields
    for warning in record["warnings"]:
        if not isinstance(warning, str):
            raise ValidationError("warnings must contain strings only")
        _check_phi_in_text(warning, "warnings")

    for error in record["errors"]:
        if not isinstance(error, str):
            raise ValidationError("errors must contain strings only")
        _check_phi_in_text(error, "errors")

    # Validate artifact paths
    for artifact in record["input_artifacts"] + record["output_artifacts"]:
        if not isinstance(artifact, str):
            raise ValidationError("artifact paths must be strings")
        if not re.match(r"^(interim|processed)/[a-zA-Z0-9_/.]+\.parquet$", artifact):
            raise ValidationError(f"artifact path invalid format: {artifact}")

    # Validate optional metadata
    if "metadata" in record:
        if not isinstance(record["metadata"], dict):
            raise ValidationError("metadata must be object")

        # Check for PHI in metadata values
        for key, value in record["metadata"].items():
            if key.lower() in PHI_DENYLIST:
                raise ValidationError(f"Forbidden PHI key in metadata: {key}")
            if isinstance(value, str):
                _check_phi_in_text(value, f"metadata.{key}")


def log_integration_event(
    record: Dict[str, Any], *, log_dir: Path, remote_sink: Optional[RemoteSink] = None
) -> None:
    """Log an integration operation event.

    Args:
        record: Integration history record (see schema for required fields)
        log_dir: Directory for JSONL log files
        remote_sink: Optional remote logging sink (defaults to env-based factory)

    Raises:
        ValidationError: If record validation fails
    """
    # Validate record
    _validate_record(record)

    # Ensure log directory exists
    log_dir.mkdir(parents=True, exist_ok=True)

    # Determine log file (daily rotation)
    timestamp = datetime.fromisoformat(record["timestamp_utc"].replace("Z", "+00:00"))
    log_file = log_dir / f"integration_history_{timestamp.strftime('%Y%m%d')}.jsonl"

    # Append to JSONL file
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")

    # Optional: emit to remote sink
    if remote_sink is None:
        remote_sink = _get_remote_sink()

    if remote_sink is not None:
        try:
            remote_sink.emit(record)
        except Exception as e:
            # Log error but don't fail the operation
            print(_yellow(f"⚠️  Remote sink error: {e}"), file=sys.stderr)

    # Print success confirmation if interactive
    if sys.stdout.isatty():
        print(_green(f"✓ Logged {record['operation']} event to {log_file.name}"))


def validate_existing_logs(log_dir: Path) -> Dict[str, Any]:
    """Validate all existing JSONL logs in directory.

    Args:
        log_dir: Directory containing integration_history_*.jsonl files

    Returns:
        Summary dict with counts of valid/invalid records
    """
    summary = {
        "total_files": 0,
        "total_records": 0,
        "valid": 0,
        "invalid": 0,
        "errors": [],
    }

    if not log_dir.exists():
        return summary

    for log_file in sorted(log_dir.glob("integration_history_*.jsonl")):
        summary["total_files"] += 1

        with open(log_file, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, start=1):
                summary["total_records"] += 1
                try:
                    record = json.loads(line)
                    _validate_record(record)
                    summary["valid"] += 1
                except (json.JSONDecodeError, ValidationError) as e:
                    summary["invalid"] += 1
                    summary["errors"].append(f"{log_file.name}:{line_num} - {e}")

    return summary

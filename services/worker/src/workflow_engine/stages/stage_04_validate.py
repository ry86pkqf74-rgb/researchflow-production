"""
Stage 04: Schema Validation

Validates data against expected schemas before PHI scanning.
This ensures data structure is correct before expensive operations.

Note: PHI scanning is in stage 05. This stage validates structure only.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stage_04_validate")


def detect_format(file_path: str) -> str:
    """Detect file format from extension.

    Args:
        file_path: Path to file

    Returns:
        Detected format string
    """
    ext = os.path.splitext(file_path)[1].lower()
    format_map = {
        ".csv": "csv",
        ".json": "json",
        ".jsonl": "jsonl",
        ".parquet": "parquet",
        ".xml": "xml",
        ".hl7": "hl7",
        ".fhir": "fhir",
        ".txt": "text",
    }
    return format_map.get(ext, "unknown")


def validate_json_structure(file_path: str) -> tuple[bool, str, Dict[str, Any]]:
    """Validate JSON file structure.

    Args:
        file_path: Path to JSON file

    Returns:
        Tuple of (is_valid, error_message, metadata)
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        metadata = {
            "type": type(data).__name__,
            "top_level_keys": list(data.keys()) if isinstance(data, dict) else None,
            "record_count": len(data) if isinstance(data, (list, dict)) else 1,
        }

        return True, "", metadata

    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {str(e)}", {}
    except UnicodeDecodeError as e:
        return False, f"Encoding error: {str(e)}", {}


def validate_csv_structure(file_path: str) -> tuple[bool, str, Dict[str, Any]]:
    """Validate CSV file structure.

    Args:
        file_path: Path to CSV file

    Returns:
        Tuple of (is_valid, error_message, metadata)
    """
    try:
        import csv

        with open(file_path, "r", encoding="utf-8", newline="") as f:
            # Sniff dialect
            sample = f.read(8192)
            f.seek(0)

            try:
                dialect = csv.Sniffer().sniff(sample)
                has_header = csv.Sniffer().has_header(sample)
            except csv.Error:
                dialect = csv.excel
                has_header = True

            reader = csv.reader(f, dialect)
            rows = list(reader)

            if not rows:
                return False, "CSV file is empty", {}

            headers = rows[0] if has_header else [f"col_{i}" for i in range(len(rows[0]))]
            data_rows = rows[1:] if has_header else rows

            # Check consistency
            inconsistent_rows = [
                i + (2 if has_header else 1)
                for i, row in enumerate(data_rows)
                if len(row) != len(headers)
            ]

            metadata = {
                "column_count": len(headers),
                "row_count": len(data_rows),
                "has_header": has_header,
                "columns": headers[:20],  # Limit to prevent bloat
                "inconsistent_row_count": len(inconsistent_rows),
            }

            if inconsistent_rows:
                return False, f"Inconsistent row lengths at rows: {inconsistent_rows[:5]}", metadata

            return True, "", metadata

    except Exception as e:
        return False, f"CSV validation error: {str(e)}", {}


def validate_jsonl_structure(file_path: str) -> tuple[bool, str, Dict[str, Any]]:
    """Validate JSONL file structure.

    Args:
        file_path: Path to JSONL file

    Returns:
        Tuple of (is_valid, error_message, metadata)
    """
    try:
        record_count = 0
        all_keys: set = set()
        errors = []

        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    record = json.loads(line)
                    record_count += 1
                    if isinstance(record, dict):
                        all_keys.update(record.keys())
                except json.JSONDecodeError as e:
                    errors.append(f"Line {line_num}: {str(e)}")
                    if len(errors) >= 5:
                        break

        if errors:
            return False, f"Invalid JSONL: {errors[0]}", {"error_count": len(errors)}

        metadata = {
            "record_count": record_count,
            "unique_keys": list(all_keys)[:20],  # Limit to prevent bloat
        }

        return True, "", metadata

    except Exception as e:
        return False, f"JSONL validation error: {str(e)}", {}


@register_stage
class SchemaValidationStage:
    """Stage 04: Schema Validation

    Validates file structure and schema before PHI scanning.
    """

    stage_id = 4
    stage_name = "Schema Validation"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute schema validation.

        Args:
            context: Stage execution context

        Returns:
            StageResult with validation outcome
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        errors: List[str] = []
        warnings: List[str] = []
        output: Dict[str, Any] = {}

        file_path = context.dataset_pointer

        if not file_path or not os.path.exists(file_path):
            completed_at = datetime.utcnow().isoformat() + "Z"
            return StageResult(
                stage_id=self.stage_id,
                stage_name=self.stage_name,
                status="failed",
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=0,
                errors=["No valid file path provided"],
            )

        # Detect format
        file_format = detect_format(file_path)
        output["detected_format"] = file_format
        logger.info(f"Validating {file_format} file: {file_path}")

        # Validate based on format
        is_valid = False
        error_msg = ""
        metadata: Dict[str, Any] = {}

        if file_format == "json":
            is_valid, error_msg, metadata = validate_json_structure(file_path)
        elif file_format == "csv":
            is_valid, error_msg, metadata = validate_csv_structure(file_path)
        elif file_format == "jsonl":
            is_valid, error_msg, metadata = validate_jsonl_structure(file_path)
        elif file_format in ("xml", "hl7", "fhir"):
            # Basic existence check for medical formats
            # Full validation would require specific parsers
            is_valid = True
            warnings.append(f"Limited validation for {file_format} format")
            metadata = {"format": file_format}
        elif file_format == "text":
            # Text files just need to be readable
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    sample = f.read(1024)
                is_valid = True
                metadata = {"sample_length": len(sample)}
            except UnicodeDecodeError:
                is_valid = False
                error_msg = "File is not valid UTF-8 text"
        else:
            warnings.append(f"Unknown format: {file_format}")
            is_valid = True  # Don't block on unknown formats

        if not is_valid:
            errors.append(error_msg)

        output["schema_metadata"] = metadata

        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        status = "failed" if errors else "completed"

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=output,
            errors=errors,
            warnings=warnings,
            metadata={
                "governance_mode": context.governance_mode,
                "format_validated": file_format,
            },
        )

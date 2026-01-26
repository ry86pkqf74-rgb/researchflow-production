"""
Stage 01: Upload Intake

Handles initial file upload processing including:
- File type validation
- Size limits check
- Checksum generation
- Initial metadata extraction

This stage does NOT perform PHI scanning (that's stage 05).
"""

import hashlib
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stage_01_upload")

# Allowed file extensions (safe medical data formats)
ALLOWED_EXTENSIONS = {
    ".csv", ".json", ".jsonl", ".parquet", ".txt",
    ".xml", ".hl7", ".fhir", ".cda",
}

# Maximum file size in bytes (100MB default)
MAX_FILE_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", 100 * 1024 * 1024))


def compute_checksum(file_path: str) -> str:
    """Compute SHA256 checksum of a file.

    Args:
        file_path: Path to file

    Returns:
        SHA256 hex digest
    """
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def validate_file_type(file_path: str) -> tuple[bool, str]:
    """Validate file extension is allowed.

    Args:
        file_path: Path to file

    Returns:
        Tuple of (is_valid, error_message)
    """
    _, ext = os.path.splitext(file_path.lower())
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File type '{ext}' not allowed. Allowed: {sorted(ALLOWED_EXTENSIONS)}"
    return True, ""


def validate_file_size(file_path: str) -> tuple[bool, str]:
    """Validate file is within size limits.

    Args:
        file_path: Path to file

    Returns:
        Tuple of (is_valid, error_message)
    """
    size = os.path.getsize(file_path)
    if size > MAX_FILE_SIZE:
        return False, f"File size {size} exceeds limit of {MAX_FILE_SIZE} bytes"
    if size == 0:
        return False, "File is empty"
    return True, ""


@register_stage
class UploadIntakeStage:
    """Stage 01: Upload Intake

    Validates and processes incoming file uploads.
    """

    stage_id = 1
    stage_name = "Upload Intake"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute upload intake validation.

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

        # Validate we have a file to process
        if not file_path:
            completed_at = datetime.utcnow().isoformat() + "Z"
            return StageResult(
                stage_id=self.stage_id,
                stage_name=self.stage_name,
                status="failed",
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=0,
                errors=["No dataset_pointer provided in context"],
            )

        if not os.path.exists(file_path):
            completed_at = datetime.utcnow().isoformat() + "Z"
            return StageResult(
                stage_id=self.stage_id,
                stage_name=self.stage_name,
                status="failed",
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=0,
                errors=["File does not exist at specified path"],
            )

        logger.info(f"Processing upload: {file_path}")

        # Validate file type
        type_valid, type_error = validate_file_type(file_path)
        if not type_valid:
            errors.append(type_error)

        # Validate file size
        size_valid, size_error = validate_file_size(file_path)
        if not size_valid:
            errors.append(size_error)

        # Compute checksum (only if basic validations pass)
        if type_valid and size_valid:
            try:
                checksum = compute_checksum(file_path)
                output["checksum"] = checksum
                output["checksum_algorithm"] = "sha256"
                logger.info(f"Checksum computed: {checksum[:12]}...")
            except Exception as e:
                errors.append(f"Failed to compute checksum: {str(e)}")

        # Extract basic metadata
        try:
            stat = os.stat(file_path)
            output["file_size_bytes"] = stat.st_size
            output["file_name"] = os.path.basename(file_path)
            output["file_extension"] = os.path.splitext(file_path)[1].lower()
            output["modified_time"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
        except Exception as e:
            warnings.append(f"Failed to extract metadata: {str(e)}")

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
            },
        )

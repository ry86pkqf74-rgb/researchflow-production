"""Manifest validation for manuscript artifacts.

Ensures all artifacts in a manifest are valid before publishing:
- Schema validation
- File existence check
- Hash verification
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Shared artifacts volume path
ARTIFACTS_BASE = os.getenv("ARTIFACTS_PATH", "/data/artifacts")


@dataclass
class ManifestValidationError:
    """Error found during manifest validation."""
    artifact_id: str
    error_type: str  # MISSING_FILE, HASH_MISMATCH, INVALID_SCHEMA, MISSING_REQUIRED_FIELD
    details: str


# Required fields for each artifact kind
REQUIRED_FIELDS = {
    "figure": ["id", "manuscriptId", "kind", "format", "name", "path", "contentHash"],
    "table": ["id", "manuscriptId", "kind", "format", "name", "path", "contentHash"],
    "export": ["id", "manuscriptId", "kind", "format", "name", "path", "contentHash", "sizeBytes"],
    "supplement": ["id", "manuscriptId", "kind", "format", "name", "path", "contentHash"],
    "data": ["id", "manuscriptId", "kind", "format", "name", "path", "contentHash"],
    "code": ["id", "manuscriptId", "kind", "format", "name", "path", "contentHash"],
    "bundle": ["id", "manuscriptId", "kind", "format", "name", "path", "contentHash", "sizeBytes"],
}

VALID_KINDS = ["figure", "table", "export", "supplement", "data", "code", "bundle"]
VALID_FORMATS = ["png", "svg", "pdf", "csv", "json", "docx", "latex", "html", "zip", "plotly_json"]


def calculate_file_hash(file_path: str) -> str:
    """Calculate SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def validate_artifact_schema(artifact: Dict[str, Any]) -> List[ManifestValidationError]:
    """Validate artifact has required fields and valid values."""
    errors = []
    artifact_id = artifact.get("id", "unknown")

    # Check kind
    kind = artifact.get("kind")
    if not kind:
        errors.append(ManifestValidationError(
            artifact_id=artifact_id,
            error_type="MISSING_REQUIRED_FIELD",
            details="Missing required field: kind",
        ))
        return errors

    if kind not in VALID_KINDS:
        errors.append(ManifestValidationError(
            artifact_id=artifact_id,
            error_type="INVALID_SCHEMA",
            details=f"Invalid kind '{kind}'. Must be one of: {VALID_KINDS}",
        ))

    # Check format
    format_val = artifact.get("format")
    if format_val and format_val not in VALID_FORMATS:
        errors.append(ManifestValidationError(
            artifact_id=artifact_id,
            error_type="INVALID_SCHEMA",
            details=f"Invalid format '{format_val}'. Must be one of: {VALID_FORMATS}",
        ))

    # Check required fields for this kind
    required = REQUIRED_FIELDS.get(kind, REQUIRED_FIELDS["figure"])
    for field in required:
        if field not in artifact or artifact[field] is None:
            errors.append(ManifestValidationError(
                artifact_id=artifact_id,
                error_type="MISSING_REQUIRED_FIELD",
                details=f"Missing required field: {field}",
            ))

    return errors


def validate_artifact_exists(artifact: Dict[str, Any]) -> Optional[ManifestValidationError]:
    """Check if artifact file exists on disk."""
    artifact_id = artifact.get("id", "unknown")
    path = artifact.get("path")

    if not path:
        return ManifestValidationError(
            artifact_id=artifact_id,
            error_type="MISSING_REQUIRED_FIELD",
            details="Missing path field",
        )

    # Handle relative and absolute paths
    if not os.path.isabs(path):
        full_path = os.path.join(ARTIFACTS_BASE, path)
    else:
        full_path = path

    if not os.path.exists(full_path):
        return ManifestValidationError(
            artifact_id=artifact_id,
            error_type="MISSING_FILE",
            details=f"File not found: {path}",
        )

    return None


def validate_artifact_hash(artifact: Dict[str, Any]) -> Optional[ManifestValidationError]:
    """Verify artifact file hash matches manifest."""
    artifact_id = artifact.get("id", "unknown")
    path = artifact.get("path")
    expected_hash = artifact.get("contentHash")

    if not path or not expected_hash:
        return None  # Can't validate without both

    # Handle relative and absolute paths
    if not os.path.isabs(path):
        full_path = os.path.join(ARTIFACTS_BASE, path)
    else:
        full_path = path

    if not os.path.exists(full_path):
        return None  # Already caught by exists check

    try:
        actual_hash = calculate_file_hash(full_path)

        if actual_hash != expected_hash:
            return ManifestValidationError(
                artifact_id=artifact_id,
                error_type="HASH_MISMATCH",
                details=f"Hash mismatch. Expected: {expected_hash[:16]}..., Got: {actual_hash[:16]}...",
            )
    except Exception as e:
        return ManifestValidationError(
            artifact_id=artifact_id,
            error_type="HASH_MISMATCH",
            details=f"Could not calculate hash: {str(e)}",
        )

    return None


def validate_manifest(manifest: Dict[str, Any]) -> Dict[str, Any]:
    """Validate a complete manuscript manifest.

    Args:
        manifest: Manifest dict with manuscriptId, version, artifacts list

    Returns:
        Validation result with valid boolean and errors list
    """
    errors: List[ManifestValidationError] = []

    # Check required manifest fields
    if "manuscriptId" not in manifest:
        errors.append(ManifestValidationError(
            artifact_id="manifest",
            error_type="MISSING_REQUIRED_FIELD",
            details="Manifest missing manuscriptId",
        ))

    if "artifacts" not in manifest:
        errors.append(ManifestValidationError(
            artifact_id="manifest",
            error_type="MISSING_REQUIRED_FIELD",
            details="Manifest missing artifacts array",
        ))
        return {
            "valid": False,
            "errors": [{"artifactId": e.artifact_id, "error": e.error_type, "details": e.details} for e in errors],
        }

    artifacts = manifest.get("artifacts", [])

    for artifact in artifacts:
        # Schema validation
        schema_errors = validate_artifact_schema(artifact)
        errors.extend(schema_errors)

        # Skip further validation if schema is invalid
        if schema_errors:
            continue

        # File existence check
        exists_error = validate_artifact_exists(artifact)
        if exists_error:
            errors.append(exists_error)
            continue

        # Hash verification
        hash_error = validate_artifact_hash(artifact)
        if hash_error:
            errors.append(hash_error)

    return {
        "valid": len(errors) == 0,
        "errors": [{"artifactId": e.artifact_id, "error": e.error_type, "details": e.details} for e in errors],
    }


def validate_manifest_file(manifest_path: str) -> Dict[str, Any]:
    """Validate a manifest from file path.

    Args:
        manifest_path: Path to manifest.json file

    Returns:
        Validation result
    """
    try:
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        return validate_manifest(manifest)
    except json.JSONDecodeError as e:
        return {
            "valid": False,
            "errors": [{
                "artifactId": "manifest",
                "error": "INVALID_SCHEMA",
                "details": f"Invalid JSON: {str(e)}",
            }],
        }
    except FileNotFoundError:
        return {
            "valid": False,
            "errors": [{
                "artifactId": "manifest",
                "error": "MISSING_FILE",
                "details": f"Manifest file not found: {manifest_path}",
            }],
        }

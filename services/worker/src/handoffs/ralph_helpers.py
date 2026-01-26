"""
Ralph handoff helper functions with governance and provenance.

Provides functions for creating Ralph requests and importing Ralph responses
with PHI scanning, classification gating, and provenance logging.

Governance:
- PHI_STAGING classification blocks request creation
- PHI scanning on all text fields using the central PHIDetector
- Quarantine for PHI-detected responses
- Provenance events logged for audit trail

Related:
- docs/handoffs/ai_requests/ralph/schemas/ralph_request.schema.json
- docs/handoffs/ai_requests/ralph/schemas/ralph_response.schema.json
- src/provenance/event.py
- src/validation/phi_detector.py (PHI detection patterns)
"""

import json
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from src.provenance.event import (
    Classification,
    EventType,
    ProvenanceEvent,
    RuntimeMode,
)
from src.provenance.unified import log_event
from src.validation.phi_detector import PHIDetector

# Schema version for Ralph handoffs
RALPH_SCHEMA_VERSION = "1.0.0"

# Valid roles for Ralph requests/responses
VALID_ROLES = {"Research", "Code", "Governance"}

# Base paths for Ralph handoff files
RALPH_BASE_PATH = Path("docs/handoffs/ai_requests/ralph")
RALPH_QUEUE_PATH = RALPH_BASE_PATH / "queue"
RALPH_RESPONSES_PATH = RALPH_BASE_PATH / "responses"
RALPH_QUARANTINE_PATH = RALPH_BASE_PATH / "quarantine"


class RalphHandoffError(Exception):
    """Base exception for Ralph handoff operations."""

    pass


class PHIStagingBlockedError(RalphHandoffError):
    """Raised when request creation is blocked due to PHI_STAGING classification."""

    pass


class PHIDetectedError(RalphHandoffError):
    """Raised when PHI is detected in content."""

    pass


class SchemaValidationError(RalphHandoffError):
    """Raised when schema validation fails."""

    pass


def _get_git_sha() -> str:
    """
    Get current git commit SHA.

    Returns:
        Short git SHA (7 characters) or 'unknown' if not in a git repo.
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short=7", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        # Git may be unavailable (e.g., in packaged distributions or CI images);
        # fall through and return "unknown" rather than failing the handoff.
        pass
    return "unknown"


# Module-level PHIDetector instance for reuse
_phi_detector: Optional[PHIDetector] = None


def _get_phi_detector() -> PHIDetector:
    """Get or create the shared PHIDetector instance."""
    global _phi_detector
    if _phi_detector is None:
        _phi_detector = PHIDetector()
    return _phi_detector


def _scan_for_phi_patterns(text: str) -> Dict[str, Any]:
    """
    Scan text for PHI patterns using the central PHIDetector.

    Uses the same PHI detection patterns as src/validation/phi_detector.py
    to ensure consistency across the codebase.

    Args:
        text: Text to scan for PHI patterns.

    Returns:
        Dict with keys:
            - scanned: True
            - phi_detected: bool
            - patterns_detected: list of pattern type names found
    """
    if not text or not isinstance(text, str):
        return {"scanned": True, "phi_detected": False, "patterns_detected": []}

    detector = _get_phi_detector()
    detections = detector.scan_value(text)

    # Convert PHIType enums to string names for the result
    patterns_detected = list({phi_type.name.lower() for phi_type, _ in detections})

    return {
        "scanned": True,
        "phi_detected": len(patterns_detected) > 0,
        "patterns_detected": patterns_detected,
    }


def _validate_role(role: str) -> None:
    """Validate role is one of the allowed values."""
    if role not in VALID_ROLES:
        raise SchemaValidationError(
            f"Invalid role '{role}'. Must be one of: {', '.join(sorted(VALID_ROLES))}"
        )


def _validate_intent(intent: str) -> None:
    """Validate intent string meets requirements."""
    if not intent or not isinstance(intent, str):
        raise SchemaValidationError("Intent must be a non-empty string")
    if len(intent) > 100:
        raise SchemaValidationError("Intent must be 100 characters or fewer")


def _classification_from_string(classification: str) -> Classification:
    """Convert classification string to Classification enum."""
    mapping = {
        "public": Classification.PUBLIC,
        "internal": Classification.INTERNAL,
        "confidential": Classification.CONFIDENTIAL,
        "phi": Classification.PHI,
        "phi_staging": Classification.PHI_STAGING,
        "unknown": Classification.UNKNOWN,
    }
    return mapping.get(classification.lower(), Classification.UNKNOWN)


def _mode_from_string(mode: str) -> RuntimeMode:
    """Convert mode string to RuntimeMode enum."""
    mapping = {
        "online": RuntimeMode.ONLINE,
        "offline": RuntimeMode.OFFLINE,
        "test": RuntimeMode.TEST,
        "unknown": RuntimeMode.UNKNOWN,
    }
    return mapping.get(mode.lower(), RuntimeMode.UNKNOWN)


def create_ralph_request(
    role: str,
    intent: str,
    context_summary: str,
    attachments: Optional[List[str]] = None,
    user_id: str = "system",
    mode: str = "offline",
    classification: str = "internal",
) -> Path:
    """
    Create a Ralph handoff request with governance checks.

    Creates a JSON request file in the queue folder with:
    - Schema validation
    - PHI_STAGING classification gating (blocks if PHI_STAGING)
    - PHI scanning on context_summary
    - Provenance logging

    Args:
        role: Request role (Research, Code, or Governance)
        intent: Human-readable intent describing the request
        context_summary: Summary of context (NO PHI allowed)
        attachments: Optional list of attachment filenames (names only, no contents)
        user_id: User identifier for provenance
        mode: Runtime mode (online, offline, test, unknown)
        classification: Data classification level

    Returns:
        Path to the created request JSON file

    Raises:
        PHIStagingBlockedError: If classification is PHI_STAGING
        PHIDetectedError: If PHI is detected in context_summary
        SchemaValidationError: If schema validation fails
    """
    # Gate: Block PHI_STAGING classification
    if classification.lower() == "phi_staging":
        raise PHIStagingBlockedError(
            "Request creation blocked: PHI_STAGING classification not allowed. "
            "Data must be scrubbed to a safe classification (e.g., 'internal') "
            "before creating Ralph requests."
        )

    # Validate inputs
    _validate_role(role)
    _validate_intent(intent)

    if not context_summary or not isinstance(context_summary, str):
        raise SchemaValidationError("context_summary must be a non-empty string")

    # PHI scan on context_summary
    phi_result = _scan_for_phi_patterns(context_summary)
    if phi_result["phi_detected"]:
        raise PHIDetectedError(
            f"PHI detected in context_summary. Patterns found: {phi_result['patterns_detected']}. "
            "Remove PHI before creating Ralph requests."
        )

    # Generate request ID and timestamp
    request_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    git_sha = _get_git_sha()

    # Build request object
    request_obj = {
        "schema_version": RALPH_SCHEMA_VERSION,
        "request_id": request_id,
        "created_at": created_at,
        "role": role,
        "intent": intent,
        "context_summary": context_summary,
        "provenance": {
            "git_sha": git_sha,
            "user_id": user_id,
            "mode": mode,
            "classification": classification,
        },
    }

    if attachments:
        # Validate attachments are filenames only (no paths)
        for att in attachments:
            if "/" in att or "\\" in att:
                raise SchemaValidationError(
                    f"Attachment must be filename only, not path: {att}"
                )
        request_obj["attachments"] = attachments

    # Ensure queue directory exists
    RALPH_QUEUE_PATH.mkdir(parents=True, exist_ok=True)

    # Write request file with deterministic filename
    filename = f"ralph_request_{request_id}.json"
    file_path = RALPH_QUEUE_PATH / filename

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(request_obj, f, indent=2)

    # Log provenance event
    event = ProvenanceEvent(
        event_type=EventType.LLM_REQUEST,
        user_id=user_id,
        mode=_mode_from_string(mode),
        classification=_classification_from_string(classification),
        success=True,
        details={
            "action": "RALPH_REQUEST_CREATED",
            "request_id": request_id,
            "role": role,
            "intent": intent,
            "git_sha": git_sha,
            "file_path": str(file_path),
        },
    )
    log_event(event, user_id=user_id)

    return file_path


def import_ralph_response(
    json_blob: Dict[str, Any],
    user_id: str = "system",
) -> Dict[str, Any]:
    """
    Import and validate a Ralph handoff response.

    Validates the response schema, runs PHI scan on response text fields,
    and either stores to responses folder or quarantines if PHI detected.

    Args:
        json_blob: The response JSON as a dictionary
        user_id: User identifier for provenance

    Returns:
        Validated response dictionary with import metadata

    Raises:
        SchemaValidationError: If schema validation fails
    """
    # Validate required fields
    required_fields = [
        "schema_version",
        "request_id",
        "response_id",
        "created_at",
        "role",
        "intent",
        "response_text",
        "provenance",
    ]
    missing_fields = [f for f in required_fields if f not in json_blob]
    if missing_fields:
        raise SchemaValidationError(
            f"Missing required fields: {', '.join(missing_fields)}"
        )

    # Validate schema version
    if json_blob.get("schema_version") != RALPH_SCHEMA_VERSION:
        raise SchemaValidationError(
            f"Invalid schema_version. Expected {RALPH_SCHEMA_VERSION}, "
            f"got {json_blob.get('schema_version')}"
        )

    # Validate role
    _validate_role(json_blob["role"])

    # Validate intent
    _validate_intent(json_blob["intent"])

    # Validate provenance
    prov = json_blob.get("provenance", {})
    prov_required = ["git_sha", "user_id", "mode", "classification"]
    missing_prov = [f for f in prov_required if f not in prov]
    if missing_prov:
        raise SchemaValidationError(
            f"Missing provenance fields: {', '.join(missing_prov)}"
        )

    # Validate mode value against allowed values
    valid_modes = {"online", "offline", "test", "unknown"}
    raw_mode = prov.get("mode", "").lower()
    if raw_mode not in valid_modes:
        raise SchemaValidationError(
            f"Invalid provenance.mode '{prov.get('mode')}'. "
            f"Expected one of: {', '.join(sorted(valid_modes))}"
        )

    # Validate classification value against allowed values
    valid_classifications = {
        "public",
        "internal",
        "confidential",
        "phi",
        "phi_staging",
        "unknown",
    }
    raw_classification = prov.get("classification", "").lower()
    if raw_classification not in valid_classifications:
        raise SchemaValidationError(
            f"Invalid provenance.classification '{prov.get('classification')}'. "
            f"Expected one of: {', '.join(sorted(valid_classifications))}"
        )

    # PHI scan on response_text
    response_text = json_blob.get("response_text", "")
    phi_result = _scan_for_phi_patterns(response_text)

    # Also scan context_summary if present in response
    context_phi_result = {"phi_detected": False, "patterns_detected": []}
    if "context_summary" in json_blob:
        context_phi_result = _scan_for_phi_patterns(json_blob["context_summary"])

    # Combine PHI results
    all_phi_detected = phi_result["phi_detected"] or context_phi_result["phi_detected"]
    all_patterns = list(
        set(phi_result["patterns_detected"] + context_phi_result["patterns_detected"])
    )

    response_id = json_blob["response_id"]
    request_id = json_blob["request_id"]
    mode = prov.get("mode", "unknown")
    classification = prov.get("classification", "unknown")

    if all_phi_detected:
        # Quarantine the response
        RALPH_QUARANTINE_PATH.mkdir(parents=True, exist_ok=True)
        filename = f"ralph_response_{response_id}_quarantined.json"
        quarantine_path = RALPH_QUARANTINE_PATH / filename

        # Add quarantine metadata block with structured info for UI browser
        quarantine_obj = {
            **json_blob,
            "_quarantine_metadata": {
                "quarantined_at": datetime.now(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
                "quarantine_reason": "PHI_DETECTED",
                "detector_hits": all_patterns,
            },
        }

        with open(quarantine_path, "w", encoding="utf-8") as f:
            json.dump(quarantine_obj, f, indent=2)

        # Log provenance event for quarantine
        event = ProvenanceEvent(
            event_type=EventType.PHI_DETECTED,
            user_id=user_id,
            mode=_mode_from_string(mode),
            classification=_classification_from_string(classification),
            success=False,
            details={
                "action": "RALPH_RESPONSE_QUARANTINED",
                "response_id": response_id,
                "request_id": request_id,
                "phi_patterns_count": len(all_patterns),
                "quarantine_path": str(quarantine_path),
            },
        )
        log_event(event, user_id=user_id)

        # Return with quarantine info
        return {
            **json_blob,
            "_import_metadata": {
                "imported_at": datetime.now(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
                "phi_detected": True,
                "phi_patterns": all_patterns,
                "status": "quarantined",
                "quarantine_path": str(quarantine_path),
            },
        }

    # No PHI detected - store to responses folder
    RALPH_RESPONSES_PATH.mkdir(parents=True, exist_ok=True)
    filename = f"ralph_response_{response_id}.json"
    response_path = RALPH_RESPONSES_PATH / filename

    with open(response_path, "w", encoding="utf-8") as f:
        json.dump(json_blob, f, indent=2)

    # Log provenance event for successful import
    event = ProvenanceEvent(
        event_type=EventType.LLM_RESPONSE,
        user_id=user_id,
        mode=_mode_from_string(mode),
        classification=_classification_from_string(classification),
        success=True,
        details={
            "action": "RALPH_RESPONSE_IMPORTED",
            "response_id": response_id,
            "request_id": request_id,
            "role": json_blob["role"],
            "intent": json_blob["intent"],
            "file_path": str(response_path),
        },
    )
    log_event(event, user_id=user_id)

    return {
        **json_blob,
        "_import_metadata": {
            "imported_at": datetime.now(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
            "phi_detected": False,
            "status": "imported",
            "file_path": str(response_path),
        },
    }

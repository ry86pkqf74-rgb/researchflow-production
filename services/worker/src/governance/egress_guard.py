"""Egress guard for online AI endpoints - prevents raw data/PHI transmission.

This module implements egress controls for optional online AI capabilities,
ensuring that ONLY downstream artifacts (manuscript prose, captions, summaries)
can be transmitted, while raw datasets remain local-only.

Design Principles:
- Fail-closed: reject anything suspicious
- No raw data egress: DataFrames, bytes, file paths under data/raw or data/restricted
- PHI-safe: scan outgoing text for PHI patterns, refuse transmission if detected
- Metadata-only: only dict/list/str payloads allowed, no complex objects

Usage:
    from src.governance.egress_guard import (
        assert_no_raw_data,
        assert_phi_safe_text,
        sanitize_for_egress
    )

    # Before sending to online AI
    payload = {"title": "Study Title", "abstract": "..."}
    sanitized = sanitize_for_egress(payload)  # Returns JSON string

    # Or manual checks
    assert_no_raw_data(some_object)
    assert_phi_safe_text(some_text)

Governance Reference: docs/governance/CAPABILITIES.md
"""

import json
import logging
from typing import Any, Dict, List, Union
import io

# Import PHI patterns from validation module
from src.validation.phi_patterns import PHI_PATTERNS

logger = logging.getLogger(__name__)


class EgressBlockedError(Exception):
    """Exception raised when egress guard blocks data transmission.

    This exception is raised when:
    - Raw data (DataFrame, bytes, file-like) is detected
    - Paths to restricted data directories are detected
    - PHI patterns are detected in outgoing text
    - Payload contains non-serializable or risky objects

    Attributes:
        message: Human-readable error description
        reason_code: Machine-readable reason code
        safe_message: PHI-free message safe for logging/display
    """

    def __init__(self, message: str, reason_code: str):
        self.message = message
        self.reason_code = reason_code
        # Generate safe message without echoing any detected content
        self.safe_message = f"Egress blocked: {reason_code}"
        super().__init__(self.safe_message)

    def __str__(self) -> str:
        return self.safe_message


# =============================================================================
# RAW DATA DETECTION
# =============================================================================


def assert_no_raw_data(obj: Any) -> None:
    """Assert that object does not contain raw datasets or restricted paths.

    Blocks transmission of:
    - pandas DataFrames (raw tabular data)
    - bytes/bytearray (raw binary data)
    - file-like objects (open file handles)
    - string paths containing "/data/raw" or "/data/restricted"

    Args:
        obj: Object to check (can be dict, list, str, int, float, bool, None)

    Raises:
        EgressBlockedError: If raw data or restricted paths detected
    """
    # Check for DataFrame
    try:
        import pandas as pd

        if isinstance(obj, pd.DataFrame):
            raise EgressBlockedError(
                "Raw DataFrame detected - DataFrames must not be transmitted to online AI",
                reason_code="RAW_DATAFRAME_BLOCKED",
            )
        if isinstance(obj, pd.Series):
            raise EgressBlockedError(
                "Raw Series detected - pandas Series must not be transmitted to online AI",
                reason_code="RAW_SERIES_BLOCKED",
            )
    except ImportError:
        pass  # pandas not available, skip DataFrame check

    # Check for bytes/bytearray
    if isinstance(obj, (bytes, bytearray)):
        raise EgressBlockedError(
            "Raw bytes detected - binary data must not be transmitted to online AI",
            reason_code="RAW_BYTES_BLOCKED",
        )

    # Check for file-like objects
    if hasattr(obj, "read") and hasattr(obj, "write"):
        raise EgressBlockedError(
            "File-like object detected - file handles must not be transmitted to online AI",
            reason_code="FILE_OBJECT_BLOCKED",
        )
    if isinstance(obj, (io.IOBase, io.BufferedIOBase, io.TextIOBase)):
        raise EgressBlockedError(
            "File-like object detected - file handles must not be transmitted to online AI",
            reason_code="FILE_OBJECT_BLOCKED",
        )

    # Check for restricted path patterns in strings
    if isinstance(obj, str):
        _check_restricted_paths(obj)

    # Recursively check containers
    elif isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(key, str):
                _check_restricted_paths(key)
            assert_no_raw_data(value)

    elif isinstance(obj, (list, tuple)):
        for item in obj:
            assert_no_raw_data(item)

    # Allow primitives (int, float, bool, None)
    elif obj is None or isinstance(obj, (int, float, bool)):
        pass

    else:
        # Unknown/complex object type - fail closed
        obj_type = type(obj).__name__
        raise EgressBlockedError(
            f"Unsupported object type '{obj_type}' - only metadata (dict/list/str/int/float/bool/None) allowed",
            reason_code="UNSUPPORTED_TYPE_BLOCKED",
        )


def _check_restricted_paths(text: str) -> None:
    """Check for restricted data paths in text.

    Args:
        text: String to check

    Raises:
        EgressBlockedError: If restricted paths detected
    """
    restricted_patterns = [
        "/data/raw",
        "/data/restricted",
        "\\data\\raw",  # Windows paths
        "\\data\\restricted",
    ]

    text_lower = text.lower()
    for pattern in restricted_patterns:
        if pattern.lower() in text_lower:
            raise EgressBlockedError(
                f"Restricted data path pattern detected - paths under data/raw or data/restricted must not be transmitted",
                reason_code="RESTRICTED_PATH_BLOCKED",
            )


# =============================================================================
# PHI DETECTION IN TEXT
# =============================================================================


def assert_phi_safe_text(text: str, raise_on_detection: bool = True) -> bool:
    """Assert that text does not contain PHI patterns.

    Scans text against known PHI patterns (SSN, MRN, EMAIL, PHONE).
    Fails closed: if PHI detected, raises exception with safe message
    (does NOT echo the detected PHI in the error message).

    Args:
        text: Text to scan for PHI patterns
        raise_on_detection: If True, raise exception on PHI detection

    Returns:
        True if text is PHI-safe, False if PHI detected (when raise_on_detection=False)

    Raises:
        EgressBlockedError: If PHI patterns detected (when raise_on_detection=True)
    """
    if not isinstance(text, str):
        raise ValueError("assert_phi_safe_text requires string input")

    # Scan against each PHI pattern
    detected_types = []
    for pattern_name, pattern_regex in PHI_PATTERNS:
        matches = pattern_regex.findall(text)
        if matches:
            detected_types.append(pattern_name)
            logger.warning(
                f"PHI pattern detected in egress text: type={pattern_name}, count={len(matches)}"
            )

    if detected_types:
        if raise_on_detection:
            # CRITICAL: Do NOT echo detected PHI in error message
            raise EgressBlockedError(
                f"PHI patterns detected in outgoing text (types: {', '.join(detected_types)}) - transmission blocked",
                reason_code="PHI_DETECTED_IN_TEXT",
            )
        else:
            return False

    return True


# =============================================================================
# PAYLOAD SANITIZATION
# =============================================================================


def sanitize_for_egress(
    payload: Union[Dict, List, str, int, float, bool, None], max_depth: int = 10
) -> str:
    """Sanitize and serialize payload for egress to online AI.

    Performs comprehensive checks:
    1. No raw data (DataFrames, bytes, file-like objects)
    2. No restricted paths (data/raw, data/restricted)
    3. No PHI patterns in text
    4. Only metadata types allowed (dict/list/str/int/float/bool/None)

    Args:
        payload: Metadata payload to sanitize (must be JSON-serializable)
        max_depth: Maximum recursion depth (prevents cyclic references)

    Returns:
        JSON string of sanitized payload

    Raises:
        EgressBlockedError: If any egress check fails (including when payload is not JSON-serializable)
    """
    if max_depth <= 0:
        raise EgressBlockedError(
            "Maximum recursion depth exceeded - possible cyclic reference",
            reason_code="MAX_DEPTH_EXCEEDED",
        )

    # Check 1: No raw data or restricted paths
    assert_no_raw_data(payload)

    # Check 2: Scan all text fields for PHI
    _scan_payload_for_phi(payload, max_depth)

    # Check 3: Ensure JSON-serializable
    try:
        json_str = json.dumps(payload, ensure_ascii=False, indent=None)
    except (TypeError, ValueError):
        raise EgressBlockedError(
            "Payload not JSON-serializable", reason_code="NOT_JSON_SERIALIZABLE"
        )

    logger.info(
        f"Egress payload sanitized: size={len(json_str)} bytes, "
        f"passed raw_data_check=True, phi_check=True"
    )

    return json_str


def _scan_payload_for_phi(payload: Any, max_depth: int) -> None:
    """Recursively scan payload for PHI in text fields.

    Args:
        payload: Payload to scan
        max_depth: Remaining recursion depth

    Raises:
        EgressBlockedError: If PHI detected
    """
    if max_depth <= 0:
        return

    if isinstance(payload, str):
        # Scan string for PHI
        assert_phi_safe_text(payload, raise_on_detection=True)

    elif isinstance(payload, dict):
        for key, value in payload.items():
            if isinstance(key, str):
                assert_phi_safe_text(key, raise_on_detection=True)
            _scan_payload_for_phi(value, max_depth - 1)

    elif isinstance(payload, (list, tuple)):
        for item in payload:
            _scan_payload_for_phi(item, max_depth - 1)

    # Primitives (int, float, bool, None) don't need PHI scanning


# =============================================================================
# ADMISSIBILITY-AWARE EGRESS
# =============================================================================


def assert_admissibility_allows_egress(admissibility: str) -> None:
    """Assert that data admissibility category allows online AI egress.

    ALLOWED for online AI (downstream artifacts only):
    - TEMPLATE: Template/fixture data
    - VERIFIED_SCRUBBED: De-identified data

    BLOCKED (raw data must stay local):
    - Any raw dataset context
    - Paths under data/raw or data/restricted

    Args:
        admissibility: Data admissibility category string

    Raises:
        EgressBlockedError: If admissibility does not allow online AI egress
    """
    allowed_categories = {"TEMPLATE", "VERIFIED_SCRUBBED"}

    admissibility_upper = admissibility.upper().strip()

    if admissibility_upper not in allowed_categories:
        raise EgressBlockedError(
            f"Data admissibility '{admissibility}' not allowed for online AI egress - "
            f"only TEMPLATE or VERIFIED_SCRUBBED artifacts permitted",
            reason_code="ADMISSIBILITY_NOT_ALLOWED",
        )

    logger.info(
        f"Admissibility check passed: {admissibility_upper} allows online AI egress"
    )


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================


def validate_egress_payload(
    payload: Union[Dict, List, str],
    admissibility: str,
    capability_enabled: bool = False,
) -> str:
    """All-in-one egress validation: capability, admissibility, and sanitization.

    Args:
        payload: Payload to validate and sanitize
        admissibility: Data admissibility category
        capability_enabled: Whether allow_online_ai_downstream capability is enabled

    Returns:
        JSON string of sanitized payload

    Raises:
        EgressBlockedError: If any validation fails
    """
    # Check 1: Capability must be enabled
    if not capability_enabled:
        raise EgressBlockedError(
            "Online AI capability not enabled - set ALLOW_ONLINE_AI_DOWNSTREAM=1 with governance approval",
            reason_code="CAPABILITY_DISABLED",
        )

    # Check 2: Admissibility must allow egress
    assert_admissibility_allows_egress(admissibility)

    # Check 3: Sanitize payload
    return sanitize_for_egress(payload)


# =============================================================================
# TESTING/DEBUG UTILITIES
# =============================================================================


def is_egress_safe(obj: Any) -> bool:
    """Check if object is safe for egress without raising exceptions.

    Convenience function for testing/debugging.

    Args:
        obj: Object to check

    Returns:
        True if object passes all egress checks, False otherwise
    """
    try:
        assert_no_raw_data(obj)
        _scan_payload_for_phi(obj, max_depth=10)
        return True
    except EgressBlockedError:
        return False

"""
Sentinel Verification for Simulated-Real Mode (PR46)

This module provides detection and verification of synthetic PHI test sentinels
in uploaded files. Sentinels ensure that only explicitly marked test data can
be uploaded in test mode.

Governance Reference: docs/plans/PR46_SIMULATED_REAL_MODE.md

Sentinel Formats:
- CSV: First line exactly "# SYNTHETIC_PHI_TEST_ONLY"
- XLSX: Sheet named "_SYNTHETIC_SENTINEL" with A1 == "SYNTHETIC_PHI_TEST_ONLY"

Design Principles:
- Offline-first: No network calls
- No PHI leakage: No logging of content/values
- Fail-closed: Return False on any ambiguity
- Deterministic: No timestamps or random values
"""

from typing import Literal
import io


class SentinelVerificationError(ValueError):
    """Raised when sentinel verification encounters an error."""

    pass


def detect_format_from_bytes(content: bytes) -> Literal["csv", "xlsx"]:
    """
    Detect file format from byte content.

    Args:
        content: Raw file bytes

    Returns:
        "csv" or "xlsx"

    Raises:
        SentinelVerificationError: If format cannot be determined
    """
    if not content:
        raise SentinelVerificationError("Empty content - cannot detect format")

    # XLSX files start with PK (ZIP magic bytes: 0x504B)
    if content[:2] == b"PK":
        return "xlsx"

    # CSV detection: assume text-based if not XLSX
    # Check if content starts with valid text markers (UTF-8, UTF-8 BOM, ASCII)
    try:
        # Try to decode first 100 bytes as UTF-8 to verify it's text
        sample = content[:100]
        _ = sample.decode("utf-8", errors="strict")
        return "csv"
    except UnicodeDecodeError:
        raise SentinelVerificationError("Cannot detect format - not XLSX or valid text")


def verify_csv_sentinel(content: bytes) -> bool:
    """
    Verify CSV sentinel: first line exactly "# SYNTHETIC_PHI_TEST_ONLY".

    Args:
        content: Raw CSV file bytes

    Returns:
        True if sentinel is present and correct, False otherwise
    """
    if not content:
        return False

    try:
        # Handle potential BOM (UTF-8 BOM: EF BB BF)
        if content.startswith(b"\xef\xbb\xbf"):
            content = content[3:]

        # Decode to string (UTF-8)
        text = content.decode("utf-8", errors="strict")

        # Get first line
        first_line = text.split("\n")[0].rstrip("\r")

        # Check exact match
        return first_line == "# SYNTHETIC_PHI_TEST_ONLY"

    except (UnicodeDecodeError, IndexError):
        # Fail closed on any decoding or parsing error
        return False


def verify_xlsx_sentinel(content: bytes) -> bool:
    """
    Verify XLSX sentinel: sheet "_SYNTHETIC_SENTINEL" with A1 == "SYNTHETIC_PHI_TEST_ONLY".

    Args:
        content: Raw XLSX file bytes

    Returns:
        True if sentinel is present and correct, False otherwise
    """
    if not content:
        return False

    try:
        # Import openpyxl only when needed (optional dependency)
        import openpyxl
    except ImportError:
        raise SentinelVerificationError(
            "openpyxl required for XLSX sentinel verification. "
            "Install with: pip install openpyxl"
        )

    try:
        # Load workbook from bytes (in-memory, no file writes)
        workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True)

        # Check if sentinel sheet exists
        if "_SYNTHETIC_SENTINEL" not in workbook.sheetnames:
            return False

        # Get sentinel sheet
        sentinel_sheet = workbook["_SYNTHETIC_SENTINEL"]

        # Check A1 cell value
        a1_value = sentinel_sheet["A1"].value

        # Check exact match
        return a1_value == "SYNTHETIC_PHI_TEST_ONLY"

    except Exception:
        # Fail closed on any openpyxl error (corrupt file, invalid format, etc.)
        return False


def verify_synthetic_sentinel(content: bytes) -> bool:
    """
    Dispatch sentinel verification based on detected file format.

    This is the main entry point for sentinel verification.

    Args:
        content: Raw file bytes

    Returns:
        True if sentinel is present and correct, False otherwise

    Raises:
        SentinelVerificationError: If format cannot be determined or dependencies missing
    """
    file_format = detect_format_from_bytes(content)

    if file_format == "csv":
        return verify_csv_sentinel(content)
    elif file_format == "xlsx":
        return verify_xlsx_sentinel(content)
    else:
        raise SentinelVerificationError(f"Unsupported format: {file_format}")

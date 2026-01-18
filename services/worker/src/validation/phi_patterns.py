"""src.validation.phi_patterns

Central PHI regex patterns with explicit *tiers*.

Why tiers exist
--------------
Different surfaces in ROS have different false-positive tolerance:

* Upload / egress gating must be **high-confidence** to avoid blocking safe
    synthetic fixtures and routine text.
* Output/export guards may be **stricter** (fail-closed) because a false
    positive is less harmful than leaking PHI.

Public contract (important)
---------------------------
* ``PHI_PATTERNS`` is the repository-wide **HIGH-confidence** set and is
    intentionally limited to the original 4 patterns:
    {SSN, EMAIL, PHONE, MRN}

* ``PHI_PATTERNS_OUTPUT_GUARD`` is a stricter set used by output/export guards
    that also includes DATE, ZIP+4, and IPv4 address patterns.

Used by (non-exhaustive)
------------------------
* src.governance.egress_guard (uses PHI_PATTERNS)
* web_frontend.phi_scan (uses PHI_PATTERNS)
* src.governance.output_phi_guard (uses PHI_PATTERNS_OUTPUT_GUARD)
* src.simulated_real.scrubber (uses PHI_PATTERNS)

Last Updated: 2026-01-14
"""

import re
from typing import List, Tuple


# ---------------------------------------------------------------------------
# Tier 1: HIGH-confidence patterns (upload + egress safe)
# ---------------------------------------------------------------------------

PHI_PATTERNS_HIGH_CONFIDENCE: List[Tuple[str, re.Pattern]] = [
    # SSN: strict format ###-##-####
    ("SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    # Email: standard format
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    # US Phone: various formats (with separators)
    ("PHONE", re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b")),
    # MRN-like: explicit MRN prefix followed by digits
    ("MRN", re.compile(r"\bMRN[-:\s]?\d{5,}\b", re.IGNORECASE)),
]


# ---------------------------------------------------------------------------
# Tier 2: Extended patterns (output/export guarding; may false-positive)
# ---------------------------------------------------------------------------

PHI_PATTERNS_EXTENDED: List[Tuple[str, re.Pattern]] = [
    # Dates: MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY formats
    # Intentionally allows non-zero-padded month/day (e.g., "1/5/2024"), which is common in real text.
    # We do not interpret locale; date strings are treated as PHI regardless of whether the author
    # intended MM/DD or DD/MM.
    # Note: May match version numbers (e.g., "2024-01-15") - known false positive
    # Note: Does not validate day/month combinations (e.g., "02/31/2024" may match)
    (
        "DATE",
        re.compile(
            r"\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12][0-9]|3[01])[/-](19|20)\d{2}\b|"
            r"\b(19|20)\d{2}[/-](0?[1-9]|1[0-2])[/-](0?[1-9]|[12][0-9]|3[01])\b"
        ),
    ),
    # ZIP+4: 9-digit ZIP codes (PHI per HIPAA; 5-digit ZIP is NOT PHI)
    ("ZIP_PLUS_4", re.compile(r"\b\d{5}-\d{4}\b")),
    # IP Address: IPv4 format (HIPAA identifier)
    # Note: May match legitimate network refs in technical logs - known false positive
    (
        "IP_ADDRESS",
        re.compile(
            r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}"
            r"(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b"
        ),
    ),
]


# Backwards-compatible alias used across the repo for upload/egress gating.
PHI_PATTERNS: List[Tuple[str, re.Pattern]] = PHI_PATTERNS_HIGH_CONFIDENCE

# Stricter set for output/export contexts.
PHI_PATTERNS_OUTPUT_GUARD: List[Tuple[str, re.Pattern]] = (
    PHI_PATTERNS_HIGH_CONFIDENCE + PHI_PATTERNS_EXTENDED
)

for patterns in (PHI_PATTERNS_HIGH_CONFIDENCE, PHI_PATTERNS_EXTENDED):
    for pattern_name, pattern_regex in patterns:
        if not isinstance(pattern_regex, re.Pattern):
            raise TypeError(
                f"PHI pattern {pattern_name} must be a compiled regex Pattern"
            )

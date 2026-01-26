"""PHI-safe output guard: scan, redact, and fail-closed enforcement.

This module provides high-confidence PHI detection for LLM-generated text outputs,
dashboard exports, QA reports, and log file exports. It enforces the repository's
"zero tolerance for PHI leakage" governance posture.

Pattern Source:
- Imports centralized patterns from src.validation.phi_patterns
- Covers 7 HIPAA Safe Harbor identifier categories (SSN, EMAIL, PHONE, MRN,
  DATE, ZIP_PLUS_4, IP_ADDRESS)

Modes:
- fail_closed=True (default): Raises RuntimeError if PHI detected
  * Use for: Production exports, QA reports, AI outputs, log exports
  * Behavior: Blocks execution immediately on detection

- fail_closed=False: Returns redacted text with findings
  * Use for: Testing/development contexts ONLY
  * NEVER use in production (see docs/governance/PHI_BOUNDARIES.md)

Governance Alignment:
- Fail-closed by default (offline-first, no "helpful" fallbacks)
- Audit trail uses SHA256 hashes (never stores raw PHI)
- Documented in docs/governance/PHI_BOUNDARIES.md

Last Updated: 2026-01-14
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from src.validation.phi_patterns import PHI_PATTERNS_OUTPUT_GUARD


def _hash_snippet(s: str) -> str:
    """Hash a PHI match for audit trail without storing raw value."""
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:12]


@dataclass(frozen=True)
class PHIFinding:
    """Represents a PHI detection finding with count and hashed example."""

    kind: str
    count: int
    example_hash: str


def scan_text_high_confidence(text: str) -> list[PHIFinding]:
    """Scan text for high-confidence PHI patterns.

    Args:
        text: Text to scan for PHI

    Returns:
        List of PHIFinding objects, one per detected pattern type
    """
    findings: list[PHIFinding] = []
    for pattern_name, pattern_regex in PHI_PATTERNS_OUTPUT_GUARD:
        matches = list(pattern_regex.finditer(text))
        if matches:
            ex = matches[0].group(0)
            findings.append(
                PHIFinding(
                    kind=pattern_name.lower(),
                    count=len(matches),
                    example_hash=_hash_snippet(ex),
                )
            )
    return findings


def redact_text(text: str) -> str:
    """Redact all high-confidence PHI patterns from text.

    Args:
        text: Text to redact

    Returns:
        Text with PHI replaced by [REDACTED:<kind>] markers
    """
    redacted = text
    for pattern_name, pattern_regex in PHI_PATTERNS_OUTPUT_GUARD:
        redacted = pattern_regex.sub(f"[REDACTED:{pattern_name.lower()}]", redacted)
    return redacted


def guard_text(text: str, *, fail_closed: bool = True) -> tuple[str, list[PHIFinding]]:
    """Guard text output against PHI leakage.

    This is the primary interface for PHI detection in text outputs. Uses centralized
    patterns from src.validation.phi_patterns for consistency across the repository.

    Args:
        text: Text to guard
        fail_closed: If True (DEFAULT), raise error on PHI detection;
                    if False, return redacted text.
                    IMPORTANT: fail_closed=False is for testing/development ONLY.
                    Production use MUST use fail_closed=True (default).

    Returns:
        Tuple of (cleaned_text, findings)
        - cleaned_text: Original text if no PHI; redacted text if fail_closed=False
        - findings: List of PHIFinding objects (empty if no PHI detected)

    Raises:
        RuntimeError: If fail_closed=True (default) and PHI detected.
                     Error message: "High-confidence PHI detected in text output..."

    Examples:
        # Fail-closed (default) - raises RuntimeError on PHI detection
        >>> guard_text("Patient SSN: 123-45-6789")
        RuntimeError: High-confidence PHI detected in text output...

        # Explicit fail-closed
        >>> guard_text("Contact: admin@hospital.org", fail_closed=True)
        RuntimeError: High-confidence PHI detected in text output...

        # Fail-open (testing/development ONLY) - returns redacted text
        >>> text, findings = guard_text("SSN: 123-45-6789", fail_closed=False)
        >>> print(text)
        "SSN: [REDACTED:ssn]"
        >>> print(findings[0].kind)
        "ssn"

        # Clean text passes through unchanged
        >>> text, findings = guard_text("Patient presented with nodule")
        >>> print(text)
        "Patient presented with nodule"
        >>> print(len(findings))
        0

    Governance Note:
        See docs/governance/PHI_BOUNDARIES.md for fail-closed policy and pattern
        maintenance procedures. fail_closed=False must NEVER be used in production.
    """
    findings = scan_text_high_confidence(text)
    if findings and fail_closed:
        raise RuntimeError(
            "High-confidence PHI detected in text output. "
            "Refuse to display/export until removed."
        )
    return redact_text(text) if findings else text, findings

"""
PHI guard for IRB drafts.

This is intentionally conservative and uses simple pattern matching.
It is designed to prevent obvious PHI/PII from being stored or exported.

Now consolidated onto central patterns from validation.phi_patterns.
"""

from __future__ import annotations

from typing import List, Tuple
import re

from src.validation.phi_patterns import PHI_PATTERNS_HIGH_CONFIDENCE


def contains_phi(
    text: str,
    patterns: List[Tuple[str, re.Pattern]] = PHI_PATTERNS_HIGH_CONFIDENCE,
) -> bool:
    """Check if text contains any PHI patterns.

    Uses high-confidence patterns by default to minimize false positives.
    """
    for _name, regex in patterns:
        if regex.search(text):
            return True
    return False


def redact_phi(
    text: str,
    patterns: List[Tuple[str, re.Pattern]] = PHI_PATTERNS_HIGH_CONFIDENCE,
) -> str:
    """Redact PHI from text using category-specific markers.

    Returns text with PHI replaced by [REDACTED:<category>] markers.
    """
    redacted = text
    for name, regex in patterns:
        redacted = regex.sub(f"[REDACTED:{name}]", redacted)
    return redacted

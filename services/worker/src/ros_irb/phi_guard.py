"""
PHI guard for IRB drafts.

This is intentionally conservative and uses simple pattern matching.
It is designed to prevent obvious PHI/PII from being stored or exported.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Pattern


@dataclass(frozen=True)
class PHIPattern:
    name: str
    pattern: Pattern[str]


DEFAULT_PATTERNS: Iterable[PHIPattern] = [
    PHIPattern("email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    PHIPattern("phone", re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")),
    PHIPattern("ssn", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    # Conservative DOB-like: YYYY-MM-DD
    PHIPattern("date", re.compile(r"\b\d{4}-\d{2}-\d{2}\b")),
]


def contains_phi(text: str, patterns: Iterable[PHIPattern] = DEFAULT_PATTERNS) -> bool:
    for p in patterns:
        if p.pattern.search(text):
            return True
    return False


def redact_phi(text: str, patterns: Iterable[PHIPattern] = DEFAULT_PATTERNS) -> str:
    redacted = text
    for p in patterns:
        redacted = p.pattern.sub("[REDACTED]", redacted)
    return redacted

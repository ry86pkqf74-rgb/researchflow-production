"""Document normalization layer (PR9B-2)

Converts parsed documents into normalized "document units" with metadata.
Outputs are structured for downstream synthesis (PR9B-3+).

Hard requirements:
- Metadata-only by default (raw_text is stored under .tmp/ but gated)
- Fail-closed on normalization errors
- No content exposure in provenance

Last Updated: 2026-01-09
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class NormalizedDocument:
    """Normalized document unit (metadata + optional gated text)."""

    section_count: int
    char_count: int
    page_count: Optional[int]
    token_estimate: Optional[int]
    source_format: str
    parser_name: str
    raw_text: Optional[str] = None  # Gated; only stored under .tmp/ if needed


def normalize_document(
    raw_text: str,
    *,
    char_count: int,
    page_count: Optional[int],
    source_format: str,
    parser_name: str,
    store_raw_text: bool = False,
) -> NormalizedDocument:
    """Normalize a parsed document into metadata + optional gated text."""

    # Simple section detection: paragraph-like blocks separated by double newlines
    sections = _detect_sections(raw_text)
    section_count = len(sections)

    # Token estimate: rough heuristic (chars / 4)
    token_estimate = char_count // 4 if char_count > 0 else 0

    return NormalizedDocument(
        section_count=section_count,
        char_count=char_count,
        page_count=page_count,
        token_estimate=token_estimate,
        source_format=source_format,
        parser_name=parser_name,
        raw_text=raw_text if store_raw_text else None,
    )


def _detect_sections(text: str) -> list[str]:
    """Detect sections (paragraph-like blocks) in text."""
    # Split on double newlines or more
    chunks = re.split(r"\n\s*\n+", text)
    # Filter out empty/whitespace-only chunks
    return [c.strip() for c in chunks if c.strip()]

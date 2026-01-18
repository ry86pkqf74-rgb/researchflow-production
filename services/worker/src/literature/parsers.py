"""Offline parsers for literature inputs (PR9B-2)

Best-effort, offline-only text extraction from supported formats.
Uses only stdlib + optional dependencies (no network calls).

Supported formats:
- .txt, .md: direct UTF-8 decode
- .html, .htm: stdlib html.parser (best-effort tag stripping)
- .pdf: pypdf (optional; graceful degradation if unavailable)

Hard requirements:
- Offline-only (no network calls)
- Fail-closed on unreadable/corrupt files
- No content exposure in logs/provenance

Last Updated: 2026-01-09
"""

from __future__ import annotations

import html.parser
import re
from dataclasses import dataclass
from typing import Optional


class ParserError(RuntimeError):
    """Raised when parsing fails."""


@dataclass(frozen=True)
class ParsedDocument:
    """Result of parsing a literature input."""

    raw_text: str
    char_count: int
    page_count: Optional[int]
    source_format: str
    parser_name: str


def parse_text(data: bytes, *, source_format: str) -> ParsedDocument:
    """Parse plain text or markdown (UTF-8)."""
    try:
        raw_text = data.decode("utf-8", errors="strict")
    except UnicodeDecodeError as e:
        raise ParserError("Failed to decode text as UTF-8") from e

    return ParsedDocument(
        raw_text=raw_text,
        char_count=len(raw_text),
        page_count=None,
        source_format=source_format,
        parser_name="utf8_decode",
    )


def parse_html(data: bytes) -> ParsedDocument:
    """Parse HTML (best-effort tag stripping via stdlib)."""
    try:
        html_str = data.decode("utf-8", errors="strict")
    except UnicodeDecodeError as e:
        raise ParserError("Failed to decode HTML as UTF-8") from e

    parser = _HTMLTextExtractor()
    try:
        parser.feed(html_str)
    except Exception as e:
        raise ParserError("HTML parse failed") from e

    raw_text = parser.get_text()
    return ParsedDocument(
        raw_text=raw_text,
        char_count=len(raw_text),
        page_count=None,
        source_format="html",
        parser_name="html.parser",
    )


def parse_pdf(data: bytes) -> ParsedDocument:
    """Parse PDF (best-effort extraction via pypdf if available)."""
    try:
        import pypdf
    except ImportError:
        raise ParserError(
            "pypdf is not installed; PDF parsing requires 'pypdf' package"
        )

    try:
        # Use BytesIO to avoid writing to disk
        from io import BytesIO

        reader = pypdf.PdfReader(BytesIO(data))
        page_count = len(reader.pages)

        texts: list[str] = []
        for page in reader.pages:
            try:
                texts.append(page.extract_text() or "")
            except Exception:
                # Best-effort: skip unreadable pages
                texts.append("")

        raw_text = "\n\n".join(texts)

        return ParsedDocument(
            raw_text=raw_text,
            char_count=len(raw_text),
            page_count=page_count,
            source_format="pdf",
            parser_name="pypdf",
        )

    except ParserError:
        raise
    except Exception as e:
        raise ParserError(f"Failed to parse PDF: {type(e).__name__}") from e


class _HTMLTextExtractor(html.parser.HTMLParser):
    """Minimal HTML text extractor (strips tags, preserves text)."""

    def __init__(self):
        super().__init__()
        self._texts: list[str] = []
        self._skip_depth = 0  # Track if we're inside script/style tags

    def handle_starttag(self, tag: str, attrs):
        if tag.lower() in {"script", "style"}:
            self._skip_depth += 1

    def handle_endtag(self, tag: str):
        if tag.lower() in {"script", "style"} and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str):
        if self._skip_depth == 0:
            self._texts.append(data)

    def get_text(self) -> str:
        raw = " ".join(self._texts)
        # Collapse multiple spaces/newlines
        return re.sub(r"\s+", " ", raw).strip()

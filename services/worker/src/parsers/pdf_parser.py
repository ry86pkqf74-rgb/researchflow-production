"""
PDF Parser using PyMuPDF (fitz)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Dict, Any

from .registry import ParseResult, register_parser
from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)


@register_parser('pdf')
def parse_pdf(file_path: str, fail_closed: bool = True) -> ParseResult:
    """
    Parse a PDF file and extract text content.

    Args:
        file_path: Path to PDF file
        fail_closed: If True, redact PHI from extracted text

    Returns:
        ParseResult with extracted text
    """
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(file_path)

        pages: List[Dict[str, Any]] = []
        full_text = []

        for page_num, page in enumerate(doc):
            text = page.get_text()

            # PHI guard the extracted text
            if fail_closed:
                safe_text, findings = guard_text(text, fail_closed=True)
                if findings:
                    logger.warning(f"PHI detected in PDF page {page_num + 1}")
                text = safe_text if safe_text else text

            pages.append({
                'page_number': page_num + 1,
                'text': text,
                'width': page.rect.width,
                'height': page.rect.height,
            })

            full_text.append(text)

        doc.close()

        metadata = {
            'file_path': file_path,
            'file_size': Path(file_path).stat().st_size,
            'page_count': len(pages),
            'title': doc.metadata.get('title', ''),
            'author': doc.metadata.get('author', ''),
            'subject': doc.metadata.get('subject', ''),
            'creator': doc.metadata.get('creator', ''),
        }

        return ParseResult(
            success=True,
            data={
                'pages': pages,
                'full_text': '\n\n'.join(full_text),
            },
            metadata=metadata,
            format='pdf',
            row_count=len(pages)
        )

    except ImportError:
        return ParseResult(
            success=False,
            data=None,
            metadata={'file_path': file_path},
            format='pdf',
            error="PyMuPDF (fitz) not installed. Run: pip install pymupdf"
        )
    except Exception as e:
        logger.exception(f"Error parsing PDF: {e}")
        return ParseResult(
            success=False,
            data=None,
            metadata={'file_path': file_path},
            format='pdf',
            error=str(e)
        )


def extract_pdf_tables(file_path: str) -> List[Dict[str, Any]]:
    """
    Attempt to extract tables from PDF.

    Returns list of detected tables with their content.
    """
    tables = []

    try:
        import fitz

        doc = fitz.open(file_path)

        for page_num, page in enumerate(doc):
            # Look for table-like structures
            # This is a simplified approach - full table extraction
            # would require more sophisticated algorithms

            blocks = page.get_text("dict")["blocks"]

            # Find text blocks that might be tables
            for block in blocks:
                if block.get("type") == 0:  # Text block
                    lines = block.get("lines", [])
                    if len(lines) > 2:
                        # Check if lines have similar structure
                        # (rough heuristic for tables)
                        pass

        doc.close()

    except Exception as e:
        logger.warning(f"Table extraction failed: {e}")

    return tables

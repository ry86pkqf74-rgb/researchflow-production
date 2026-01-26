"""
PDF File Parser

Parses PDF files using pdfplumber for text extraction.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from .registry import BaseParser, ParseResult

logger = logging.getLogger(__name__)


class PDFParser(BaseParser):
    """Parser for PDF files using pdfplumber."""

    @property
    def name(self) -> str:
        return "pdf"

    @property
    def supported_extensions(self) -> List[str]:
        return ["pdf"]

    @property
    def supported_mimetypes(self) -> List[str]:
        return ["application/pdf"]

    def parse(
        self,
        file_path: Path,
        max_pages: Optional[int] = None,
        extract_tables: bool = True,
        extract_images: bool = False,
        **options
    ) -> ParseResult:
        """
        Parse a PDF file.

        Args:
            file_path: Path to the PDF file
            max_pages: Maximum pages to parse (None for all)
            extract_tables: Whether to extract tables
            extract_images: Whether to extract image metadata
            **options: Additional options

        Returns:
            ParseResult with parsed data
        """
        try:
            import pdfplumber
        except ImportError:
            return ParseResult(
                success=False,
                format=self.name,
                errors=["pdfplumber not installed. Install with: pip install pdfplumber"],
            )

        try:
            with pdfplumber.open(file_path) as pdf:
                # Get metadata
                metadata = pdf.metadata or {}

                # Determine pages to process
                total_pages = len(pdf.pages)
                pages_to_process = (
                    min(max_pages, total_pages) if max_pages else total_pages
                )

                # Extract text from each page
                page_texts = []
                tables = []
                image_info = []
                warnings = []

                for i, page in enumerate(pdf.pages[:pages_to_process]):
                    try:
                        # Extract text
                        text = page.extract_text() or ""
                        page_texts.append({
                            "page_number": i + 1,
                            "text": text,
                            "char_count": len(text),
                            "width": page.width,
                            "height": page.height,
                        })

                        # Extract tables
                        if extract_tables:
                            page_tables = page.extract_tables()
                            for j, table in enumerate(page_tables):
                                if table:
                                    tables.append({
                                        "page_number": i + 1,
                                        "table_index": j,
                                        "rows": len(table),
                                        "cols": len(table[0]) if table else 0,
                                        "data": table[:100],  # Limit table rows
                                    })

                        # Extract image metadata
                        if extract_images and hasattr(page, "images"):
                            for img in page.images:
                                image_info.append({
                                    "page_number": i + 1,
                                    "x0": img.get("x0"),
                                    "y0": img.get("y0"),
                                    "x1": img.get("x1"),
                                    "y1": img.get("y1"),
                                    "width": img.get("width"),
                                    "height": img.get("height"),
                                })

                    except Exception as e:
                        warnings.append(f"Error processing page {i + 1}: {str(e)}")
                        logger.warning(f"Error processing page {i + 1}: {e}")

                # Combine all text
                full_text = "\n\n".join(
                    f"--- Page {p['page_number']} ---\n{p['text']}"
                    for p in page_texts
                )

                return ParseResult(
                    success=True,
                    format=self.name,
                    record_count=pages_to_process,
                    columns=["page_number", "text", "char_count"],
                    schema={
                        "pages": {
                            "type": "array",
                            "items": {
                                "page_number": "integer",
                                "text": "string",
                                "char_count": "integer",
                            }
                        },
                        "tables": {
                            "type": "array",
                            "items": {
                                "page_number": "integer",
                                "rows": "integer",
                                "cols": "integer",
                            }
                        }
                    },
                    data={
                        "pages": page_texts,
                        "tables": tables if extract_tables else [],
                        "images": image_info if extract_images else [],
                    },
                    text_content=full_text,
                    metadata={
                        "total_pages": total_pages,
                        "pages_processed": pages_to_process,
                        "total_chars": sum(p["char_count"] for p in page_texts),
                        "total_tables": len(tables),
                        "total_images": len(image_info),
                        "pdf_metadata": self._clean_metadata(metadata),
                    },
                    warnings=warnings,
                )

        except Exception as e:
            logger.exception(f"Error parsing PDF file: {e}")
            return ParseResult(
                success=False,
                format=self.name,
                errors=[str(e)],
            )

    def _clean_metadata(self, metadata: Dict) -> Dict:
        """Clean PDF metadata for JSON serialization."""
        cleaned = {}
        for key, value in metadata.items():
            if value is None:
                continue
            # Remove leading slash from key names
            clean_key = key.lstrip('/')
            # Handle datetime objects
            if hasattr(value, 'isoformat'):
                cleaned[clean_key] = value.isoformat()
            elif isinstance(value, bytes):
                cleaned[clean_key] = value.decode('utf-8', errors='replace')
            elif isinstance(value, (str, int, float, bool)):
                cleaned[clean_key] = value
            else:
                cleaned[clean_key] = str(value)
        return cleaned


class PDFTextExtractor:
    """Utility class for PDF text extraction."""

    def __init__(self):
        self.parser = PDFParser()

    def extract_text(
        self,
        file_path: Path,
        max_pages: Optional[int] = None,
    ) -> str:
        """
        Extract all text from a PDF file.

        Args:
            file_path: Path to the PDF file
            max_pages: Maximum pages to process

        Returns:
            Extracted text content
        """
        result = self.parser.parse(
            file_path,
            max_pages=max_pages,
            extract_tables=False,
            extract_images=False,
        )
        return result.text_content if result.success else ""

    def extract_tables(
        self,
        file_path: Path,
        max_pages: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Extract tables from a PDF file.

        Args:
            file_path: Path to the PDF file
            max_pages: Maximum pages to process

        Returns:
            List of table dictionaries
        """
        result = self.parser.parse(
            file_path,
            max_pages=max_pages,
            extract_tables=True,
            extract_images=False,
        )
        if result.success and result.data:
            return result.data.get("tables", [])
        return []

    def get_page_count(self, file_path: Path) -> int:
        """
        Get the number of pages in a PDF.

        Args:
            file_path: Path to the PDF file

        Returns:
            Number of pages
        """
        result = self.parser.parse(
            file_path,
            max_pages=1,
            extract_tables=False,
        )
        if result.success and result.metadata:
            return result.metadata.get("total_pages", 0)
        return 0


def extract_pdf_text(file_path: Path, max_pages: Optional[int] = None) -> str:
    """
    Extract text from a PDF file.

    Args:
        file_path: Path to the PDF file
        max_pages: Maximum pages to process

    Returns:
        Extracted text
    """
    extractor = PDFTextExtractor()
    return extractor.extract_text(file_path, max_pages)


def extract_pdf_tables(
    file_path: Path,
    max_pages: Optional[int] = None,
) -> List[List[List[str]]]:
    """
    Extract tables from a PDF file.

    Args:
        file_path: Path to the PDF file
        max_pages: Maximum pages to process

    Returns:
        List of tables (each table is a list of rows)
    """
    extractor = PDFTextExtractor()
    tables = extractor.extract_tables(file_path, max_pages)
    return [t.get("data", []) for t in tables]

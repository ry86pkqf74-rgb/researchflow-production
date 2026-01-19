"""
PDF Parse Job Handler
Phase B - Task 69: Add PDF parse job type for manuscript service

Extracts text, metadata, and structured content from PDF documents
for use in manuscript processing workflows.
"""

import os
import logging
from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional, List
from pathlib import Path

from src.extraction.tika_client import get_tika_client, TikaExtractionError
from src.validation.phi_detector import PHIDetector

logger = logging.getLogger(__name__)


@dataclass
class PDFSection:
    """Parsed section from a PDF document"""
    name: str
    start_page: int
    end_page: int
    # GOVERNANCE: text_preview replaced with character count - never expose raw text
    char_count: int
    has_tables: bool
    has_figures: bool


@dataclass
class PDFParseResult:
    """Result of PDF parsing operation"""
    success: bool
    file_path: str
    page_count: int
    word_count: int
    char_count: int
    # GOVERNANCE: Removed full_text field - only return metadata
    # full_text field would expose document content
    sections: List[PDFSection]
    metadata: Dict[str, Any]
    phi_scan_passed: bool
    phi_finding_count: int
    error: Optional[str] = None


class PDFParseError(RuntimeError):
    """Raised when PDF parsing fails (fail-closed)"""
    pass


class PDFParser:
    """
    PDF parser using Apache Tika for text extraction

    CRITICAL GOVERNANCE:
    - Never return raw text content to API responses
    - Always scan for PHI before any external return
    - Store extracted text internally only (for AI processing)
    - Return only metadata, structure, and stats
    """

    def __init__(self):
        self.tika = get_tika_client()
        self._phi_detector = None

    @property
    def phi_detector(self):
        """Lazy load PHI detector"""
        if self._phi_detector is None:
            self._phi_detector = PHIDetector()
        return self._phi_detector

    def parse(self, file_path: str, scan_for_phi: bool = True) -> PDFParseResult:
        """
        Parse a PDF file and extract structured information

        Args:
            file_path: Path to PDF file
            scan_for_phi: Whether to scan for PHI (default True)

        Returns:
            PDFParseResult with metadata and structure (never raw text)

        Raises:
            PDFParseError: If parsing fails (fail-closed)
        """
        # Validate file exists
        if not os.path.exists(file_path):
            raise PDFParseError(f"File not found: {file_path}")

        # Validate PDF extension
        if not file_path.lower().endswith('.pdf'):
            raise PDFParseError(f"Not a PDF file: {file_path}")

        try:
            logger.info(f"[PDF Parse] Starting parse of {file_path}")

            # Extract text using Tika
            extraction_result = self.tika.extract_text(file_path)
            if not extraction_result.success:
                raise PDFParseError(f"Tika extraction failed: {extraction_result.error}")

            text = extraction_result.text

            # Extract metadata
            metadata_result = self.tika.extract_metadata(file_path)
            metadata = metadata_result.metadata if metadata_result.success else {}

            # Calculate statistics (GOVERNANCE: only return stats, not text)
            word_count = len(text.split())
            char_count = len(text)
            page_count = self._estimate_pages(metadata, text)

            # PHI scan using PHIDetector
            phi_finding_count = 0
            phi_scan_passed = True
            if scan_for_phi and text:
                # PHIDetector.detect() returns list of (value, phi_type, severity) tuples
                phi_findings = self.phi_detector.detect(text)
                phi_finding_count = len(phi_findings)
                phi_scan_passed = phi_finding_count == 0

                if phi_finding_count > 0:
                    logger.warning(f"[PDF Parse] PHI detected: {phi_finding_count} findings")

            # Detect sections (GOVERNANCE: section text not exposed)
            sections = self._detect_sections(text, metadata)

            # GOVERNANCE: Sanitize metadata - remove any user-identifying info
            safe_metadata = self._sanitize_metadata(metadata)

            logger.info(f"[PDF Parse] Complete: {page_count} pages, {word_count} words")

            return PDFParseResult(
                success=True,
                file_path=file_path,
                page_count=page_count,
                word_count=word_count,
                char_count=char_count,
                # GOVERNANCE: No full_text in result
                sections=sections,
                metadata=safe_metadata,
                phi_scan_passed=phi_scan_passed,
                phi_finding_count=phi_finding_count,
            )

        except TikaExtractionError as e:
            error_msg = f"PDF extraction failed: {e}"
            logger.error(f"[PDF Parse] {error_msg}")
            raise PDFParseError(error_msg)

        except Exception as e:
            error_msg = f"PDF parse error: {e}"
            logger.error(f"[PDF Parse] {error_msg}")
            raise PDFParseError(error_msg)

    def _estimate_pages(self, metadata: Dict[str, Any], text: str) -> int:
        """Estimate page count from metadata or text length"""
        # Try to get from metadata
        page_keys = ['xmpTPg:NPages', 'meta:page-count', 'Page-Count', 'pdf:pageCount']
        for key in page_keys:
            if key in metadata:
                try:
                    return int(metadata[key])
                except (ValueError, TypeError):
                    pass

        # Estimate from text length (rough: ~3000 chars per page)
        return max(1, len(text) // 3000)

    def _detect_sections(self, text: str, metadata: Dict[str, Any]) -> List[PDFSection]:
        """
        Detect document sections based on common manuscript structure

        GOVERNANCE: Returns section metadata only, never text content
        """
        sections = []

        # Common manuscript section headers
        section_patterns = [
            ('Abstract', r'(?:^|\n)(?:ABSTRACT|Abstract)\s*\n'),
            ('Introduction', r'(?:^|\n)(?:INTRODUCTION|Introduction|1\.\s*Introduction)\s*\n'),
            ('Methods', r'(?:^|\n)(?:METHODS|Methods|MATERIALS AND METHODS|2\.\s*Methods)\s*\n'),
            ('Results', r'(?:^|\n)(?:RESULTS|Results|3\.\s*Results)\s*\n'),
            ('Discussion', r'(?:^|\n)(?:DISCUSSION|Discussion|4\.\s*Discussion)\s*\n'),
            ('Conclusion', r'(?:^|\n)(?:CONCLUSION|Conclusion|CONCLUSIONS)\s*\n'),
            ('References', r'(?:^|\n)(?:REFERENCES|References|BIBLIOGRAPHY)\s*\n'),
        ]

        import re
        text_lower = text.lower()

        for section_name, pattern in section_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                # Calculate approximate position in pages
                position = match.start()
                total_len = len(text)
                page_estimate = max(1, int((position / total_len) * self._estimate_pages({}, text)))

                # Get section length (rough estimate)
                section_start = match.end()
                # Find next section or end
                next_section_start = total_len
                for _, next_pattern in section_patterns:
                    next_match = re.search(next_pattern, text[section_start:], re.IGNORECASE)
                    if next_match:
                        next_section_start = min(next_section_start, section_start + next_match.start())

                section_len = next_section_start - section_start

                sections.append(PDFSection(
                    name=section_name,
                    start_page=page_estimate,
                    end_page=page_estimate + max(1, section_len // 3000),
                    char_count=section_len,
                    has_tables='table' in text_lower[section_start:next_section_start],
                    has_figures='figure' in text_lower[section_start:next_section_start] or
                               'fig.' in text_lower[section_start:next_section_start],
                ))

        return sections

    def _sanitize_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize metadata to remove potentially identifying information

        GOVERNANCE: Remove creator names, modification timestamps that could
        identify individuals, file paths, etc.
        """
        # Keys to remove (potentially identifying)
        sensitive_keys = [
            'Author', 'Creator', 'dc:creator', 'meta:author',
            'Last-Author', 'meta:last-author',
            'Company', 'dc:publisher',
            'meta:creation-date',  # Keep creation date but remove author
            'xmp:CreatorTool',  # May contain email
        ]

        # Keys to keep (safe metadata)
        safe_keys = [
            'Content-Type', 'pdf:PDFVersion',
            'xmpTPg:NPages', 'meta:page-count', 'Page-Count',
            'dc:format', 'pdf:encrypted', 'pdf:hasMarkedContent',
            'pdf:hasXFA', 'pdf:producer',
        ]

        safe_metadata = {}
        for key, value in metadata.items():
            # Only include explicitly safe keys
            if any(safe_key.lower() == key.lower() for safe_key in safe_keys):
                safe_metadata[key] = value
            # Special handling for certain fields
            elif key.lower() == 'title' and isinstance(value, str):
                # Keep title if it doesn't look like a file path
                if '/' not in value and '\\' not in value:
                    safe_metadata[key] = value

        return safe_metadata

    def to_dict(self, result: PDFParseResult) -> Dict[str, Any]:
        """Convert result to dictionary for API response"""
        return {
            'success': result.success,
            'filePath': result.file_path,
            'pageCount': result.page_count,
            'wordCount': result.word_count,
            'charCount': result.char_count,
            'sections': [asdict(s) for s in result.sections],
            'metadata': result.metadata,
            'phiScanPassed': result.phi_scan_passed,
            'phiFindingCount': result.phi_finding_count,
            'error': result.error,
        }


# Singleton instance
_pdf_parser: Optional[PDFParser] = None


def get_pdf_parser() -> PDFParser:
    """Get global PDF parser instance"""
    global _pdf_parser
    if _pdf_parser is None:
        _pdf_parser = PDFParser()
    return _pdf_parser

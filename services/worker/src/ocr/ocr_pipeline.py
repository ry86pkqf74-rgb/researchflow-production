"""
OCR Pipeline

Extracts text from scanned images and PDFs using Tesseract.
"""

from __future__ import annotations

import os
import logging
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)

ENABLE_OCR = os.getenv("ENABLE_OCR", "true").lower() == "true"


@dataclass
class OCRPage:
    """OCR result for a single page"""
    page_number: int
    text: str
    confidence: float
    language: str


@dataclass
class OCRResult:
    """Complete OCR result"""
    pages: List[OCRPage]
    full_text: str
    success: bool
    page_count: int
    average_confidence: float
    error: Optional[str] = None
    phi_redacted: bool = False


def _check_ocr_available() -> bool:
    """Check if OCR dependencies are available"""
    if not ENABLE_OCR:
        return False

    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def extract_text_from_image(
    image_path: str,
    language: str = 'eng',
    fail_closed: bool = True
) -> OCRResult:
    """
    Extract text from an image using Tesseract OCR.

    Args:
        image_path: Path to image file
        language: Tesseract language code
        fail_closed: If True, redact PHI from results

    Returns:
        OCRResult with extracted text
    """
    if not ENABLE_OCR:
        return OCRResult(
            pages=[],
            full_text="",
            success=False,
            page_count=0,
            average_confidence=0.0,
            error="OCR is disabled (ENABLE_OCR=false)"
        )

    try:
        import pytesseract
        from PIL import Image

        img = Image.open(image_path)

        # Get text with confidence data
        data = pytesseract.image_to_data(img, lang=language, output_type=pytesseract.Output.DICT)

        # Calculate average confidence
        confidences = [int(c) for c in data['conf'] if int(c) > 0]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        # Get full text
        text = pytesseract.image_to_string(img, lang=language)

        # PHI guard
        phi_redacted = False
        if fail_closed:
            safe_text, findings = guard_text(text, fail_closed=True)
            if findings:
                text = safe_text or "[PHI REDACTED]"
                phi_redacted = True
                logger.warning("PHI detected and redacted from OCR output")

        page = OCRPage(
            page_number=1,
            text=text,
            confidence=avg_confidence,
            language=language
        )

        return OCRResult(
            pages=[page],
            full_text=text,
            success=True,
            page_count=1,
            average_confidence=avg_confidence,
            phi_redacted=phi_redacted
        )

    except ImportError as e:
        return OCRResult(
            pages=[],
            full_text="",
            success=False,
            page_count=0,
            average_confidence=0.0,
            error=f"Required package not installed: {e}"
        )
    except Exception as e:
        logger.exception(f"OCR extraction failed: {e}")
        return OCRResult(
            pages=[],
            full_text="",
            success=False,
            page_count=0,
            average_confidence=0.0,
            error=str(e)
        )


def extract_text_from_pdf(
    pdf_path: str,
    language: str = 'eng',
    dpi: int = 300,
    fail_closed: bool = True
) -> OCRResult:
    """
    Extract text from a scanned PDF using OCR.

    Args:
        pdf_path: Path to PDF file
        language: Tesseract language code
        dpi: Resolution for PDF to image conversion
        fail_closed: If True, redact PHI from results

    Returns:
        OCRResult with extracted text from all pages
    """
    if not ENABLE_OCR:
        return OCRResult(
            pages=[],
            full_text="",
            success=False,
            page_count=0,
            average_confidence=0.0,
            error="OCR is disabled (ENABLE_OCR=false)"
        )

    try:
        import pytesseract
        from pdf2image import convert_from_path

        # Convert PDF to images
        images = convert_from_path(pdf_path, dpi=dpi)

        pages: List[OCRPage] = []
        full_text_parts: List[str] = []
        total_confidence = 0.0
        phi_redacted = False

        for page_num, img in enumerate(images, 1):
            # Get text with confidence
            data = pytesseract.image_to_data(img, lang=language, output_type=pytesseract.Output.DICT)

            confidences = [int(c) for c in data['conf'] if int(c) > 0]
            page_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            text = pytesseract.image_to_string(img, lang=language)

            # PHI guard
            if fail_closed:
                safe_text, findings = guard_text(text, fail_closed=True)
                if findings:
                    text = safe_text or "[PHI REDACTED]"
                    phi_redacted = True
                    logger.warning(f"PHI detected and redacted from PDF page {page_num}")

            pages.append(OCRPage(
                page_number=page_num,
                text=text,
                confidence=page_confidence,
                language=language
            ))

            full_text_parts.append(text)
            total_confidence += page_confidence

        avg_confidence = total_confidence / len(pages) if pages else 0.0

        return OCRResult(
            pages=pages,
            full_text="\n\n".join(full_text_parts),
            success=True,
            page_count=len(pages),
            average_confidence=avg_confidence,
            phi_redacted=phi_redacted
        )

    except ImportError as e:
        return OCRResult(
            pages=[],
            full_text="",
            success=False,
            page_count=0,
            average_confidence=0.0,
            error=f"Required package not installed: {e}"
        )
    except Exception as e:
        logger.exception(f"PDF OCR extraction failed: {e}")
        return OCRResult(
            pages=[],
            full_text="",
            success=False,
            page_count=0,
            average_confidence=0.0,
            error=str(e)
        )


def save_ocr_result(
    result: OCRResult,
    output_path: str
) -> str:
    """
    Save OCR result as JSON.

    Args:
        result: OCRResult to save
        output_path: Path to save JSON

    Returns:
        Path to saved file
    """
    import json

    output = {
        'pages': [
            {
                'page_number': p.page_number,
                'text': p.text,
                'confidence': p.confidence,
                'language': p.language
            }
            for p in result.pages
        ],
        'full_text': result.full_text,
        'success': result.success,
        'page_count': result.page_count,
        'average_confidence': result.average_confidence,
        'error': result.error,
        'phi_redacted': result.phi_redacted
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)

    return output_path

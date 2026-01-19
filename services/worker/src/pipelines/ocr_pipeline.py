"""
Tesseract OCR Pipeline with PHI Scrubbing
Phase A - Task 1: Tesseract OCR + PHI Scrubbing

Extracts text from PDFs and images, with mandatory PHI scrubbing.
"""

import os
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import urllib.request
import urllib.error
import json
import logging

logger = logging.getLogger(__name__)

# Configuration
PHI_ENGINE_URL = os.getenv("PHI_ENGINE_URL")
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
OCR_DPI = 300  # Higher DPI = better quality, but slower
OCR_TIMEOUT = 300  # 5 minutes


@dataclass(frozen=True)
class OCRResult:
    """Result of OCR processing"""
    scrubbed_text: str
    raw_text_length: int
    scrubbed_text_length: int
    phi_detected: bool
    page_count: int
    success: bool
    error: Optional[str] = None


class OCRProcessingError(RuntimeError):
    """Raised when OCR processing fails (fail-closed)"""
    pass


class PHIScrubError(RuntimeError):
    """Raised when PHI scrubbing fails (fail-closed)"""
    pass


class OCRPipeline:
    """
    OCR Pipeline with mandatory PHI scrubbing

    Following ResearchFlow patterns:
    - Fail-closed: PHI engine failure blocks processing
    - Validates file size and type
    - Supports PDF and image formats
    - Scrubs ALL text before persistence
    """

    def __init__(self, phi_engine_url: Optional[str] = PHI_ENGINE_URL):
        if not phi_engine_url:
            raise ValueError(
                "PHI_ENGINE_URL must be configured for OCR pipeline. "
                "OCR processes medical documents and MUST scrub PHI."
            )

        self.phi_engine_url = phi_engine_url

    def process_document(self, file_path: str) -> OCRResult:
        """
        Extract text from document and scrub PHI

        Args:
            file_path: Path to PDF or image file

        Returns:
            OCRResult with scrubbed text

        Raises:
            OCRProcessingError: If OCR fails
            PHIScrubError: If PHI scrubbing fails (fail-closed)
        """
        # Validate file exists
        if not os.path.exists(file_path):
            raise OCRProcessingError(f"File not found: {file_path}")

        # Validate file size
        file_size = os.path.getsize(file_path)
        if file_size > MAX_FILE_SIZE:
            raise OCRProcessingError(
                f"File too large for OCR: {file_size} > {MAX_FILE_SIZE}"
            )

        try:
            logger.info(f"Processing document for OCR: {file_path}")

            # Extract text based on file type
            file_ext = Path(file_path).suffix.lower()

            if file_ext == '.pdf':
                raw_text, page_count = self._extract_from_pdf(file_path)
            elif file_ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
                raw_text, page_count = self._extract_from_image(file_path)
            else:
                raise OCRProcessingError(
                    f"Unsupported file type for OCR: {file_ext}"
                )

            logger.info(
                f"Extracted {len(raw_text)} characters from {page_count} page(s)"
            )

            # CRITICAL: Scrub PHI before returning ANY text
            # Fail-closed: If PHI engine is down, we CANNOT process medical documents
            scrubbed_text = self._scrub_phi(raw_text)

            phi_detected = len(raw_text) != len(scrubbed_text)

            if phi_detected:
                logger.warning(
                    f"PHI detected and scrubbed in {file_path}. "
                    f"Original: {len(raw_text)} chars, Scrubbed: {len(scrubbed_text)} chars"
                )

            return OCRResult(
                scrubbed_text=scrubbed_text,
                raw_text_length=len(raw_text),
                scrubbed_text_length=len(scrubbed_text),
                phi_detected=phi_detected,
                page_count=page_count,
                success=True
            )

        except (OCRProcessingError, PHIScrubError):
            raise

        except Exception as e:
            error_msg = f"OCR processing failed: {e}"
            logger.error(error_msg)
            raise OCRProcessingError(error_msg)

    def _extract_from_pdf(self, pdf_path: str) -> tuple[str, int]:
        """
        Convert PDF pages to images and OCR each page

        Args:
            pdf_path: Path to PDF file

        Returns:
            Tuple of (extracted_text, page_count)

        Raises:
            OCRProcessingError: If extraction fails
        """
        try:
            # Convert PDF to images
            logger.info(f"Converting PDF to images: {pdf_path}")
            images = convert_from_path(pdf_path, dpi=OCR_DPI)

            texts = []

            # OCR each page
            for i, image in enumerate(images, start=1):
                logger.info(f"OCR processing page {i}/{len(images)}")

                # Run Tesseract OCR
                page_text = pytesseract.image_to_string(image, lang='eng')

                texts.append(f"--- Page {i} ---\n{page_text}")

            combined_text = "\n\n".join(texts)

            return combined_text, len(images)

        except Exception as e:
            raise OCRProcessingError(f"PDF OCR failed: {e}")

    def _extract_from_image(self, image_path: str) -> tuple[str, int]:
        """
        OCR single image file

        Args:
            image_path: Path to image file

        Returns:
            Tuple of (extracted_text, 1)

        Raises:
            OCRProcessingError: If extraction fails
        """
        try:
            logger.info(f"OCR processing image: {image_path}")

            # Load image
            image = Image.open(image_path)

            # Run Tesseract OCR
            text = pytesseract.image_to_string(image, lang='eng')

            return text, 1

        except Exception as e:
            raise OCRProcessingError(f"Image OCR failed: {e}")

    def _scrub_phi(self, text: str) -> str:
        """
        Call PHI engine to redact sensitive information

        CRITICAL: Fail-closed pattern
        If PHI engine is unavailable, we MUST NOT persist raw text
        Medical documents require PHI scrubbing

        Args:
            text: Raw text to scrub

        Returns:
            PHI-scrubbed text

        Raises:
            PHIScrubError: If scrubbing fails (fail-closed)
        """
        if not text or len(text.strip()) == 0:
            return ""

        try:
            logger.info(f"Scrubbing PHI from {len(text)} characters")

            # Prepare request (following LLM provider pattern with urllib)
            request_data = json.dumps({"text": text}).encode('utf-8')

            req = urllib.request.Request(
                f"{self.phi_engine_url}/scan",
                data=request_data,
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                method="POST"
            )

            # Execute request with timeout
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))

            scrubbed_text = result.get("scrubbed_text")

            if scrubbed_text is None:
                raise PHIScrubError("PHI engine returned no scrubbed_text")

            logger.info(f"PHI scrubbing complete. Output: {len(scrubbed_text)} characters")

            return scrubbed_text

        except urllib.error.URLError as e:
            error_msg = f"PHI engine unavailable: {e}"
            logger.error(error_msg)
            raise PHIScrubError(
                f"{error_msg}. CRITICAL: Cannot process medical documents without PHI scrubbing. "
                "Ensure PHI_ENGINE_URL is configured and service is running."
            )

        except urllib.error.HTTPError as e:
            error_msg = f"PHI engine HTTP error {e.code}: {e.reason}"
            logger.error(error_msg)
            raise PHIScrubError(error_msg)

        except Exception as e:
            error_msg = f"PHI scrubbing failed: {e}"
            logger.error(error_msg)
            raise PHIScrubError(error_msg)


# Singleton instance (lazy loading)
_ocr_pipeline: Optional[OCRPipeline] = None


def get_ocr_pipeline() -> OCRPipeline:
    """Get global OCR pipeline instance"""
    global _ocr_pipeline
    if _ocr_pipeline is None:
        _ocr_pipeline = OCRPipeline()
    return _ocr_pipeline

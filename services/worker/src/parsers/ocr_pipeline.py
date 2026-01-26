"""
OCR Pipeline with Tesseract

Extracts text from images and scanned PDFs using Tesseract OCR.
"""

from __future__ import annotations

import logging
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)

# Feature flag for OCR
OCR_ENABLED = os.getenv("OCR_ENABLED", "false").lower() == "true"
OCR_LANG = os.getenv("OCR_LANG", "eng")


@dataclass
class OcrResult:
    """Result of OCR processing."""
    success: bool
    text: str
    pages: List[Dict[str, Any]] = field(default_factory=list)
    confidence: Optional[float] = None
    language: str = "eng"
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OcrConfig:
    """Configuration for OCR processing."""
    language: str = "eng"
    psm: int = 3  # Page segmentation mode (3 = fully automatic)
    oem: int = 3  # OCR engine mode (3 = default, based on available)
    dpi: int = 300  # DPI for image processing
    preprocess: bool = True  # Apply preprocessing
    preserve_layout: bool = False  # Try to preserve text layout
    confidence_threshold: float = 0.0  # Minimum confidence to include


class OcrPipeline:
    """
    OCR pipeline using Tesseract.

    Supports:
    - Image files (PNG, JPEG, TIFF, BMP)
    - Scanned PDFs (converted to images first)
    """

    def __init__(self, config: Optional[OcrConfig] = None):
        self.config = config or OcrConfig()
        self._tesseract_available = None

    def is_available(self) -> bool:
        """Check if Tesseract is available."""
        if self._tesseract_available is not None:
            return self._tesseract_available

        if not OCR_ENABLED:
            self._tesseract_available = False
            return False

        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self._tesseract_available = True
        except Exception:
            self._tesseract_available = False

        return self._tesseract_available

    def process_image(
        self,
        image_path: Union[str, Path],
        config: Optional[OcrConfig] = None,
    ) -> OcrResult:
        """
        Process a single image file.

        Args:
            image_path: Path to the image file
            config: OCR configuration (uses default if not provided)

        Returns:
            OcrResult with extracted text
        """
        if not self.is_available():
            return OcrResult(
                success=False,
                text="",
                errors=["OCR is not available. Set OCR_ENABLED=true and install tesseract-ocr."],
            )

        cfg = config or self.config
        path = Path(image_path)

        if not path.exists():
            return OcrResult(
                success=False,
                text="",
                errors=[f"File not found: {image_path}"],
            )

        try:
            import pytesseract
            from PIL import Image

            # Load and preprocess image
            img = Image.open(path)

            if cfg.preprocess:
                img = self._preprocess_image(img)

            # Build Tesseract config string
            tess_config = self._build_config_string(cfg)

            # Run OCR
            if cfg.preserve_layout:
                text = pytesseract.image_to_string(
                    img,
                    lang=cfg.language,
                    config=tess_config,
                )
            else:
                text = pytesseract.image_to_string(
                    img,
                    lang=cfg.language,
                    config=tess_config,
                )

            # Get detailed data for confidence
            data = pytesseract.image_to_data(
                img,
                lang=cfg.language,
                output_type=pytesseract.Output.DICT,
            )

            # Calculate average confidence
            confidences = [
                int(c) for c in data.get("conf", [])
                if str(c).isdigit() and int(c) >= 0
            ]
            avg_confidence = (
                sum(confidences) / len(confidences) / 100.0
                if confidences else None
            )

            return OcrResult(
                success=True,
                text=text.strip(),
                pages=[{
                    "page_number": 1,
                    "text": text.strip(),
                    "confidence": avg_confidence,
                    "width": img.width,
                    "height": img.height,
                }],
                confidence=avg_confidence,
                language=cfg.language,
                metadata={
                    "source": str(path),
                    "format": img.format,
                    "mode": img.mode,
                    "size": [img.width, img.height],
                },
            )

        except ImportError as e:
            return OcrResult(
                success=False,
                text="",
                errors=[f"Missing dependency: {e}. Install with: pip install pytesseract Pillow"],
            )
        except Exception as e:
            logger.exception(f"OCR error: {e}")
            return OcrResult(
                success=False,
                text="",
                errors=[str(e)],
            )

    def process_pdf(
        self,
        pdf_path: Union[str, Path],
        max_pages: Optional[int] = None,
        config: Optional[OcrConfig] = None,
    ) -> OcrResult:
        """
        Process a PDF file (converts pages to images first).

        Args:
            pdf_path: Path to the PDF file
            max_pages: Maximum pages to process
            config: OCR configuration

        Returns:
            OcrResult with extracted text from all pages
        """
        if not self.is_available():
            return OcrResult(
                success=False,
                text="",
                errors=["OCR is not available. Set OCR_ENABLED=true and install tesseract-ocr."],
            )

        cfg = config or self.config
        path = Path(pdf_path)

        if not path.exists():
            return OcrResult(
                success=False,
                text="",
                errors=[f"File not found: {pdf_path}"],
            )

        try:
            from pdf2image import convert_from_path

            # Convert PDF to images
            images = convert_from_path(
                path,
                dpi=cfg.dpi,
                first_page=1,
                last_page=max_pages,
            )

            pages = []
            all_text = []
            total_confidence = 0
            confidence_count = 0
            warnings = []

            for i, img in enumerate(images):
                try:
                    # Process each page image
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp:
                        img.save(tmp.name, "PNG")
                        result = self.process_image(tmp.name, cfg)

                        if result.success:
                            page_data = {
                                "page_number": i + 1,
                                "text": result.text,
                                "confidence": result.confidence,
                                "width": img.width,
                                "height": img.height,
                            }
                            pages.append(page_data)
                            all_text.append(f"--- Page {i + 1} ---\n{result.text}")

                            if result.confidence is not None:
                                total_confidence += result.confidence
                                confidence_count += 1
                        else:
                            warnings.extend(result.errors)

                except Exception as e:
                    warnings.append(f"Error processing page {i + 1}: {str(e)}")

            avg_confidence = (
                total_confidence / confidence_count
                if confidence_count > 0 else None
            )

            return OcrResult(
                success=len(pages) > 0,
                text="\n\n".join(all_text),
                pages=pages,
                confidence=avg_confidence,
                language=cfg.language,
                warnings=warnings,
                metadata={
                    "source": str(path),
                    "total_pages": len(images),
                    "pages_processed": len(pages),
                    "dpi": cfg.dpi,
                },
            )

        except ImportError as e:
            return OcrResult(
                success=False,
                text="",
                errors=[f"Missing dependency: {e}. Install with: pip install pdf2image"],
            )
        except Exception as e:
            logger.exception(f"PDF OCR error: {e}")
            return OcrResult(
                success=False,
                text="",
                errors=[str(e)],
            )

    def process_file(
        self,
        file_path: Union[str, Path],
        max_pages: Optional[int] = None,
        config: Optional[OcrConfig] = None,
    ) -> OcrResult:
        """
        Process any supported file (auto-detect format).

        Args:
            file_path: Path to the file
            max_pages: Maximum pages (for PDFs)
            config: OCR configuration

        Returns:
            OcrResult with extracted text
        """
        path = Path(file_path)
        ext = path.suffix.lower()

        if ext == ".pdf":
            return self.process_pdf(path, max_pages, config)
        elif ext in {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".gif"}:
            return self.process_image(path, config)
        else:
            return OcrResult(
                success=False,
                text="",
                errors=[f"Unsupported file format: {ext}"],
            )

    def _preprocess_image(self, img):
        """Apply preprocessing to improve OCR quality."""
        from PIL import Image, ImageFilter, ImageOps

        # Convert to grayscale
        if img.mode != "L":
            img = img.convert("L")

        # Apply slight sharpening
        img = img.filter(ImageFilter.SHARPEN)

        # Increase contrast
        img = ImageOps.autocontrast(img)

        return img

    def _build_config_string(self, cfg: OcrConfig) -> str:
        """Build Tesseract config string from OcrConfig."""
        parts = [
            f"--psm {cfg.psm}",
            f"--oem {cfg.oem}",
        ]

        if cfg.preserve_layout:
            parts.append("-c preserve_interword_spaces=1")

        return " ".join(parts)


def extract_text_ocr(
    file_path: Union[str, Path],
    language: str = "eng",
    max_pages: Optional[int] = None,
) -> str:
    """
    Extract text from an image or PDF using OCR.

    Args:
        file_path: Path to the file
        language: Tesseract language code
        max_pages: Maximum pages to process (for PDFs)

    Returns:
        Extracted text
    """
    config = OcrConfig(language=language)
    pipeline = OcrPipeline(config)
    result = pipeline.process_file(file_path, max_pages, config)
    return result.text if result.success else ""


def is_ocr_available() -> bool:
    """Check if OCR is available."""
    pipeline = OcrPipeline()
    return pipeline.is_available()


def get_ocr_languages() -> List[str]:
    """Get list of available Tesseract languages."""
    if not is_ocr_available():
        return []

    try:
        import pytesseract
        return pytesseract.get_languages()
    except Exception:
        return ["eng"]  # Default fallback

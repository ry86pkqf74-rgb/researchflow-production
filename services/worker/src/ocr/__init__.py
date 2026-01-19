"""
OCR Module

Provides OCR extraction for scanned documents and images.
Gated by ENABLE_OCR environment variable.
"""

import os

ENABLE_OCR = os.getenv("ENABLE_OCR", "true").lower() == "true"

if ENABLE_OCR:
    from .ocr_pipeline import (
        extract_text_from_image,
        extract_text_from_pdf,
        OCRResult,
    )

    __all__ = [
        'extract_text_from_image',
        'extract_text_from_pdf',
        'OCRResult',
    ]
else:
    __all__ = []

"""
MathPix Equation Extraction Stub

Placeholder for MathPix API integration.
Extracts mathematical equations from images and PDFs.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# MathPix configuration
MATHPIX_APP_ID = os.getenv('MATHPIX_APP_ID', '')
MATHPIX_APP_KEY = os.getenv('MATHPIX_APP_KEY', '')
ENABLE_MATHPIX = os.getenv('ENABLE_MATHPIX', '0') == '1'


@dataclass
class Equation:
    """An extracted equation"""
    latex: str
    confidence: float
    position: Optional[Dict[str, int]] = None  # x, y, width, height
    type: str = "inline"  # inline or display


@dataclass
class EquationResult:
    """Equation extraction result"""
    success: bool
    equations: List[Equation] = field(default_factory=list)
    raw_latex: Optional[str] = None
    error: Optional[str] = None


def extract_equations(
    image_path: str,
    formats: Optional[List[str]] = None
) -> EquationResult:
    """
    Extract mathematical equations from an image.

    NOTE: This is a stub implementation. Real MathPix integration
    requires an API key.

    Args:
        image_path: Path to image file
        formats: Desired output formats (latex, mathml, etc.)

    Returns:
        EquationResult with extracted equations
    """
    if not os.path.exists(image_path):
        return EquationResult(
            success=False,
            error=f"Image not found: {image_path}"
        )

    if not ENABLE_MATHPIX or not MATHPIX_APP_ID or not MATHPIX_APP_KEY:
        # Fall back to basic pattern matching
        return _fallback_extraction(image_path)

    try:
        import requests
        import base64

        # Read image and encode
        with open(image_path, 'rb') as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')

        # Determine image type
        ext = os.path.splitext(image_path)[1].lower()
        mime_types = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
        }
        mime_type = mime_types.get(ext, 'image/png')

        # Call MathPix API
        url = 'https://api.mathpix.com/v3/text'
        headers = {
            'app_id': MATHPIX_APP_ID,
            'app_key': MATHPIX_APP_KEY,
            'Content-Type': 'application/json',
        }
        payload = {
            'src': f'data:{mime_type};base64,{image_data}',
            'formats': formats or ['latex_simplified', 'latex_styled'],
            'data_options': {
                'include_asciimath': True,
                'include_latex': True,
            }
        }

        response = requests.post(url, json=payload, headers=headers, timeout=30)

        if response.status_code != 200:
            return EquationResult(
                success=False,
                error=f"MathPix API error: {response.status_code}"
            )

        data = response.json()

        equations = []
        raw_latex = data.get('latex_styled') or data.get('latex_simplified', '')

        # Parse detected math regions
        for region in data.get('data', []):
            if region.get('type') == 'math':
                equations.append(Equation(
                    latex=region.get('value', ''),
                    confidence=region.get('confidence', 0.0),
                    type='display' if '\\[' in region.get('value', '') else 'inline'
                ))

        # If no regions but raw latex exists, create single equation
        if not equations and raw_latex:
            equations.append(Equation(
                latex=raw_latex,
                confidence=data.get('confidence', 0.0)
            ))

        return EquationResult(
            success=True,
            equations=equations,
            raw_latex=raw_latex
        )

    except ImportError:
        return EquationResult(
            success=False,
            error="requests library not installed"
        )
    except Exception as e:
        logger.exception(f"MathPix extraction failed: {e}")
        return EquationResult(
            success=False,
            error=str(e)
        )


def _fallback_extraction(image_path: str) -> EquationResult:
    """
    Fallback extraction using OCR (if available).

    This is a basic implementation that uses OCR to find
    potential equation patterns.
    """
    try:
        # Try to use OCR
        from src.ocr.ocr_pipeline import extract_text_from_image

        ocr_result = extract_text_from_image(image_path, fail_closed=False)

        if not ocr_result.success or not ocr_result.text:
            return EquationResult(
                success=False,
                error="OCR extraction failed and MathPix not available"
            )

        text = ocr_result.text
        equations = []

        # Look for common equation patterns
        patterns = [
            # Simple equations like x = 5
            r'[a-zA-Z]\s*=\s*[\d\+\-\*\/\^\(\)\s]+',
            # Fractions
            r'\d+\s*/\s*\d+',
            # Powers/exponents
            r'[a-zA-Z]\^\d+',
            # Greek letters (commonly used)
            r'(alpha|beta|gamma|delta|theta|pi|sigma|omega)',
            # Sum/product notation
            r'(sum|product|integral)',
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                equations.append(Equation(
                    latex=match.group(0),
                    confidence=0.5,  # Low confidence for pattern matching
                    type='inline'
                ))

        return EquationResult(
            success=True,
            equations=equations,
            raw_latex=text if equations else None
        )

    except ImportError:
        return EquationResult(
            success=False,
            error="Neither MathPix nor OCR available"
        )
    except Exception as e:
        return EquationResult(
            success=False,
            error=str(e)
        )


def latex_to_unicode(latex: str) -> str:
    """
    Convert basic LaTeX to Unicode.

    Args:
        latex: LaTeX string

    Returns:
        Unicode representation
    """
    replacements = {
        r'\alpha': 'α', r'\beta': 'β', r'\gamma': 'γ',
        r'\delta': 'δ', r'\epsilon': 'ε', r'\theta': 'θ',
        r'\lambda': 'λ', r'\mu': 'μ', r'\pi': 'π',
        r'\sigma': 'σ', r'\omega': 'ω', r'\phi': 'φ',
        r'\psi': 'ψ', r'\Delta': 'Δ', r'\Sigma': 'Σ',
        r'\Pi': 'Π', r'\Omega': 'Ω', r'\infty': '∞',
        r'\pm': '±', r'\times': '×', r'\div': '÷',
        r'\neq': '≠', r'\leq': '≤', r'\geq': '≥',
        r'\approx': '≈', r'\sum': '∑', r'\prod': '∏',
        r'\int': '∫', r'\partial': '∂', r'\nabla': '∇',
        r'\sqrt': '√', r'\cdot': '·',
    }

    result = latex
    for latex_cmd, unicode_char in replacements.items():
        result = result.replace(latex_cmd, unicode_char)

    # Handle superscripts
    superscripts = {'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
                    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
                    'n': 'ⁿ', 'i': 'ⁱ'}

    for match in re.finditer(r'\^(\d+|[a-z])', result):
        power = match.group(1)
        unicode_power = ''.join(superscripts.get(c, c) for c in power)
        result = result.replace(match.group(0), unicode_power)

    return result

"""
MathPix Equation Extraction - Task 190

Extracts mathematical equations from images using MathPix API.
Reference: https://docs.mathpix.com/
"""

import base64
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import requests

logger = logging.getLogger(__name__)


@dataclass
class EquationResult:
    """Result of equation extraction"""
    latex: str
    latex_styled: Optional[str] = None
    asciimath: Optional[str] = None
    mathml: Optional[str] = None
    text: Optional[str] = None
    confidence: float = 0.0
    position: Optional[Dict[str, int]] = None
    error: Optional[str] = None


@dataclass
class MathPixConfig:
    """Configuration for MathPix API"""
    app_id: Optional[str] = None
    app_key: Optional[str] = None
    base_url: str = "https://api.mathpix.com/v3"
    formats: List[str] = None
    include_asciimath: bool = True
    include_mathml: bool = False
    include_text: bool = True
    confidence_threshold: float = 0.5
    timeout: int = 30

    def __post_init__(self):
        if self.app_id is None:
            self.app_id = os.environ.get("MATHPIX_APP_ID")
        if self.app_key is None:
            self.app_key = os.environ.get("MATHPIX_APP_KEY")
        if self.formats is None:
            self.formats = ["latex_styled", "asciimath", "text"]


class MathPixClient:
    """Client for MathPix equation extraction API"""

    def __init__(self, config: Optional[MathPixConfig] = None):
        self.config = config or MathPixConfig()

        if not self.config.app_id or not self.config.app_key:
            raise ValueError(
                "MATHPIX_APP_ID and MATHPIX_APP_KEY must be set in environment or config"
            )

    def _get_headers(self) -> Dict[str, str]:
        """Get API headers"""
        return {
            "app_id": self.config.app_id,
            "app_key": self.config.app_key,
            "Content-type": "application/json",
        }

    def _encode_image(self, image: Union[str, bytes, Path]) -> str:
        """Encode image to base64 data URI"""
        if isinstance(image, (str, Path)):
            path = Path(image)
            if path.exists():
                with open(path, "rb") as f:
                    image_bytes = f.read()
            elif image.startswith(("http://", "https://")):
                return image  # URL can be used directly
            else:
                # Assume it's already base64
                return f"data:image/jpeg;base64,{image}"
        else:
            image_bytes = image

        b64 = base64.b64encode(image_bytes).decode("utf-8")

        # Detect image type
        if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
            mime = "image/png"
        elif image_bytes[:2] == b"\xff\xd8":
            mime = "image/jpeg"
        elif image_bytes[:4] == b"GIF8":
            mime = "image/gif"
        else:
            mime = "image/jpeg"

        return f"data:{mime};base64,{b64}"

    def extract_equation(
        self, image: Union[str, bytes, Path]
    ) -> EquationResult:
        """
        Extract equation from an image.

        Args:
            image: Image file path, URL, bytes, or base64 string

        Returns:
            EquationResult with extracted equation
        """
        encoded = self._encode_image(image)

        payload = {
            "src": encoded,
            "formats": self.config.formats,
            "data_options": {
                "include_asciimath": self.config.include_asciimath,
                "include_mathml": self.config.include_mathml,
            },
        }

        try:
            response = requests.post(
                f"{self.config.base_url}/text",
                headers=self._get_headers(),
                json=payload,
                timeout=self.config.timeout,
            )
            response.raise_for_status()
            data = response.json()

            # Check for errors
            if "error" in data:
                return EquationResult(
                    latex="",
                    error=data.get("error", "Unknown error"),
                    confidence=0.0,
                )

            # Extract results
            confidence = data.get("confidence", 0.0)
            if confidence < self.config.confidence_threshold:
                return EquationResult(
                    latex=data.get("latex", ""),
                    confidence=confidence,
                    error=f"Low confidence: {confidence:.2f}",
                )

            return EquationResult(
                latex=data.get("latex", ""),
                latex_styled=data.get("latex_styled"),
                asciimath=data.get("asciimath"),
                mathml=data.get("mathml"),
                text=data.get("text"),
                confidence=confidence,
            )

        except requests.exceptions.Timeout:
            logger.error("MathPix API timeout")
            return EquationResult(latex="", error="API timeout", confidence=0.0)
        except requests.exceptions.RequestException as e:
            logger.error(f"MathPix API error: {e}")
            return EquationResult(latex="", error=str(e), confidence=0.0)

    def extract_equations_batch(
        self, images: List[Union[str, bytes, Path]]
    ) -> List[EquationResult]:
        """Extract equations from multiple images"""
        results = []
        for image in images:
            result = self.extract_equation(image)
            results.append(result)
        return results

    def extract_document(
        self,
        pdf_path: Union[str, Path],
        pages: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Extract equations from a PDF document.

        Args:
            pdf_path: Path to PDF file
            pages: Optional list of page numbers (1-indexed)

        Returns:
            Dictionary with extracted equations by page
        """
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

        b64 = base64.b64encode(pdf_bytes).decode("utf-8")

        options = {
            "conversion_formats": {"docx": False, "tex.zip": False},
            "math_inline_delimiters": ["$", "$"],
            "math_display_delimiters": ["$$", "$$"],
            "rm_spaces": True,
        }

        if pages:
            options["page_ranges"] = ",".join(str(p) for p in pages)

        payload = {
            "src": f"data:application/pdf;base64,{b64}",
            "options_json": options,
        }

        try:
            # Submit document for processing
            response = requests.post(
                f"{self.config.base_url}/pdf",
                headers=self._get_headers(),
                json=payload,
                timeout=self.config.timeout * 3,  # Longer timeout for PDFs
            )
            response.raise_for_status()
            data = response.json()

            if "error" in data:
                return {"error": data["error"], "equations": []}

            # Extract equations from response
            equations = self._extract_equations_from_text(data.get("text", ""))

            return {
                "total_pages": data.get("num_pages", 0),
                "equations": equations,
                "latex": data.get("latex", ""),
                "text": data.get("text", ""),
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"MathPix PDF processing error: {e}")
            return {"error": str(e), "equations": []}

    def _extract_equations_from_text(self, text: str) -> List[Dict[str, str]]:
        """Extract equation blocks from processed text"""
        equations = []
        import re

        # Find display equations ($$...$$)
        display_pattern = r"\$\$(.*?)\$\$"
        for match in re.finditer(display_pattern, text, re.DOTALL):
            equations.append({
                "type": "display",
                "latex": match.group(1).strip(),
                "position": match.start(),
            })

        # Find inline equations ($...$)
        inline_pattern = r"(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)"
        for match in re.finditer(inline_pattern, text):
            equations.append({
                "type": "inline",
                "latex": match.group(1).strip(),
                "position": match.start(),
            })

        # Sort by position
        equations.sort(key=lambda x: x["position"])

        return equations


# Global client instance
_mathpix_client: Optional[MathPixClient] = None


def get_mathpix_client(config: Optional[MathPixConfig] = None) -> MathPixClient:
    """Get or create the global MathPix client"""
    global _mathpix_client
    if _mathpix_client is None:
        _mathpix_client = MathPixClient(config)
    return _mathpix_client


def extract_equation(image: Union[str, bytes, Path]) -> EquationResult:
    """Convenience function to extract a single equation"""
    client = get_mathpix_client()
    return client.extract_equation(image)


def is_mathpix_configured() -> bool:
    """Check if MathPix is configured"""
    return bool(
        os.environ.get("MATHPIX_APP_ID") and os.environ.get("MATHPIX_APP_KEY")
    )

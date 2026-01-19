"""
Apache Tika Integration for Document Text Extraction
Phase A - Task 17: Apache Tika Integration

Provides document text and metadata extraction for various formats.
"""

import os
import urllib.request
import urllib.error
import json
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

# Configuration
TIKA_URL = os.getenv("TIKA_URL", "http://tika:9998")
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
TIMEOUT = 120  # 2 minutes


@dataclass(frozen=True)
class ExtractionResult:
    """Result of document text extraction"""
    text: str
    success: bool
    length: int
    error: Optional[str] = None


@dataclass(frozen=True)
class MetadataResult:
    """Result of document metadata extraction"""
    metadata: Dict[str, Any]
    success: bool
    error: Optional[str] = None


class TikaExtractionError(RuntimeError):
    """Raised when Tika extraction fails (fail-closed)"""
    pass


class TikaClient:
    """
    Client for Apache Tika document extraction service

    Following ResearchFlow patterns:
    - Fail-closed: Raises exceptions on failure
    - Uses urllib.request (matches LLM provider pattern)
    - Validates file size before processing
    - Respects timeouts
    """

    def __init__(self, url: str = TIKA_URL):
        self.url = url

    def extract_text(self, file_path: str) -> ExtractionResult:
        """
        Extract text from document using Tika

        Args:
            file_path: Path to document file

        Returns:
            ExtractionResult with extracted text

        Raises:
            TikaExtractionError: If extraction fails (fail-closed)
        """
        # Validate file exists
        if not os.path.exists(file_path):
            raise TikaExtractionError(f"File not found: {file_path}")

        # Validate file size
        file_size = os.path.getsize(file_path)
        if file_size > MAX_FILE_SIZE:
            raise TikaExtractionError(
                f"File too large for Tika: {file_size} > {MAX_FILE_SIZE}"
            )

        if file_size == 0:
            logger.warning(f"Empty file: {file_path}")
            return ExtractionResult(text="", success=True, length=0)

        try:
            logger.info(f"Extracting text from {file_path} ({file_size} bytes)")

            # Read file data
            with open(file_path, 'rb') as f:
                file_data = f.read()

            # Create request (following LLM provider pattern)
            req = urllib.request.Request(
                f"{self.url}/tika",
                data=file_data,
                headers={'Accept': 'text/plain'},
                method="PUT"
            )

            # Execute request with timeout
            with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
                text = response.read().decode('utf-8')

            logger.info(f"Extracted {len(text)} characters")

            return ExtractionResult(
                text=text,
                success=True,
                length=len(text)
            )

        except urllib.error.URLError as e:
            error_msg = f"Tika service unavailable: {e}"
            logger.error(error_msg)
            raise TikaExtractionError(error_msg)

        except urllib.error.HTTPError as e:
            error_msg = f"Tika HTTP error {e.code}: {e.reason}"
            logger.error(error_msg)
            raise TikaExtractionError(error_msg)

        except TimeoutError:
            error_msg = f"Tika extraction timeout after {TIMEOUT}s"
            logger.error(error_msg)
            raise TikaExtractionError(error_msg)

        except Exception as e:
            error_msg = f"Tika extraction failed: {e}"
            logger.error(error_msg)
            raise TikaExtractionError(error_msg)

    def extract_metadata(self, file_path: str) -> MetadataResult:
        """
        Extract document metadata using Tika

        Args:
            file_path: Path to document file

        Returns:
            MetadataResult with metadata dictionary

        Raises:
            TikaExtractionError: If extraction fails (fail-closed)
        """
        # Validate file exists
        if not os.path.exists(file_path):
            raise TikaExtractionError(f"File not found: {file_path}")

        try:
            logger.info(f"Extracting metadata from {file_path}")

            # Read file data
            with open(file_path, 'rb') as f:
                file_data = f.read()

            # Create request
            req = urllib.request.Request(
                f"{self.url}/meta",
                data=file_data,
                headers={'Accept': 'application/json'},
                method="PUT"
            )

            # Execute request with timeout
            with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
                metadata = json.loads(response.read().decode('utf-8'))

            logger.info(f"Extracted {len(metadata)} metadata fields")

            return MetadataResult(
                metadata=metadata,
                success=True
            )

        except Exception as e:
            error_msg = f"Metadata extraction failed: {e}"
            logger.error(error_msg)
            raise TikaExtractionError(error_msg)

    def health_check(self) -> bool:
        """Check if Tika service is available"""
        try:
            req = urllib.request.Request(
                f"{self.url}/tika",
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status == 200
        except Exception:
            return False


# Singleton instance (lazy loading)
_tika_client: Optional[TikaClient] = None


def get_tika_client() -> TikaClient:
    """Get global Tika client instance"""
    global _tika_client
    if _tika_client is None:
        _tika_client = TikaClient()
    return _tika_client

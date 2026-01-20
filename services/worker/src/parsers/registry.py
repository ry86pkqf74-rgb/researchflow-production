"""
Parser Registry

Centralized registry for file format parsers with automatic format detection.
"""

from __future__ import annotations

import logging
import mimetypes
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Type, Union

logger = logging.getLogger(__name__)


@dataclass
class ParseResult:
    """Result of parsing a file."""
    success: bool
    format: str
    record_count: Optional[int] = None
    columns: Optional[List[str]] = None
    schema: Optional[Dict[str, Any]] = None
    data: Optional[Any] = None  # DataFrame, dict, or list
    metadata: Dict[str, Any] = field(default_factory=dict)
    text_content: Optional[str] = None  # For text-based formats (PDF, etc.)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    file_size_bytes: int = 0
    parse_time_ms: int = 0


class BaseParser(ABC):
    """Abstract base class for file parsers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Parser name."""
        pass

    @property
    @abstractmethod
    def supported_extensions(self) -> List[str]:
        """List of supported file extensions (without dot)."""
        pass

    @property
    @abstractmethod
    def supported_mimetypes(self) -> List[str]:
        """List of supported MIME types."""
        pass

    @abstractmethod
    def parse(self, file_path: Path, **options) -> ParseResult:
        """Parse a file and return the result."""
        pass

    def can_parse(self, file_path: Path) -> bool:
        """Check if this parser can handle the file."""
        ext = file_path.suffix.lower().lstrip('.')
        if ext in self.supported_extensions:
            return True

        mimetype, _ = mimetypes.guess_type(str(file_path))
        return mimetype in self.supported_mimetypes if mimetype else False


class ParserRegistry:
    """
    Registry for file parsers with automatic format detection.
    """

    _parsers: Dict[str, BaseParser] = {}
    _extension_map: Dict[str, str] = {}
    _mimetype_map: Dict[str, str] = {}

    @classmethod
    def register(cls, parser: BaseParser) -> None:
        """Register a parser."""
        cls._parsers[parser.name] = parser

        for ext in parser.supported_extensions:
            cls._extension_map[ext.lower()] = parser.name

        for mimetype in parser.supported_mimetypes:
            cls._mimetype_map[mimetype] = parser.name

        logger.debug(f"Registered parser: {parser.name}")

    @classmethod
    def get_parser(cls, file_path: Union[str, Path]) -> Optional[BaseParser]:
        """Get the appropriate parser for a file."""
        path = Path(file_path)
        ext = path.suffix.lower().lstrip('.')

        # Try extension first
        if ext in cls._extension_map:
            return cls._parsers[cls._extension_map[ext]]

        # Try MIME type
        mimetype, _ = mimetypes.guess_type(str(path))
        if mimetype and mimetype in cls._mimetype_map:
            return cls._parsers[cls._mimetype_map[mimetype]]

        return None

    @classmethod
    def parse(cls, file_path: Union[str, Path], **options) -> ParseResult:
        """Parse a file using the appropriate parser."""
        import time
        start_time = time.time()

        path = Path(file_path)

        if not path.exists():
            return ParseResult(
                success=False,
                format="unknown",
                errors=[f"File not found: {file_path}"],
            )

        file_size = path.stat().st_size

        parser = cls.get_parser(path)
        if parser is None:
            return ParseResult(
                success=False,
                format="unknown",
                file_size_bytes=file_size,
                errors=[f"No parser available for format: {path.suffix}"],
            )

        try:
            result = parser.parse(path, **options)
            result.file_size_bytes = file_size
            result.parse_time_ms = int((time.time() - start_time) * 1000)
            return result
        except Exception as e:
            logger.exception(f"Error parsing {file_path}: {e}")
            return ParseResult(
                success=False,
                format=parser.name,
                file_size_bytes=file_size,
                parse_time_ms=int((time.time() - start_time) * 1000),
                errors=[str(e)],
            )

    @classmethod
    def list_parsers(cls) -> List[str]:
        """List all registered parser names."""
        return list(cls._parsers.keys())

    @classmethod
    def list_supported_extensions(cls) -> List[str]:
        """List all supported file extensions."""
        return list(cls._extension_map.keys())

    @classmethod
    def is_supported(cls, file_path: Union[str, Path]) -> bool:
        """Check if a file format is supported."""
        return cls.get_parser(file_path) is not None


def parse_file(file_path: Union[str, Path], **options) -> ParseResult:
    """
    Convenience function to parse a file.

    Args:
        file_path: Path to the file to parse
        **options: Parser-specific options

    Returns:
        ParseResult with parsed data and metadata
    """
    return ParserRegistry.parse(file_path, **options)


def register_default_parsers() -> None:
    """Register all default parsers."""
    # Import and register parsers
    # This is called at module load time
    pass


# Initialize default parsers when this module is imported
def _init_parsers():
    """Initialize and register default parsers."""
    try:
        from .parquet_parser import ParquetParser
        ParserRegistry.register(ParquetParser())
    except ImportError as e:
        logger.debug(f"Parquet parser not available: {e}")

    try:
        from .hdf5_parser import HDF5Parser
        ParserRegistry.register(HDF5Parser())
    except ImportError as e:
        logger.debug(f"HDF5 parser not available: {e}")

    try:
        from .pdf_parser import PDFParser
        ParserRegistry.register(PDFParser())
    except ImportError as e:
        logger.debug(f"PDF parser not available: {e}")


# Don't auto-register to avoid import errors
# Call _init_parsers() explicitly when needed

"""
Parser Registry

Central registry for file format parsers.
"""

from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Union
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ParseResult:
    """Result of parsing a file"""
    success: bool
    data: Any  # DataFrame, dict, or extracted text
    metadata: Dict[str, Any]
    format: str
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    error: Optional[str] = None


# Parser function signature
ParserFunc = Callable[[str], ParseResult]


class ParserRegistry:
    """
    Registry of file parsers by extension.

    Usage:
        registry = ParserRegistry()
        result = registry.parse('/path/to/file.parquet')
    """

    _parsers: Dict[str, ParserFunc] = {}

    @classmethod
    def register(cls, extension: str, parser: ParserFunc) -> None:
        """Register a parser for an extension"""
        ext = extension.lower().lstrip('.')
        cls._parsers[ext] = parser
        logger.debug(f"Registered parser for .{ext}")

    @classmethod
    def get_parser(cls, extension: str) -> Optional[ParserFunc]:
        """Get parser for an extension"""
        ext = extension.lower().lstrip('.')
        return cls._parsers.get(ext)

    @classmethod
    def supported_extensions(cls) -> list:
        """List all supported extensions"""
        return list(cls._parsers.keys())

    @classmethod
    def parse(cls, file_path: str) -> ParseResult:
        """Parse a file using the appropriate parser"""
        path = Path(file_path)

        if not path.exists():
            return ParseResult(
                success=False,
                data=None,
                metadata={},
                format='unknown',
                error=f"File not found: {file_path}"
            )

        # Get extension (handle .tar.gz, etc.)
        suffixes = path.suffixes
        if len(suffixes) >= 2 and suffixes[-2:] == ['.tar', '.gz']:
            ext = 'tar.gz'
        else:
            ext = path.suffix.lower().lstrip('.')

        parser = cls.get_parser(ext)

        if parser is None:
            return ParseResult(
                success=False,
                data=None,
                metadata={'file_path': str(path)},
                format=ext,
                error=f"No parser registered for .{ext}"
            )

        try:
            return parser(str(path))
        except Exception as e:
            logger.exception(f"Parser error for {file_path}")
            return ParseResult(
                success=False,
                data=None,
                metadata={'file_path': str(path)},
                format=ext,
                error=str(e)
            )


def get_parser(extension: str) -> Optional[ParserFunc]:
    """Get parser for an extension"""
    return ParserRegistry.get_parser(extension)


# Decorator for registering parsers
def register_parser(extension: str):
    """Decorator to register a parser function"""
    def decorator(func: ParserFunc) -> ParserFunc:
        ParserRegistry.register(extension, func)
        return func
    return decorator

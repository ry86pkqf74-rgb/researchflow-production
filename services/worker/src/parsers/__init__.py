"""
Data Parsers Module

Provides parsers for various data formats:
- Parquet
- HDF5
- PDF
- CSV/Excel
- GeoJSON/Shapefiles
- Images (via OCR)
"""

from .registry import ParserRegistry, ParseResult, parse_file, BaseParser
from .parquet_parser import ParquetParser
from .hdf5_parser import HDF5Parser
from .pdf_parser import PDFParser
from .ocr_pipeline import (
    OcrPipeline,
    OcrResult,
    OcrConfig,
    extract_text_ocr,
    is_ocr_available,
)

__all__ = [
    # Registry
    "ParserRegistry",
    "ParseResult",
    "parse_file",
    "BaseParser",
    # Parsers
    "ParquetParser",
    "HDF5Parser",
    "PDFParser",
    # OCR
    "OcrPipeline",
    "OcrResult",
    "OcrConfig",
    "extract_text_ocr",
    "is_ocr_available",
]

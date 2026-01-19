"""
Multi-format Parsers Module

Provides parsing for various data formats:
- Parquet
- HDF5
- PDF (via PyMuPDF or GROBID)
- JSONL/NDJSON
- ZIP archives (recursive)
"""

from .registry import ParserRegistry, get_parser, ParseResult
from .parquet_parser import parse_parquet
from .hdf5_parser import parse_hdf5
from .pdf_parser import parse_pdf
from .jsonl_parser import parse_jsonl
from .zip_recursive import parse_zip_recursive
from .grobid_parser import parse_pdf_with_grobid, GrobidResult

__all__ = [
    'ParserRegistry',
    'get_parser',
    'ParseResult',
    'parse_parquet',
    'parse_hdf5',
    'parse_pdf',
    'parse_jsonl',
    'parse_zip_recursive',
    'parse_pdf_with_grobid',
    'GrobidResult',
]

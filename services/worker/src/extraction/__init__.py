"""
Document Extraction Module
Phase A - Task 17: Apache Tika Integration
"""

from .tika_client import (
    TikaClient,
    TikaExtractionError,
    ExtractionResult,
    MetadataResult,
    get_tika_client
)

__all__ = [
    "TikaClient",
    "TikaExtractionError",
    "ExtractionResult",
    "MetadataResult",
    "get_tika_client"
]

"""
Deduplication Module

Provides fuzzy and exact deduplication capabilities.
"""

from .fuzzy_dedup import (
    FuzzyDeduplicator,
    DedupConfig,
    DedupResult,
    deduplicate_records,
    find_duplicates,
)

__all__ = [
    "FuzzyDeduplicator",
    "DedupConfig",
    "DedupResult",
    "deduplicate_records",
    "find_duplicates",
]

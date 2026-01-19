"""
Data Cleaning Module

Provides deduplication and data cleaning utilities.
"""

from .dedup import deduplicate, DedupResult

__all__ = [
    'deduplicate',
    'DedupResult',
]

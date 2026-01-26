"""
Conform Module - Data Standardization and Conformance.

This module provides utilities for standardizing data across multiple sources:
- Linkage key normalization (research_id canonical key)
- Column name standardization
- Data type conformance

Submodules:
- linkage_key_normalizer: Normalize variant research IDs to canonical key
"""

from src.conform.linkage_key_normalizer import (
    normalize_linkage_key,
    normalize_linkage_keys_batch,
    find_linkage_key_column,
    validate_linkage_key,
    NormalizationResult,
    CANONICAL_KEY,
    KNOWN_VARIANTS,
)

__all__ = [
    "normalize_linkage_key",
    "normalize_linkage_keys_batch",
    "find_linkage_key_column",
    "validate_linkage_key",
    "NormalizationResult",
    "CANONICAL_KEY",
    "KNOWN_VARIANTS",
]

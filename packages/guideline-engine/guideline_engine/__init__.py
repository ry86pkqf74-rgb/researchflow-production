"""Guideline Engine package for ResearchFlow.

This package provides:
- Deterministic clinical calculations (calculator.py)
- Guideline fetching and parsing (core.py)
- Source URL mappings (sources.py)
- Redis caching (cache.py)
"""

# Core fetch/parse/suggest functions
from .core import (
    fetch_guideline,
    parse_guideline,
    suggest_validation_and_ideation,
    process_query,
)

# Source management
from .sources import (
    discover_url,
    list_sources,
    list_fields,
    list_categories,
    GUIDELINE_SOURCES,
)

# Cache module
from . import cache

# Calculator (deterministic rules)
from .calculator import RuleCalculator, CalculationResult

__all__ = [
    # Core
    "fetch_guideline",
    "parse_guideline",
    "suggest_validation_and_ideation",
    "process_query",
    # Sources
    "discover_url",
    "list_sources",
    "list_fields",
    "list_categories",
    "GUIDELINE_SOURCES",
    # Cache
    "cache",
    # Calculator
    "RuleCalculator",
    "CalculationResult",
]

__version__ = "0.2.0"

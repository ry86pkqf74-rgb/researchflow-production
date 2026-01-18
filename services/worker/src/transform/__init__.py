"""
Transform module for data reshaping operations.

Provides utilities for converting between wide and long data formats,
particularly for lab measurement datasets.

GOVERNANCE NOTICE:
- This module performs STRUCTURAL transformations only
- NO statistical analysis, aggregation, or modeling
- NO PHI columns emitted (enforced by denylist)
"""

from src.transform.wide_to_long import (
    wide_labs_to_long,
    detect_wide_lab_blocks,
    PHI_OUTPUT_DENYLIST,
)

__all__ = [
    "wide_labs_to_long",
    "detect_wide_lab_blocks",
    "PHI_OUTPUT_DENYLIST",
]

__version__ = "v1.0.0"

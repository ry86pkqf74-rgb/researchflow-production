"""
Reproducible figure generation and management.

This module provides utilities for:
- Centralized figure styling
- Deterministic figure saving with preflight checks
- Figure manifest generation for tracking and auditing

All figures generated through this module are:
- Reproducibly styled
- Metadata-tagged
- Hash-verified
- Tracked in manifest.jsonl
"""

from .style import set_publication_style, get_color_palette
from .savefig import save_figure, FigureMetadata
from .manifest import FigureManifest, generate_manifest

__all__ = [
    "set_publication_style",
    "get_color_palette",
    "save_figure",
    "FigureMetadata",
    "FigureManifest",
    "generate_manifest",
]

__version__ = "1.0.0"

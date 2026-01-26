"""
ROS Sourcelit - Offline Codebase Indexing and Query

Module: ros_sourcelit (avoid shadowing external 'sourcelit' package)

Key Features:
- Offline-first indexing (no network calls)
- Paths-only output (no file content exposure in STANDBY)
- Deterministic ordering (alphabetically sorted)
- PHI-safe (excludes restricted paths)
- Runtime-only output (.tmp/ directory, never committed)

Last Updated: 2026-01-08
"""

__version__ = "1.0.0"

from .index import build_index
from .query import execute_query
from .verify import verify_index

__all__ = ["build_index", "execute_query", "verify_index"]

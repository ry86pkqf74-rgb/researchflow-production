"""Sourcelit runtime integration layer (PR9B-3)

SANDBOX-only, offline-only synthesis over normalized literature artifacts.
All runtime artifacts are confined to `.tmp/sourcelit_runtime/`.

Last Updated: 2026-01-09
"""

from .runtime import SourcelitRuntimeError, SourcelitRunHandle, run_sourcelit_runtime

__all__ = [
    "SourcelitRuntimeError",
    "SourcelitRunHandle",
    "run_sourcelit_runtime",
]

__version__ = "1.0.0"

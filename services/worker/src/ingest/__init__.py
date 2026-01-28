"""
Data Ingestion Module

Provides data ingestion capabilities including:
- Multi-file/multi-sheet ingestion with merge
- PHI stripping and de-identification
- Patient-generated signals processing
- Excel inventory processing
"""

# Lazy imports to avoid circular dependency issues
__all__ = [
    'MultiFileIngestEngine',
    'MergeManifest',
    'MergeResult',
]


def __getattr__(name):
    """Lazy import for module attributes."""
    if name in __all__:
        from .merge_ingest import (
            MultiFileIngestEngine,
            MergeManifest,
            MergeResult,
        )
        globals().update({
            'MultiFileIngestEngine': MultiFileIngestEngine,
            'MergeManifest': MergeManifest,
            'MergeResult': MergeResult,
        })
        return globals()[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

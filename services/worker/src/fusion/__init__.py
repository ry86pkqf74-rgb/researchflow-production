"""
Data Fusion Module

Provides data fusion and integration capabilities:
- Schema alignment
- Join/union operations
- Provenance tracking
"""

from .fusion_engine import (
    FusionEngine,
    FusionConfig,
    FusionResult,
    fuse_datasets,
)
from .schema_alignment import (
    align_schemas,
    SchemaAlignment,
    ColumnMapping,
)

__all__ = [
    "FusionEngine",
    "FusionConfig",
    "FusionResult",
    "fuse_datasets",
    "align_schemas",
    "SchemaAlignment",
    "ColumnMapping",
]

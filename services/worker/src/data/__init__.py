"""Data module - Dataset registry and lifecycle management.

Phase 2 implementation for LIVE-ready data plane:
- Dataset registry (metadata-only)
- Quarantine ingestion
- Promotion flow with capability gating
"""

from .registry import DatasetRecord, DatasetRegistry, DatasetStatus
from .promotion import promote_dataset, PromotionResult
from .loader import (
    load_dataset_df,
    export_dataset_to_bytes,
    get_dataset_path,
    find_dataset_file,
)
from .exceptions import (
    DatasetError,
    DatasetNotFoundError,
    DatasetFileNotFoundError,
    DatasetLoadError,
    UnsupportedFormatError,
)

__all__ = [
    "DatasetRecord",
    "DatasetRegistry",
    "DatasetStatus",
    "promote_dataset",
    "PromotionResult",
    "load_dataset_df",
    "export_dataset_to_bytes",
    "get_dataset_path",
    "find_dataset_file",
    "DatasetError",
    "DatasetNotFoundError",
    "DatasetFileNotFoundError",
    "DatasetLoadError",
    "UnsupportedFormatError",
]

"""
Ingestion Schema Layer (PR9A-1)

Declarative schema validation for structured data ingestion.
Fail-closed validation: no preview on invalid data.

Modules:
- config: Configuration for large-data ingestion (Dask, chunked processing)
- schema_loader: Load and validate YAML/Python schema definitions
- validator: Validate data against schemas with fail-closed semantics
- ingestion: High-level ingestion wrapper with provenance hooks

SAFETY INVARIANTS:
- All processing in .tmp/ (no persistence outside)
- No PHI handling
- No network access
- Fail-closed validation (invalid data rejected)

Last Updated: 2026-01-23 (Phase 3: Dask/chunk validation)
"""

from .config import (
    IngestionConfig,
    AutoRefineConfig,
    get_ingestion_config,
    get_auto_refine_config,
    reset_config,
    reset_auto_refine_config,
)
from .schema_loader import load_schema, SchemaDefinition
from .validator import (
    validate_dataframe,
    validate_data,  # New: handles Dask/chunked data
    ValidationResult,
    ValidationError,
    ChunkValidationError,  # New: per-chunk error tracking
    DASK_AVAILABLE as VALIDATOR_DASK_AVAILABLE,
)
from .ingestion import (
    ingest_file,
    ingest_file_large,
    IngestionMetadata,
    DASK_AVAILABLE,
)
from .runtime import ingest_runtime, IngestionPreviewHandle

__all__ = [
    # Config
    "IngestionConfig",
    "AutoRefineConfig",
    "get_ingestion_config",
    "get_auto_refine_config",
    "reset_config",
    "reset_auto_refine_config",
    # Schema
    "load_schema",
    "SchemaDefinition",
    # Validation
    "validate_dataframe",  # Original: pandas only
    "validate_data",       # New: Dask/chunked/pandas
    "ValidationResult",
    "ValidationError",
    "ChunkValidationError",
    # Ingestion
    "ingest_file",
    "ingest_file_large",
    "ingest_runtime",
    "IngestionPreviewHandle",
    "IngestionMetadata",
    "DASK_AVAILABLE",
]

__version__ = "1.3.0"

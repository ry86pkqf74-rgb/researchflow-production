"""
Ingestion Schema Layer (PR9A-1)

Declarative schema validation for structured data ingestion.
Fail-closed validation: no preview on invalid data.

Modules:
- schema_loader: Load and validate YAML/Python schema definitions
- validator: Validate data against schemas with fail-closed semantics
- ingestion: High-level ingestion wrapper with provenance hooks

SAFETY INVARIANTS:
- All processing in .tmp/ (no persistence outside)
- No PHI handling
- No network access
- Fail-closed validation (invalid data rejected)

Last Updated: 2026-01-09
"""

from .schema_loader import load_schema, SchemaDefinition
from .validator import validate_dataframe, ValidationResult
from .ingestion import ingest_file
from .runtime import ingest_runtime, IngestionPreviewHandle

__all__ = [
    "load_schema",
    "SchemaDefinition",
    "validate_dataframe",
    "ValidationResult",
    "ingest_file",
    "ingest_runtime",
    "IngestionPreviewHandle",
]

__version__ = "1.0.0"

"""
Provenance logging for ROS core operations.

This module provides minimal metadata-only logging for pipeline operations.
Logs are written to .tmp/provenance/ and contain NO PHI or row-level data.

Key differences from web_frontend/utils/provenance.py:
- This is for core src/ pipeline runs (not UI sessions)
- Simpler structure: operation metadata only
- Uses .tmp/ for temporary run artifacts (not reports/)

Governance: docs/governance/PHI_BOUNDARIES.md

**NEW UNIFIED INTERFACE (preferred):**
    from src.provenance import log_event, ProvenanceEvent, EventType

**LEGACY INTERFACE (deprecated, but maintained for compatibility):**
    from src.provenance import log_operation, ProvenanceLogger
"""

# Unified interface (preferred)
from .event import (
    ProvenanceEvent,
    EventType,
    RuntimeMode,
    Classification,
)
from .unified import (
    log_event,
    load_events,
    get_event_summary,
)

# Artifact store (Task 3)
from .artifact_store import (
    ArtifactStoreError,
    StoredArtifact,
    new_run_id,
    sha256_bytes,
    store_text,
    store_bytes,
    reports_root,
)

# Legacy interface (maintained for compatibility)
from .logger import (
    ProvenanceLogger,
    log_operation,
    log_dataset_load,
    log_ai_request,
)

__all__ = [
    # Unified interface (preferred)
    "ProvenanceEvent",
    "EventType",
    "RuntimeMode",
    "Classification",
    "log_event",
    "load_events",
    "get_event_summary",
    # Artifact store (Task 3)
    "ArtifactStoreError",
    "StoredArtifact",
    "new_run_id",
    "sha256_bytes",
    "store_text",
    "store_bytes",
    "reports_root",
    # Legacy interface (deprecated)
    "ProvenanceLogger",
    "log_operation",
    # High-level helpers
    "log_dataset_load",
    "log_ai_request",
]

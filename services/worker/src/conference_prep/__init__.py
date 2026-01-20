"""
Conference Preparation Module

Provides conference discovery, guideline extraction, material generation,
validation, export bundling, and provenance tracking for Stage 20.

Key Components:
- discovery: Conference search and matching
- guidelines: Guideline extraction and PHI sanitization
- generate_materials: Poster/slides/abstract generation
- export_bundle: Package bundling for submission
- registry: Conference requirements registry
- provenance: PHI-safe artifact provenance tracking
"""

__version__ = "1.1.0"

from .provenance import (
    ArtifactType,
    PhiScanStatus,
    ProvenanceRelationType,
    PhiFinding,
    ProvenanceEdge,
    ArtifactProvenanceRecord,
    create_provenance_record,
    add_provenance_edge,
    rescan_for_phi,
    validate_provenance_chain,
    generate_export_manifest,
    scan_text_for_phi,
)

__all__ = [
    "ArtifactType",
    "PhiScanStatus",
    "ProvenanceRelationType",
    "PhiFinding",
    "ProvenanceEdge",
    "ArtifactProvenanceRecord",
    "create_provenance_record",
    "add_provenance_edge",
    "rescan_for_phi",
    "validate_provenance_chain",
    "generate_export_manifest",
    "scan_text_for_phi",
]

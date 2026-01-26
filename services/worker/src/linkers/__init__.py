"""
Cross-Modal Linker Specifications Module

This module provides declarative specifications for linking clinical events
across modalities (molecular, imaging, surgical). It is a SPECIFICATION-ONLY
layer that does NOT execute any data processing.

Governance: SSAP v1.0 Compliant
Status: Pre-Analysis Only
Execution: PROHIBITED until lane activation

BOUNDARY: This module MUST NOT import or depend on src/linkage/.

Relationship to src/linkage/:
- src/linkage/ = Execution engine for diagnostic→pathology links
- src/linkers/ = Specification layer for cross-modal linking rules

Author: Research Operating System
Date: 2025-12-25
Version: 1.0.0
"""

__version__ = "1.0.0"
__status__ = "specification_only"

from .spec import (
    LinkableEntity,
    Laterality,
    Directionality,
    Cardinality,
    ConfidenceCategory,
    TimeWindow,
    LateralityRule,
    LinkTypeSpec,
    LinkerConfig,
    load_linker_config,
)

from .validator import (
    LinkerSchemaValidator,
    ValidationResult,
    validate_linker_config,
    validate_time_window,
    validate_laterality_compatibility,
)

__all__ = [
    # Enums
    "LinkableEntity",
    "Laterality",
    "Directionality",
    "Cardinality",
    "ConfidenceCategory",
    # Data classes
    "TimeWindow",
    "LateralityRule",
    "LinkTypeSpec",
    "LinkerConfig",
    # Loaders
    "load_linker_config",
    # Validators
    "LinkerSchemaValidator",
    "ValidationResult",
    "validate_linker_config",
    "validate_time_window",
    "validate_laterality_compatibility",
]

"""
Linkage Module with CI Guardrails

This module provides production-grade deterministic linkage between multi-modal
diagnostic data (imaging, cytology, molecular) and outcomes (pathology, surgery).

Key Features:
- Deterministic linkage rules with configurable date tolerances
- CI validation checks (time-gap bounds, cardinality, prohibited combinations)
- Immutable audit logging for all link decisions
- Materialized views for linkage quality monitoring

Components:
- linkage_engine.py: Core linkage logic with date tolerances
- linkage_validators.py: CI validation checks and guardrails
- audit_log.py: Immutable audit trail for link decisions

Author: Research Operating System
Date: 2025-12-22
Version: 1.0.0
"""

__version__ = "1.0.0"

from .linkage_engine import (
    LinkageConfig,
    create_linkage,
    link_ct_to_pathology,
    link_fna_to_pathology,
    link_molecular_to_pathology,
    validate_linkage_temporal_bounds,
)

from .linkage_validators import (
    LinkageValidator,
    validate_time_gap_bounds,
    validate_cardinality,
    validate_prohibited_combinations,
    run_all_validation_checks,
)

from .audit_log import (
    AuditLogger,
    log_linkage_decision,
    get_audit_trail,
    export_audit_log,
)

__all__ = [
    # Core linkage functions
    "LinkageConfig",
    "create_linkage",
    "link_ct_to_pathology",
    "link_fna_to_pathology",
    "link_molecular_to_pathology",
    "validate_linkage_temporal_bounds",
    # Validation
    "LinkageValidator",
    "validate_time_gap_bounds",
    "validate_cardinality",
    "validate_prohibited_combinations",
    "run_all_validation_checks",
    # Audit logging
    "AuditLogger",
    "log_linkage_decision",
    "get_audit_trail",
    "export_audit_log",
]

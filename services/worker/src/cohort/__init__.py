"""
Cohort Assembly Module - SAP-Aligned Scaffolding.

Provides structured cohort assembly aligned to SAP §2 (Study Population)
concepts. This module is SCAFFOLDING ONLY - actual analysis is performed
only when analysis lanes are authorized.

GOVERNANCE NOTICE:
- This module provides STRUCTURAL scaffolding only
- NO outcomes, labels, or model features computed
- NO cohort counts for manuscript
- NO real data processing without authorization
- PHI checks enforced upstream (via src/ingest/phi_strip_ingestion.py)

Module Structure (aligned to SAP §2):
- assemble_cohort.py: Main cohort assembly orchestration
- eligibility_checks.py: Individual eligibility rule functions

Expected Upstream Dependencies:
- Linkage key normalization (src/conform/linkage_key_normalizer.py)
- PHI-stripped ingestion (src/ingest/phi_strip_ingestion.py)
- Schema validation (schemas/pandera/)
"""

from src.cohort.assemble_cohort import (
    CohortResult,
    assemble_cohort,
    create_empty_cohort_result,
)
from src.cohort.eligibility_checks import (
    EligibilityRule,
    check_has_required_column,
    check_non_null_linkage_key,
    check_value_in_set,
    check_value_range,
    apply_eligibility_rules,
)

__all__ = [
    # Core result structure
    "CohortResult",
    # Assembly functions
    "assemble_cohort",
    "create_empty_cohort_result",
    # Eligibility rule components
    "EligibilityRule",
    "check_has_required_column",
    "check_non_null_linkage_key",
    "check_value_in_set",
    "check_value_range",
    "apply_eligibility_rules",
]

__version__ = "v1.0.0"

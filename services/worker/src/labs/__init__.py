"""Laboratory utilities module.

Provides:
- UCUM unit validation (ucum.py)
- Reference interval registry (reference_intervals.py)

Version: 1.0.0
Date: 2025-12-26
Status: PRE-ANALYSIS SCAFFOLD
"""

from .ucum import (
    UCUMValidator,
    UCUMValidationResult,
    check_ucum_unit,
    check_ucum_unit_strict,
    get_allowed_units,
    normalize_unit,
)

from .reference_intervals import (
    ReferenceInterval,
    ReferenceIntervalRegistry,
    RegistryValidationResult,
    load_registry,
    validate_registry,
    lookup_reference_interval,
)

__all__ = [
    # UCUM validation
    "UCUMValidator",
    "UCUMValidationResult",
    "check_ucum_unit",
    "check_ucum_unit_strict",
    "get_allowed_units",
    "normalize_unit",
    # Reference intervals
    "ReferenceInterval",
    "ReferenceIntervalRegistry",
    "RegistryValidationResult",
    "load_registry",
    "validate_registry",
    "lookup_reference_interval",
]

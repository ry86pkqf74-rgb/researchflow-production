"""UCUM unit validation for laboratory measurements.

This module provides validation hooks for UCUM (Unified Code for Units of Measure)
units in laboratory datasets. It is a READ-ONLY VALIDATOR that does not perform
any data transformations.

Design Principles:
- Allowlist-based validation (conservative)
- No data transformations (validation only)
- Config-driven (units loaded from YAML)
- Pandera-compatible check functions

See: config/units/ucum_allowlist.yaml

Version: 1.0.0
Date: 2025-12-26
Status: PRE-ANALYSIS SCAFFOLD
"""

import yaml
from pathlib import Path
from typing import Set, Dict, Optional, List, Tuple
from dataclasses import dataclass, field


@dataclass
class UCUMValidationResult:
    """Result of UCUM unit validation."""

    valid: bool
    unit: str
    normalized_unit: Optional[str] = None
    message: str = ""

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            "valid": self.valid,
            "unit": self.unit,
            "normalized_unit": self.normalized_unit,
            "message": self.message,
        }


class UCUMValidator:
    """Validator for UCUM unit codes.

    Loads allowlist from configuration and provides validation methods
    compatible with Pandera schema checks.

    This is a READ-ONLY validator. It does not transform data.
    """

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize UCUM validator.

        Args:
            config_path: Path to ucum_allowlist.yaml. If None, uses default location.
        """
        if config_path is None:
            # Default location relative to this file
            self.config_path = (
                Path(__file__).parent.parent.parent
                / "config"
                / "units"
                / "ucum_allowlist.yaml"
            )
        else:
            self.config_path = Path(config_path)

        self._allowlist: Set[str] = set()
        self._equivalence_map: Dict[str, str] = {}
        self._blocked_patterns: List[str] = []
        self._config_loaded: bool = False
        self._validation_mode: str = "permissive"

    def _load_config(self) -> None:
        """Load configuration from YAML file."""
        if self._config_loaded:
            return

        if not self.config_path.exists():
            # Graceful degradation: empty allowlist if config not found
            self._config_loaded = True
            return

        with open(self.config_path, "r") as f:
            config = yaml.safe_load(f)

        if config is None:
            self._config_loaded = True
            return

        # Build allowlist from all unit categories
        for category in [
            "concentration_units",
            "ratio_units",
            "size_units",
            "mass_units",
        ]:
            units = config.get(category, [])
            for unit_def in units:
                if isinstance(unit_def, dict) and "code" in unit_def:
                    self._allowlist.add(unit_def["code"])

        # Load equivalence mappings
        self._equivalence_map = config.get("equivalence_mappings", {})

        # Add canonical forms from equivalence map to allowlist
        for canonical in self._equivalence_map.values():
            self._allowlist.add(canonical)

        # Load validation settings
        validation = config.get("validation", {})
        self._validation_mode = validation.get("default_mode", "permissive")
        self._blocked_patterns = validation.get("blocked_patterns", [])

        self._config_loaded = True

    @property
    def allowlist(self) -> Set[str]:
        """Get the set of allowed UCUM units."""
        self._load_config()
        return self._allowlist.copy()

    @property
    def equivalence_map(self) -> Dict[str, str]:
        """Get the unit equivalence mapping."""
        self._load_config()
        return self._equivalence_map.copy()

    def is_valid_unit(self, unit: str) -> bool:
        """Check if a unit is in the allowlist.

        Args:
            unit: Unit string to validate

        Returns:
            True if unit is valid (in allowlist or maps to allowlist)
        """
        self._load_config()

        if not unit or not isinstance(unit, str):
            return False

        unit = unit.strip()

        # Check for blocked patterns (likely PHI)
        for pattern in self._blocked_patterns:
            if pattern.lower() in unit.lower():
                return False

        # Direct match
        if unit in self._allowlist:
            return True

        # Check equivalence mapping
        if unit in self._equivalence_map:
            return True

        return False

    def normalize_unit(self, unit: str) -> Optional[str]:
        """Get the canonical UCUM form of a unit.

        Args:
            unit: Unit string to normalize

        Returns:
            Canonical form if mapping exists, original if already canonical, None if invalid
        """
        self._load_config()

        if not unit or not isinstance(unit, str):
            return None

        unit = unit.strip()

        # Check equivalence mapping first
        if unit in self._equivalence_map:
            return self._equivalence_map[unit]

        # Return as-is if in allowlist
        if unit in self._allowlist:
            return unit

        return None

    def validate(self, unit: str) -> UCUMValidationResult:
        """Validate a unit and return detailed result.

        Args:
            unit: Unit string to validate

        Returns:
            UCUMValidationResult with validation details
        """
        self._load_config()

        if not unit or not isinstance(unit, str):
            return UCUMValidationResult(
                valid=False,
                unit=str(unit) if unit else "",
                message="Unit is empty or not a string",
            )

        unit = unit.strip()

        # Check blocked patterns
        for pattern in self._blocked_patterns:
            if pattern.lower() in unit.lower():
                return UCUMValidationResult(
                    valid=False,
                    unit=unit,
                    message=f"Unit contains blocked pattern: {pattern}",
                )

        # Check direct match
        if unit in self._allowlist:
            return UCUMValidationResult(
                valid=True, unit=unit, normalized_unit=unit, message="Valid UCUM unit"
            )

        # Check equivalence mapping
        if unit in self._equivalence_map:
            return UCUMValidationResult(
                valid=True,
                unit=unit,
                normalized_unit=self._equivalence_map[unit],
                message=f"Valid unit (maps to {self._equivalence_map[unit]})",
            )

        # Not in allowlist
        if self._validation_mode == "strict":
            return UCUMValidationResult(
                valid=False, unit=unit, message="Unit not in UCUM allowlist"
            )
        else:
            # Permissive mode: warn but allow
            return UCUMValidationResult(
                valid=True,  # Allow in permissive mode
                unit=unit,
                message="Unit not in allowlist (permissive mode)",
            )

    def validate_series(self, units: List[str]) -> List[UCUMValidationResult]:
        """Validate a list of unit values.

        Args:
            units: List of unit strings

        Returns:
            List of validation results
        """
        return [self.validate(u) for u in units]


# =============================================================================
# PANDERA CHECK FUNCTIONS
# =============================================================================


def check_ucum_unit(unit: str) -> bool:
    """Pandera-compatible check for UCUM unit validity.

    For use in pandera.Check() or @pa.check decorators.
    Uses permissive mode by default.

    Args:
        unit: Unit string to check

    Returns:
        True if unit is valid (or permissively allowed)
    """
    validator = UCUMValidator()
    result = validator.validate(unit)
    return result.valid


def check_ucum_unit_strict(unit: str) -> bool:
    """Strict Pandera check for UCUM unit validity.

    Rejects any unit not explicitly in the allowlist.

    Args:
        unit: Unit string to check

    Returns:
        True only if unit is in allowlist
    """
    validator = UCUMValidator()
    return validator.is_valid_unit(unit)


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================


def get_allowed_units() -> Set[str]:
    """Get the set of all allowed UCUM units.

    Returns:
        Set of valid unit codes
    """
    validator = UCUMValidator()
    return validator.allowlist


def normalize_unit(unit: str) -> Optional[str]:
    """Normalize a unit to its canonical UCUM form.

    Args:
        unit: Unit string to normalize

    Returns:
        Canonical form or None if not mappable
    """
    validator = UCUMValidator()
    return validator.normalize_unit(unit)

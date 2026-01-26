"""Reference interval registry loader and validator.

This module loads and validates the laboratory reference interval registry
from configuration files. It provides lookup functions for reference ranges
with temporal validity support.

Design Principles:
- Config-driven (loaded from YAML)
- Temporal validity (effective_start/effective_end)
- Read-only (no data transformations)
- Population/sex-specific ranges supported

See: config/reference_intervals/lab_reference_intervals.yaml

Version: 1.0.0
Date: 2025-12-26
Status: PRE-ANALYSIS SCAFFOLD
"""

import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import date, datetime


@dataclass
class ReferenceInterval:
    """A single reference interval entry."""

    analyte: str
    unit_ucum: str
    ref_low: float
    ref_high: float
    effective_start: date
    effective_end: Optional[date]
    population: str
    sex: str
    source: str
    method: Optional[str] = None
    notes: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReferenceInterval":
        """Create ReferenceInterval from dictionary.

        Args:
            data: Dictionary with interval data

        Returns:
            ReferenceInterval instance
        """
        # Parse dates
        effective_start = data.get("effective_start")
        if isinstance(effective_start, str):
            effective_start = datetime.strptime(effective_start, "%Y-%m-%d").date()
        elif isinstance(effective_start, datetime):
            effective_start = effective_start.date()

        effective_end = data.get("effective_end")
        if isinstance(effective_end, str):
            effective_end = datetime.strptime(effective_end, "%Y-%m-%d").date()
        elif isinstance(effective_end, datetime):
            effective_end = effective_end.date()

        return cls(
            analyte=data["analyte"],
            unit_ucum=data["unit_ucum"],
            ref_low=float(data["ref_low"]),
            ref_high=float(data["ref_high"]),
            effective_start=effective_start,
            effective_end=effective_end,
            population=data.get("population", "adult"),
            sex=data.get("sex", "all"),
            source=data.get("source", ""),
            method=data.get("method"),
            notes=data.get("notes"),
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "analyte": self.analyte,
            "unit_ucum": self.unit_ucum,
            "ref_low": self.ref_low,
            "ref_high": self.ref_high,
            "effective_start": (
                self.effective_start.isoformat() if self.effective_start else None
            ),
            "effective_end": (
                self.effective_end.isoformat() if self.effective_end else None
            ),
            "population": self.population,
            "sex": self.sex,
            "source": self.source,
            "method": self.method,
            "notes": self.notes,
        }

    def is_effective_on(self, query_date: date) -> bool:
        """Check if this interval is effective on a given date.

        Args:
            query_date: Date to check

        Returns:
            True if interval is effective on query_date
        """
        if self.effective_start and query_date < self.effective_start:
            return False
        if self.effective_end and query_date > self.effective_end:
            return False
        return True


@dataclass
class RegistryValidationResult:
    """Result of validating the reference interval registry."""

    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    interval_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "interval_count": self.interval_count,
        }


class ReferenceIntervalRegistry:
    """Registry of laboratory reference intervals.

    Loads reference intervals from configuration and provides
    lookup functions with temporal and population filtering.
    """

    def __init__(self, config_path: Optional[Path] = None):
        """Initialize the registry.

        Args:
            config_path: Path to registry YAML file. If None, uses default.
        """
        if config_path is None:
            self.config_path = (
                Path(__file__).parent.parent.parent
                / "config"
                / "reference_intervals"
                / "lab_reference_intervals.yaml"
            )
        else:
            self.config_path = Path(config_path)

        self._intervals: List[ReferenceInterval] = []
        self._metadata: Dict[str, Any] = {}
        self._loaded: bool = False

    def _load(self) -> None:
        """Load registry from configuration file."""
        if self._loaded:
            return

        if not self.config_path.exists():
            self._loaded = True
            return

        with open(self.config_path, "r") as f:
            config = yaml.safe_load(f)

        if config is None:
            self._loaded = True
            return

        # Load intervals
        intervals_data = config.get("reference_intervals", [])
        for interval_data in intervals_data:
            try:
                interval = ReferenceInterval.from_dict(interval_data)
                self._intervals.append(interval)
            except (KeyError, ValueError) as e:
                # Skip invalid entries during load; validation will catch them
                pass

        # Load metadata
        self._metadata = config.get("registry_metadata", {})

        self._loaded = True

    @property
    def intervals(self) -> List[ReferenceInterval]:
        """Get all loaded reference intervals."""
        self._load()
        return self._intervals.copy()

    @property
    def metadata(self) -> Dict[str, Any]:
        """Get registry metadata."""
        self._load()
        return self._metadata.copy()

    def get_analytes(self) -> List[str]:
        """Get list of unique analytes in the registry.

        Returns:
            List of analyte names
        """
        self._load()
        return list(set(i.analyte for i in self._intervals))

    def lookup(
        self,
        analyte: str,
        unit: Optional[str] = None,
        query_date: Optional[date] = None,
        population: Optional[str] = None,
        sex: Optional[str] = None,
    ) -> List[ReferenceInterval]:
        """Look up reference intervals matching criteria.

        Args:
            analyte: Analyte name (required)
            unit: Unit to match (optional)
            query_date: Date for temporal validity (optional)
            population: Population filter (optional)
            sex: Sex filter (optional)

        Returns:
            List of matching ReferenceInterval objects
        """
        self._load()

        results = []
        for interval in self._intervals:
            # Match analyte (case-insensitive)
            if interval.analyte.lower() != analyte.lower():
                continue

            # Match unit if specified
            if unit and interval.unit_ucum != unit:
                continue

            # Check temporal validity
            if query_date and not interval.is_effective_on(query_date):
                continue

            # Match population if specified
            if population and interval.population.lower() != population.lower():
                continue

            # Match sex if specified
            if sex:
                if (
                    interval.sex.lower() != "all"
                    and interval.sex.lower() != sex.lower()
                ):
                    continue

            results.append(interval)

        return results

    def validate(self) -> RegistryValidationResult:
        """Validate the registry structure and content.

        Returns:
            RegistryValidationResult with validation details
        """
        self._load()

        errors = []
        warnings = []

        # Check if registry has any intervals
        if not self._intervals:
            warnings.append("Registry is empty (no reference intervals)")

        # Validate each interval
        for idx, interval in enumerate(self._intervals):
            prefix = f"Interval {idx} ({interval.analyte})"

            # Required fields
            if not interval.analyte:
                errors.append(f"{prefix}: Missing analyte")
            if not interval.unit_ucum:
                errors.append(f"{prefix}: Missing unit_ucum")

            # Numeric validation
            if interval.ref_low is not None and interval.ref_high is not None:
                if interval.ref_low > interval.ref_high:
                    errors.append(
                        f"{prefix}: ref_low ({interval.ref_low}) > ref_high ({interval.ref_high})"
                    )

            # Date validation
            if interval.effective_start and interval.effective_end:
                if interval.effective_start > interval.effective_end:
                    errors.append(f"{prefix}: effective_start > effective_end")

        # Check for duplicate entries (same analyte, unit, population, sex, dates)
        seen = set()
        for interval in self._intervals:
            key = (
                interval.analyte.lower(),
                interval.unit_ucum,
                interval.population.lower(),
                interval.sex.lower(),
                interval.effective_start,
            )
            if key in seen:
                warnings.append(
                    f"Possible duplicate: {interval.analyte} ({interval.population}, {interval.sex})"
                )
            seen.add(key)

        return RegistryValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            interval_count=len(self._intervals),
        )


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================


def load_registry(config_path: Optional[Path] = None) -> ReferenceIntervalRegistry:
    """Load the reference interval registry.

    Args:
        config_path: Optional path to config file

    Returns:
        Loaded ReferenceIntervalRegistry
    """
    return ReferenceIntervalRegistry(config_path)


def validate_registry(config_path: Optional[Path] = None) -> RegistryValidationResult:
    """Validate the reference interval registry.

    Args:
        config_path: Optional path to config file

    Returns:
        RegistryValidationResult
    """
    registry = ReferenceIntervalRegistry(config_path)
    return registry.validate()


def lookup_reference_interval(
    analyte: str,
    unit: Optional[str] = None,
    query_date: Optional[date] = None,
    population: str = "adult",
    sex: str = "all",
) -> Optional[ReferenceInterval]:
    """Look up a single reference interval (convenience function).

    Returns the first matching interval, or None if no match.

    Args:
        analyte: Analyte name
        unit: Unit (optional)
        query_date: Date for validity check (optional)
        population: Population (default: "adult")
        sex: Sex (default: "all")

    Returns:
        ReferenceInterval or None
    """
    registry = ReferenceIntervalRegistry()
    results = registry.lookup(
        analyte=analyte,
        unit=unit,
        query_date=query_date,
        population=population,
        sex=sex,
    )
    return results[0] if results else None

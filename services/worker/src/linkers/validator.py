"""
Cross-Modal Linker Schema Validator

This module provides READ-ONLY validation of linker specifications.
It validates the schema and rules WITHOUT executing any data processing.

Governance: SSAP v1.0 Compliant
Status: Pre-Analysis Only
V-17 Style: Verification harness for specification correctness
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

import yaml

from .spec import (
    LinkerConfig,
    LinkTypeSpec,
    TimeWindow,
    Laterality,
    Cardinality,
    load_linker_config,
)


class ValidationSeverity(Enum):
    """Severity levels for validation findings."""

    ERROR = "ERROR"  # Blocks execution
    WARNING = "WARNING"  # Should be addressed
    INFO = "INFO"  # Informational only


@dataclass
class ValidationFinding:
    """A single validation finding."""

    severity: ValidationSeverity
    rule: str
    message: str
    location: Optional[str] = None

    def __str__(self) -> str:
        loc = f" [{self.location}]" if self.location else ""
        return f"[{self.severity.value}]{loc} {self.rule}: {self.message}"


@dataclass
class ValidationResult:
    """Complete validation result with all findings."""

    is_valid: bool
    findings: List[ValidationFinding] = field(default_factory=list)
    config_version: str = ""
    validator_version: str = "1.0.0"

    @property
    def error_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == ValidationSeverity.ERROR)

    @property
    def warning_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == ValidationSeverity.WARNING)

    def add_finding(self, finding: ValidationFinding) -> None:
        """Add a finding and update validity."""
        self.findings.append(finding)
        if finding.severity == ValidationSeverity.ERROR:
            self.is_valid = False

    def add_error(
        self, rule: str, message: str, location: Optional[str] = None
    ) -> None:
        """Convenience method to add an error."""
        self.add_finding(
            ValidationFinding(
                severity=ValidationSeverity.ERROR,
                rule=rule,
                message=message,
                location=location,
            )
        )

    def add_warning(
        self, rule: str, message: str, location: Optional[str] = None
    ) -> None:
        """Convenience method to add a warning."""
        self.add_finding(
            ValidationFinding(
                severity=ValidationSeverity.WARNING,
                rule=rule,
                message=message,
                location=location,
            )
        )

    def add_info(self, rule: str, message: str, location: Optional[str] = None) -> None:
        """Convenience method to add an info finding."""
        self.add_finding(
            ValidationFinding(
                severity=ValidationSeverity.INFO,
                rule=rule,
                message=message,
                location=location,
            )
        )

    def summary(self) -> str:
        """Generate summary string."""
        status = "VALID" if self.is_valid else "INVALID"
        return (
            f"Validation {status}: "
            f"{self.error_count} errors, {self.warning_count} warnings, "
            f"{len(self.findings) - self.error_count - self.warning_count} info"
        )


class LinkerSchemaValidator:
    """
    Validator for linker specification schemas.

    This is a READ-ONLY validator that checks specification correctness
    WITHOUT executing any data processing or computing links.

    V-17 Style Validation Rules:
    - Schema completeness
    - Enum validity
    - Window sanity
    - Cardinality consistency
    """

    REQUIRED_ENTITY_FIELDS = {"patient_id", "event_date", "laterality", "event_id"}
    VALID_LATERALITY_VALUES = {"LEFT", "RIGHT", "BILATERAL", "MIDLINE", "NA"}
    VALID_CARDINALITY_VALUES = {
        "one_to_one",
        "one_to_many",
        "many_to_one",
        "many_to_many",
    }
    VALID_DIRECTIONALITY_VALUES = {"forward", "backward", "bidirectional"}

    def __init__(self, config: LinkerConfig):
        """Initialize validator with a linker configuration."""
        self.config = config
        self.result = ValidationResult(is_valid=True, config_version=config.version)

    def validate(self) -> ValidationResult:
        """
        Run all validation checks.

        Returns:
            ValidationResult with all findings.
        """
        self._validate_schema_completeness()
        self._validate_enum_validity()
        self._validate_window_sanity()
        self._validate_cardinality_consistency()
        self._validate_entity_references()
        self._validate_confidence_weights()

        return self.result

    def _validate_schema_completeness(self) -> None:
        """Check that all required schema elements are present."""
        # Check entities have required fields
        for entity_name, entity_spec in self.config.entities.items():
            missing_fields = self.REQUIRED_ENTITY_FIELDS - set(
                entity_spec.required_fields
            )
            if missing_fields:
                self.result.add_error(
                    rule="schema_completeness",
                    message=f"Missing required fields: {missing_fields}",
                    location=f"entities.{entity_name}",
                )

            if not entity_spec.source_patterns:
                self.result.add_error(
                    rule="schema_completeness",
                    message="Entity must have at least one source_pattern",
                    location=f"entities.{entity_name}",
                )

        # Check link types have all required attributes
        for link_id, link_spec in self.config.link_types.items():
            if not link_spec.description:
                self.result.add_warning(
                    rule="schema_completeness",
                    message="Link type missing description",
                    location=f"link_types.{link_id}",
                )

    def _validate_enum_validity(self) -> None:
        """Check that enum values are valid."""
        # Check laterality values in compatibility matrix
        for source_lat, target_map in self.config.laterality_compatibility.items():
            if source_lat not in self.VALID_LATERALITY_VALUES:
                self.result.add_error(
                    rule="enum_validity",
                    message=f"Invalid source laterality: {source_lat}",
                    location="laterality_rules.compatibility_matrix",
                )

            for target_lat in target_map.keys():
                if target_lat not in self.VALID_LATERALITY_VALUES:
                    self.result.add_error(
                        rule="enum_validity",
                        message=f"Invalid target laterality: {target_lat}",
                        location="laterality_rules.compatibility_matrix",
                    )

        # Check link type cardinality values
        for link_id, link_spec in self.config.link_types.items():
            if link_spec.cardinality.value not in self.VALID_CARDINALITY_VALUES:
                self.result.add_error(
                    rule="enum_validity",
                    message=f"Invalid cardinality: {link_spec.cardinality.value}",
                    location=f"link_types.{link_id}",
                )

    def _validate_window_sanity(self) -> None:
        """Check that time windows are logically valid."""
        for link_id, link_spec in self.config.link_types.items():
            window = link_spec.time_window

            # min_days <= max_days (already enforced in TimeWindow, but double-check)
            if window.min_days > window.max_days:
                self.result.add_error(
                    rule="window_sanity",
                    message=f"min_days ({window.min_days}) > max_days ({window.max_days})",
                    location=f"link_types.{link_id}.time_window",
                )

            # Bidirectional links should have symmetric windows
            if link_spec.directionality.value == "bidirectional":
                if not window.is_symmetric:
                    self.result.add_warning(
                        rule="window_sanity",
                        message="Bidirectional link has asymmetric time window",
                        location=f"link_types.{link_id}.time_window",
                    )

            # Warn on very large windows
            if window.span_days > 365:
                self.result.add_warning(
                    rule="window_sanity",
                    message=f"Time window span ({window.span_days} days) exceeds 1 year",
                    location=f"link_types.{link_id}.time_window",
                )

    def _validate_cardinality_consistency(self) -> None:
        """Check that cardinality rules are consistent."""
        # Build map of inverse relationships
        link_pairs: Dict[Tuple[str, str], List[str]] = {}
        for link_id, link_spec in self.config.link_types.items():
            key = (link_spec.source_entity.value, link_spec.target_entity.value)
            if key not in link_pairs:
                link_pairs[key] = []
            link_pairs[key].append(link_id)

        # Check for conflicting cardinality on same entity pair
        for (source, target), link_ids in link_pairs.items():
            if len(link_ids) > 1:
                cardinalities = [
                    self.config.link_types[lid].cardinality.value for lid in link_ids
                ]
                if len(set(cardinalities)) > 1:
                    self.result.add_warning(
                        rule="cardinality_consistency",
                        message=f"Multiple link types for {source}→{target} with different cardinality",
                        location=f"link_types: {link_ids}",
                    )

    def _validate_entity_references(self) -> None:
        """Check that link types reference defined entities."""
        defined_entities = set(self.config.entities.keys())

        for link_id, link_spec in self.config.link_types.items():
            source = link_spec.source_entity.value
            target = link_spec.target_entity.value

            if source not in defined_entities:
                self.result.add_error(
                    rule="entity_reference",
                    message=f"Source entity '{source}' not defined in entities",
                    location=f"link_types.{link_id}",
                )

            if target not in defined_entities:
                self.result.add_error(
                    rule="entity_reference",
                    message=f"Target entity '{target}' not defined in entities",
                    location=f"link_types.{link_id}",
                )

    def _validate_confidence_weights(self) -> None:
        """Check that confidence weights sum to 1.0."""
        for link_id, link_spec in self.config.link_types.items():
            total = link_spec.window_position_weight + link_spec.laterality_match_weight
            if abs(total - 1.0) > 0.01:
                self.result.add_error(
                    rule="confidence_weights",
                    message=f"Weights sum to {total}, expected 1.0",
                    location=f"link_types.{link_id}",
                )


def validate_linker_config(config_path: Optional[Path] = None) -> ValidationResult:
    """
    Convenience function to validate a linker configuration file.

    Args:
        config_path: Path to linker_rules.yaml. If None, uses default location.

    Returns:
        ValidationResult with all findings.
    """
    config = load_linker_config(config_path)
    validator = LinkerSchemaValidator(config)
    return validator.validate()


def validate_time_window(window: TimeWindow) -> List[str]:
    """
    Validate a single time window specification.

    Returns list of error messages (empty if valid).
    """
    errors = []

    if window.min_days > window.max_days:
        errors.append(f"min_days ({window.min_days}) > max_days ({window.max_days})")

    if window.span_days > 730:  # 2 years
        errors.append(f"Time window span ({window.span_days} days) exceeds 2 years")

    return errors


def validate_laterality_compatibility(
    config: LinkerConfig,
    source: Laterality,
    target: Laterality,
) -> Tuple[bool, str, List[str]]:
    """
    Validate laterality compatibility between source and target.

    Args:
        config: LinkerConfig with compatibility matrix.
        source: Source event laterality.
        target: Target event laterality.

    Returns:
        Tuple of (is_compatible, confidence_level, warnings).
    """
    warnings = []

    is_compatible, confidence = config.is_laterality_compatible(source, target)

    if source == Laterality.NA or target == Laterality.NA:
        warnings.append("NA laterality reduces confidence")

    if source == Laterality.BILATERAL and target not in (
        Laterality.BILATERAL,
        Laterality.NA,
    ):
        warnings.append(
            "BILATERAL source with specific target may indicate data quality issue"
        )

    return is_compatible, confidence, warnings


def main() -> int:
    """CLI entry point for linker schema validation.

    Returns:
        Exit code (0 = success, 1 = errors found)
    """
    import argparse
    import json
    import sys

    parser = argparse.ArgumentParser(
        description="Validate linker configuration schemas",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m src.linkers.validator
  python -m src.linkers.validator --json linker_report.json
  python -m src.linkers.validator --config config/linkers/linker_rules.yaml
        """,
    )
    parser.add_argument(
        "--config",
        metavar="PATH",
        help="Path to linker_rules.yaml (default: config/linkers/linker_rules.yaml)",
    )
    parser.add_argument(
        "--json",
        metavar="FILE",
        help="Write JSON report to file",
    )

    args = parser.parse_args()

    print("=== Linker Schema Validation ===")
    print()

    try:
        config_path = Path(args.config) if args.config else None
        result = validate_linker_config(config_path)
    except FileNotFoundError as e:
        print(f"❌ Configuration file not found: {e}")
        return 1
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        return 1

    # Print findings
    for finding in result.findings:
        if finding.severity == ValidationSeverity.ERROR:
            prefix = "❌ ERROR"
        elif finding.severity == ValidationSeverity.WARNING:
            prefix = "⚠️  WARN"
        else:
            prefix = "ℹ️  INFO"

        loc = f" [{finding.location}]" if finding.location else ""
        print(f"{prefix}{loc}")
        print(f"    {finding.rule}: {finding.message}")

    print()
    print(f"Summary: {result.summary()}")

    if result.is_valid:
        print("✓ Linker schema validation PASSED")
    else:
        print("✗ Linker schema validation FAILED")

    # Write JSON report if requested
    if args.json:
        report = {
            "valid": result.is_valid,
            "config_version": result.config_version,
            "validator_version": result.validator_version,
            "error_count": result.error_count,
            "warning_count": result.warning_count,
            "findings": [
                {
                    "severity": f.severity.value,
                    "rule": f.rule,
                    "message": f.message,
                    "location": f.location,
                }
                for f in result.findings
            ],
        }
        with open(args.json, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\nReport written to: {args.json}")

    return 0 if result.is_valid else 1


if __name__ == "__main__":
    import sys

    sys.exit(main())

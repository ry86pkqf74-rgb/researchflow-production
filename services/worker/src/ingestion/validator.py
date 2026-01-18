"""Validator for Ingestion Schema Layer (PR9A-1)

Validates a pandas DataFrame against a declarative SchemaDefinition.

Fail-closed semantics:
- ValidationResult.valid must be True for ingestion to return any preview/data.

Last Updated: 2026-01-09
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

import pandas as pd

from .schema_loader import SchemaDefinition


class ValidationError(ValueError):
    """Raised when schema or data validation fails (fail-closed)."""


@dataclass(frozen=True)
class ValidationResult:
    """Result of validating a DataFrame against a schema."""

    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def raise_if_invalid(self) -> None:
        if not self.valid:
            raise ValidationError(
                "; ".join(self.errors) if self.errors else "Validation failed"
            )


_DECLARED_TYPE_CANONICAL_DTYPE = {
    "string": "string",
    "integer": "int64",
    "float": "float64",
    "boolean": "bool",
    "datetime": "datetime64[ns, UTC]",
}


def validate_dataframe(
    df: pd.DataFrame,
    schema: SchemaDefinition,
    *,
    coerce_types: bool = True,
) -> ValidationResult:
    """Validate a DataFrame against SchemaDefinition.

    Args:
        df: DataFrame to validate.
        schema: Parsed schema definition.
        coerce_types: If True, attempt safe coercion before type checks.

    Returns:
        ValidationResult
    """
    errors: List[str] = []
    warnings: List[str] = []

    if df is None:
        return ValidationResult(False, errors=["DataFrame is None"], warnings=[])

    # Required columns present
    missing_required = [c for c in schema.required_columns if c not in df.columns]
    if missing_required:
        errors.append(f"Missing required columns: {missing_required}")

    # If required columns missing, fail closed early (do not attempt coercions)
    if errors:
        return ValidationResult(False, errors=errors, warnings=warnings)

    pending_coercions: Dict[str, pd.Series] = {}

    # Validate each declared column
    for col_def in schema.columns:
        if col_def.name not in df.columns:
            if col_def.required:
                errors.append(f"Missing required column: {col_def.name}")
            continue

        series = df[col_def.name]
        original_na = series.isna()

        # Nullability check
        if not col_def.nullable:
            if series.isna().any():
                errors.append(
                    f"Column '{col_def.name}' contains nulls but nullable=false"
                )

        # Type coercion + type checks
        if coerce_types:
            coerced = _coerce_series(series, col_def.type)
            if coerced is None:
                errors.append(
                    f"Column '{col_def.name}' could not be coerced to type {col_def.type}"
                )
            else:
                introduced_na = coerced.isna() & ~original_na
                if introduced_na.any():
                    errors.append(
                        f"Column '{col_def.name}' has values that cannot be coerced to {col_def.type}"
                    )
                pending_coercions[col_def.name] = coerced
                series = coerced

        if not _is_series_type(series, col_def.type):
            errors.append(
                f"Column '{col_def.name}' type mismatch: expected {col_def.type}, got {series.dtype}"
            )

    if errors:
        return ValidationResult(False, errors=errors, warnings=warnings)

    if coerce_types and pending_coercions:
        for col_name, coerced in pending_coercions.items():
            df[col_name] = coerced

    return ValidationResult(True, errors=errors, warnings=warnings)


def _coerce_series(series: pd.Series, declared_type: str) -> Optional[pd.Series]:
    try:
        if declared_type == "string":
            # Preserve nulls as <NA>
            return series.astype("string")

        if declared_type == "integer":
            # Use pandas nullable integer
            coerced = pd.to_numeric(series, errors="coerce")
            return coerced.astype("Int64")

        if declared_type == "float":
            coerced = pd.to_numeric(series, errors="coerce")
            return coerced.astype("float64")

        if declared_type == "boolean":
            # Accept common truthy/falsey representations
            if series.dtype == bool:
                return series
            if str(series.dtype).startswith("boolean"):
                return series
            mapped = series.map(_to_bool)
            return mapped.astype("boolean")

        if declared_type == "datetime":
            coerced = pd.to_datetime(series, errors="coerce", utc=True)
            return coerced

        return None
    except (TypeError, ValueError, OverflowError):
        return None


def _to_bool(value):
    if pd.isna(value):
        return pd.NA
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if value == 1:
            return True
        if value == 0:
            return False
        return pd.NA
    if isinstance(value, str):
        s = value.strip().lower()
        if s in {"true", "t", "yes", "y", "1"}:
            return True
        if s in {"false", "f", "no", "n", "0"}:
            return False
    return pd.NA


def _is_series_type(series: pd.Series, declared_type: str) -> bool:
    dtype_str = str(series.dtype)

    if declared_type == "string":
        return dtype_str in {"string", "object"}

    if declared_type == "integer":
        return dtype_str in {"Int64", "int64", "int32"}

    if declared_type == "float":
        return dtype_str.startswith("float")

    if declared_type == "boolean":
        return dtype_str in {"bool", "boolean"}

    if declared_type == "datetime":
        return dtype_str.startswith("datetime")

    return False

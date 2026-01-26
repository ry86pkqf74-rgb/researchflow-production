"""
Pandera validator wrapper.

Wraps existing Pandera DataFrameModel schemas for use in the validation suite registry.
This validator is always offline-safe since Pandera validation is local DataFrame operations.

Usage:
    from schemas.pandera.thyroid_fna_schema import FNAResultsSchema
    from src.validation.validators.pandera_validator import PanderaValidator

    validator = PanderaValidator(FNAResultsSchema)
    result = validator.validate(df)
"""

import pandas as pd
import pandera as pa
from typing import Type

from .base import BaseValidator, ValidatorResult


class PanderaValidator(BaseValidator):
    """
    Validator that wraps existing Pandera DataFrameModel schemas.

    This is a thin wrapper that:
    1. Takes a Pandera schema class
    2. Validates DataFrames against the schema
    3. Returns ValidatorResult with pass/fail status

    No refactoring of existing schemas is required - this simply wraps them.
    """

    def __init__(self, schema: Type[pa.DataFrameModel], schema_name: str = None):
        """
        Initialize Pandera validator.

        Args:
            schema: Pandera DataFrameModel class to use for validation
            schema_name: Optional human-readable name (defaults to schema.__name__)
        """
        self.schema = schema
        self.schema_name = schema_name or schema.__name__

    def is_offline_safe(self) -> bool:
        """Pandera validation is always offline-safe (local DataFrame operations)."""
        return True

    def _validate_impl(self, artifact: pd.DataFrame) -> ValidatorResult:
        """
        Validate DataFrame against Pandera schema.

        Args:
            artifact: pandas DataFrame to validate

        Returns:
            ValidatorResult with:
            - status: "pass" if valid, "fail" if invalid
            - message: Summary message
            - details: Schema errors if validation failed
        """
        try:
            # Use lazy=True to collect all errors before raising
            validated_df = self.schema.validate(artifact, lazy=True)

            return ValidatorResult(
                validator_name=f"PanderaValidator({self.schema_name})",
                status="pass",
                message=f"DataFrame passed {self.schema_name} validation ({len(validated_df)} rows)",
                details={
                    "schema": self.schema_name,
                    "rows_validated": len(validated_df),
                    "columns_checked": list(validated_df.columns),
                }
            )

        except pa.errors.SchemaErrors as e:
            # Pandera lazy validation collects multiple errors
            failure_cases = e.failure_cases

            return ValidatorResult(
                validator_name=f"PanderaValidator({self.schema_name})",
                status="fail",
                message=f"DataFrame failed {self.schema_name} validation: {len(failure_cases)} errors",
                details={
                    "schema": self.schema_name,
                    "total_failures": len(failure_cases),
                    "failure_cases": failure_cases.to_dict("records") if len(failure_cases) <= 10 else failure_cases.head(10).to_dict("records"),
                    "error_summary": str(e)[:500],  # Truncate long error messages
                }
            )

        except Exception as e:
            # Catch unexpected errors (e.g., wrong data type, missing columns)
            return ValidatorResult(
                validator_name=f"PanderaValidator({self.schema_name})",
                status="fail",
                message=f"Unexpected validation error: {type(e).__name__}",
                details={
                    "schema": self.schema_name,
                    "error_type": type(e).__name__,
                    "error_message": str(e)[:500],
                }
            )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"PanderaValidator(schema={self.schema_name}, offline_safe=True)"

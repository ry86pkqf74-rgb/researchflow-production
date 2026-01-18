"""
Schema Validator - Layer 1

Validates data against Pandera schemas with type checking, null constraints,
and range validation.
"""

import logging
from typing import Dict, List, Optional, Any
import pandas as pd
import pandera as pa
from pathlib import Path

from .layered_verifier import LayerResult, VerificationLayer, VerificationStatus

logger = logging.getLogger(__name__)


class SchemaValidator:
    """
    Pandera-based schema validation.

    Checks:
    - Column types (int, float, str, datetime)
    - Null constraints (nullable vs non-nullable)
    - Value ranges (min/max, allowed values)
    - Custom validators (regex, custom functions)
    """

    def __init__(self, schema_dir: Optional[Path] = None):
        """
        Initialize schema validator.

        Parameters
        ----------
        schema_dir : Path, optional
            Directory containing Pandera schema definitions
        """
        self.schema_dir = schema_dir or Path("schemas/pandera")
        self.schemas = {}
        logger.info(f"Initialized SchemaValidator with schema_dir: {self.schema_dir}")

    def load_schema(self, schema_name: str) -> pa.DataFrameSchema:
        """Load Pandera schema by name"""
        if schema_name in self.schemas:
            return self.schemas[schema_name]

        # Try to import from schemas directory
        try:
            schema_path = self.schema_dir / f"{schema_name}.py"
            if not schema_path.exists():
                raise FileNotFoundError(f"Schema not found: {schema_path}")

            # Dynamically import schema
            import importlib.util

            spec = importlib.util.spec_from_file_location(schema_name, schema_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Get schema object
            schema = getattr(module, "schema")
            self.schemas[schema_name] = schema
            logger.info(f"Loaded schema: {schema_name}")
            return schema

        except Exception as e:
            logger.error(f"Failed to load schema '{schema_name}': {e}")
            raise

    def validate(
        self, data: pd.DataFrame, schema_name: str, strict: bool = False
    ) -> LayerResult:
        """
        Validate data against Pandera schema.

        Parameters
        ----------
        data : pd.DataFrame
            Data to validate
        schema_name : str
            Name of schema to validate against
        strict : bool
            If True, treat warnings as errors

        Returns
        -------
        LayerResult
            Schema validation result
        """
        logger.info(f"Validating data against schema: {schema_name}")
        logger.info(f"Data shape: {data.shape}")

        warnings = []
        errors = []
        metrics = {}

        try:
            # Load schema
            schema = self.load_schema(schema_name)

            # Validate
            validated_data = schema.validate(data, lazy=True)

            # Count validation checks passed
            metrics["rows_validated"] = len(data)
            metrics["columns_validated"] = len(data.columns)
            metrics["schema_name"] = schema_name

            logger.info(f"✅ Schema validation PASSED")
            logger.info(f"  Rows: {metrics['rows_validated']}")
            logger.info(f"  Columns: {metrics['columns_validated']}")

            return LayerResult(
                layer=VerificationLayer.SCHEMA,
                status=VerificationStatus.PASSED,
                passed=True,
                metrics=metrics,
            )

        except pa.errors.SchemaErrors as e:
            # Pandera schema errors (multiple violations)
            logger.error(f"Schema validation FAILED: {len(e.failure_cases)} violations")

            # Extract error details
            for idx, row in e.failure_cases.iterrows():
                error_msg = (
                    f"Column '{row['column']}', Index {row['index']}: {row['check']}"
                )
                errors.append(error_msg)

            metrics["total_violations"] = len(e.failure_cases)
            metrics["violation_summary"] = (
                e.failure_cases.groupby("column")["check"].count().to_dict()
            )

            return LayerResult(
                layer=VerificationLayer.SCHEMA,
                status=VerificationStatus.FAILED,
                passed=False,
                errors=errors,
                metrics=metrics,
            )

        except pa.errors.SchemaError as e:
            # Single schema error
            logger.error(f"Schema validation FAILED: {e}")
            errors.append(str(e))

            return LayerResult(
                layer=VerificationLayer.SCHEMA,
                status=VerificationStatus.FAILED,
                passed=False,
                errors=errors,
            )

        except Exception as e:
            logger.exception(f"Schema validation raised exception")
            errors.append(f"Exception: {str(e)}")

            return LayerResult(
                layer=VerificationLayer.SCHEMA,
                status=VerificationStatus.FAILED,
                passed=False,
                errors=errors,
            )


def validate_schema(
    data: pd.DataFrame, schema_name: str, strict: bool = False
) -> LayerResult:
    """Convenience function for schema validation"""
    validator = SchemaValidator()
    return validator.validate(data, schema_name, strict)


def get_schema_errors(result: LayerResult) -> List[str]:
    """Extract schema errors from layer result"""
    return result.errors if result.errors else []

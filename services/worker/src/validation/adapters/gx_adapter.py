"""
Great Expectations Adapter Stub (Tier-2 Only)

WARNING: This module is for manuscript documentation only.
DO NOT use in CI or runtime validation paths.

This adapter converts Pandera schemas to Great Expectations expectation suite JSON
for generating HTML Data Docs in manuscript supplements.

Governance: See docs/validation/TIER2_GREAT_EXPECTATIONS.md

Import Quarantine:
  This module raises ImportError if NO_NETWORK=1 to prevent accidental use in CI.
"""

import os

# CRITICAL: Import quarantine - block in offline/CI mode
if os.getenv("NO_NETWORK") == "1":
    raise ImportError(
        "Great Expectations adapter is Tier-2 only and cannot be imported "
        "in CI or offline mode. See docs/validation/TIER2_GREAT_EXPECTATIONS.md for details."
    )

import json
from pathlib import Path
from typing import Any, Dict, Type

import pandera as pa


def pandera_to_gx_expectations(
    schema: Type[pa.DataFrameModel],
    suite_name: str,
    output_path: Path = None,
) -> Dict[str, Any]:
    """
    Convert Pandera schema to Great Expectations expectation suite JSON.

    WARNING: This is for manuscript documentation only.
    DO NOT use in CI or runtime validation paths.

    Args:
        schema: Pandera DataFrameModel class
        suite_name: Name for the expectation suite
        output_path: Optional path to save JSON (default: docs/validation/expectation_suites/{suite_name}.json)

    Returns:
        GX expectation suite as dict

    Raises:
        ImportError: If called in offline/CI mode (NO_NETWORK=1)
    """
    # Build GX expectation suite structure
    expectations = []

    # Convert Pandera DataFrameModel to schema object to access columns
    # Note: Pandera DataFrameModel doesn't have __fields__; use to_schema() instead
    schema_obj = schema.to_schema()
    
    # Map Pandera columns to GX expectations
    for col_name, col_schema in schema_obj.columns.items():
        # Check: Column exists
        expectations.append({
            "expectation_type": "expect_column_to_exist",
            "kwargs": {"column": col_name}
        })

        # Check: Non-nullable fields
        # Access nullable property from column schema
        if not col_schema.nullable:
            expectations.append({
                "expectation_type": "expect_column_values_to_not_be_null",
                "kwargs": {"column": col_name}
            })

        # Check: Numeric ranges (ge, le)
        # Note: This is a simplified stub - full implementation would parse Pandera checks
        # For INF-14, this demonstrates the concept without full Pandera introspection

    # Build GX suite structure
    suite = {
        "expectation_suite_name": suite_name,
        "data_asset_type": "Dataset",
        "meta": {
            "great_expectations_version": "0.15.0",  # Example version
            "generated_by": "pandera_to_gx_adapter (Tier-2 only)",
            "source_schema": schema.__name__,
        },
        "expectations": expectations,
    }

    # Save to file if output_path provided
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(suite, f, indent=2)

    return suite


def generate_gx_suite_from_pandera(
    schema: Type[pa.DataFrameModel],
    output_dir: Path = None,
) -> Path:
    """
    Generate GX expectation suite JSON from Pandera schema.

    Convenience function that generates suite name from schema and saves to standard location.

    Args:
        schema: Pandera DataFrameModel class
        output_dir: Output directory (default: docs/validation/expectation_suites/)

    Returns:
        Path to generated expectation suite JSON

    Raises:
        ImportError: If called in offline/CI mode (NO_NETWORK=1)
    """
    if output_dir is None:
        output_dir = Path("docs/validation/expectation_suites")

    suite_name = f"{schema.__name__}.suite"
    output_path = output_dir / f"{suite_name}.json"

    pandera_to_gx_expectations(schema, suite_name, output_path)

    return output_path


# Example usage (commented out - for reference only)
"""
from schemas.pandera.thyroid_fna_schema import FNAResultsSchema

# Generate GX suite (MANUSCRIPT USE ONLY)
suite_path = generate_gx_suite_from_pandera(FNAResultsSchema)
print(f"Generated GX suite: {suite_path}")
"""

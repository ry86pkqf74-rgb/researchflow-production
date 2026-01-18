"""
Pandera schema for patients core table.

This is a generic stub. Real projects define canonical patient fields via:
- Extraction specifications (docs/planning/extraction_spec/)
- Conform rules (src/conform/)
- Institutional data dictionaries

Adjust fields based on project requirements and data governance policies.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class PatientsSchema(pa.DataFrameModel):
    """Pandera schema for validating patients table structure and content."""

    patient_id: Series[str] = pa.Field(nullable=False, unique=True)
    sex: Series[str] = pa.Field(nullable=True, isin=["M", "F", "Unknown"])
    dob: Series[pa.DateTime] = pa.Field(nullable=True)

    class Config:
        strict = True
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """
    Validate a DataFrame against the PatientsSchema.

    Args:
        df: Input DataFrame to validate

    Returns:
        Validated DataFrame with coerced types

    Raises:
        pandera.errors.SchemaError: If validation fails
    """
    return PatientsSchema.validate(df, lazy=True)

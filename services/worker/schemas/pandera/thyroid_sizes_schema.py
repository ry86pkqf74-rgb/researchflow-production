"""
Pandera schema for thyroid sizes/measurements data.

Validates thyroid size and volume measurements from surgical specimens.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class ThyroidSizesSchema(pa.DataFrameModel):
    """
    Schema for thyroid sizes data.

    Source: THyroid Sizes, Stanardized_12_2_25.xlsx
    Contains standardized thyroid lobe and nodule measurements.
    Note: Original key is 'Research ID number', normalized to 'research_id'.
    """

    # Linkage key (normalized from 'Research ID number')
    research_id: Series[int] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # Surgery date (YYYY-MM-DD string format, no time component)
    surg_date: Series[str] = pa.Field(
        nullable=True, description="Surgery date (YYYY-MM-DD format only)"
    )

    # Right lobe measurements
    RL_Formatted: Series[str] = pa.Field(
        nullable=True, description="Right lobe dimensions formatted (L x W x D cm)"
    )

    RL_Volume_cm3: Series[float] = pa.Field(
        ge=0, nullable=True, description="Right lobe volume in cm³"
    )

    # Left lobe measurements
    LL_Formatted: Series[str] = pa.Field(
        nullable=True, description="Left lobe dimensions formatted (L x W x D cm)"
    )

    LL_Volume_cm3: Series[float] = pa.Field(
        ge=0, nullable=True, description="Left lobe volume in cm³"
    )

    # Isthmus measurements
    ISTHMUS_Formatted: Series[str] = pa.Field(
        nullable=True, description="Isthmus dimensions formatted (L x W x D cm)"
    )

    ISTHMUS_Volume_cm3: Series[float] = pa.Field(
        ge=0, nullable=True, description="Isthmus volume in cm³"
    )

    # Pyramidal lobe measurements
    PYRAMIDAL_Formatted: Series[str] = pa.Field(
        nullable=True, description="Pyramidal lobe dimensions formatted"
    )

    PYRAMIDAL_Volume_cm3: Series[float] = pa.Field(
        ge=0, nullable=True, description="Pyramidal lobe volume in cm³"
    )

    # Total thyroid measurements
    TOTAL_Formatted: Series[str] = pa.Field(
        nullable=True, description="Total thyroid dimensions formatted"
    )

    TOTAL_Volume_cm3: Series[float] = pa.Field(
        ge=0, nullable=True, description="Total thyroid volume in cm³"
    )

    # Substernal component
    SUBSTERNAL_Formatted: Series[str] = pa.Field(
        nullable=True, description="Substernal component dimensions"
    )

    SUBSTERNAL_Volume_cm3: Series[float] = pa.Field(
        ge=0, nullable=True, description="Substernal component volume in cm³"
    )

    # Pathology text (may contain PHI - use with caution)
    microscopic_description: Series[str] = pa.Field(
        nullable=True, description="Microscopic pathology description"
    )

    final_path_diagnosis: Series[str] = pa.Field(
        nullable=True, description="Final pathology diagnosis text"
    )

    class Config:
        strict = False
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate thyroid sizes DataFrame."""
    return ThyroidSizesSchema.validate(df, lazy=True)

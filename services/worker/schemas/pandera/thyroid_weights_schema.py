"""
Pandera schema for thyroid weight data.

Validates thyroid specimen weight measurements from surgical pathology.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class ThyroidWeightsSchema(pa.DataFrameModel):
    """
    Schema for thyroid weight data.

    Source: Thyroid_Weight_Data_12_2_25.xlsx
    Contains surgical specimen weight measurements.
    Note: Original key is 'Research ID', normalized to 'research_id'.

    WARNING: This dataset contains 'DOB' column which is PHI.
    The DOB column must be dropped during ingestion.
    """

    # Linkage key (normalized from 'Research ID')
    research_id: Series[int] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # NOTE: DOB is PHI and should NOT be present after ingestion
    # The PHI stripping layer should remove this column

    # Surgery date (string format, time stripped)
    date_of_surgery: Series[str] = pa.Field(
        nullable=True, description="Surgery date (YYYY-MM-DD format only, no time)"
    )

    # Individual lobe weights
    right_lobe_g: Series[float] = pa.Field(
        ge=0, nullable=True, description="Right lobe weight in grams"
    )

    left_lobe_g: Series[float] = pa.Field(
        ge=0, nullable=True, description="Left lobe weight in grams"
    )

    isthmus_g: Series[float] = pa.Field(
        ge=0, nullable=True, description="Isthmus weight in grams"
    )

    total_weight_g: Series[float] = pa.Field(
        ge=0, nullable=True, description="Total thyroid weight in grams"
    )

    specimen_weight_combined: Series[float] = pa.Field(
        ge=0, nullable=True, description="Combined specimen weight in grams"
    )

    notes: Series[str] = pa.Field(nullable=True, description="Weight calculation notes")

    # Pathology text
    final_diagnosis: Series[str] = pa.Field(
        nullable=True, description="Final pathology diagnosis"
    )

    synoptic_diagnosis: Series[str] = pa.Field(
        nullable=True, description="Synoptic diagnosis template"
    )

    gross_path_description: Series[str] = pa.Field(
        nullable=True, description="Gross pathology description"
    )

    microscopic_description: Series[str] = pa.Field(
        nullable=True, description="Microscopic pathology description"
    )

    correction_flag: Series[str] = pa.Field(
        nullable=True, description="Data correction/verification flag"
    )

    class Config:
        strict = False
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate thyroid weights DataFrame."""
    return ThyroidWeightsSchema.validate(df, lazy=True)

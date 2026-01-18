"""
Pandera schema for thyroid pathology reports (benign and malignant).

Validates surgical pathology data with histologic diagnoses.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class ThyroidPathologySchema(pa.DataFrameModel):
    """
    Schema for thyroid pathology reports.

    Covers both benign and malignant diagnoses from surgical specimens.
    """

    # Linkage key
    research_id: Series[str] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # Specimen details
    specimen_type: Series[str] = pa.Field(
        nullable=True, description="Type of thyroid specimen"
    )

    specimen_weight_g: Series[float] = pa.Field(
        ge=0, nullable=True, description="Specimen weight in grams"
    )

    # Diagnosis
    diagnosis: Series[str] = pa.Field(
        nullable=True, description="Primary histologic diagnosis"
    )

    malignancy_status: Series[str] = pa.Field(
        nullable=True, description="Benign vs. malignant classification"
    )

    # Tumor characteristics (if malignant)
    tumor_size_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Largest tumor dimension in mm"
    )

    tumor_focality: Series[str] = pa.Field(
        nullable=True, description="Unifocal vs. multifocal"
    )

    extrathyroidal_extension: Series[bool] = pa.Field(
        nullable=True, description="Presence of ETE"
    )

    lymphovascular_invasion: Series[bool] = pa.Field(
        nullable=True, description="LVI present"
    )

    lymph_nodes_positive: Series[int] = pa.Field(
        ge=0, nullable=True, description="Number of positive LNs"
    )

    lymph_nodes_examined: Series[int] = pa.Field(
        ge=0, nullable=True, description="Total LNs examined"
    )

    # Staging (if malignant)
    pathologic_t_stage: Series[str] = pa.Field(nullable=True, description="pT stage")

    pathologic_n_stage: Series[str] = pa.Field(nullable=True, description="pN stage")

    # Free text
    pathology_report_text: Series[str] = pa.Field(
        nullable=True, description="Full pathology report text"
    )

    class Config:
        strict = False  # Allow additional columns
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate pathology DataFrame."""
    return ThyroidPathologySchema.validate(df, lazy=True)

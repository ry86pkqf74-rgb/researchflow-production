"""
Pandera schema for MRI imaging extraction data.

Validates MRI thyroid extraction data with imaging findings.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class ThyroidMRISchema(pa.DataFrameModel):
    """
    Schema for MRI thyroid extraction data.

    Source: mri_extraction__FINAL_11_20_25.xlsx
    Contains AI-extracted MRI findings related to thyroid.
    """

    # Linkage key (uses record_id as variant, normalized to research_id)
    research_id: Series[int] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # Study metadata
    mri_label: Series[str] = pa.Field(
        nullable=True, description="MRI study label (MRI1, MRI2, etc.)"
    )

    date_of_exam: Series[str] = pa.Field(
        nullable=True, description="Date of MRI exam (YYYY-MM-DD format)"
    )

    exam_type_detail: Series[str] = pa.Field(
        nullable=True, description="Detailed exam type description"
    )

    contrast: Series[str] = pa.Field(
        nullable=True, description="Contrast administration (with_iv, without)"
    )

    indication: Series[str] = pa.Field(
        nullable=True, description="Clinical indication for MRI"
    )

    # Thyroid findings (binary flags)
    thyroid_visualized: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Thyroid visualized on MRI (1=yes, 0=no)"
    )

    thyroid_normal: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Thyroid appears normal (1=yes, 0=no)"
    )

    thyroid_nodule: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Thyroid nodule present (1=yes, 0=no)"
    )

    thyroid_enlarged: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Thyroid enlarged (1=yes, 0=no)"
    )

    thyroid_postsurgical: Series[float] = pa.Field(
        ge=0,
        le=1,
        nullable=True,
        description="Post-surgical thyroid changes (1=yes, 0=no)",
    )

    thyroid_mass_effect: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Mass effect from thyroid (1=yes, 0=no)"
    )

    substernal_goiter: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Substernal goiter present (1=yes, 0=no)"
    )

    substernal_extension: Series[float] = pa.Field(
        ge=0,
        le=1,
        nullable=True,
        description="Substernal extension present (1=yes, 0=no)",
    )

    # Detailed findings
    thyroid_details: Series[str] = pa.Field(
        nullable=True, description="Free-text thyroid findings"
    )

    thyroid_dimensions_cm: Series[str] = pa.Field(
        nullable=True, description="Thyroid dimensions in cm"
    )

    # Parathyroid findings
    parathyroid_described: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Parathyroid described (1=yes, 0=no)"
    )

    parathyroid_details: Series[str] = pa.Field(
        nullable=True, description="Parathyroid findings description"
    )

    # Vocal cord findings
    vocal_cords_described: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Vocal cords described (1=yes, 0=no)"
    )

    vocal_cords_normal: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Vocal cords normal (1=yes, 0=no)"
    )

    # Nodule details
    dominant_nodule: Series[str] = pa.Field(
        nullable=True, description="Dominant nodule description"
    )

    nodule1_location: Series[str] = pa.Field(
        nullable=True, description="First nodule location"
    )

    nodule1_size_cm: Series[str] = pa.Field(
        nullable=True, description="First nodule size in cm"
    )

    # Lymph node findings
    lymph_nodes_mentioned: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Lymph nodes mentioned (1=yes, 0=no)"
    )

    pathologic_lymph_nodes: Series[float] = pa.Field(
        ge=0,
        le=1,
        nullable=True,
        description="Pathologic lymph nodes present (1=yes, 0=no)",
    )

    lymph_node_locations: Series[str] = pa.Field(
        nullable=True, description="Lymph node location descriptions"
    )

    # Quality/confidence
    confidence: Series[str] = pa.Field(
        nullable=True, description="Extraction confidence (High/Low)"
    )

    class Config:
        strict = False
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate MRI extraction DataFrame."""
    return ThyroidMRISchema.validate(df, lazy=True)

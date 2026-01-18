"""
Pandera schema for CT imaging extraction data.

Validates CT thyroid extraction data with imaging findings.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class ThyroidCTSchema(pa.DataFrameModel):
    """
    Schema for CT thyroid extraction data.

    Source: CT_thyroid_extraction_FINAL_11_20_25.xlsx
    Contains AI-extracted CT findings related to thyroid.
    """

    # Linkage key (uses record_id as variant, normalized to research_id)
    research_id: Series[int] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # Study metadata
    CT_column: Series[str] = pa.Field(
        nullable=True, description="CT study label (CT1, CT2, etc.)"
    )

    date_of_exam: Series[str] = pa.Field(
        nullable=True, description="Date of CT exam (YYYY-MM-DD format)"
    )

    exam_type_normalized: Series[str] = pa.Field(
        nullable=True, description="Normalized exam type"
    )

    contrast: Series[str] = pa.Field(
        nullable=True, description="Contrast administered (Yes/No)"
    )

    indication: Series[str] = pa.Field(
        nullable=True, description="Clinical indication for CT"
    )

    # Thyroid findings (binary flags)
    thyroid_normal: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Thyroid appears normal (1=yes, 0=no)"
    )

    thyroid_nodule: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Thyroid nodule present (1=yes, 0=no)"
    )

    thyroid_enlarged: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Thyroid enlarged (1=yes, 0=no)"
    )

    thyroid_heterogeneous: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Thyroid heterogeneous (1=yes, 0=no)"
    )

    thyroid_postsurgical: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Post-surgical changes (1=yes, 0=no)"
    )

    thyroid_not_visualized: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Thyroid not visualized (1=yes, 0=no)"
    )

    thyroid_other_abnormality: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Other thyroid abnormality (1=yes, 0=no)"
    )

    # Goiter findings
    goiter_present: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Goiter present (1=yes, 0=no)"
    )

    substernal_extension: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Substernal extension (1=yes, 0=no)"
    )

    # Detailed findings
    thyroid_details: Series[str] = pa.Field(
        nullable=True, description="Free-text thyroid findings"
    )

    # Tracheal findings
    tracheal_deviation: Series[str] = pa.Field(
        nullable=True, description="Tracheal deviation status"
    )

    tracheal_deviation_direction: Series[str] = pa.Field(
        nullable=True, description="Direction of tracheal deviation"
    )

    tracheal_narrowing: Series[str] = pa.Field(
        nullable=True, description="Tracheal narrowing severity"
    )

    airway_compromise_comment: Series[str] = pa.Field(
        nullable=True, description="Airway compromise description"
    )

    # Lymph node findings
    lymph_nodes_enlarged: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Lymph nodes enlarged (1=yes, 0=no)"
    )

    lymph_nodes_suspicious: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Lymph nodes suspicious (1=yes, 0=no)"
    )

    lymph_nodes_mentioned: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Lymph nodes mentioned (1=yes, 0=no)"
    )

    pathologic_lymph_nodes: Series[float] = pa.Field(
        ge=0, le=1, nullable=True, description="Pathologic lymph nodes (1=yes, 0=no)"
    )

    lymph_node_locations: Series[str] = pa.Field(
        nullable=True, description="Lymph node locations"
    )

    largest_lymph_node_short_axis_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Largest LN short axis in mm"
    )

    lymph_node_details: Series[str] = pa.Field(
        nullable=True, description="Lymph node details"
    )

    # Quality/confidence
    confidence: Series[str] = pa.Field(
        nullable=True, description="Extraction confidence (High/Low)"
    )

    class Config:
        strict = False
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate CT extraction DataFrame."""
    return ThyroidCTSchema.validate(df, lazy=True)

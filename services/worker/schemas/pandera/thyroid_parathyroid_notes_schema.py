"""
Pandera schema for parathyroid notes and intent data.

Validates parathyroid surgical notes with gland details and removal intent.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class ParathyroidNotesSchema(pa.DataFrameModel):
    """
    Schema for parathyroid notes data.

    Source: parathyroid_notes_intent.xlsx
    Contains parathyroid gland findings and removal intent classification.
    Note: Original key is 'Research ID number', normalized to 'research_id'.
    """

    # Linkage key (normalized from 'Research ID number')
    research_id: Series[float] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # Parathyroid inclusion
    parathyroid_gland_included: Series[str] = pa.Field(
        nullable=True, description="Parathyroid gland/tissue in specimen (Yes/No)"
    )

    incidental_gland_excision: Series[str] = pa.Field(
        nullable=True, description="Incidental gland excision notes"
    )

    pathologic_glands: Series[str] = pa.Field(
        nullable=True, description="Number of pathologic glands"
    )

    parathyroid_abnormality: Series[str] = pa.Field(
        nullable=True, description="Abnormality type (adenoma/hyperplasia)"
    )

    # Removal intent classification
    removal_intent: Series[str] = pa.Field(
        nullable=True, description="Removal intent (intentional/incidental)"
    )

    removal_intent_evidence: Series[str] = pa.Field(
        nullable=True, description="Evidence supporting removal intent"
    )

    incidental_status_refined: Series[str] = pa.Field(
        nullable=True, description="Refined incidental status"
    )

    note_intent_inferred: Series[str] = pa.Field(
        nullable=True, description="Inferred note intent"
    )

    note_intent_evidence: Series[str] = pa.Field(
        nullable=True, description="Evidence for note intent"
    )

    # Pathology text
    final_path_diagnosis: Series[str] = pa.Field(
        nullable=True, description="Final pathology diagnosis"
    )

    gross_path: Series[str] = pa.Field(
        nullable=True, description="Gross pathology description"
    )

    parathyroid_supporting_fields: Series[str] = pa.Field(
        nullable=True, description="Supporting field data"
    )

    # Gland 1 details
    g1_location: Series[str] = pa.Field(nullable=True, description="Gland 1 location")

    g1_biopsy: Series[str] = pa.Field(
        nullable=True, description="Gland 1 biopsy performed"
    )

    g1_excision: Series[str] = pa.Field(
        nullable=True, description="Gland 1 excision performed"
    )

    g1_cellularity: Series[str] = pa.Field(
        nullable=True, description="Gland 1 cellularity percentage"
    )

    g1_weight: Series[str] = pa.Field(nullable=True, description="Gland 1 weight")

    g1_size: Series[str] = pa.Field(nullable=True, description="Gland 1 size")

    # Gland 2 details
    g2_location: Series[str] = pa.Field(nullable=True, description="Gland 2 location")

    g2_biopsy: Series[str] = pa.Field(
        nullable=True, description="Gland 2 biopsy performed"
    )

    g2_excision: Series[str] = pa.Field(
        nullable=True, description="Gland 2 excision performed"
    )

    g2_cellularity: Series[str] = pa.Field(
        nullable=True, description="Gland 2 cellularity percentage"
    )

    g2_weight: Series[str] = pa.Field(nullable=True, description="Gland 2 weight")

    g2_size: Series[str] = pa.Field(nullable=True, description="Gland 2 size")

    # Gland 3 details
    g3_location: Series[str] = pa.Field(nullable=True, description="Gland 3 location")

    g3_cellularity: Series[str] = pa.Field(
        nullable=True, description="Gland 3 cellularity percentage"
    )

    g3_weight: Series[str] = pa.Field(nullable=True, description="Gland 3 weight")

    # Gland 4 details
    g4_location: Series[str] = pa.Field(nullable=True, description="Gland 4 location")

    g4_cellularity: Series[str] = pa.Field(
        nullable=True, description="Gland 4 cellularity percentage"
    )

    class Config:
        strict = False
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate parathyroid notes DataFrame."""
    return ParathyroidNotesSchema.validate(df, lazy=True)

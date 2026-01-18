"""
Pandera schema for FNA (Fine Needle Aspiration) results.

Validates cytology data with Bethesda scoring system.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class FNAResultsSchema(pa.DataFrameModel):
    """
    Schema for FNA cytology results.

    Bethesda System for Reporting Thyroid Cytopathology:
    - Category I: Nondiagnostic/Unsatisfactory
    - Category II: Benign
    - Category III: Atypia of Undetermined Significance (AUS)
    - Category IV: Follicular Neoplasm/Suspicious for Follicular Neoplasm
    - Category V: Suspicious for Malignancy
    - Category VI: Malignant
    """

    # Linkage key
    research_id: Series[str] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # FNA metadata
    fna_date: Series[str] = pa.Field(
        nullable=True, description="Date of FNA procedure (YYYY-MM format only)"
    )

    # Bethesda classification
    bethesda_category: Series[int] = pa.Field(
        ge=1, le=6, nullable=True, description="Bethesda category (I-VI)"
    )

    # Cytology details
    adequacy: Series[str] = pa.Field(
        nullable=True, description="Sample adequacy (adequate/inadequate)"
    )

    cellularity: Series[str] = pa.Field(
        nullable=True, description="Sample cellularity assessment"
    )

    # Clinical notes (text field)
    cytology_notes: Series[str] = pa.Field(
        nullable=True, description="Free-text cytology interpretation"
    )

    class Config:
        strict = False  # Allow additional columns for now (discovery phase)
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate FNA results DataFrame."""
    return FNAResultsSchema.validate(df, lazy=True)

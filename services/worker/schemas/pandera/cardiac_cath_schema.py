"""
Pandera schema for cardiac catheterization dataset validation.

Schema defines expected structure, types, and constraints for coronary
angiography data including stenosis severity and intervention details.
"""

from __future__ import annotations

import pandera as pa
from pandera.typing import Series


class CardiacCathSchema(pa.DataFrameModel):
    """Schema for validating cardiac catheterization dataset structure and content.

    This schema validates coronary angiography findings including stenosis
    severity in major coronary arteries and intervention details.
    """

    # Linkage key
    research_id: Series[str] = pa.Field(
        nullable=False,
        description="De-identified patient research ID (ROS-CARDIAC-XXXXXX format)",
    )

    # Temporal metadata (generalized to YYYY-MM)
    cath_date: Series[str] = pa.Field(
        nullable=False,
        description="Catheterization date in YYYY-MM format only (de-identified temporal data)",
    )

    # Coronary artery stenosis severity (LAD = Left Anterior Descending)
    lad_stenosis_pct: Series[int] = pa.Field(
        ge=0,
        le=100,
        nullable=False,
        description="LAD stenosis as percentage (≥70% = obstructive; <50% = non-obstructive)",
    )

    # Left Circumflex stenosis
    lcx_stenosis_pct: Series[int] = pa.Field(
        ge=0,
        le=100,
        nullable=False,
        description="LCx stenosis as percentage (≥70% = obstructive; <50% = non-obstructive)",
    )

    # Right Coronary Artery stenosis
    rca_stenosis_pct: Series[int] = pa.Field(
        ge=0,
        le=100,
        nullable=False,
        description="RCA stenosis as percentage (≥70% = obstructive; <50% = non-obstructive)",
    )

    # Number of diseased vessels
    num_vessels_diseased: Series[int] = pa.Field(
        ge=0,
        le=3,
        nullable=False,
        description="Number of coronary vessels with ≥70% stenosis (0=no CAD, 3=3-vessel disease)",
    )

    # Intervention performed
    intervention_performed: Series[bool] = pa.Field(
        nullable=False,
        description="Whether PCI or CABG intervention was performed (False = diagnostic cath only)",
    )

    # Intervention type
    intervention_type: Series[str] = pa.Field(
        isin=["none", "pci", "cabg"],
        nullable=False,
        description="Type of intervention (none=diagnostic only, pci=percutaneous coronary intervention, cabg=coronary artery bypass graft)",
    )

    # Procedural complications
    complications: Series[bool] = pa.Field(
        nullable=False,
        description="Presence of procedural complications (bleeding, dissection, stroke, etc.)",
    )

    class Config:
        """Pandera configuration."""

        strict = False  # Allow additional columns for discovery phase
        coerce = True  # Coerce types when possible


# Validation function for convenience
def validate_cardiac_cath(df):
    """Validate DataFrame against CardiacCathSchema.

    Args:
        df: DataFrame to validate

    Returns:
        Validated DataFrame

    Raises:
        pa.errors.SchemaError: If validation fails
    """
    return CardiacCathSchema.validate(df)

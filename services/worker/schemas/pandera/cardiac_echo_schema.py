"""
Pandera schema for cardiac echocardiography dataset validation.

Schema defines expected structure, types, and constraints for echocardiogram
data including structural measurements and functional assessment.
"""

from __future__ import annotations

import pandera as pa
from pandera.typing import Series


class CardiacEchoSchema(pa.DataFrameModel):
    """Schema for validating cardiac echocardiography dataset structure and content.

    This schema validates echo findings including left ventricular function,
    chamber dimensions, and valvular disease severity.
    """

    # Linkage key
    research_id: Series[str] = pa.Field(
        nullable=False,
        description="De-identified patient research ID (ROS-CARDIAC-XXXXXX format)",
    )

    # Temporal metadata (generalized to YYYY-MM)
    echo_date: Series[str] = pa.Field(
        nullable=False,
        description="Echo date in YYYY-MM format only (de-identified temporal data)",
    )

    # Left ventricular systolic function
    ejection_fraction_pct: Series[int] = pa.Field(
        ge=15,
        le=80,
        nullable=False,
        description="Left ventricular ejection fraction as percentage (normal: 50-70%)",
    )

    # Left ventricular dimensions
    lv_end_diastolic_diameter_mm: Series[int] = pa.Field(
        ge=30,
        le=80,
        nullable=False,
        description="LV end-diastolic diameter in millimeters (normal: 42-59mm)",
    )

    lv_end_systolic_diameter_mm: Series[int] = pa.Field(
        ge=20,
        le=60,
        nullable=False,
        description="LV end-systolic diameter in millimeters (normal: 25-40mm)",
    )

    # Left atrial size
    left_atrial_size_mm: Series[int] = pa.Field(
        ge=25,
        le=70,
        nullable=False,
        description="Left atrial diameter in millimeters (normal: 27-40mm)",
    )

    # Valvular disease severity
    mitral_regurgitation: Series[str] = pa.Field(
        isin=["none", "mild", "moderate", "severe"],
        nullable=False,
        description="Mitral valve regurgitation severity classification",
    )

    aortic_stenosis: Series[str] = pa.Field(
        isin=["none", "mild", "moderate", "severe"],
        nullable=False,
        description="Aortic valve stenosis severity classification",
    )

    # Regional wall motion abnormality (ischemia/infarct marker)
    wall_motion_abnormality: Series[bool] = pa.Field(
        nullable=False,
        description="Presence of regional wall motion abnormality (ischemia/infarct marker)",
    )

    # Diastolic function
    diastolic_dysfunction_grade: Series[int] = pa.Field(
        ge=0,
        le=3,
        nullable=False,
        description="Diastolic dysfunction grade (0=normal, 1=mild, 2=moderate, 3=severe)",
    )

    class Config:
        """Pandera configuration."""

        strict = False  # Allow additional columns for discovery phase
        coerce = True  # Coerce types when possible


# Validation function for convenience
def validate_cardiac_echo(df):
    """Validate DataFrame against CardiacEchoSchema.

    Args:
        df: DataFrame to validate

    Returns:
        Validated DataFrame

    Raises:
        pa.errors.SchemaError: If validation fails
    """
    return CardiacEchoSchema.validate(df)

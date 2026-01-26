"""
Pandera schema for cardiac ECG dataset validation.

Schema defines expected structure, types, and constraints for electrocardiogram
data in the cardiac multi-modality sample dataset.
"""

from __future__ import annotations

import pandera as pa
from pandera.typing import Series


class CardiacECGSchema(pa.DataFrameModel):
    """Schema for validating cardiac ECG dataset structure and content.

    This schema validates ECG findings including cardiac rhythm, interval measurements,
    and ST-T wave abnormalities for synthetic cardiac patient cohort.
    """

    # Linkage key
    research_id: Series[str] = pa.Field(
        nullable=False,
        description="De-identified patient research ID (ROS-CARDIAC-XXXXXX format)",
    )

    # Temporal metadata (generalized to YYYY-MM)
    ecg_date: Series[str] = pa.Field(
        nullable=False,
        description="ECG date in YYYY-MM format only (de-identified temporal data)",
    )

    # Vital sign
    heart_rate_bpm: Series[int] = pa.Field(
        ge=40,
        le=220,
        nullable=False,
        description="Heart rate in beats per minute (normal: 60-100 bpm)",
    )

    # Interval measurements
    pr_interval_ms: Series[int] = pa.Field(
        ge=0,
        le=300,
        nullable=False,
        description="PR interval in milliseconds (0 if atrial fibrillation; normal: 120-200ms)",
    )

    qrs_duration_ms: Series[int] = pa.Field(
        ge=60,
        le=200,
        nullable=False,
        description="QRS complex duration in milliseconds (normal: 80-120ms)",
    )

    qt_interval_ms: Series[int] = pa.Field(
        ge=250,
        le=600,
        nullable=False,
        description="QT interval in milliseconds (normal: 350-450ms)",
    )

    qt_corrected_ms: Series[int] = pa.Field(
        ge=250,
        le=600,
        nullable=False,
        description="QTc (Bazett's formula) in milliseconds (normal: 350-450ms)",
    )

    # Cardiac rhythm
    rhythm: Series[str] = pa.Field(
        isin=["sinus", "afib", "aflutter", "svt", "vtach"],
        nullable=False,
        description="Cardiac rhythm classification",
    )

    # ST segment elevation (acute MI marker)
    st_elevation_mm: Series[float] = pa.Field(
        ge=0.0,
        le=10.0,
        nullable=False,
        description="ST segment elevation in millimeters (>1mm suggests acute MI)",
    )

    # T wave inversion (ischemia marker)
    t_wave_inversion: Series[bool] = pa.Field(
        nullable=False, description="T wave inversion present (ischemia marker)"
    )

    # Clinical interpretation
    interpretation: Series[str] = pa.Field(
        nullable=False,
        description="Clinical ECG interpretation text",
    )

    class Config:
        """Pandera configuration."""

        strict = False  # Allow additional columns for discovery phase
        coerce = True  # Coerce types when possible


# Validation function for convenience
def validate_cardiac_ecg(df):
    """Validate DataFrame against CardiacECGSchema.

    Args:
        df: DataFrame to validate

    Returns:
        Validated DataFrame

    Raises:
        pa.errors.SchemaError: If validation fails
    """
    return CardiacECGSchema.validate(df)

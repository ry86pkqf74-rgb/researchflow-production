"""
Pandera schema for Heart Disease dataset.

This schema validates the structure and types of heart disease prediction datasets,
inspired by the UCI Heart Disease Dataset. It enforces column presence, data types,
and reasonable numeric bounds without making clinical assumptions.

Schema is generic and dataset-agnostic - suitable for any heart disease dataset
following this structure.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class HeartDiseaseSchema(pa.DataFrameModel):
    """Pandera schema for validating heart disease dataset structure and content."""

    # Demographics
    age: Series[int] = pa.Field(ge=0, le=120, nullable=False)
    sex: Series[int] = pa.Field(isin=[0, 1], nullable=False)

    # Clinical measurements
    cp: Series[int] = pa.Field(ge=0, le=3, nullable=False)  # Chest pain type
    trestbps: Series[int] = pa.Field(ge=50, le=250, nullable=False)  # Resting BP
    chol: Series[int] = pa.Field(ge=100, le=600, nullable=False)  # Cholesterol
    fbs: Series[int] = pa.Field(isin=[0, 1], nullable=False)  # Fasting blood sugar
    restecg: Series[int] = pa.Field(ge=0, le=2, nullable=False)  # Resting ECG
    thalach: Series[int] = pa.Field(ge=60, le=220, nullable=False)  # Max heart rate
    exang: Series[int] = pa.Field(isin=[0, 1], nullable=False)  # Exercise angina
    oldpeak: Series[float] = pa.Field(ge=0.0, le=10.0, nullable=False)  # ST depression
    slope: Series[int] = pa.Field(ge=0, le=2, nullable=False)  # ST slope
    ca: Series[int] = pa.Field(ge=0, le=4, nullable=False)  # Major vessels
    thal: Series[int] = pa.Field(ge=0, le=3, nullable=False)  # Thalassemia

    # Target variable
    target: Series[int] = pa.Field(isin=[0, 1], nullable=False)  # Diagnosis

    class Config:
        strict = True
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """
    Validate a DataFrame against the HeartDiseaseSchema.

    Args:
        df: Input DataFrame to validate

    Returns:
        Validated DataFrame with coerced types

    Raises:
        pandera.errors.SchemaError: If validation fails
    """
    return HeartDiseaseSchema.validate(df, lazy=True)

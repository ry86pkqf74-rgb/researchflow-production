"""
Pandera schema for thyroid lab values (hormone panel, tumor markers).

Validates lab results including TSH, thyroid hormones, and tumor markers.

Version History:
    v1.0.0: Initial schema with basic lab values
    v1.1.0: Added units, reference ranges, and source system metadata
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.1.0"


class ThyroidLabValuesSchema(pa.DataFrameModel):
    """
    Schema for thyroid laboratory values.

    Includes thyroid function tests and tumor markers.

    v1.1.0 additions:
    - Units and reference ranges (lab_unit, ref_range_low/high/text)
    - Source system metadata (source_system)
    - All new fields are nullable for backward compatibility
    """

    # Linkage key
    research_id: Series[str] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # Test metadata
    lab_date: Series[str] = pa.Field(
        nullable=True, description="Date of lab draw (YYYY-MM format)"
    )

    # Thyroid function tests
    tsh_miu_l: Series[float] = pa.Field(
        ge=0, le=100, nullable=True, description="TSH in mIU/L (normal: 0.4-4.0)"
    )

    free_t4_ng_dl: Series[float] = pa.Field(
        ge=0, le=10, nullable=True, description="Free T4 in ng/dL (normal: 0.8-1.8)"
    )

    free_t3_pg_ml: Series[float] = pa.Field(
        ge=0, le=20, nullable=True, description="Free T3 in pg/mL (normal: 2.3-4.2)"
    )

    total_t4_mcg_dl: Series[float] = pa.Field(
        ge=0, le=30, nullable=True, description="Total T4 in mcg/dL (normal: 5-12)"
    )

    total_t3_ng_dl: Series[float] = pa.Field(
        ge=0, le=300, nullable=True, description="Total T3 in ng/dL (normal: 80-200)"
    )

    # Tumor markers (thyroid cancer)
    thyroglobulin_ng_ml: Series[float] = pa.Field(
        ge=0, nullable=True, description="Thyroglobulin in ng/mL"
    )

    anti_thyroglobulin_iu_ml: Series[float] = pa.Field(
        ge=0, nullable=True, description="Anti-thyroglobulin antibody in IU/mL"
    )

    anti_tpo_iu_ml: Series[float] = pa.Field(
        ge=0, nullable=True, description="Anti-thyroid peroxidase antibody in IU/mL"
    )

    calcitonin_pg_ml: Series[float] = pa.Field(
        ge=0,
        nullable=True,
        description="Calcitonin in pg/mL (medullary thyroid cancer marker)",
    )

    # Clinical interpretation
    thyroid_function_status: Series[str] = pa.Field(
        nullable=True, description="Euthyroid/hypothyroid/hyperthyroid"
    )

    on_thyroid_medication: Series[bool] = pa.Field(
        nullable=True, description="Patient on thyroid hormone replacement"
    )

    # Units and reference ranges (v1.1.0+)
    # These fields enable clinical interpretability and cross-site harmonization.
    # All are nullable to maintain backward compatibility with existing data.
    lab_unit: Series[str] = pa.Field(
        nullable=True, description="Measurement unit (e.g., 'mIU/L', 'ng/dL', 'pg/mL')"
    )

    ref_range_low: Series[float] = pa.Field(
        nullable=True, description="Lower bound of reference range (numeric)"
    )

    ref_range_high: Series[float] = pa.Field(
        nullable=True, description="Upper bound of reference range (numeric)"
    )

    ref_range_text: Series[str] = pa.Field(
        nullable=True, description="Reference range as text (e.g., '0.4-4.0 mIU/L')"
    )

    # Source system metadata (v1.1.0+)
    # Enables provenance tracking and multi-site studies
    source_system: Series[str] = pa.Field(
        nullable=True,
        description="Lab system source (e.g., 'EPIC', 'Cerner', 'LabCorp')",
    )

    class Config:
        strict = False
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate lab values DataFrame."""
    return ThyroidLabValuesSchema.validate(df, lazy=True)

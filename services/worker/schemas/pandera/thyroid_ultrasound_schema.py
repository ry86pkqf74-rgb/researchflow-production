"""
Pandera schema for thyroid ultrasound imaging reports.

Validates ultrasound data with TIRADS (Thyroid Imaging Reporting and Data System) scoring.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class ThyroidUltrasoundSchema(pa.DataFrameModel):
    """
    Schema for thyroid ultrasound reports.

    TIRADS (ACR TI-RADS) scoring system:
    - TR1: Benign (0 points)
    - TR2: Not suspicious (2 points)
    - TR3: Mildly suspicious (3 points)
    - TR4: Moderately suspicious (4-6 points)
    - TR5: Highly suspicious (≥7 points)
    """

    # Linkage key
    research_id: Series[str] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # Study metadata
    ultrasound_date: Series[str] = pa.Field(
        nullable=True, description="Date of ultrasound (YYYY-MM format)"
    )

    # Thyroid gland measurements
    right_lobe_length_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Right lobe craniocaudal length"
    )

    right_lobe_width_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Right lobe transverse width"
    )

    right_lobe_depth_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Right lobe AP depth"
    )

    left_lobe_length_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Left lobe craniocaudal length"
    )

    left_lobe_width_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Left lobe transverse width"
    )

    left_lobe_depth_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Left lobe AP depth"
    )

    isthmus_thickness_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Isthmus thickness"
    )

    # Nodule characteristics (dominant/largest nodule)
    nodule_present: Series[bool] = pa.Field(
        nullable=True, description="Nodule identified"
    )

    nodule_size_mm: Series[float] = pa.Field(
        ge=0, nullable=True, description="Largest nodule dimension"
    )

    nodule_location: Series[str] = pa.Field(
        nullable=True, description="Nodule location (right/left/isthmus)"
    )

    # TIRADS features
    composition: Series[str] = pa.Field(
        nullable=True, description="Nodule composition (solid/cystic/mixed)"
    )

    echogenicity: Series[str] = pa.Field(
        nullable=True, description="Echogenicity (hyper/iso/hypo/anechoic)"
    )

    shape: Series[str] = pa.Field(
        nullable=True, description="Shape (wider-than-tall/taller-than-wide)"
    )

    margins: Series[str] = pa.Field(
        nullable=True, description="Margins (smooth/irregular/lobulated)"
    )

    echogenic_foci: Series[str] = pa.Field(
        nullable=True, description="Calcifications or echogenic foci"
    )

    tirads_category: Series[str] = pa.Field(
        nullable=True, description="ACR TI-RADS category (TR1-TR5)"
    )

    tirads_score: Series[int] = pa.Field(
        ge=0, nullable=True, description="TI-RADS total points"
    )

    # Vascularity
    vascularity: Series[str] = pa.Field(
        nullable=True, description="Doppler vascularity assessment"
    )

    # Lymph nodes
    suspicious_lymph_nodes: Series[bool] = pa.Field(
        nullable=True, description="Suspicious cervical LNs identified"
    )

    # Free text
    ultrasound_impression: Series[str] = pa.Field(
        nullable=True, description="Radiologist impression text"
    )

    class Config:
        strict = False
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate ultrasound DataFrame."""
    return ThyroidUltrasoundSchema.validate(df, lazy=True)

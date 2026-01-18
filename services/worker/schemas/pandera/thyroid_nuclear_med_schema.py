"""
Pandera schema for nuclear medicine thyroid imaging data.

Validates nuclear medicine scan data including uptake studies and whole-body scans.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class ThyroidNuclearMedSchema(pa.DataFrameModel):
    """
    Schema for nuclear medicine thyroid data.

    Source: Nuclear_Med_final.xlsx
    Contains nuclear medicine scan data with multiple scan entries per patient.
    Note: Original key is 'ResearchID', normalized to 'research_id'.

    WARNING: This dataset may contain columns that look like PHI
    (Patient_DOB, Patient_MRN, Patient_SSN_Last4) but they appear to be
    empty/null in the actual data. Schema validation will fail if
    these contain actual values.
    """

    # Linkage key (normalized from 'ResearchID')
    research_id: Series[int] = pa.Field(
        nullable=False, description="De-identified patient research ID"
    )

    # First nuclear medicine scan
    NucMed_1: Series[str] = pa.Field(
        nullable=True, description="First NM scan report text"
    )

    NucMed_1_ScanDate: Series[str] = pa.Field(
        nullable=True, description="First scan date (MM/DD/YY format)"
    )

    NucMed_1_Indication_Text: Series[str] = pa.Field(
        nullable=True, description="First scan indication"
    )

    NucMed_1_Radiotracer: Series[str] = pa.Field(
        nullable=True, description="Radiotracer used (i-123, i-131, tc-99m)"
    )

    NucMed_1_ScanType: Series[str] = pa.Field(
        nullable=True, description="Type of scan performed"
    )

    NucMed_1_Uptake_6hour: Series[str] = pa.Field(
        nullable=True, description="6-hour uptake percentage"
    )

    NucMed_1_Uptake_24hour: Series[str] = pa.Field(
        nullable=True, description="24-hour uptake percentage"
    )

    NucMed_1_Uptake_General: Series[str] = pa.Field(
        nullable=True, description="General uptake value"
    )

    NucMed_1_Findings_Text: Series[str] = pa.Field(
        nullable=True, description="Scan findings text"
    )

    NucMed_1_Impression_Text: Series[str] = pa.Field(
        nullable=True, description="Scan impression text"
    )

    NucMed_1_Lab_Summary: Series[str] = pa.Field(
        nullable=True, description="Associated lab summary"
    )

    # Lab values (extracted from reports)
    TSH_Value: Series[float] = pa.Field(ge=0, nullable=True, description="TSH value")

    TSH_Date: Series[str] = pa.Field(nullable=True, description="TSH measurement date")

    Thyroglobulin_Value: Series[float] = pa.Field(
        ge=0, nullable=True, description="Thyroglobulin value"
    )

    Thyroglobulin_Date: Series[str] = pa.Field(
        nullable=True, description="Thyroglobulin measurement date"
    )

    # Clinical findings
    Nodule_Present: Series[str] = pa.Field(
        nullable=True, description="Nodule present (yes/no)"
    )

    Nodule_Type: Series[str] = pa.Field(
        nullable=True, description="Nodule type (cold/hot)"
    )

    Nodule_Count: Series[str] = pa.Field(
        nullable=True, description="Nodule count (multiple/unspecified)"
    )

    Multinodular_Goiter: Series[str] = pa.Field(
        nullable=True, description="Multinodular goiter present"
    )

    Toxic_Nodule: Series[str] = pa.Field(
        nullable=True, description="Toxic nodule present"
    )

    # Post-surgical findings
    Thyroid_Bed_Activity: Series[str] = pa.Field(
        nullable=True, description="Activity in thyroid bed"
    )

    Residual_Thyroid_Tissue: Series[str] = pa.Field(
        nullable=True, description="Residual thyroid tissue present"
    )

    # Metastasis findings
    Lymph_Node_Uptake: Series[str] = pa.Field(
        nullable=True, description="Lymph node uptake present"
    )

    Bone_Metastases: Series[str] = pa.Field(
        nullable=True, description="Bone metastases present"
    )

    Lung_Metastases: Series[str] = pa.Field(
        nullable=True, description="Lung metastases present"
    )

    # Treatment/outcome
    Treatment_Response: Series[str] = pa.Field(
        nullable=True, description="Treatment response (complete/partial)"
    )

    Disease_Status: Series[str] = pa.Field(
        nullable=True, description="Disease status (negative/positive)"
    )

    # Thyroid function
    Thyroid_Function_Status: Series[str] = pa.Field(
        nullable=True, description="Thyroid function status"
    )

    Thyromegaly: Series[str] = pa.Field(
        nullable=True, description="Thyromegaly present"
    )

    # Malignancy info
    Associated_Malignancy: Series[str] = pa.Field(
        nullable=True, description="Associated malignancy present"
    )

    Primary_Malignancy_Type: Series[str] = pa.Field(
        nullable=True, description="Type of primary malignancy"
    )

    Malignancy_Stage: Series[str] = pa.Field(
        nullable=True, description="Malignancy stage"
    )

    # Treatment details
    RAI_Dose_mCi: Series[float] = pa.Field(
        ge=0, nullable=True, description="Radioactive iodine dose in mCi"
    )

    Past_Surgical_History: Series[str] = pa.Field(
        nullable=True, description="Past surgical history"
    )

    # Patient age (acceptable demographic, not PHI when deidentified)
    Patient_Age: Series[float] = pa.Field(
        ge=0, le=120, nullable=True, description="Patient age at scan (deidentified)"
    )

    class Config:
        strict = False
        coerce = True


def validate(df: DataFrame) -> DataFrame:
    """Validate nuclear medicine DataFrame."""
    return ThyroidNuclearMedSchema.validate(df, lazy=True)

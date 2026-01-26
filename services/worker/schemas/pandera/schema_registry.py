"""
Schema Registry for Thyroid Pilot Datasets.

Maps all 12 thyroid pilot Excel files to their corresponding Pandera schemas.
Provides central access to schema validation for the entire dataset collection.

Usage:
    from schemas.pandera.schema_registry import get_schema, validate_dataset, DATASET_SCHEMAS

    # Get schema for a specific dataset
    schema = get_schema('fna_results')

    # Validate a DataFrame
    df_validated = validate_dataset(df, 'thyroid_sizes')

    # List all registered datasets
    print(DATASET_SCHEMAS.keys())
"""

from typing import Dict, Optional, Type
import pandera as pa
from pandera.typing import DataFrame

__version__ = "v1.0.0"


# -----------------------------------------------------------------------------
# Import all schemas
# -----------------------------------------------------------------------------

from schemas.pandera.thyroid_fna_schema import FNAResultsSchema
from schemas.pandera.thyroid_labs_schema import ThyroidLabValuesSchema
from schemas.pandera.thyroid_pathology_schema import ThyroidPathologySchema
from schemas.pandera.thyroid_ultrasound_schema import ThyroidUltrasoundSchema
from schemas.pandera.thyroid_mri_schema import ThyroidMRISchema
from schemas.pandera.thyroid_ct_schema import ThyroidCTSchema
from schemas.pandera.thyroid_sizes_schema import ThyroidSizesSchema
from schemas.pandera.thyroid_nuclear_med_schema import ThyroidNuclearMedSchema
from schemas.pandera.thyroid_weights_schema import ThyroidWeightsSchema
from schemas.pandera.thyroid_parathyroid_notes_schema import ParathyroidNotesSchema

# Cardiac multi-modality schemas (INF-26-29 Phase 2 D)
from schemas.pandera.cardiac_ecg_schema import CardiacECGSchema
from schemas.pandera.cardiac_echo_schema import CardiacEchoSchema
from schemas.pandera.cardiac_cath_schema import CardiacCathSchema


# -----------------------------------------------------------------------------
# Dataset-to-Schema Registry
# -----------------------------------------------------------------------------

# Maps dataset output names (from source_mappings.yaml) to schema classes
DATASET_SCHEMAS: Dict[str, Type[pa.DataFrameModel]] = {
    # Lab data (wide format)
    "anti_tg_antibody": ThyroidLabValuesSchema,
    "thyroglobulin": ThyroidLabValuesSchema,
    # Pathology reports
    "benign_pathology": ThyroidPathologySchema,
    "tumor_pathology": ThyroidPathologySchema,
    # Imaging - Ultrasound
    "ultrasound_reports": ThyroidUltrasoundSchema,
    # Imaging - MRI
    "mri_reports": ThyroidMRISchema,
    # Imaging - CT
    "ct_reports": ThyroidCTSchema,
    # Imaging - Nuclear Medicine
    "nuclear_medicine": ThyroidNuclearMedSchema,
    # FNA cytology
    "fna_results": FNAResultsSchema,
    # Measurements
    "thyroid_sizes": ThyroidSizesSchema,
    "thyroid_weights": ThyroidWeightsSchema,
    # Clinical notes
    "parathyroid_notes": ParathyroidNotesSchema,
    # Cardiac multi-modality sample datasets (INF-26-29 Phase 2 D)
    "cardiac_ecg": CardiacECGSchema,
    "cardiac_echo": CardiacEchoSchema,
    "cardiac_cath": CardiacCathSchema,
}


# Maps Excel file names to dataset output names (for convenience)
FILE_TO_DATASET: Dict[str, str] = {
    "anti_thyroglobulin_antibody_wide_by_research_id_split.xlsx": "anti_tg_antibody",
    "thyroglobulin_wide_by_research_id_split.xlsx": "thyroglobulin",
    "FINAL_UPDATE_BenignPath_12_8_WithText.xlsx": "benign_pathology",
    "FINAL_UPDATE_TumorPath_12_8_CLEANED.xlsx": "tumor_pathology",
    "COMPLETE_MULTI_SHEET_ULTRASOUND_REPORTS.xlsx": "ultrasound_reports",
    "mri_extraction__FINAL_11_20_25.xlsx": "mri_reports",
    "CT_thyroid_extraction_FINAL_11_20_25.xlsx": "ct_reports",
    "Nuclear_Med_final.xlsx": "nuclear_medicine",
    "FNAs_Rescored_Long_Format.xlsx": "fna_results",
    "THyroid Sizes, Stanardized_12_2_25.xlsx": "thyroid_sizes",
    "Thyroid_Weight_Data_12_2_25.xlsx": "thyroid_weights",
    "parathyroid_notes_intent.xlsx": "parathyroid_notes",
}


# -----------------------------------------------------------------------------
# Schema Access Functions
# -----------------------------------------------------------------------------


def get_schema(dataset_name: str) -> Optional[Type[pa.DataFrameModel]]:
    """
    Get Pandera schema class for a dataset.

    Args:
        dataset_name: Dataset output name (e.g., 'fna_results', 'thyroid_sizes')

    Returns:
        Pandera DataFrameModel class, or None if not found
    """
    return DATASET_SCHEMAS.get(dataset_name)


def get_schema_for_file(file_name: str) -> Optional[Type[pa.DataFrameModel]]:
    """
    Get Pandera schema class for an Excel file.

    Args:
        file_name: Excel file name (e.g., 'FNAs_Rescored_Long_Format.xlsx')

    Returns:
        Pandera DataFrameModel class, or None if not found
    """
    dataset_name = FILE_TO_DATASET.get(file_name)
    if dataset_name:
        return get_schema(dataset_name)
    return None


def validate_dataset(df: DataFrame, dataset_name: str, lazy: bool = True) -> DataFrame:
    """
    Validate DataFrame against dataset-specific schema.

    Args:
        df: DataFrame to validate
        dataset_name: Dataset output name
        lazy: If True, collect all errors before raising

    Returns:
        Validated DataFrame

    Raises:
        KeyError: If dataset_name not in registry
        pa.errors.SchemaError: If validation fails
    """
    schema_class = DATASET_SCHEMAS.get(dataset_name)
    if schema_class is None:
        raise KeyError(f"No schema registered for dataset: {dataset_name}")

    return schema_class.validate(df, lazy=lazy)


def list_datasets() -> list:
    """Return list of all registered dataset names."""
    return list(DATASET_SCHEMAS.keys())


def list_schemas() -> Dict[str, str]:
    """Return mapping of dataset names to schema class names."""
    return {name: schema.__name__ for name, schema in DATASET_SCHEMAS.items()}


# -----------------------------------------------------------------------------
# Validation Report
# -----------------------------------------------------------------------------


def generate_schema_report() -> str:
    """
    Generate a markdown report of all registered schemas.

    Returns:
        Markdown-formatted schema report
    """
    lines = [
        "# Thyroid Pilot Dataset Schema Registry",
        "",
        f"**Version**: {__version__}",
        f"**Total Datasets**: {len(DATASET_SCHEMAS)}",
        "",
        "## Dataset Schemas",
        "",
        "| Dataset | Schema Class | Required Key |",
        "|---------|--------------|--------------|",
    ]

    for dataset, schema in DATASET_SCHEMAS.items():
        # Check if research_id is defined in schema
        has_research_id = hasattr(schema, "research_id")
        key_status = "✓ research_id" if has_research_id else "⚠ Check"
        lines.append(f"| {dataset} | {schema.__name__} | {key_status} |")

    lines.extend(
        [
            "",
            "## File Mappings",
            "",
            "| Excel File | Dataset Name |",
            "|------------|--------------|",
        ]
    )

    for file, dataset in FILE_TO_DATASET.items():
        lines.append(f"| {file} | {dataset} |")

    return "\n".join(lines)

"""Versioned canonical signal schema (v1.0.0).

This schema defines the neutral canonical format for patient-generated signals,
serving as the bridge between FHIR Observations and internal research datasets.

The canonical signal format provides a stable interchange contract that:
- Decouples external FHIR representations from internal research schemas
- Enables bidirectional transforms with provenance tracking
- Maintains backward compatibility through semantic versioning
- Enforces PHI safety through de-identified research IDs

Schema Design:
    - 13 canonical fields aligned with FHIR R4 Observation structure
    - Supports both quantitative (signal_value_num) and qualitative (signal_value_text) values
    - Optional fields for context (episode_id, encounter_id_deid)
    - Quality flags for data validation and filtering
    - UCUM-preferred units for interoperability

Version History:
    v1.0.0 (2026-01-15): Initial schema aligned with FHIR_OBSERVATION_MAPPING.md v1.0.0

Governance:
    - STANDBY-safe: Schema validation only, no I/O operations
    - PHI-safe: Uses research_id (de-identified), not patient_id or MRN
    - Offline-first: No external dependencies, uses standard library + pandera
"""

import pandas as pd
import pandera as pa

__version__ = "v1.0.0"

# Canonical signal schema matching FHIR_OBSERVATION_MAPPING.md specification
SignalSchemaV1 = pa.DataFrameSchema(
    {
        "research_id": pa.Column(
            str,
            nullable=False,
            description="De-identified patient research ID (e.g., R001, R002)",
        ),
        "signal_time": pa.Column(
            pa.DateTime,
            nullable=False,
            description="Signal timestamp in UTC (ISO 8601 format)",
        ),
        "signal_type": pa.Column(
            str,
            nullable=False,
            description="Signal category: PROM (patient-reported outcome), symptom, wearable, adherence, other",
        ),
        "signal_name": pa.Column(
            str,
            nullable=False,
            description="Signal name identifier (e.g., promis_fatigue, daily_steps, pain_score)",
        ),
        "signal_value_num": pa.Column(
            float,
            nullable=True,
            required=False,
            description="Numeric value for quantitative signals (mutually exclusive with signal_value_text)",
        ),
        "signal_value_text": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Text value for qualitative signals (mutually exclusive with signal_value_num)",
        ),
        "unit": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Unit of measurement (UCUM preferred, e.g., steps, mg, score)",
        ),
        "source_system": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Source system identifier (e.g., fitbit_api, redcap_survey, epic_fhir)",
        ),
        "collection_mode": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Collection mode: self_report, passive_sensing, clinician_entered",
        ),
        "quality_flag": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Quality flag: invalid, rejected, flagged (null indicates valid/accepted)",
        ),
        "notes": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Free-text notes or annotations",
        ),
        "episode_id": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Episode identifier for linking signals to care episodes",
        ),
        "encounter_id_deid": pa.Column(
            str,
            nullable=True,
            required=False,
            description="De-identified encounter ID for linking to clinical visits",
        ),
    },
    strict=False,  # Allow extra columns for forward compatibility
    coerce=True,   # Coerce types during validation (e.g., string → datetime)
    name="SignalSchemaV1",
    description="Canonical signal schema v1.0.0 (FHIR R4 Observation compatible)",
)


def validate_signals(df: pd.DataFrame, lazy: bool = True) -> pd.DataFrame:
    """Validate DataFrame against canonical signal schema v1.0.0.

    Args:
        df: DataFrame containing signal records
        lazy: If True, collect all validation errors before raising.
              If False, raise on first validation error.

    Returns:
        Validated and coerced DataFrame

    Raises:
        pandera.errors.SchemaError: If validation fails

    Example:
        >>> import pandas as pd
        >>> signals_df = pd.DataFrame([{
        ...     "research_id": "R001",
        ...     "signal_time": "2026-01-15T10:00:00Z",
        ...     "signal_type": "PROM",
        ...     "signal_name": "promis_fatigue",
        ...     "signal_value_num": 42.0,
        ...     "signal_value_text": None,
        ...     "unit": "score",
        ...     "source_system": "redcap_survey",
        ...     "collection_mode": "self_report",
        ...     "quality_flag": None,
        ...     "notes": None,
        ...     "episode_id": None,
        ...     "encounter_id_deid": None,
        ... }])
        >>> validated = validate_signals(signals_df)
    """
    return SignalSchemaV1.validate(df, lazy=lazy)

"""
Pandera schema for patient-generated signals (symptoms, PROMs, wearables).

Validates patient-reported outcomes, symptom logs, wearable summaries,
medication adherence signals, and other patient-generated data streams.

Version History:
- v1.0.0: Initial schema with core signal capture fields
"""

import pandera as pa
from pandera.typing import DataFrame, Series
from pandera import Check

__version__ = "v1.0.0"


class PatientGeneratedSignalsSchema(pa.DataFrameModel):
    """
    Schema for patient-generated signals and outcomes.

    Captures patient-reported outcomes (PROMs), symptoms, wearable device data,
    medication adherence, and other patient-generated data streams in a unified
    format for temporal analysis and episode linkage.

    Key Features:
    - Flexible signal typing for diverse data sources
    - Dual value fields (numeric + text) to handle varied signal types
    - Quality flagging for data reliability assessment
    - PHI-free notes field for context (governance enforced elsewhere)
    - Extensible to FHIR Observation mapping

    Version: v1.0.0
    """

    # Linkage key
    research_id: Series[str] = pa.Field(
        nullable=False,
        str_matches=r".+",
        description="De-identified patient research ID (required for linkage)",
    )

    # Temporal anchor
    signal_time: Series[pa.DateTime] = pa.Field(
        nullable=False,
        description="Event timestamp (timezone-naive ISO datetime; when signal was captured/reported)",
    )

    # Signal classification
    signal_type: Series[str] = pa.Field(
        nullable=False,
        isin=["PROM", "symptom", "wearable", "adherence", "other"],
        description="Signal category: PROM, symptom, wearable, adherence, other",
    )

    signal_name: Series[str] = pa.Field(
        nullable=False,
        str_matches=r".+",
        description="Specific signal identifier (e.g., 'fatigue', 'PROMIS_global10', 'steps_daily')",
    )

    # Value fields (at least one must be populated)
    signal_value_num: Series[float] = pa.Field(
        nullable=True,
        description="Numeric signal value (e.g., scale scores, counts, measurements)",
    )

    signal_value_text: Series[str] = pa.Field(
        nullable=True,
        description="Text signal value (e.g., categorical responses, free text summaries)",
    )

    # Metadata
    unit: Series[str] = pa.Field(
        nullable=True,
        description="Unit of measurement (e.g., 'steps', 'mg', 'score 0-10') if applicable",
    )

    source_system: Series[str] = pa.Field(
        nullable=True,
        description="Data source (e.g., 'PROMIS', 'AppleHealth', 'Fitbit', 'PatientPortal', 'REDCap')",
    )

    collection_mode: Series[str] = pa.Field(
        nullable=True,
        description="Collection method (e.g., 'self_report', 'device', 'survey', 'manual_entry')",
    )

    quality_flag: Series[str] = pa.Field(
        nullable=True,
        description="Data quality indicator (e.g., 'ok', 'outlier', 'missing_context', 'sensor_error')",
    )

    # Context (PHI-free only; runtime scanning handled elsewhere)
    notes: Series[str] = pa.Field(
        nullable=True,
        description="PHI-free contextual notes (MUST NOT contain patient identifiers)",
    )

    # Optional linkage fields for future temporal fusion
    encounter_id_deid: Series[str] = pa.Field(
        nullable=True,
        description="De-identified encounter key (NOT MRN) for clinical visit linkage",
    )

    episode_id: Series[str] = pa.Field(
        nullable=True, description="Episode identifier for temporal fusion (future use)"
    )

    @pa.dataframe_check
    def at_least_one_value(cls, df: DataFrame) -> bool:
        """
        Dataframe-level check: ensure at least one value field is populated per row.

        Either signal_value_num or signal_value_text (or both) must be non-null.
        """
        has_num = df["signal_value_num"].notna()
        has_text = df["signal_value_text"].notna()
        all_valid = (has_num | has_text).all()
        if not all_valid:
            raise ValueError(
                "At least one of signal_value_num or signal_value_text must be non-null"
            )
        return all_valid

    class Config:
        """Pandera configuration."""

        strict = False  # Allow additional columns for forward compatibility
        coerce = True  # Attempt type coercion where possible


def validate_at_least_one_value(df: DataFrame) -> bool:
    """
    Standalone validator function for testing.

    Either signal_value_num or signal_value_text (or both) must be non-null.
    """
    has_num = df["signal_value_num"].notna()
    has_text = df["signal_value_text"].notna()
    return (has_num | has_text).all()

"""
Pandera schema for events core table.

This is a generic stub for event-based research datasets. Real projects define:
- Canonical event types via extraction specifications
- Event classification rules via conform logic
- Temporal constraints and FK relationships via governance docs

Adjust fields and constraints based on project requirements.
"""

import pandera as pa
from pandera.typing import DataFrame, Series

__version__ = "v1.0.0"


class EventsSchema(pa.DataFrameModel):
    """Pandera schema for validating events table structure and content."""

    event_id: Series[str] = pa.Field(nullable=False, unique=True)
    patient_id: Series[str] = pa.Field(nullable=False)
    event_date: Series[pa.DateTime] = pa.Field(nullable=False)

    # event_type is non-null: all events should be classified for analysis.
    # Projects may extend this enum based on study design.
    event_type: Series[str] = pa.Field(
        nullable=False, isin=["index", "followup", "other"]
    )

    class Config:
        strict = True
        coerce = True

    # Relational integrity: patient_id and event_date are non-null to support
    # joins to patients table and temporal analysis. FK enforcement is a policy
    # concern, not enforced at schema validation layer.


def validate(df: DataFrame) -> DataFrame:
    """
    Validate a DataFrame against the EventsSchema.

    Args:
        df: Input DataFrame to validate

    Returns:
        Validated DataFrame with coerced types

    Raises:
        pandera.errors.SchemaError: If validation fails
    """
    return EventsSchema.validate(df, lazy=True)

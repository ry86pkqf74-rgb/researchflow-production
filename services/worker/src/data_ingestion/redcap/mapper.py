"""
REDCap Record Mapper

Converts REDCap records into normalized SurgicalCase objects.

Based on document_pdf.pdf specification (page 5).

Field Mapping:
    The mapper uses configurable field names to accommodate different
    REDCap project structures. Default field names follow common conventions.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from ..models import SurgicalCase

logger = logging.getLogger(__name__)


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    """
    Parse datetime from REDCap date field.

    REDCap supports various date formats depending on project configuration.

    Args:
        value: Date string from REDCap

    Returns:
        Parsed datetime or None if parsing fails
    """
    if not value:
        return None

    # Common REDCap date formats
    formats = [
        "%Y-%m-%d",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%m/%d/%Y",
        "%m/%d/%Y %H:%M:%S",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            pass

    logger.warning(f"Could not parse date: {value}")
    return None


def _clean_string(value: Any) -> Optional[str]:
    """Clean and validate a string value."""
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def redcap_record_to_case(
    record: dict[str, Any],
    *,
    # Field name configuration
    case_id_field: str = "case_id",
    patient_id_field: str = "study_id",
    procedure_field: str = "procedure",
    date_field: str = "procedure_date",
    surgeon_field: str = "surgeon",
    service_line_field: str = "service_line",
    opnote_field: str = "operative_note",
    # Outcome fields (common surgical outcomes)
    ssi_field: Optional[str] = "ssi",
    los_field: Optional[str] = "los_days",
    readmission_field: Optional[str] = "readmission_30d",
    complication_field: Optional[str] = "complication",
) -> SurgicalCase:
    """
    Convert a REDCap record to a SurgicalCase.

    Args:
        record: Raw REDCap record dictionary
        case_id_field: Field name for case ID (fallback to record_id)
        patient_id_field: Field name for patient/study ID
        procedure_field: Field name for procedure name
        date_field: Field name for procedure date
        surgeon_field: Field name for surgeon
        service_line_field: Field name for service line
        opnote_field: Field name for operative note text
        ssi_field: Field name for SSI outcome
        los_field: Field name for length of stay
        readmission_field: Field name for 30-day readmission
        complication_field: Field name for complication flag

    Returns:
        SurgicalCase object

    Raises:
        ValueError: If case_id cannot be determined
    """
    # Get case ID (try configured field, then fall back to record_id)
    case_id = _clean_string(record.get(case_id_field) or record.get("record_id"))
    if not case_id:
        raise ValueError("REDCap record missing case id (case_id_field/record_id).")

    # Build outcomes dictionary from available fields
    outcomes: dict[str, Any] = {}

    if ssi_field and record.get(ssi_field) is not None:
        outcomes["ssi"] = record[ssi_field]

    if los_field and record.get(los_field) is not None:
        try:
            outcomes["los_days"] = float(record[los_field])
        except (ValueError, TypeError):
            outcomes["los_days"] = record[los_field]

    if readmission_field and record.get(readmission_field) is not None:
        outcomes["readmission_30d"] = record[readmission_field]

    if complication_field and record.get(complication_field) is not None:
        outcomes["complication"] = record[complication_field]

    return SurgicalCase(
        case_id=case_id,
        source="redcap",
        patient_id=_clean_string(record.get(patient_id_field)),
        procedure=_clean_string(record.get(procedure_field)),
        procedure_date=_parse_dt(record.get(date_field)),
        surgeon=_clean_string(record.get(surgeon_field)),
        service_line=_clean_string(record.get(service_line_field)),
        operative_note_text=record.get(opnote_field) if record.get(opnote_field) else None,
        outcomes=outcomes,
        metadata={"raw": record},
    )


def batch_convert_records(
    records: list[dict[str, Any]],
    **mapper_kwargs: Any,
) -> tuple[list[SurgicalCase], list[tuple[str, str]]]:
    """
    Convert multiple REDCap records to SurgicalCase objects.

    Args:
        records: List of raw REDCap records
        **mapper_kwargs: Arguments passed to redcap_record_to_case

    Returns:
        Tuple of (successful cases, list of (record_id, error) tuples)
    """
    cases: list[SurgicalCase] = []
    errors: list[tuple[str, str]] = []

    for record in records:
        record_id = str(record.get("record_id", "unknown"))
        try:
            case = redcap_record_to_case(record, **mapper_kwargs)
            cases.append(case)
        except Exception as e:
            logger.warning(f"Failed to convert REDCap record {record_id}: {e}")
            errors.append((record_id, str(e)))

    logger.info(f"Converted {len(cases)} records, {len(errors)} errors")
    return cases, errors

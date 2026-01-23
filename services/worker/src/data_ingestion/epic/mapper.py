"""
Epic FHIR Resource Mapper

Converts Epic FHIR resources to normalized SurgicalCase objects.

Based on document_pdf.pdf specification (pages 8-9).

Notes:
    Epic installations differ on how operative notes are stored and coded.
    This mapper provides common patterns that may need adjustment for
    your specific Epic configuration.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..models import SurgicalCase

logger = logging.getLogger(__name__)


def _parse_fhir_datetime(value: Optional[str]) -> Optional[datetime]:
    """
    Parse FHIR datetime string.

    FHIR uses ISO 8601 format with optional timezone.

    Args:
        value: FHIR datetime string

    Returns:
        Parsed datetime or None
    """
    if not value:
        return None

    # Try various FHIR datetime formats
    formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d",
    ]

    # Handle 'Z' suffix (UTC)
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"

    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            pass

    logger.warning(f"Could not parse FHIR datetime: {value}")
    return None


def _extract_coding(codings: List[Dict[str, Any]], system: Optional[str] = None) -> Optional[str]:
    """
    Extract code from FHIR Coding array.

    Args:
        codings: List of Coding objects
        system: Optional system to filter by

    Returns:
        First matching code display or code value
    """
    for coding in codings:
        if system and coding.get("system") != system:
            continue
        return coding.get("display") or coding.get("code")
    return None


def procedure_to_case(
    procedure: Dict[str, Any],
    *,
    patient_id: Optional[str] = None,
    operative_note: Optional[str] = None,
) -> SurgicalCase:
    """
    Convert a FHIR Procedure resource to SurgicalCase.

    Args:
        procedure: FHIR Procedure resource
        patient_id: Patient ID (if not in resource)
        operative_note: Operative note text (from DocumentReference)

    Returns:
        SurgicalCase object

    Raises:
        ValueError: If procedure ID cannot be determined
    """
    # Get procedure ID
    proc_id = procedure.get("id")
    if not proc_id:
        raise ValueError("Procedure resource missing id")

    # Extract patient reference
    subject = procedure.get("subject", {})
    pat_ref = subject.get("reference", "")
    extracted_patient_id = patient_id or pat_ref.replace("Patient/", "")

    # Extract procedure code/name
    code = procedure.get("code", {})
    codings = code.get("coding", [])
    procedure_name = (
        code.get("text")
        or _extract_coding(codings)
        or "Unknown Procedure"
    )

    # Extract date
    performed = procedure.get("performedDateTime") or procedure.get("performedPeriod", {}).get("start")
    procedure_date = _parse_fhir_datetime(performed)

    # Extract performer (surgeon)
    performers = procedure.get("performer", [])
    surgeon = None
    for perf in performers:
        actor = perf.get("actor", {})
        surgeon = actor.get("display")
        if surgeon:
            break

    return SurgicalCase(
        case_id=f"epic-proc-{proc_id}",
        source="epic",
        patient_id=extracted_patient_id,
        procedure=procedure_name,
        procedure_date=procedure_date,
        surgeon=surgeon,
        operative_note_text=operative_note,
        outcomes={},
        metadata={
            "fhir_resource_type": "Procedure",
            "fhir_id": proc_id,
            "raw": procedure,
        },
    )


def encounter_to_case(
    encounter: Dict[str, Any],
    *,
    procedure_name: Optional[str] = None,
    operative_note: Optional[str] = None,
) -> SurgicalCase:
    """
    Convert a FHIR Encounter resource to SurgicalCase.

    Args:
        encounter: FHIR Encounter resource
        procedure_name: Procedure name (if known from related resources)
        operative_note: Operative note text

    Returns:
        SurgicalCase object
    """
    enc_id = encounter.get("id", "unknown")

    # Extract patient
    subject = encounter.get("subject", {})
    pat_ref = subject.get("reference", "")
    patient_id = pat_ref.replace("Patient/", "")

    # Extract encounter type/reason
    enc_types = encounter.get("type", [])
    enc_type = None
    for t in enc_types:
        codings = t.get("coding", [])
        enc_type = _extract_coding(codings) or t.get("text")
        if enc_type:
            break

    # Extract period
    period = encounter.get("period", {})
    start_date = _parse_fhir_datetime(period.get("start"))

    # Extract service type
    service_type = encounter.get("serviceType", {})
    service_line = service_type.get("text") or _extract_coding(service_type.get("coding", []))

    return SurgicalCase(
        case_id=f"epic-enc-{enc_id}",
        source="epic",
        patient_id=patient_id,
        procedure=procedure_name or enc_type,
        procedure_date=start_date,
        service_line=service_line,
        operative_note_text=operative_note,
        outcomes={},
        metadata={
            "fhir_resource_type": "Encounter",
            "fhir_id": enc_id,
            "raw": encounter,
        },
    )


def bundle_to_cases(
    bundle: Dict[str, Any],
    resource_type: str = "Procedure",
) -> List[SurgicalCase]:
    """
    Convert FHIR Bundle search results to SurgicalCase list.

    Args:
        bundle: FHIR Bundle resource
        resource_type: Type of resources in bundle

    Returns:
        List of SurgicalCase objects
    """
    cases: List[SurgicalCase] = []
    entries = bundle.get("entry", [])

    for entry in entries:
        resource = entry.get("resource", {})
        if resource.get("resourceType") != resource_type:
            continue

        try:
            if resource_type == "Procedure":
                case = procedure_to_case(resource)
            elif resource_type == "Encounter":
                case = encounter_to_case(resource)
            else:
                logger.warning(f"Unsupported resource type: {resource_type}")
                continue

            cases.append(case)
        except Exception as e:
            logger.warning(f"Failed to convert {resource_type}: {e}")

    logger.info(f"Converted {len(cases)} {resource_type} resources to cases")
    return cases

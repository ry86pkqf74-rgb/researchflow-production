"""
Minimal FHIR R4 resource type stubs for mock connector.

These are simplified representations of FHIR resources, not a full FHIR client library.
Only fields needed for the mock connector are included.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class PatientResource:
    """
    Minimal FHIR R4 Patient resource stub.

    Represents a patient in the EHR system. Only includes fields
    necessary for mock connector functionality.
    """
    id: str
    name: str
    identifier: List[Dict[str, Any]] = field(default_factory=list)
    resource_type: str = "Patient"


@dataclass
class Observation:
    """
    Minimal FHIR R4 Observation resource stub.

    Based on FHIR_OBSERVATION_MAPPING.md specification.
    Represents a single observation (PROM, vital, etc.).
    """
    id: str
    status: str  # registered, preliminary, final, amended, entered-in-error
    category: List[Dict[str, Any]]
    code: Dict[str, Any]
    subject: Dict[str, Any]
    effective_datetime: str
    value_quantity: Optional[Dict[str, Any]] = None
    value_string: Optional[str] = None
    resource_type: str = "Observation"


@dataclass
class OperationOutcome:
    """
    FHIR OperationOutcome for POST/PUT responses.

    Indicates success or failure of a FHIR operation.
    """
    success: bool
    message: str
    resource_id: Optional[str] = None
    resource_type: str = "OperationOutcome"

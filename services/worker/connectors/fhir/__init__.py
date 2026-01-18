"""
FHIR connector module for EHR interoperability.

Provides mock and real FHIR server connectors with governance gating.
"""

from .interface import FHIRConnector
from .mock_connector import MockFHIRConnector
from .types import PatientResource, Observation, OperationOutcome

__all__ = [
    "FHIRConnector",
    "MockFHIRConnector",
    "PatientResource",
    "Observation",
    "OperationOutcome",
]

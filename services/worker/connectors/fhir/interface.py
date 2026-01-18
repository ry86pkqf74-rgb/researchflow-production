"""
FHIR Connector Protocol interface.

Defines the contract that all FHIR connectors (mock and real) must implement.
"""

from typing import Protocol, List, Optional
from .types import PatientResource, Observation, OperationOutcome


class FHIRConnector(Protocol):
    """
    Abstract interface for FHIR server connectors.

    All implementations must:
    - Check RuntimeConfig for gating (STANDBY blocks, SANDBOX allows mock only)
    - Return deterministic results in mock mode
    - Require ONLINE mode for real EHR connectivity

    **Governance:**
    - STANDBY mode: All operations blocked (fail-closed)
    - SANDBOX mode: Mock connector only (offline-safe)
    - ONLINE mode: Real connector allowed (explicit opt-in)
    """

    name: str

    def get_patient(self, patient_id: str) -> PatientResource:
        """
        Fetch Patient resource by ID.

        Args:
            patient_id: Patient identifier

        Returns:
            PatientResource with patient details

        Raises:
            RuntimeError: If called in STANDBY mode
        """
        ...

    def get_observations(
        self,
        patient_id: str,
        *,
        code: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Observation]:
        """
        Fetch Observation resources for a patient.

        Args:
            patient_id: Patient identifier
            code: Optional LOINC/internal code filter
            category: Optional observation category filter

        Returns:
            List of Observation resources

        Raises:
            RuntimeError: If called in STANDBY mode
        """
        ...

    def post_observation(self, observation: Observation) -> OperationOutcome:
        """
        Create a new Observation resource.

        Args:
            observation: Observation resource to create

        Returns:
            OperationOutcome indicating success/failure

        Raises:
            RuntimeError: If called in STANDBY mode
        """
        ...

    def validate_connectivity(self) -> bool:
        """
        Test connection to FHIR server.

        Returns:
            True if connection successful (mock always returns True)

        Raises:
            RuntimeError: If called in STANDBY mode
        """
        ...

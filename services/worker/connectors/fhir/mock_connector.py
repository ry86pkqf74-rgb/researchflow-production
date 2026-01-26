"""
Mock FHIR connector for offline testing.

Features:
- Deterministic responses (seeded by patient_id)
- Works offline (no network)
- Uses recorded fixtures
- Safe in SANDBOX mode
- Blocked in STANDBY mode (fail-closed)
"""

from dataclasses import dataclass
from typing import List, Optional
from .interface import FHIRConnector
from .types import PatientResource, Observation, OperationOutcome
from .fixtures import RECORDED_RESPONSES
from src.runtime_config import RuntimeConfig


@dataclass(frozen=True)
class MockFHIRConnector:
    """
    Mock FHIR connector implementation for testing.

    **Governance:**
    - STANDBY mode: All operations blocked with RuntimeError
    - SANDBOX mode: All operations allowed (uses fixtures)
    - ONLINE mode: Not applicable for mock connector

    **Safety:**
    - No network calls
    - Deterministic responses
    - Synthetic data only (R### identifiers)
    - No PHI processing
    """

    name: str = "mock"

    def get_patient(self, patient_id: str) -> PatientResource:
        """
        Fetch synthetic patient resource.

        Args:
            patient_id: Patient identifier (e.g., "R001")

        Returns:
            PatientResource with synthetic data

        Raises:
            RuntimeError: If called in STANDBY mode
        """
        cfg = RuntimeConfig.from_env_and_optional_yaml(None)
        if cfg.is_standby:
            raise RuntimeError(
                "FHIR connector blocked in STANDBY mode (fail-closed). "
                "Set NO_NETWORK=0 and MOCK_ONLY=1 to enable SANDBOX mock connector."
            )

        return RECORDED_RESPONSES.get_patient(patient_id)

    def get_observations(
        self,
        patient_id: str,
        *,
        code: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Observation]:
        """
        Fetch synthetic observation resources.

        Args:
            patient_id: Patient identifier
            code: Optional code filter
            category: Optional category filter

        Returns:
            List of Observation resources

        Raises:
            RuntimeError: If called in STANDBY mode
        """
        cfg = RuntimeConfig.from_env_and_optional_yaml(None)
        if cfg.is_standby:
            raise RuntimeError(
                "FHIR connector blocked in STANDBY mode (fail-closed). "
                "Set NO_NETWORK=0 and MOCK_ONLY=1 to enable SANDBOX mock connector."
            )

        return RECORDED_RESPONSES.get_observations(patient_id, code=code, category=category)

    def post_observation(self, observation: Observation) -> OperationOutcome:
        """
        Post synthetic observation (mock - no actual POST).

        Args:
            observation: Observation resource to post

        Returns:
            OperationOutcome indicating success

        Raises:
            RuntimeError: If called in STANDBY mode
        """
        cfg = RuntimeConfig.from_env_and_optional_yaml(None)
        if cfg.is_standby:
            raise RuntimeError(
                "FHIR connector blocked in STANDBY mode (fail-closed). "
                "Set NO_NETWORK=0 and MOCK_ONLY=1 to enable SANDBOX mock connector."
            )

        return RECORDED_RESPONSES.post_observation(observation)

    def validate_connectivity(self) -> bool:
        """
        Validate mock connectivity (always succeeds in SANDBOX).

        Returns:
            True if in SANDBOX mode, raises in STANDBY

        Raises:
            RuntimeError: If called in STANDBY mode
        """
        cfg = RuntimeConfig.from_env_and_optional_yaml(None)
        if cfg.is_standby:
            raise RuntimeError(
                "FHIR connector blocked in STANDBY mode (fail-closed). "
                "Set NO_NETWORK=0 and MOCK_ONLY=1 to enable SANDBOX mock connector."
            )

        # Mock connector always validates successfully
        return True

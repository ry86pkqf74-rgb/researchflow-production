"""
Recorded FHIR server responses for deterministic testing.

All responses are:
- Synthetic (no real patient data - uses R### pattern)
- Metadata-only (no PHI)
- Deterministic (seeded by input parameters)
- Offline-safe (no network required)
"""

import hashlib
from typing import List, Optional
from .types import PatientResource, Observation, OperationOutcome


class RecordedFHIRResponses:
    """
    Provides deterministic synthetic FHIR responses for testing.

    Uses patient_id hashing to generate consistent but varied responses.
    All data is clearly marked as synthetic test data.
    """

    SYNTHETIC_MARKER = "SYNTHETIC_TEST_DATA"

    def get_patient(self, patient_id: str) -> PatientResource:
        """
        Return deterministic synthetic patient.

        Args:
            patient_id: Patient identifier (e.g., "R001")

        Returns:
            PatientResource with synthetic data
        """
        # Generate consistent but varied names based on ID
        hash_val = int(hashlib.md5(patient_id.encode()).hexdigest()[:8], 16)
        name_suffix = chr(65 + (hash_val % 26))  # A-Z

        return PatientResource(
            id=f"syn-{patient_id}",
            name=f"Synthetic Patient {patient_id[:4]}{name_suffix}",
            identifier=[
                {
                    "system": "https://test.example.org/synthetic-mrn",
                    "value": f"SYN-{patient_id}",
                    "type": {
                        "text": self.SYNTHETIC_MARKER
                    }
                }
            ]
        )

    def get_observations(
        self,
        patient_id: str,
        code: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Observation]:
        """
        Return deterministic synthetic observations.

        Args:
            patient_id: Patient identifier
            code: Optional code filter
            category: Optional category filter

        Returns:
            List of 2-3 synthetic observations
        """
        # Generate 2-3 observations based on patient_id hash
        hash_val = int(hashlib.md5(patient_id.encode()).hexdigest()[:8], 16)
        num_obs = 2 + (hash_val % 2)  # 2 or 3 observations

        observations = []
        for i in range(num_obs):
            obs_id = f"obs-{patient_id}-{i+1}"
            value = 50 + ((hash_val + i * 17) % 50)  # 50-99 range

            obs = Observation(
                id=obs_id,
                status="final",
                category=[{
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "survey",
                        "display": "Survey"
                    }],
                    "text": self.SYNTHETIC_MARKER
                }],
                code={
                    "coding": [{
                        "system": "https://research-os.example.org/signals",
                        "code": f"test_signal_{i+1}",
                        "display": f"Test Signal {i+1}"
                    }],
                    "text": f"test_signal_{i+1} (PROM)"
                },
                subject={
                    "identifier": {
                        "system": "https://research-os.example.org/patients",
                        "value": patient_id
                    },
                    "display": f"Research Subject {patient_id}"
                },
                effective_datetime=f"2024-01-{15+i:02d}T14:30:00Z",
                value_quantity={
                    "value": float(value),
                    "unit": "/100",
                    "code": "/100",
                    "system": "http://unitsofmeasure.org"
                }
            )

            # Apply filters
            if code and f"test_signal_{i+1}" != code:
                continue
            if category and category != "survey":
                continue

            observations.append(obs)

        return observations

    def post_observation(self, observation: Observation) -> OperationOutcome:
        """
        Simulate posting an observation (always succeeds in mock).

        Args:
            observation: Observation to post

        Returns:
            OperationOutcome indicating success
        """
        # Generate deterministic resource ID
        obs_hash = hashlib.md5(observation.code["coding"][0]["code"].encode()).hexdigest()[:8]
        new_id = f"obs-created-{obs_hash}"

        return OperationOutcome(
            success=True,
            message=f"Observation created successfully (mock) - {self.SYNTHETIC_MARKER}",
            resource_id=new_id
        )


# Singleton instance
RECORDED_RESPONSES = RecordedFHIRResponses()

"""
Epic FHIR Client

FHIR R4 client for Epic with backend OAuth authentication.

Based on document_pdf.pdf specification (page 8).

Environment Variables:
    EPIC_FHIR_BASE_URL: FHIR base URL (e.g., https://.../api/FHIR/R4)
    Plus all variables from auth.py for authentication

Notes:
    Epic installations differ on where operative notes live and how they
    are typed/coded. Common patterns:
    - Search DocumentReference by patient + date/encounter
    - Follow content.attachment.url or Binary to retrieve note text/PDF
    
    You will need to align with your local Epic/FHIR configuration and scopes.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import requests

from .auth import EpicBackendAuthConfig, EpicBackendAuthenticator

logger = logging.getLogger(__name__)


class EpicFHIRError(Exception):
    """Raised when Epic FHIR request fails."""
    pass


class EpicFHIRClient:
    """
    FHIR R4 client for Epic with automatic token management.

    Example:
        client = EpicFHIRClient.from_env()
        patient = client.get("Patient/12345")
        procedures = client.search("Procedure", params={"patient": "12345"})
    """

    def __init__(
        self,
        base_url: str,
        authenticator: EpicBackendAuthenticator,
        *,
        timeout_s: int = 60
    ) -> None:
        """
        Initialize FHIR client.

        Args:
            base_url: FHIR R4 base URL
            authenticator: Configured authenticator for token management
            timeout_s: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.authenticator = authenticator
        self.timeout_s = timeout_s
        self.session = requests.Session()

    @classmethod
    def from_env(cls) -> "EpicFHIRClient":
        """
        Create client from environment variables.

        Required:
            EPIC_FHIR_BASE_URL: FHIR base URL
            Plus all auth variables (see auth.py)
        """
        base_url = os.environ["EPIC_FHIR_BASE_URL"]
        auth_cfg = EpicBackendAuthConfig.from_env()
        auth = EpicBackendAuthenticator(auth_cfg)
        return cls(base_url=base_url, authenticator=auth, timeout_s=auth_cfg.timeout_s)

    def _headers(self) -> Dict[str, str]:
        """Get request headers with current access token."""
        token = self.authenticator.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/fhir+json",
        }

    def get(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        GET a FHIR resource or search results.

        Args:
            path: Resource path (e.g., "Patient/12345")
            params: Query parameters

        Returns:
            FHIR resource or Bundle

        Raises:
            EpicFHIRError: If request fails
        """
        url = f"{self.base_url}/{path.lstrip('/')}"

        try:
            resp = self.session.get(
                url,
                headers=self._headers(),
                params=params,
                timeout=self.timeout_s
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            raise EpicFHIRError(f"FHIR GET failed: {e}") from e

        return resp.json()

    def search(
        self,
        resource_type: str,
        *,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Search for FHIR resources.

        FHIR search: GET [base]/[type]?[params...]

        Args:
            resource_type: Resource type (e.g., "Patient", "Procedure")
            params: Search parameters

        Returns:
            FHIR Bundle with search results
        """
        return self.get(resource_type, params=params)

    def get_patient(self, patient_id: str) -> Dict[str, Any]:
        """Get Patient resource by ID."""
        return self.get(f"Patient/{patient_id}")

    def search_encounters(
        self,
        patient_id: str,
        *,
        status: Optional[str] = None,
        date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Search Encounters for a patient.

        Args:
            patient_id: Patient ID
            status: Encounter status filter
            date: Date filter (FHIR date format)

        Returns:
            FHIR Bundle with Encounter resources
        """
        params: Dict[str, Any] = {"patient": patient_id}
        if status:
            params["status"] = status
        if date:
            params["date"] = date
        return self.search("Encounter", params=params)

    def search_procedures(
        self,
        patient_id: str,
        *,
        date: Optional[str] = None,
        code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Search Procedures for a patient.

        Args:
            patient_id: Patient ID
            date: Date filter
            code: Procedure code filter

        Returns:
            FHIR Bundle with Procedure resources
        """
        params: Dict[str, Any] = {"patient": patient_id}
        if date:
            params["date"] = date
        if code:
            params["code"] = code
        return self.search("Procedure", params=params)

    def search_document_references(
        self,
        patient_id: str,
        *,
        type_code: Optional[str] = None,
        date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Search DocumentReferences for a patient.

        This is commonly where operative notes are stored in Epic.

        Args:
            patient_id: Patient ID
            type_code: Document type LOINC code
            date: Date filter

        Returns:
            FHIR Bundle with DocumentReference resources
        """
        params: Dict[str, Any] = {"patient": patient_id}
        if type_code:
            params["type"] = type_code
        if date:
            params["date"] = date
        return self.search("DocumentReference", params=params)

    def get_binary(self, binary_id: str) -> bytes:
        """
        Get Binary resource content (e.g., document attachment).

        Args:
            binary_id: Binary resource ID

        Returns:
            Raw binary content
        """
        url = f"{self.base_url}/Binary/{binary_id}"

        headers = self._headers()
        headers["Accept"] = "*/*"  # Accept any content type

        resp = self.session.get(url, headers=headers, timeout=self.timeout_s)
        resp.raise_for_status()

        return resp.content

"""
Epic FHIR Data Ingestion

Epic SMART on FHIR backend services integration for surgical case data.

Uses JWT client assertion for backend OAuth 2.0 authentication
(client_credentials grant with signed JWT).

Based on document_pdf.pdf specification (pages 6-9).

Usage:
    from data_ingestion.epic.auth import EpicBackendAuthenticator, EpicBackendAuthConfig
    from data_ingestion.epic.fhir_client import EpicFHIRClient

    client = EpicFHIRClient.from_env()
    patient = client.get("Patient/12345")
"""

from .auth import EpicBackendAuthConfig, EpicBackendAuthenticator
from .fhir_client import EpicFHIRClient

__all__ = [
    "EpicBackendAuthConfig",
    "EpicBackendAuthenticator",
    "EpicFHIRClient",
]

"""
Data Ingestion Module

Clinical data ingestion from multiple sources (REDCap, Epic FHIR, spreadsheets)
normalized into a single SurgicalCase payload for downstream extraction pipelines.

Based on document_pdf.pdf specification.

Usage:
    from data_ingestion.models import SurgicalCase
    from data_ingestion.redcap.client import RedcapClient
    from data_ingestion.epic.fhir_client import EpicFHIRClient
"""

from .models import SurgicalCase

__all__ = ["SurgicalCase"]

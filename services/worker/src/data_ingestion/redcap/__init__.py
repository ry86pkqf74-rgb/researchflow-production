"""
REDCap Data Ingestion

REDCap API client and mapper for surgical case data.
Commonly used for research pipelines at institutions like Emory.

Usage:
    from data_ingestion.redcap.client import RedcapClient
    from data_ingestion.redcap.mapper import redcap_record_to_case

    client = RedcapClient.from_env()
    records = client.export_records(filter_logic='[service_line]="General Surgery"')
    cases = [redcap_record_to_case(r) for r in records]
"""

from .client import RedcapClient
from .mapper import redcap_record_to_case

__all__ = ["RedcapClient", "redcap_record_to_case"]

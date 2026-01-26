"""
REDCap API Client

Minimal REDCap API client for exporting records.
REDCap commonly uses an API token (not username/password) and expects
POST form-encoded parameters including 'token' and 'content'.

Based on document_pdf.pdf specification (pages 3-4).

Environment Variables:
    REDCAP_API_URL: REDCap API endpoint (e.g., https://<redcap>/api/)
    REDCAP_API_TOKEN: Project-scoped API token
    REDCAP_TIMEOUT_S: Request timeout in seconds (default: 60)

Security Notes:
    - API tokens are user+project scoped; never log tokens
    - Prefer exporting de-identified datasets when feasible
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)


class RedcapError(Exception):
    """Raised when REDCap API returns an error."""
    pass


class RedcapClient:
    """
    Minimal REDCap API client for exporting records.

    REDCap commonly authenticates via per-user / per-project API tokens
    that must be included in each request.

    Example:
        client = RedcapClient.from_env()
        records = client.export_records(filter_logic='[service_line]="General Surgery"')
    """

    def __init__(
        self,
        api_url: str,
        api_token: str,
        *,
        timeout_s: int = 60
    ) -> None:
        """
        Initialize REDCap client.

        Args:
            api_url: REDCap API endpoint URL
            api_token: Project-scoped API token
            timeout_s: Request timeout in seconds
        """
        self.api_url = api_url.rstrip("/")
        self.api_token = api_token
        self.timeout_s = timeout_s
        self.session = requests.Session()

    @classmethod
    def from_env(cls) -> "RedcapClient":
        """
        Create client from environment variables.

        Required:
            REDCAP_API_URL: e.g., https://<redcap>/api/
            REDCAP_API_TOKEN: project-scoped token

        Optional:
            REDCAP_TIMEOUT_S: timeout in seconds (default: 60)
        """
        api_url = os.environ["REDCAP_API_URL"]
        api_token = os.environ["REDCAP_API_TOKEN"]
        timeout_s = int(os.getenv("REDCAP_TIMEOUT_S", "60"))
        return cls(api_url=api_url, api_token=api_token, timeout_s=timeout_s)

    def export_records(
        self,
        *,
        fields: Optional[list[str]] = None,
        records: Optional[list[str]] = None,
        forms: Optional[list[str]] = None,
        events: Optional[list[str]] = None,
        filter_logic: Optional[str] = None,
        return_format: str = "json",
    ) -> list[dict[str, Any]]:
        """
        Export REDCap records (content=record).

        REDCap supports exporting subsets by records/fields and filter logic
        (project config dependent).

        Args:
            fields: Specific fields to export
            records: Specific record IDs to export
            forms: Specific forms/instruments to export
            events: Specific events to export (longitudinal projects)
            filter_logic: REDCap filter logic string
            return_format: Response format ("json" supported)

        Returns:
            List of record dictionaries

        Raises:
            RedcapError: If API returns an error
            ValueError: If unsupported return_format
        """
        data: dict[str, Any] = {
            "token": self.api_token,
            "content": "record",
            "format": return_format,
            "type": "flat",
            "rawOrLabel": "raw",
            "rawOrLabelHeaders": "raw",
            "exportCheckboxLabel": "false",
            "returnFormat": return_format,
        }

        if fields:
            # Many REDCap installs accept repeated fields[]; some accept comma strings
            data["fields"] = fields
        if records:
            data["records"] = records
        if forms:
            data["forms"] = forms
        if events:
            data["events"] = events
        if filter_logic:
            data["filterLogic"] = filter_logic

        logger.debug(f"REDCap export_records: filter={filter_logic}, fields={fields}")

        try:
            resp = self.session.post(
                self.api_url,
                data=data,
                timeout=self.timeout_s
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            raise RedcapError(f"REDCap API request failed: {e}") from e

        if return_format == "json":
            payload = resp.json()
            if not isinstance(payload, list):
                # REDCap sometimes returns error objects
                if isinstance(payload, dict) and "error" in payload:
                    raise RedcapError(f"REDCap error: {payload['error']}")
                raise ValueError(f"Unexpected REDCap response shape: {type(payload)}")
            logger.info(f"REDCap exported {len(payload)} records")
            return payload

        raise ValueError(f"Unsupported return_format={return_format!r}")

    def export_metadata(self, *, return_format: str = "json") -> list[dict[str, Any]]:
        """
        Export project metadata (data dictionary).

        Returns:
            List of field metadata dictionaries
        """
        data = {
            "token": self.api_token,
            "content": "metadata",
            "format": return_format,
            "returnFormat": return_format,
        }

        resp = self.session.post(self.api_url, data=data, timeout=self.timeout_s)
        resp.raise_for_status()

        if return_format == "json":
            return resp.json()

        raise ValueError(f"Unsupported return_format={return_format!r}")

    def export_project_info(self) -> dict[str, Any]:
        """
        Export project information.

        Returns:
            Dictionary with project settings
        """
        data = {
            "token": self.api_token,
            "content": "project",
            "format": "json",
            "returnFormat": "json",
        }

        resp = self.session.post(self.api_url, data=data, timeout=self.timeout_s)
        resp.raise_for_status()
        return resp.json()

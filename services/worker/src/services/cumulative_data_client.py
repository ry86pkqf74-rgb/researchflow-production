"""
Cumulative Data Client

This module provides a client for the worker to fetch cumulative stage data
from the orchestrator's cumulative data service. This enables LIVE mode
workflows to access data from all prior stages.
"""

import os
import logging
import httpx
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

logger = logging.getLogger("worker.cumulative_data")


@dataclass
class CumulativeStageData:
    """Cumulative data retrieved from orchestrator for a project/research workflow."""
    manifest_id: Optional[str] = None
    project_id: Optional[str] = None
    research_id: Optional[str] = None
    current_stage: int = 1
    governance_mode: str = "DEMO"
    cumulative_data: Dict[str, Any] = None
    phi_schemas: Dict[str, Any] = None
    stage_outputs: Dict[int, Dict[str, Any]] = None

    def __post_init__(self):
        if self.cumulative_data is None:
            self.cumulative_data = {}
        if self.phi_schemas is None:
            self.phi_schemas = {}
        if self.stage_outputs is None:
            self.stage_outputs = {}


class CumulativeDataClient:
    """
    Client for fetching cumulative workflow data from the orchestrator.

    This client connects to the orchestrator's /api/cumulative endpoints
    to retrieve prior stage outputs, PHI schemas, and manifest state.
    """

    def __init__(self, orchestrator_url: Optional[str] = None):
        """
        Initialize the cumulative data client.

        Args:
            orchestrator_url: Base URL for the orchestrator service.
                            Defaults to ORCHESTRATOR_URL env var or http://orchestrator:3001
        """
        self.orchestrator_url = orchestrator_url or os.getenv(
            "ORCHESTRATOR_URL",
            "http://orchestrator:3001"
        )
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={"Content-Type": "application/json"}
            )
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def get_cumulative_data(
        self,
        identifier: Dict[str, str],
        stage_number: int,
    ) -> CumulativeStageData:
        """
        Fetch cumulative data for a project/research up to a specific stage.

        Args:
            identifier: Dict containing either 'project_id' or 'research_id'
            stage_number: The stage number to get cumulative data for

        Returns:
            CumulativeStageData with all prior stage outputs and PHI schemas
        """
        client = await self._get_client()

        # Determine the identifier string (prefer research_id for URL)
        id_value = identifier.get("research_id") or identifier.get("project_id")
        if not id_value:
            logger.warning("No project_id or research_id provided, returning empty cumulative data")
            return CumulativeStageData()

        try:
            # Fetch cumulative data from orchestrator
            url = f"{self.orchestrator_url}/api/cumulative/projects/{id_value}/cumulative/{stage_number}"
            logger.info(f"Fetching cumulative data from: {url}")

            response = await client.get(url)

            if response.status_code == 404:
                logger.info(f"No existing manifest for {id_value}, starting fresh")
                return CumulativeStageData(
                    project_id=identifier.get("project_id"),
                    research_id=identifier.get("research_id"),
                )

            response.raise_for_status()
            data = response.json()

            # Parse stage outputs into dict keyed by stage number
            stage_outputs = {}
            for stage_key, stage_data in data.get("stageOutputs", {}).items():
                try:
                    stage_num = int(stage_key)
                    stage_outputs[stage_num] = stage_data
                except (ValueError, TypeError):
                    logger.warning(f"Invalid stage key: {stage_key}")

            return CumulativeStageData(
                manifest_id=data.get("manifestId"),
                project_id=data.get("projectId"),
                research_id=data.get("researchId"),
                current_stage=data.get("currentStage", 1),
                governance_mode=data.get("governanceMode", "DEMO"),
                cumulative_data=data.get("cumulativeData", {}),
                phi_schemas=data.get("phiSchemas", {}),
                stage_outputs=stage_outputs,
            )

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching cumulative data: {e.response.status_code} - {e.response.text}")
            return CumulativeStageData(
                project_id=identifier.get("project_id"),
                research_id=identifier.get("research_id"),
            )
        except Exception as e:
            logger.error(f"Error fetching cumulative data: {e}")
            return CumulativeStageData(
                project_id=identifier.get("project_id"),
                research_id=identifier.get("research_id"),
            )

    async def report_stage_completion(
        self,
        identifier: Dict[str, str],
        stage_number: int,
        output_data: Dict[str, Any],
        artifacts: List[str] = None,
        processing_time_ms: int = 0,
    ) -> bool:
        """
        Report stage completion back to the orchestrator.

        Args:
            identifier: Dict containing either 'project_id' or 'research_id'
            stage_number: The completed stage number
            output_data: The stage's output data
            artifacts: List of artifact paths generated
            processing_time_ms: Processing time in milliseconds

        Returns:
            True if successfully reported, False otherwise
        """
        client = await self._get_client()

        id_value = identifier.get("research_id") or identifier.get("project_id")
        if not id_value:
            logger.warning("No identifier provided, skipping stage completion report")
            return False

        try:
            url = f"{self.orchestrator_url}/api/cumulative/internal/stages/complete"

            payload = {
                "identifier": id_value,
                "stageNumber": stage_number,
                "outputData": output_data,
                "artifacts": artifacts or [],
                "processingTimeMs": processing_time_ms,
            }

            response = await client.post(url, json=payload)
            response.raise_for_status()

            logger.info(f"Stage {stage_number} completion reported for {id_value}")
            return True

        except Exception as e:
            logger.error(f"Failed to report stage completion: {e}")
            return False

    async def report_stage_failure(
        self,
        identifier: Dict[str, str],
        stage_number: int,
        error_message: str,
        error_code: str = "STAGE_ERROR",
    ) -> bool:
        """
        Report stage failure back to the orchestrator.

        Args:
            identifier: Dict containing either 'project_id' or 'research_id'
            stage_number: The failed stage number
            error_message: PHI-sanitized error message
            error_code: Error code for categorization

        Returns:
            True if successfully reported, False otherwise
        """
        client = await self._get_client()

        id_value = identifier.get("research_id") or identifier.get("project_id")
        if not id_value:
            return False

        try:
            url = f"{self.orchestrator_url}/api/cumulative/internal/stages/fail"

            payload = {
                "identifier": id_value,
                "stageNumber": stage_number,
                "errorMessage": error_message,
                "errorCode": error_code,
            }

            response = await client.post(url, json=payload)
            response.raise_for_status()

            logger.info(f"Stage {stage_number} failure reported for {id_value}")
            return True

        except Exception as e:
            logger.error(f"Failed to report stage failure: {e}")
            return False


# Global client instance
_cumulative_data_client: Optional[CumulativeDataClient] = None


def get_cumulative_data_client() -> CumulativeDataClient:
    """Get or create the global cumulative data client instance."""
    global _cumulative_data_client
    if _cumulative_data_client is None:
        _cumulative_data_client = CumulativeDataClient()
    return _cumulative_data_client


async def close_cumulative_data_client():
    """Close the global cumulative data client."""
    global _cumulative_data_client
    if _cumulative_data_client:
        await _cumulative_data_client.close()
        _cumulative_data_client = None

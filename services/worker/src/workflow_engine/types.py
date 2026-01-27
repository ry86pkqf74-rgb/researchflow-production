"""
Workflow Engine Types

This module defines the core types and protocols for the workflow engine.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable
from datetime import datetime


@dataclass
class StageResult:
    """Result from executing a workflow stage.

    Attributes:
        stage_id: The numeric identifier of the stage (1-19)
        stage_name: Human-readable name of the stage
        status: Execution status (completed, failed, skipped)
        started_at: ISO timestamp when stage started
        completed_at: ISO timestamp when stage completed
        duration_ms: Execution duration in milliseconds
        output: Stage-specific output data
        artifacts: List of generated artifact paths
        errors: List of error messages (PHI-sanitized)
        warnings: List of warning messages
        metadata: Additional stage metadata
    """
    stage_id: int
    stage_name: str
    status: str  # completed, failed, skipped
    started_at: str
    completed_at: str
    duration_ms: int
    output: Dict[str, Any] = field(default_factory=dict)
    artifacts: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StageContext:
    """Context passed to each stage during execution.

    Attributes:
        job_id: Unique identifier for the current job
        config: Job configuration dictionary
        dataset_pointer: Path or URI to the dataset
        artifact_path: Base path for artifact storage
        log_path: Base path for log storage
        governance_mode: Current governance mode (DEMO, STAGING, PRODUCTION)
        previous_results: Results from previously executed stages (within current job)
        metadata: Additional context metadata

        # Cumulative data from orchestrator (LIVE mode)
        manifest_id: UUID of the project manifest in the database
        project_id: Project identifier for cumulative tracking
        research_id: Research identifier for cumulative tracking
        cumulative_data: Accumulated data from all prior stages across sessions
        phi_schemas: PHI detection/protection schemas for sensitive data
        prior_stage_outputs: Raw outputs from prior stages (from database)
    """
    job_id: str
    config: Dict[str, Any]
    dataset_pointer: Optional[str] = None
    artifact_path: str = "/data/artifacts"
    log_path: str = "/data/logs"
    governance_mode: str = "DEMO"
    previous_results: Dict[int, StageResult] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Cumulative data fields (populated from orchestrator in LIVE mode)
    manifest_id: Optional[str] = None
    project_id: Optional[str] = None
    research_id: Optional[str] = None
    cumulative_data: Dict[str, Any] = field(default_factory=dict)
    phi_schemas: Dict[str, Any] = field(default_factory=dict)
    prior_stage_outputs: Dict[int, Dict[str, Any]] = field(default_factory=dict)

    def get_prior_stage_output(self, stage_number: int) -> Optional[Dict[str, Any]]:
        """
        Get the output from a prior stage.

        First checks previous_results (current job run), then falls back to
        prior_stage_outputs (from database/orchestrator).

        Args:
            stage_number: The stage number to retrieve output for

        Returns:
            The stage output dict, or None if not found
        """
        # Check in-job results first
        if stage_number in self.previous_results:
            return self.previous_results[stage_number].output

        # Fall back to orchestrator-provided cumulative data
        if stage_number in self.prior_stage_outputs:
            return self.prior_stage_outputs[stage_number].get("output_data", {})

        return None

    def get_cumulative_value(self, key: str, default: Any = None) -> Any:
        """
        Get a value from cumulative data by key.

        Args:
            key: The key to look up in cumulative_data
            default: Default value if key not found

        Returns:
            The value or default
        """
        return self.cumulative_data.get(key, default)

    def has_phi_schema(self, schema_name: str) -> bool:
        """Check if a PHI schema is available."""
        return schema_name in self.phi_schemas

    def get_phi_schema(self, schema_name: str) -> Optional[Dict[str, Any]]:
        """Get a PHI schema by name."""
        return self.phi_schemas.get(schema_name)


@runtime_checkable
class Stage(Protocol):
    """Protocol defining the interface for workflow stages.

    All stage implementations must provide:
    - stage_id: Numeric identifier (1-19)
    - stage_name: Human-readable name
    - execute: Async method that performs the stage logic
    """

    stage_id: int
    stage_name: str

    async def execute(self, context: StageContext) -> StageResult:
        """Execute the stage with the given context.

        Args:
            context: StageContext containing job info and configuration

        Returns:
            StageResult containing execution results and any artifacts
        """
        ...

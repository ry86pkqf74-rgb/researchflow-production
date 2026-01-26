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
        previous_results: Results from previously executed stages
        metadata: Additional context metadata
    """
    job_id: str
    config: Dict[str, Any]
    dataset_pointer: Optional[str] = None
    artifact_path: str = "/data/artifacts"
    log_path: str = "/data/logs"
    governance_mode: str = "DEMO"
    previous_results: Dict[int, StageResult] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


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

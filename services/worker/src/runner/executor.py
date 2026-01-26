"""Job executor with capability gating and governance enforcement.

Executes jobs with full governance checks:
- Capability gating (require_capability)
- STANDBY blocking
- Metadata-only logging
- No PHI leakage

Governance Reference: docs/governance/CAPABILITIES.md
"""

import sys
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

from src.governance.capabilities import require_capability, RosMode, get_current_mode
from src.provenance.logger import log_operation
from .jobs import Job, JobStatus, JobRegistry


@dataclass
class JobResult:
    """Result of job execution.

    Attributes:
        success: Whether job succeeded
        job_id: Job identifier
        run_id: Pipeline run_id (if applicable)
        artifact_refs: List of artifact paths
        error: Error message if failed (no PHI)
    """

    success: bool
    job_id: str
    run_id: Optional[str] = None
    artifact_refs: list = None
    error: Optional[str] = None

    def __post_init__(self):
        if self.artifact_refs is None:
            self.artifact_refs = []


class JobExecutor:
    """Execute jobs with capability gating and governance enforcement."""

    def __init__(self, registry: Optional[JobRegistry] = None):
        """Initialize job executor.

        Args:
            registry: Job registry instance. Default: JobRegistry()
        """
        self.registry = registry or JobRegistry()

    def submit_job(
        self,
        workflow_name: str,
        dataset_id: Optional[str] = None,
        parameters: Optional[Dict] = None,
    ) -> Job:
        """Submit a new job for execution.

        Creates job in PENDING state and registers it.

        Args:
            workflow_name: Workflow to execute
            dataset_id: Dataset identifier (optional)
            parameters: Workflow parameters (optional)

        Returns:
            Created Job instance
        """
        job = Job.create(
            workflow_name=workflow_name,
            dataset_id=dataset_id,
            parameters=parameters,
        )

        self.registry.register_job(job)
        return job

    def execute_job(self, job_id: str) -> JobResult:
        """Execute a job by ID with full governance checks.

        Execution flow:
        1. Check capability (allow_external_runner)
        2. If STANDBY → block
        3. Load job from registry
        4. Update status to RUNNING
        5. Execute workflow
        6. Update status to COMPLETED/FAILED
        7. Log provenance

        Args:
            job_id: Job identifier

        Returns:
            JobResult with execution outcome
        """
        # 1. Check capability
        decision = require_capability(
            capability_name="allow_external_runner",
            attestation_complete=False,  # No attestation for orchestration
        )

        if not decision.allowed:
            error_msg = f"Capability denied: {decision.reason}"
            return JobResult(
                success=False,
                job_id=job_id,
                error=error_msg,
            )

        # 2. Additional STANDBY check (defense in depth)
        mode = get_current_mode()
        if mode == RosMode.STANDBY:
            error_msg = "External runner blocked in STANDBY mode"
            return JobResult(
                success=False,
                job_id=job_id,
                error=error_msg,
            )

        # 3. Load job
        job = self.registry.get_job(job_id)
        if job is None:
            return JobResult(
                success=False,
                job_id=job_id,
                error=f"Job not found: {job_id}",
            )

        # 4. Check if job already terminal
        if job.status.is_terminal():
            return JobResult(
                success=job.status == JobStatus.COMPLETED,
                job_id=job.job_id,
                run_id=job.run_id,
                artifact_refs=job.artifact_refs,
                error=job.error_message,
            )

        # 5. Update status to RUNNING
        job.update_status(JobStatus.RUNNING)
        self.registry.update_job(job)

        # 6. Execute workflow
        try:
            result = self._execute_workflow(job)

            # Update job on success
            job.update_status(JobStatus.COMPLETED)
            job.run_id = result.run_id
            for artifact_ref in result.artifact_refs:
                job.add_artifact(artifact_ref)

            self.registry.update_job(job)

            # Log provenance
            log_operation(
                operation=f"external_runner_{job.workflow_name}",
                inputs=[job.dataset_id] if job.dataset_id else [],
                outputs=result.artifact_refs,
                notes=f"Job {job.job_id} completed",
            )

            return result

        except Exception as e:
            # Update job on failure
            error_msg = self._sanitize_error(str(e))
            job.update_status(JobStatus.FAILED, error_message=error_msg)
            self.registry.update_job(job)

            return JobResult(
                success=False,
                job_id=job.job_id,
                error=error_msg,
            )

    def _execute_workflow(self, job: Job) -> JobResult:
        """Execute workflow based on job.workflow_name.

        Args:
            job: Job to execute

        Returns:
            JobResult with execution outcome

        Raises:
            ValueError: If workflow not supported
            Exception: If workflow execution fails
        """
        workflow_name = job.workflow_name

        if workflow_name == "pipeline":
            return self._execute_pipeline_workflow(job)
        elif workflow_name == "simulated_real":
            return self._execute_simulated_real_workflow(job)
        else:
            raise ValueError(f"Unsupported workflow: {workflow_name}")

    def _execute_pipeline_workflow(self, job: Job) -> JobResult:
        """Execute pipeline workflow.

        Uses src/pipeline/runner.py for execution.

        Args:
            job: Job to execute

        Returns:
            JobResult with execution outcome
        """
        from src.pipeline.runner import run_pipeline

        # Get parameters
        strict = job.parameters.get("strict", False)

        # Setup output directory
        job_dir = self.registry.get_job_dir(job.job_id)
        output_dir = job_dir / "pipeline_output"

        # Redirect stdout/stderr to logs
        stdout_path = job_dir / "stdout.log"
        stderr_path = job_dir / "stderr.log"

        with open(stdout_path, "w") as stdout_f, open(stderr_path, "w") as stderr_f:
            old_stdout = sys.stdout
            old_stderr = sys.stderr

            try:
                sys.stdout = stdout_f
                sys.stderr = stderr_f

                # Execute pipeline
                run_pipeline(output_dir=output_dir, strict=strict)

            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr

        # Collect artifacts
        artifact_refs = []
        if output_dir.exists():
            for artifact in output_dir.glob("*"):
                rel_path = artifact.relative_to(Path(".tmp"))
                artifact_refs.append(str(rel_path))

        # Add logs as artifacts
        artifact_refs.append(str(stdout_path.relative_to(Path(".tmp"))))
        artifact_refs.append(str(stderr_path.relative_to(Path(".tmp"))))

        return JobResult(
            success=True,
            job_id=job.job_id,
            run_id=None,  # Pipeline doesn't expose run_id
            artifact_refs=artifact_refs,
        )

    def _execute_simulated_real_workflow(self, job: Job) -> JobResult:
        """Execute simulated-real workflow.

        Uses src/simulated_real/pipeline.py for execution.

        Args:
            job: Job to execute

        Returns:
            JobResult with execution outcome
        """
        from src.simulated_real.pipeline import run_simulated_real_from_bytes

        # Get parameters
        input_path = job.parameters.get("input_path")
        if not input_path:
            raise ValueError("Missing required parameter: input_path")

        # Read input bytes
        input_path = Path(input_path)
        if not input_path.exists():
            raise ValueError(f"Input file not found: {input_path}")

        raw_bytes = input_path.read_bytes()

        # Setup output directory
        tmp_root = Path(".tmp")

        # Execute pipeline
        result = run_simulated_real_from_bytes(
            raw_bytes=raw_bytes,
            tmp_root=tmp_root,
            include_scrubbed_dataset=True,
        )

        # Extract artifact refs
        artifact_refs = list(result["paths"].values())

        return JobResult(
            success=True,
            job_id=job.job_id,
            run_id=result["run_id"],
            artifact_refs=artifact_refs,
        )

    def _sanitize_error(self, error: str) -> str:
        """Sanitize error message to prevent PHI leakage.

        Args:
            error: Raw error message

        Returns:
            Sanitized error message (no potential PHI)
        """
        # For now, just truncate to first 500 chars
        # Future: more sophisticated PHI detection/redaction
        if len(error) > 500:
            return error[:500] + "... (truncated)"
        return error

    def get_job_status(self, job_id: str) -> Optional[Job]:
        """Get current status of a job.

        Args:
            job_id: Job identifier

        Returns:
            Job instance or None if not found
        """
        return self.registry.get_job(job_id)

    def list_jobs(
        self,
        status: Optional[JobStatus] = None,
        workflow_name: Optional[str] = None,
    ) -> list:
        """List jobs with optional filters.

        Args:
            status: Filter by status (optional)
            workflow_name: Filter by workflow name (optional)

        Returns:
            List of Job instances
        """
        return self.registry.list_jobs(status=status, workflow_name=workflow_name)

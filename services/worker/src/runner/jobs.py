"""Job model and registry for external runner.

Job lifecycle: PENDING → RUNNING → COMPLETED/FAILED

Storage: JSONL append-only log at .tmp/runner/jobs.jsonl
Logs: Per-job directory at .tmp/runner/job_<id>/

Governance: Metadata-only, no PHI in job records.
"""

import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional
from uuid import uuid4


class JobStatus(Enum):
    """Job execution status."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

    def is_terminal(self) -> bool:
        """Check if status is terminal (no further transitions)."""
        return self in {JobStatus.COMPLETED, JobStatus.FAILED}


@dataclass
class Job:
    """Job record for external runner.

    Attributes:
        job_id: Unique job identifier
        dataset_id: Dataset identifier (if applicable)
        workflow_name: Workflow to execute (e.g., "pipeline", "simulated_real")
        parameters: Workflow parameters (metadata only, no PHI)
        status: Current job status
        artifact_refs: List of artifact paths (relative to .tmp/)
        created_at: ISO 8601 timestamp (UTC)
        updated_at: ISO 8601 timestamp (UTC)
        run_id: Pipeline run_id (if applicable)
        error_message: Error message if failed (no PHI)
    """

    job_id: str
    dataset_id: Optional[str]
    workflow_name: str
    parameters: Dict
    status: JobStatus
    artifact_refs: List[str]
    created_at: str
    updated_at: str
    run_id: Optional[str] = None
    error_message: Optional[str] = None

    @classmethod
    def create(
        cls,
        workflow_name: str,
        dataset_id: Optional[str] = None,
        parameters: Optional[Dict] = None,
    ) -> "Job":
        """Create a new job in PENDING state.

        Args:
            workflow_name: Workflow to execute
            dataset_id: Dataset identifier (optional)
            parameters: Workflow parameters (optional)

        Returns:
            New Job instance
        """
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        job_id = f"job_{uuid4().hex[:16]}"

        return cls(
            job_id=job_id,
            dataset_id=dataset_id,
            workflow_name=workflow_name,
            parameters=parameters or {},
            status=JobStatus.PENDING,
            artifact_refs=[],
            created_at=now,
            updated_at=now,
        )

    def update_status(
        self,
        status: JobStatus,
        error_message: Optional[str] = None,
    ) -> None:
        """Update job status and timestamp.

        Args:
            status: New status
            error_message: Error message if failed (no PHI)
        """
        self.status = status
        self.updated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        if error_message:
            self.error_message = error_message

    def add_artifact(self, artifact_path: str) -> None:
        """Add artifact reference to job.

        Args:
            artifact_path: Path to artifact (relative to .tmp/)
        """
        if artifact_path not in self.artifact_refs:
            self.artifact_refs.append(artifact_path)

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization.

        Returns:
            Dictionary representation
        """
        data = asdict(self)
        data["status"] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "Job":
        """Create Job from dictionary.

        Args:
            data: Dictionary representation

        Returns:
            Job instance
        """
        data = data.copy()
        data["status"] = JobStatus(data["status"])
        return cls(**data)


class JobRegistry:
    """Job registry with JSONL persistence.

    Storage: .tmp/runner/jobs.jsonl (append-only)

    Thread-safety: Not thread-safe (single-process assumption)
    """

    def __init__(self, registry_path: Optional[Path] = None):
        """Initialize job registry.

        Args:
            registry_path: Path to JSONL registry file.
                          Default: .tmp/runner/jobs.jsonl
        """
        if registry_path is None:
            registry_path = Path(".tmp/runner/jobs.jsonl")

        self.registry_path = Path(registry_path)
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)

    def register_job(self, job: Job) -> None:
        """Register a new job.

        Args:
            job: Job to register
        """
        # Append to JSONL
        with open(self.registry_path, "a") as f:
            f.write(json.dumps(job.to_dict()) + "\n")

    def update_job(self, job: Job) -> None:
        """Update existing job (rewrite registry).

        Note: This is inefficient for large registries. For production,
        consider using a database or append-only log with compaction.

        Args:
            job: Job to update
        """
        jobs = self.list_jobs()

        # Replace job in list
        for i, existing_job in enumerate(jobs):
            if existing_job.job_id == job.job_id:
                jobs[i] = job
                break
        else:
            # Job not found, append it
            jobs.append(job)

        # Rewrite registry
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.registry_path, "w") as f:
            for j in jobs:
                f.write(json.dumps(j.to_dict()) + "\n")

    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID.

        Args:
            job_id: Job identifier

        Returns:
            Job instance or None if not found
        """
        jobs = self.list_jobs()
        for job in jobs:
            if job.job_id == job_id:
                return job
        return None

    def list_jobs(
        self,
        status: Optional[JobStatus] = None,
        workflow_name: Optional[str] = None,
    ) -> List[Job]:
        """List jobs with optional filters.

        Args:
            status: Filter by status (optional)
            workflow_name: Filter by workflow name (optional)

        Returns:
            List of Job instances (latest version of each)
        """
        if not self.registry_path.exists():
            return []

        # Read all entries
        jobs_by_id = {}
        with open(self.registry_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                data = json.loads(line)
                job = Job.from_dict(data)

                # Keep latest version of each job
                jobs_by_id[job.job_id] = job

        # Apply filters
        jobs = list(jobs_by_id.values())

        if status is not None:
            jobs = [j for j in jobs if j.status == status]

        if workflow_name is not None:
            jobs = [j for j in jobs if j.workflow_name == workflow_name]

        # Sort by created_at (newest first)
        jobs.sort(key=lambda j: j.created_at, reverse=True)

        return jobs

    def get_job_dir(self, job_id: str) -> Path:
        """Get job-specific directory for logs/artifacts.

        Args:
            job_id: Job identifier

        Returns:
            Path to job directory (.tmp/runner/job_<id>/)
        """
        job_dir = self.registry_path.parent / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        return job_dir

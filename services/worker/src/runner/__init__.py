"""External runner for executing workflows outside Streamlit lifecycle.

Provides job-based execution with capability gating and metadata-only logging.

Design Principles:
- Local, offline execution (no network calls)
- STANDBY immutability enforced
- Fail-closed governance
- Metadata-only logs (no PHI)
- .tmp/ boundary enforcement

Usage:
    # CLI
    python -m src.runner.cli submit --workflow pipeline --dataset-id ds_001
    python -m src.runner.cli status --job-id job_abc123
    python -m src.runner.cli list

    # Programmatic
    from src.runner import JobRegistry, JobExecutor
    registry = JobRegistry()
    executor = JobExecutor(registry)
    job = executor.submit_job(workflow_name="pipeline", dataset_id="ds_001")
    result = executor.execute_job(job.job_id)

Governance Reference: docs/governance/CAPABILITIES.md
"""

from .jobs import Job, JobStatus, JobRegistry
from .executor import JobExecutor, JobResult

__all__ = [
    "Job",
    "JobStatus",
    "JobRegistry",
    "JobExecutor",
    "JobResult",
]

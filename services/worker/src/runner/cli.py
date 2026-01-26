#!/usr/bin/env python3
"""CLI entry point for external runner.

Usage:
    python -m src.runner.cli submit --workflow pipeline --dataset-id ds_001
    python -m src.runner.cli submit --workflow simulated_real --input-path .tmp/uploads/test.csv
    python -m src.runner.cli status --job-id job_abc123
    python -m src.runner.cli list
    python -m src.runner.cli list --status PENDING
    python -m src.runner.cli list --workflow pipeline

Governance: Capability gating enforced in executor.
"""

import argparse
import json
import sys

from .executor import JobExecutor
from .jobs import JobStatus


def cmd_submit(args):
    """Submit a new job."""
    executor = JobExecutor()

    # Build parameters dict
    parameters = {}
    if args.dataset_id:
        parameters["dataset"] = args.dataset_id
    if args.input_path:
        parameters["input_path"] = args.input_path
    if args.strict:
        parameters["strict"] = True

    # Submit job
    job = executor.submit_job(
        workflow_name=args.workflow,
        dataset_id=args.dataset_id,
        parameters=parameters,
    )

    print(f"✓ Job submitted: {job.job_id}")
    print(f"  Workflow: {job.workflow_name}")
    print(f"  Status: {job.status.value}")
    print(f"  Created: {job.created_at}")

    # Optionally execute immediately
    if args.execute:
        print(f"\nExecuting job {job.job_id}...")
        result = executor.execute_job(job.job_id)

        if result.success:
            print(f"✓ Job completed successfully")
            print(f"  Artifacts: {len(result.artifact_refs)}")
            for artifact in result.artifact_refs[:5]:
                print(f"    - {artifact}")
            if len(result.artifact_refs) > 5:
                print(f"    ... and {len(result.artifact_refs) - 5} more")
        else:
            print(f"✗ Job failed: {result.error}")
            sys.exit(1)


def cmd_execute(args):
    """Execute an existing job."""
    executor = JobExecutor()

    print(f"Executing job {args.job_id}...")
    result = executor.execute_job(args.job_id)

    if result.success:
        print(f"✓ Job completed successfully")
        print(f"  Artifacts: {len(result.artifact_refs)}")
        for artifact in result.artifact_refs[:10]:
            print(f"    - {artifact}")
        if len(result.artifact_refs) > 10:
            print(f"    ... and {len(result.artifact_refs) - 10} more")
    else:
        print(f"✗ Job failed: {result.error}")
        sys.exit(1)


def cmd_status(args):
    """Get job status."""
    executor = JobExecutor()

    job = executor.get_job_status(args.job_id)

    if job is None:
        print(f"✗ Job not found: {args.job_id}")
        sys.exit(1)

    print(f"Job: {job.job_id}")
    print(f"  Workflow: {job.workflow_name}")
    print(f"  Status: {job.status.value}")
    print(f"  Created: {job.created_at}")
    print(f"  Updated: {job.updated_at}")

    if job.dataset_id:
        print(f"  Dataset: {job.dataset_id}")

    if job.run_id:
        print(f"  Run ID: {job.run_id}")

    if job.artifact_refs:
        print(f"  Artifacts: {len(job.artifact_refs)}")
        for artifact in job.artifact_refs[:5]:
            print(f"    - {artifact}")
        if len(job.artifact_refs) > 5:
            print(f"    ... and {len(job.artifact_refs) - 5} more")

    if job.error_message:
        print(f"  Error: {job.error_message}")

    # Output JSON if requested
    if args.json:
        print("\nJSON:")
        print(json.dumps(job.to_dict(), indent=2))


def cmd_list(args):
    """List jobs."""
    executor = JobExecutor()

    # Parse status filter
    status = None
    if args.status:
        try:
            status = JobStatus(args.status)
        except ValueError:
            print(f"✗ Invalid status: {args.status}")
            print(f"  Valid: {', '.join([s.value for s in JobStatus])}")
            sys.exit(1)

    # List jobs
    jobs = executor.list_jobs(status=status, workflow_name=args.workflow)

    if not jobs:
        print("No jobs found")
        return

    print(f"Jobs: {len(jobs)}")
    print(f"{'='*80}")

    for job in jobs:
        status_icon = {
            JobStatus.PENDING: "○",
            JobStatus.RUNNING: "◐",
            JobStatus.COMPLETED: "✓",
            JobStatus.FAILED: "✗",
        }.get(job.status, "?")

        print(f"{status_icon} {job.job_id}")
        print(f"  Workflow: {job.workflow_name}")
        print(f"  Status: {job.status.value}")
        print(f"  Created: {job.created_at}")

        if job.error_message:
            print(f"  Error: {job.error_message[:80]}...")

        print()


def main():
    """CLI main entry point."""
    parser = argparse.ArgumentParser(
        description="External runner CLI for executing workflows",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    subparsers.required = True

    # Submit command
    submit_parser = subparsers.add_parser("submit", help="Submit a new job")
    submit_parser.add_argument(
        "--workflow",
        type=str,
        required=True,
        choices=["pipeline", "simulated_real"],
        help="Workflow to execute",
    )
    submit_parser.add_argument(
        "--dataset-id",
        type=str,
        help="Dataset identifier (optional)",
    )
    submit_parser.add_argument(
        "--input-path",
        type=str,
        help="Input file path (for simulated_real workflow)",
    )
    submit_parser.add_argument(
        "--strict",
        action="store_true",
        help="Enable strict mode (for pipeline workflow)",
    )
    submit_parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute job immediately after submission",
    )
    submit_parser.set_defaults(func=cmd_submit)

    # Execute command
    execute_parser = subparsers.add_parser("execute", help="Execute an existing job")
    execute_parser.add_argument(
        "--job-id",
        type=str,
        required=True,
        help="Job identifier",
    )
    execute_parser.set_defaults(func=cmd_execute)

    # Status command
    status_parser = subparsers.add_parser("status", help="Get job status")
    status_parser.add_argument(
        "--job-id",
        type=str,
        required=True,
        help="Job identifier",
    )
    status_parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON format",
    )
    status_parser.set_defaults(func=cmd_status)

    # List command
    list_parser = subparsers.add_parser("list", help="List jobs")
    list_parser.add_argument(
        "--status",
        type=str,
        help="Filter by status (PENDING/RUNNING/COMPLETED/FAILED)",
    )
    list_parser.add_argument(
        "--workflow",
        type=str,
        help="Filter by workflow name",
    )
    list_parser.set_defaults(func=cmd_list)

    # Parse args and execute
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

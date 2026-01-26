"""
Minimal run provenance logger for ROS core operations.

Records metadata-only audit trails for pipeline operations.
NO PHI, NO row-level data, NO external calls.

Log format: JSONL (one JSON object per line)
Log location: .tmp/provenance/run_provenance.jsonl

Each entry includes:
- entry_id (uuid)
- timestamp (UTC ISO 8601)
- git_commit_sha
- operation (string enum: "export", "qa", "manuscript", etc.)
- inputs (list of file paths only)
- outputs (list of file paths only)
- notes (optional free text)

Example entry:
{
  "entry_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-01-07T02:55:00Z",
  "git_commit_sha": "cdd04a4314fbda6f5ce2b0ab1933a1028af7478c",
  "operation": "export",
  "inputs": ["data/processed/cohort.parquet", "config/phase1.yaml"],
  "outputs": ["results/export_bundle_20260107.json"],
  "notes": "Phase 1 cohort export"
}

Governance: Offline-first, no external provider calls in src/
"""

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from uuid import uuid4


class ProvenanceLogger:
    """
    Minimal provenance logger for ROS core pipeline operations.

    Logs metadata-only entries to .tmp/provenance/run_provenance.jsonl.
    Append-only writes to a local JSONL file (no remote writes).
    """

    def __init__(self, log_path: Optional[Path] = None):
        """
        Initialize provenance logger.

        Args:
            log_path: Path to JSONL log file.
                     Default: .tmp/provenance/run_provenance.jsonl
        """
        if log_path is None:
            log_path = Path(".tmp/provenance/run_provenance.jsonl")

        self.log_path = Path(log_path)

        # Ensure directory exists
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def log_operation(
        self,
        operation: str,
        inputs: List[str],
        outputs: List[str],
        notes: Optional[str] = None,
    ) -> dict:
        """
        Log a pipeline operation to provenance JSONL.

        Args:
            operation: Operation type (e.g., "export", "qa", "manuscript").
                       Freeform on purpose: intentionally not validated to
                       allow experiment-specific operation names.
            inputs: List of input file paths (NO data, paths only)
            outputs: List of output file paths (NO data, paths only)
            notes: Optional short description

        Returns:
            Dictionary of the logged entry

        Example:
            >>> logger = ProvenanceLogger()
            >>> entry = logger.log_operation(
            ...     operation="export",
            ...     inputs=["data/processed/cohort.parquet"],
            ...     outputs=["results/bundle.json"],
            ...     notes="Phase 1 export"
            ... )
        """
        # Get git commit SHA (best effort, no error if not in git repo)
        git_commit_sha = self._get_git_commit_sha()

        # Create entry
        entry = {
            "entry_id": str(uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "git_commit_sha": git_commit_sha,
            "operation": operation,
            "inputs": inputs,
            "outputs": outputs,
            "notes": notes or "",
        }

        # Append to JSONL (one line per entry)
        with open(self.log_path, "a") as f:
            f.write(json.dumps(entry) + "\n")

        return entry

    def _get_git_commit_sha(self) -> str:
        """
        Get current git commit SHA.

        Returns:
            Commit SHA string, or "unknown" if not in a git repo.
        """
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True,
                text=True,
                timeout=2,
                check=False,
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except (
            subprocess.TimeoutExpired,
            subprocess.CalledProcessError,
            FileNotFoundError,
            OSError,
        ):
            # Best-effort: when git is unavailable or errors, fall back to "unknown"
            return "unknown"

        return "unknown"

    def read_log(self) -> List[dict]:
        """
        Read all entries from the provenance log.

        Returns:
            List of entry dictionaries
        """
        if not self.log_path.exists():
            return []

        entries = []
        with open(self.log_path, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))

        return entries

    def get_summary(self) -> dict:
        """
        Get summary statistics for the provenance log.

        Returns:
            Dictionary with summary stats
        """
        entries = self.read_log()

        if not entries:
            return {
                "total_entries": 0,
                "operations": {},
                "first_entry": None,
                "last_entry": None,
            }

        # Count operations
        operation_counts = {}
        for entry in entries:
            op = entry.get("operation", "unknown")
            operation_counts[op] = operation_counts.get(op, 0) + 1

        return {
            "total_entries": len(entries),
            "operations": operation_counts,
            "first_entry": entries[0].get("timestamp"),
            "last_entry": entries[-1].get("timestamp"),
        }


# =============================================================================
# Convenience function
# =============================================================================


def log_operation(
    operation: str,
    inputs: List[str],
    outputs: List[str],
    notes: Optional[str] = None,
    log_path: Optional[Path] = None,
) -> dict:
    """
    Convenience function to log an operation.

    Args:
        operation: Operation type
        inputs: Input file paths
        outputs: Output file paths
        notes: Optional description
        log_path: Optional custom log path

    Returns:
        Dictionary of the logged entry

    Example:
        >>> from src.provenance import log_operation
        >>> log_operation(
        ...     operation="export",
        ...     inputs=["data/processed/cohort.parquet"],
        ...     outputs=["results/bundle.json"]
        ... )
    """
    logger = ProvenanceLogger(log_path=log_path)
    return logger.log_operation(
        operation=operation, inputs=inputs, outputs=outputs, notes=notes
    )


# =============================================================================
# High-level provenance logging helpers
# =============================================================================


def _get_timestamp() -> str:
    """Return current UTC timestamp in ISO 8601 with milliseconds and Z suffix."""
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def log_dataset_load(
    dataset_id: str,
    content_hash: str,
    schema_fingerprint: str,
    user_id: str,
    notes: Optional[str] = None,
) -> dict:
    """
    Log a dataset load operation to provenance.

    Args:
        dataset_id: Unique identifier for the dataset
        content_hash: SHA256 hex digest of the raw file content
        schema_fingerprint: Deterministic hash of the dataset schema
        user_id: Identifier of the user performing the load
        notes: Optional operator notes (must not include PHI)

    Returns:
        The logged entry dictionary
    """
    logger = ProvenanceLogger()
    note_parts = [
        f"content_hash={content_hash[:16]}...",
        f"schema={schema_fingerprint[:16]}...",
        f"user={user_id}",
    ]
    if notes:
        note_parts.append(notes)
    return logger.log_operation(
        operation="DATASET_LOAD",
        inputs=[],
        outputs=[dataset_id],
        notes=", ".join(note_parts),
    )


def log_ai_request(
    request_id: str,
    prompt_hash: str,
    provider: str,
    user_id: str,
    model: str,
) -> dict:
    """
    Log an AI request event to provenance.

    Args:
        request_id: Unique identifier for the LLM request
        prompt_hash: SHA256 hash of the prompt (PHI-free)
        provider: Name of the LLM provider (e.g. "OpenAI", "xAI")
        user_id: Identifier of the user initiating the request
        model: Name of the model used

    Returns:
        The logged entry dictionary
    """
    logger = ProvenanceLogger()
    return logger.log_operation(
        operation="LLM_REQUEST",
        inputs=[f"prompt:{prompt_hash[:16]}..."],
        outputs=[request_id],
        notes=f"provider={provider}, model={model}, user={user_id}",
    )

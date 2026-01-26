"""
Run manifest writer for workflow execution provenance.

Generates deterministic, PHI-safe run manifests that conform to the
run_manifest.schema.json schema. All manifests are written to .tmp/
runtime-only paths and never committed.

Governance:
- Metadata only (NO content, NO snippets, NO PHI)
- Deterministic JSON (sort_keys=True, stable ordering)
- Runtime-only (.tmp/ paths, never committed)
- Schema-validated output

Usage:
    from src.provenance.manifest_writer import ManifestWriter

    writer = ManifestWriter(run_id="workflow_20260114_120000_abc123")
    writer.set_workflow_metadata(
        workflow_name="literature_ingestion",
        git_commit="abc123...",
        data_version_id="v1.0.0"
    )
    writer.add_artifact("qa_json", ".tmp/artifacts/qa_metrics.json")
    writer.set_validation_summary({
        "schema": "pass",
        "relational": "pass",
        "domain": "pass",
        "drift": "pass"
    })
    manifest_path = writer.write_manifest()
"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


class ManifestWriterError(ValueError):
    """Exception raised for invalid manifest writer operations."""

    pass


# PHI denylist - normalized (lowercase, no underscores/dashes)
# Reused from ProvenanceEvent validation logic
PHI_DENYLIST = {
    "ssn",
    "socialsecurity",
    "patientname",
    "patientid",
    "mrn",
    "medicalrecord",
    "medicalrecordnumber",
    "dob",
    "dateofbirth",
    "email",
    "phonenumber",
    "phone",
    "address",
    "rawdata",
    "content",
    "snippet",
    "raw",
}


def get_git_commit_sha() -> str:
    """
    Capture current git commit SHA.

    Returns:
        Git commit SHA (40 characters) or "unknown_commit" on failure

    Example:
        >>> sha = get_git_commit_sha()
        >>> len(sha) in (40, 14)  # 40 for SHA, 14 for "unknown_commit"
        True
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
        return "unknown_commit"


def _validate_tmp_path(path: str | Path) -> None:
    """
    Validate that path contains .tmp/ in its path.

    Args:
        path: Path to validate

    Raises:
        ManifestWriterError: If path does not contain .tmp/

    Example:
        >>> _validate_tmp_path(".tmp/manifests/run_123/manifest.json")  # OK
        >>> _validate_tmp_path("/etc/passwd")  # Raises ManifestWriterError
        Traceback (most recent call last):
        ...
        ManifestWriterError: Path must be under .tmp/ directory: /etc/passwd
    """
    path_str = str(Path(path).resolve())

    # Check if path contains .tmp/
    if ".tmp" not in path_str:
        raise ManifestWriterError(
            f"Path must be under .tmp/ directory: {path}"
        )


def _validate_no_phi_content(data: Dict[str, Any], path: str = "root") -> None:
    """
    Recursively validate that dict doesn't contain PHI-bearing fields.

    Uses same denylist as ProvenanceEvent for consistency.

    Args:
        data: Dictionary to validate
        path: Current path in dict tree (for error messages)

    Raises:
        ManifestWriterError: If PHI-bearing field names detected

    Example:
        >>> _validate_no_phi_content({"workflow": "test", "status": "pass"})  # OK
        >>> _validate_no_phi_content({"patient_name": "John"})  # Raises
        Traceback (most recent call last):
        ...
        ManifestWriterError: Potential PHI field detected at root.patient_name
    """
    if not isinstance(data, dict):
        return

    for key, value in data.items():
        # Normalize key: lowercase + remove underscores and dashes
        key_norm = key.lower().replace("_", "").replace("-", "")

        # Check denylist
        if key_norm in PHI_DENYLIST:
            raise ManifestWriterError(
                f"Potential PHI field detected at {path}.{key}. "
                f"Manifests must NOT contain PHI content. "
                f"Use hashes or paths instead."
            )

        # Recursive check for nested dicts
        if isinstance(value, dict):
            _validate_no_phi_content(value, path=f"{path}.{key}")
        elif isinstance(value, list):
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    _validate_no_phi_content(item, path=f"{path}.{key}[{i}]")


def _compute_overall_status(validation_summary: Dict[str, str]) -> str:
    """
    Compute overall status from validation summary.

    Uses precedence: fail > warn > pass

    Args:
        validation_summary: Dict with validation layer statuses

    Returns:
        "fail" if any layer failed, otherwise "pass"

    Example:
        >>> _compute_overall_status({"schema": "pass", "relational": "pass", "domain": "pass", "drift": "pass"})
        'pass'
        >>> _compute_overall_status({"schema": "fail", "relational": "pass", "domain": "pass", "drift": "pass"})
        'fail'
        >>> _compute_overall_status({"schema": "pass", "relational": "warn", "domain": "pass", "drift": "pass"})
        'pass'
    """
    # If any layer is "fail", overall is "fail"
    if any(status == "fail" for status in validation_summary.values()):
        return "fail"

    # Otherwise "pass" (warnings don't cause overall failure)
    return "pass"


class ManifestWriter:
    """
    Write deterministic run manifests for workflow provenance.

    Attributes:
        run_id: Unique run identifier
        output_dir: Directory for manifest output (must be under .tmp/)
        manifest: Manifest data structure (conforms to run_manifest.schema.json)

    Example:
        >>> writer = ManifestWriter(run_id="workflow_20260114_120000_abc123")
        >>> writer.set_workflow_metadata(
        ...     workflow_name="test_workflow",
        ...     git_commit="abc123",
        ...     data_version_id="v1.0.0"
        ... )
        >>> writer.add_artifact("qa_json", ".tmp/test/qa.json")
        >>> writer.set_validation_summary({
        ...     "schema": "pass",
        ...     "relational": "pass",
        ...     "domain": "pass",
        ...     "drift": "pass"
        ... })
        >>> path = writer.write_manifest()
    """

    def __init__(self, run_id: str, output_dir: Path = Path(".tmp/manifests")):
        """
        Initialize manifest writer.

        Args:
            run_id: Unique run identifier
            output_dir: Directory for manifest output (default: .tmp/manifests)

        Raises:
            ManifestWriterError: If output_dir is not under .tmp/
        """
        # Validate output_dir is under .tmp/
        _validate_tmp_path(output_dir)

        self.run_id = run_id
        self.output_dir = output_dir

        # Initialize manifest structure with required fields
        # Timestamp in ISO 8601 format with 'Z' suffix
        self.manifest: Dict[str, Any] = {
            "run_id": run_id,
            "run_date": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "workflow_name": "",  # Set via set_workflow_metadata
            "git_commit": "",     # Set via set_workflow_metadata
            "data_version_id": "",  # Set via set_workflow_metadata
            "status": "",         # Computed from validation_summary
            "validation_summary": {},  # Set via set_validation_summary
            "artifacts": {},      # Set via add_artifact
        }

    def set_workflow_metadata(
        self,
        workflow_name: str,
        git_commit: str,
        data_version_id: str
    ) -> None:
        """
        Set core workflow metadata fields.

        Args:
            workflow_name: Name of the workflow/pipeline
            git_commit: Git commit SHA (40 characters)
            data_version_id: Version identifier for input data

        Raises:
            ManifestWriterError: If metadata contains PHI

        Example:
            >>> writer = ManifestWriter(run_id="test_run")
            >>> writer.set_workflow_metadata(
            ...     workflow_name="literature_ingestion",
            ...     git_commit="abc123",
            ...     data_version_id="v1.0.0"
            ... )
        """
        # Validate no PHI in metadata
        metadata = {
            "workflow_name": workflow_name,
            "git_commit": git_commit,
            "data_version_id": data_version_id,
        }
        _validate_no_phi_content(metadata, path="workflow_metadata")

        # Set fields
        self.manifest["workflow_name"] = workflow_name
        self.manifest["git_commit"] = git_commit
        self.manifest["data_version_id"] = data_version_id

    def add_artifact(self, artifact_type: str, artifact_path: str) -> None:
        """
        Add artifact path to manifest (metadata only, not content).

        Args:
            artifact_type: Type of artifact (e.g., "qa_json", "qa_summary")
            artifact_path: Path to artifact file (must be under .tmp/)

        Raises:
            ManifestWriterError: If path is not under .tmp/

        Example:
            >>> writer = ManifestWriter(run_id="test_run")
            >>> writer.add_artifact("qa_json", ".tmp/artifacts/qa_metrics.json")
        """
        # Validate path is under .tmp/
        _validate_tmp_path(artifact_path)

        # Store path (metadata only, not content)
        self.manifest["artifacts"][artifact_type] = str(artifact_path)

    def set_validation_summary(self, summary: Dict[str, str]) -> None:
        """
        Set validation summary from validation suite results.

        Args:
            summary: Dict with keys: schema, relational, domain, drift
                    Values must be: "pass", "fail", or "warn"

        Raises:
            ManifestWriterError: If summary is invalid or contains PHI

        Example:
            >>> writer = ManifestWriter(run_id="test_run")
            >>> writer.set_validation_summary({
            ...     "schema": "pass",
            ...     "relational": "pass",
            ...     "domain": "pass",
            ...     "drift": "pass"
            ... })
        """
        # Validate required keys
        required_keys = {"schema", "relational", "domain", "drift"}
        if set(summary.keys()) != required_keys:
            raise ManifestWriterError(
                f"Validation summary must have exactly these keys: {required_keys}. "
                f"Got: {set(summary.keys())}"
            )

        # Validate status values
        valid_statuses = {"pass", "fail", "warn"}
        for key, status in summary.items():
            if status not in valid_statuses:
                raise ManifestWriterError(
                    f"Invalid validation status '{status}' for {key}. "
                    f"Must be one of: {valid_statuses}"
                )

        # Validate no PHI
        _validate_no_phi_content(summary, path="validation_summary")

        # Set summary
        self.manifest["validation_summary"] = summary

        # Compute and set overall status
        self.manifest["status"] = _compute_overall_status(summary)

    def set_notes(self, notes: str) -> None:
        """
        Set optional notes field.

        Args:
            notes: Optional notes or context for this run

        Example:
            >>> writer = ManifestWriter(run_id="test_run")
            >>> writer.set_notes("Test run for INF-13 validation")
        """
        self.manifest["notes"] = notes

    def set_baseline_reference(self, baseline_reference: str) -> None:
        """
        Set optional baseline reference field.

        Args:
            baseline_reference: Identifier of baseline used for drift comparison

        Example:
            >>> writer = ManifestWriter(run_id="test_run")
            >>> writer.set_baseline_reference("baseline_20260101")
        """
        self.manifest["baseline_reference"] = baseline_reference

    def write_manifest(self) -> Path:
        """
        Write manifest to file with deterministic JSON serialization.

        Returns:
            Absolute path to written manifest file

        Raises:
            ManifestWriterError: If manifest is incomplete or invalid

        Example:
            >>> writer = ManifestWriter(run_id="test_run")
            >>> # ... set metadata, artifacts, validation summary ...
            >>> path = writer.write_manifest()
            >>> path.exists()
            True
        """
        # Validate all required fields are set
        required_fields = [
            "run_id", "run_date", "workflow_name", "git_commit",
            "data_version_id", "status", "validation_summary", "artifacts"
        ]

        for field in required_fields:
            value = self.manifest.get(field)
            if value is None or value == "" or value == {}:
                raise ManifestWriterError(
                    f"Required field '{field}' is not set. "
                    f"Call appropriate setter methods before writing manifest."
                )

        # Final PHI validation on complete manifest
        _validate_no_phi_content(self.manifest, path="manifest")

        # Create output directory
        manifest_dir = self.output_dir / self.run_id
        manifest_dir.mkdir(parents=True, exist_ok=True)

        # Write with deterministic JSON serialization
        manifest_path = manifest_dir / "run_manifest.json"

        with manifest_path.open("w", encoding="utf-8") as f:
            json.dump(
                self.manifest,
                f,
                sort_keys=True,  # Deterministic key ordering
                indent=2,
                ensure_ascii=False,
            )

        return manifest_path.resolve()

    def to_json(self) -> str:
        """
        Serialize manifest to deterministic JSON string.

        Returns:
            JSON string with sorted keys

        Example:
            >>> writer = ManifestWriter(run_id="test_run")
            >>> # ... set fields ...
            >>> json_str = writer.to_json()
            >>> isinstance(json_str, str)
            True
        """
        return json.dumps(self.manifest, sort_keys=True, indent=2, ensure_ascii=False)

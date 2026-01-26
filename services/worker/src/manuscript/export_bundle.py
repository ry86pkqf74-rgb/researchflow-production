"""
Export Bundle Builder - PR37b

Assembles deterministic export bundles linking:
- Pipeline provenance
- Figures manifest
- Bundle metadata + SHA256 hashes

Governance:
- All outputs MUST go under .tmp/ (quarantine boundary)
- PHI-Safe: No PHI processing - references paths only
- Offline-first: No network calls
- Deterministic: Same inputs → same hash

Version: 1.0.0
Related: PR37b, schemas/export_bundle_v1.json
"""

import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from src.export.exceptions import ExportError


def build_export_bundle(
    run_id: str,
    output_dir: Path,
    pipeline_provenance_path: Path,
    figures_manifest_path: Path,
    extra_artifacts: Optional[list[Path]] = None,
    simulated_real_artifacts: Optional[dict[str, Path]] = None,
    include_scrubbed_dataset: bool = False,
    dataset_ids: Optional[list[str]] = None,
) -> Path:
    """
    Writes export_bundle.json under output_dir and returns its path.

    Enforces .tmp/ boundary and computes sha256 deterministically.

    CANONICAL INTEGRATION POINT (PR46 Step 5):
    This function is the authoritative bundle builder for the ROS platform.
    All export bundles MUST go through this function to ensure:
    - .tmp/ boundary enforcement (quarantine)
    - PHI-safe artifact inclusion (metadata only, no raw uploads)
    - Deterministic hash computation
    - Schema compliance (schemas/export_bundle_v1.json)

    Args:
        run_id: Unique run identifier (e.g., "run_20260107_143022")
        output_dir: Output directory (MUST be under repo_root/.tmp/)
        pipeline_provenance_path: Path to pipeline provenance JSON
        figures_manifest_path: Path to figures manifest JSON
        extra_artifacts: Optional list of additional artifact paths to hash
        simulated_real_artifacts: Optional dict of simulated-real artifacts:
            - "phi_scan_report": Path to phi_scan_report.json
            - "phi_scrub_manifest": Path to phi_scrub_manifest.json
            - "dataset_profile": Path to dataset_profile.json
            - "scrubbed_dataset": Path to scrubbed.csv (only if post-scrub clean)
            NOTE: Raw upload files (.tmp/uploads/.../raw.*) are NEVER included
        include_scrubbed_dataset: Whether to include scrubbed dataset in bundle
            (only if post-scrub clean verified; default False for safety)
        dataset_ids: Optional list of dataset IDs from registry (Phase 2)

    Returns:
        Path to the generated export_bundle.json

    Raises:
        ValueError: If output_dir or input paths violate .tmp/ boundary, or if JSON invalid
        FileNotFoundError: If required input files don't exist

    Example:
        >>> from pathlib import Path
        >>> bundle_path = build_export_bundle(
        ...     run_id="run_20260107_143022",
        ...     output_dir=Path(".tmp/bundles"),
        ...     pipeline_provenance_path=Path(".tmp/metadata/pipeline_provenance.json"),
        ...     figures_manifest_path=Path(".tmp/figures/figures_manifest_run_20260107.json"),
        ...     simulated_real_artifacts={
        ...         "phi_scan_report": Path(".tmp/artifacts/run_xyz/phi_scan_report.json"),
        ...         "phi_scrub_manifest": Path(".tmp/artifacts/run_xyz/phi_scrub_manifest.json"),
        ...         "dataset_profile": Path(".tmp/artifacts/run_xyz/dataset_profile.json"),
        ...     }
        ... )
    """
    # Convert to absolute paths
    output_dir = Path(output_dir).resolve()
    pipeline_provenance_path = Path(pipeline_provenance_path).resolve()
    figures_manifest_path = Path(figures_manifest_path).resolve()

    # Get repo root (assume we're in Research-Operating-System-Template or its subdirectory)
    repo_root = _get_repo_root()
    tmp_dir = repo_root / ".tmp"

    # GUARDRAIL: Enforce .tmp/ boundary for output
    if not _is_under_directory(output_dir, tmp_dir):
        raise ValueError(
            f"Security boundary violation: output_dir must be under {tmp_dir}, "
            f"got {output_dir}"
        )

    # GUARDRAIL: Enforce .tmp/ boundary for input files (quarantine)
    if not _is_under_directory(pipeline_provenance_path, tmp_dir):
        raise ValueError(
            f"Security boundary violation: pipeline_provenance_path must be under {tmp_dir}, "
            f"got {pipeline_provenance_path}"
        )

    if not _is_under_directory(figures_manifest_path, tmp_dir):
        raise ValueError(
            f"Security boundary violation: figures_manifest_path must be under {tmp_dir}, "
            f"got {figures_manifest_path}"
        )

    # Validate input files exist
    if not pipeline_provenance_path.exists():
        raise FileNotFoundError(
            f"Pipeline provenance file not found: {pipeline_provenance_path}"
        )

    if not figures_manifest_path.exists():
        raise FileNotFoundError(
            f"Figures manifest file not found: {figures_manifest_path}"
        )

    # Validate extra artifacts if provided
    if extra_artifacts:
        for artifact_path in extra_artifacts:
            resolved_artifact_path = Path(artifact_path).resolve()

            # GUARDRAIL: Enforce .tmp/ boundary for extra artifacts
            if not _is_under_directory(resolved_artifact_path, tmp_dir):
                raise ValueError(
                    f"Security boundary violation: extra artifact must be under {tmp_dir}, "
                    f"got {resolved_artifact_path}"
                )

            if not resolved_artifact_path.exists():
                raise FileNotFoundError(
                    f"Extra artifact not found: {resolved_artifact_path}"
                )

    # PR46: Validate and process simulated_real_artifacts (if provided)
    simulated_real_refs = {}
    synthetic_upload_test = False
    raw_upload_excluded = True  # Always true (raw uploads NEVER included)

    if simulated_real_artifacts:
        synthetic_upload_test = True

        # Validate and resolve simulated-real artifacts
        for artifact_name, artifact_path in simulated_real_artifacts.items():
            if artifact_path is None:
                continue

            resolved_artifact_path = Path(artifact_path).resolve()

            # GUARDRAIL: Enforce .tmp/ boundary
            if not _is_under_directory(resolved_artifact_path, tmp_dir):
                raise ValueError(
                    f"Security boundary violation: simulated_real artifact '{artifact_name}' "
                    f"must be under {tmp_dir}, got {resolved_artifact_path}"
                )

            # GUARDRAIL: Verify artifact is NOT a raw upload file (quarantine enforcement)
            if "/uploads/" in str(
                resolved_artifact_path
            ) and resolved_artifact_path.name.startswith("raw."):
                raise ValueError(
                    f"Security violation: Raw upload files cannot be included in export bundles. "
                    f"Attempted to include: {resolved_artifact_path}. "
                    f"Only scrubbed/metadata artifacts from .tmp/artifacts/ or .tmp/work/ are allowed."
                )

            # Validate file exists
            if not resolved_artifact_path.exists():
                raise FileNotFoundError(
                    f"Simulated-real artifact '{artifact_name}' not found: {resolved_artifact_path}"
                )

            # Validate JSON artifacts (all except scrubbed_dataset)
            if artifact_name != "scrubbed_dataset":
                try:
                    with open(resolved_artifact_path, "r") as f:
                        json.load(f)
                except json.JSONDecodeError as e:
                    raise ValueError(
                        f"Invalid JSON in simulated-real artifact '{artifact_name}': {e}"
                    )

            # Store relative reference
            try:
                simulated_real_refs[artifact_name] = str(
                    resolved_artifact_path.relative_to(repo_root)
                )
            except ValueError:
                simulated_real_refs[artifact_name] = str(resolved_artifact_path)

    # Read input JSON files (validation that they're valid JSON)
    try:
        with open(pipeline_provenance_path, "r") as f:
            pipeline_provenance_data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in pipeline provenance: {e}")

    # PHI Classification Validation - Block PHI export
    # Only block if explicitly marked as PHI_STAGING; allow DEIDENTIFIED or unset
    classification = pipeline_provenance_data.get("classification")
    if classification == "PHI_STAGING":
        raise ExportError("Cannot export data classified as PHI_STAGING")

    try:
        with open(figures_manifest_path, "r") as f:
            figures_manifest_data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in figures manifest: {e}")

    # Compute deterministic bundle_sha256
    bundle_sha256 = _compute_bundle_hash(
        run_id=run_id,
        pipeline_provenance_path=pipeline_provenance_path,
        figures_manifest_path=figures_manifest_path,
        extra_artifacts=extra_artifacts,
        repo_root=repo_root,
    )

    # Get git commit SHA
    git_commit_sha = _get_git_commit_sha()

    # Get relative paths for references (relative to repo root)
    try:
        pipeline_provenance_ref = str(pipeline_provenance_path.relative_to(repo_root))
    except ValueError:
        # If not relative to repo_root, use absolute path
        pipeline_provenance_ref = str(pipeline_provenance_path)

    try:
        figures_manifest_ref = str(figures_manifest_path.relative_to(repo_root))
    except ValueError:
        figures_manifest_ref = str(figures_manifest_path)

    # Build export bundle following schemas/export_bundle_v1.json
    export_bundle = {
        # Required fields
        "export_version": "v1",
        "template_spec_version": "v1",
        "template_id": "ros_manuscript_export",
        "template_name": "ROS Manuscript Export Bundle",
        "template_version": "1.0.0",
        # Note: export_timestamp is informational only and excluded from bundle_sha256
        # hashing to preserve deterministic integrity (same inputs → same hash)
        "export_timestamp": datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        "content_hash": _compute_content_hash(
            pipeline_provenance_data, figures_manifest_data
        ),
        "bundle_hash": f"sha256:{bundle_sha256}",
        "safety_flags": {
            "ruo_required": True,
            "allow_network": False,
            "allow_uploads": False,
        },
        # Optional but recommended fields
        "commit_sha": git_commit_sha,
        "app_version": "1.0.0",
        "governance_reference": "docs/governance/RUO_DISCLAIMER.md",
        "mode_flags": {
            "mock_only": False,
            "no_network": True,
            "standby_mode": False,
            "synthetic_upload_test": synthetic_upload_test,
            "raw_upload_excluded": raw_upload_excluded,
            "include_scrubbed_dataset": include_scrubbed_dataset,
        },
        # NEW: PR37a optional fields for provenance linking
        "pipeline_provenance_ref": pipeline_provenance_ref,
        "figures_manifest_ref": figures_manifest_ref,
        "bundle_run_id": run_id,
        "bundle_sha256": bundle_sha256,
    }

    # PR46: Add simulated-real artifact references (if provided)
    if simulated_real_refs.get("phi_scan_report"):
        export_bundle["phi_scan_report_ref"] = simulated_real_refs["phi_scan_report"]

    if simulated_real_refs.get("phi_scrub_manifest"):
        export_bundle["phi_scrub_manifest_ref"] = simulated_real_refs[
            "phi_scrub_manifest"
        ]

    if simulated_real_refs.get("dataset_profile"):
        export_bundle["dataset_profile_ref"] = simulated_real_refs["dataset_profile"]

    # Only include scrubbed dataset ref if explicitly requested AND file was provided
    if include_scrubbed_dataset and simulated_real_refs.get("scrubbed_dataset"):
        export_bundle["scrubbed_dataset_ref"] = simulated_real_refs["scrubbed_dataset"]

    # Phase 2: Add dataset registry references (if provided)
    if dataset_ids:
        export_bundle["dataset_registry_refs"] = dataset_ids

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write export_bundle.json
    output_path = output_dir / "export_bundle.json"
    with open(output_path, "w") as f:
        json.dump(export_bundle, f, indent=2)

    # Log provenance event using unified logging
    try:
        from src.provenance import (
            log_event,
            ProvenanceEvent,
            EventType,
            RuntimeMode,
            Classification,
        )

        classification_enum = Classification.UNKNOWN
        if classification and str(classification).strip():
            try:
                classification_enum = Classification[
                    str(classification).strip().upper()
                ]
            except (KeyError, AttributeError):
                classification_enum = Classification.UNKNOWN

        event = ProvenanceEvent(
            event_type=EventType.EXPORT_BUNDLE,
            user_id="system",  # Export bundle is system operation
            mode=RuntimeMode.OFFLINE,  # Export is always offline
            classification=classification_enum,
            success=True,
            details={
                "run_id": run_id,
                "output_file": str(output_path.relative_to(repo_root)),
                "has_simulated_real_artifacts": bool(simulated_real_artifacts),
                "includes_scrubbed_dataset": include_scrubbed_dataset,
            },
            hashes={"bundle": bundle_sha256},
            git_commit_sha=git_commit_sha,
        )
        log_event(event)
    except Exception:
        # Silent fail - don't break export on logging errors
        pass

    return output_path


def _get_repo_root() -> Path:
    """
    Get repository root directory.

    Returns:
        Path to repository root
    """
    # Try git first
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
        if result.returncode == 0:
            return Path(result.stdout.strip()).resolve()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        # Intentionally swallow exceptions: git may not be available or repo may not be
        # initialized. Fall back to heuristic directory search.
        pass

    # Fall back to current working directory assumption
    # Assume we're in Research-Operating-System-Template or its subdirectory
    cwd = Path.cwd()
    if cwd.name == "Research-Operating-System-Template":
        return cwd
    elif (cwd / "Research-Operating-System-Template").exists():
        return cwd / "Research-Operating-System-Template"
    else:
        # Search upwards for Research-Operating-System-Template
        for parent in cwd.parents:
            if parent.name == "Research-Operating-System-Template":
                return parent
        # Last resort: return cwd
        return cwd


def _is_under_directory(path: Path, parent: Path) -> bool:
    """
    Check if path is under parent directory using is_relative_to.

    Args:
        path: Path to check
        parent: Parent directory

    Returns:
        True if path is under parent, False otherwise
    """
    return path.is_relative_to(parent)


def _get_git_commit_sha() -> str:
    """
    Get current git commit SHA.

    Returns:
        Commit SHA string (7 chars), or "unknown" if not in a git repo
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short=7", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        # Intentionally swallow exceptions: git may not be available. Fall back to "unknown".
        pass

    return "unknown"


def _compute_content_hash(
    pipeline_provenance_data: dict,
    figures_manifest_data: dict,
) -> str:
    """
    Compute SHA256 hash of JSON content (metadata-only).

    Args:
        pipeline_provenance_data: Pipeline provenance dictionary
        figures_manifest_data: Figures manifest dictionary

    Returns:
        Hash string in format "sha256:..."
    """
    # Create stable JSON representation
    content_str = json.dumps(
        {
            "pipeline_provenance": pipeline_provenance_data,
            "figures_manifest": figures_manifest_data,
        },
        sort_keys=True,
    )

    hash_digest = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
    return f"sha256:{hash_digest}"


def _compute_bundle_hash(
    run_id: str,
    pipeline_provenance_path: Path,
    figures_manifest_path: Path,
    extra_artifacts: Optional[list[Path]],
    repo_root: Path,
) -> str:
    """
    Compute deterministic SHA256 hash of bundle artifacts.

    Hashes:
    1. Stable metadata header (run_id + relative refs)
    2. File contents in stable order: [pipeline_provenance, figures_manifest] + sorted(extra_artifacts)

    Args:
        run_id: Run identifier
        pipeline_provenance_path: Path to pipeline provenance
        figures_manifest_path: Path to figures manifest
        extra_artifacts: Optional extra artifact paths
        repo_root: Repository root for computing relative paths

    Returns:
        64-character hex SHA256 hash
    """
    hasher = hashlib.sha256()

    # Hash stable metadata header
    try:
        prov_ref = str(pipeline_provenance_path.relative_to(repo_root))
    except ValueError:
        prov_ref = str(pipeline_provenance_path)

    try:
        fig_ref = str(figures_manifest_path.relative_to(repo_root))
    except ValueError:
        fig_ref = str(figures_manifest_path)

    metadata_header = f"run_id={run_id}|pipeline={prov_ref}|figures={fig_ref}"
    hasher.update(metadata_header.encode("utf-8"))

    # Hash file contents in stable order
    file_paths = [pipeline_provenance_path, figures_manifest_path]

    if extra_artifacts:
        # Sort extra artifacts for determinism
        sorted_extras = sorted([Path(p).resolve() for p in extra_artifacts])
        file_paths.extend(sorted_extras)

    for file_path in file_paths:
        with open(file_path, "rb") as f:
            hasher.update(f.read())

    return hasher.hexdigest()

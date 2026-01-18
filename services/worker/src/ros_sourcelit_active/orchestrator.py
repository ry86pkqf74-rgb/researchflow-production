"""Sourcelit synthesis orchestration layer (Task E).

Controlled runtime trigger connecting literature runtime to sourcelit synthesis.

SANDBOX-only, offline-only, metadata-only synthesis.
No AI calls, no network access, no content in outputs.

Created: 2026-01-14 (Task E - Phase 9)
"""

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from src.governance.capabilities import RosMode, get_current_mode
from src.sourcelit_runtime import SourcelitRuntimeError, run_sourcelit_runtime
from web_frontend.provenance_logger import log_event

logger = logging.getLogger(__name__)


class SourcelitOrchestrationError(Exception):
    """Raised when orchestration is blocked by governance or validation."""

    pass


@dataclass(frozen=True)
class SourcelitOrchestrationHandle:
    """Return type for orchestrated sourcelit synthesis.

    Attributes:
        status: Synthesis status ("SUCCESS" | "BLOCKED" | "FAILED")
        sourcelit_run_id: 12-char hash (if successful, None if blocked/failed)
        literature_run_id: Reference to input literature run
        artifact_count: Number of artifacts processed
        ready: True if synthesis completed successfully
        manifest_relpath: Path to synthesized manifest (if successful)
        reason_code: Error reason code (if blocked/failed, None if successful)
    """

    status: str
    sourcelit_run_id: Optional[str]
    literature_run_id: str
    artifact_count: int
    ready: bool
    manifest_relpath: Optional[str]
    reason_code: Optional[str]


def orchestrate_sourcelit_synthesis(
    literature_manifest_relpath: str,
    *,
    tmp_root: Path = Path(".tmp"),
) -> SourcelitOrchestrationHandle:
    """Orchestrate sourcelit synthesis from literature runtime artifacts.

    SANDBOX-only, offline-only, metadata-only synthesis.

    This function:
    1. Validates governance (MODE=SANDBOX, NO_NETWORK=1)
    2. Loads and validates literature manifest
    3. Validates all artifacts are normalized (normalized_ready=true)
    4. Invokes run_sourcelit_runtime() to perform synthesis
    5. Logs provenance events (decision-level only, no content/paths)
    6. Returns orchestration handle with synthesis results

    Args:
        literature_manifest_relpath: Relative path to literature manifest
            (e.g., ".tmp/literature_runtime/manifests/manifest_<id>.json")
        tmp_root: Repository .tmp/ directory (defaults to Path(".tmp"))

    Returns:
        SourcelitOrchestrationHandle with synthesis results

    Raises:
        SourcelitOrchestrationError: Governance violations or invalid inputs (fail-closed)

    Examples:
        >>> handle = orchestrate_sourcelit_synthesis(
        ...     literature_manifest_relpath=".tmp/literature_runtime/manifests/manifest_abc123.json"
        ... )
        >>> assert handle.ready is True
        >>> assert handle.status == "SUCCESS"
    """
    # Step 1: Validate governance (fail-closed)
    _validate_governance()

    # Step 2: Load literature manifest
    manifest_path = tmp_root / literature_manifest_relpath
    manifest = _validate_literature_manifest(manifest_path)

    literature_run_id = manifest["run_id"]
    artifact_ids = manifest.get("artifact_ids", [])
    artifact_count = len(artifact_ids)

    # Step 3: Validate all artifacts are normalized
    _validate_artifacts_normalized(manifest, tmp_root)

    # Step 4: Log orchestration request
    mode = get_current_mode()
    log_event(
        "orchestration_requested",
        {
            "component": "sourcelit_orchestrator",
            "allowed": True,
            "mode": mode.value,
            "literature_run_id": literature_run_id,
            "artifact_count": artifact_count,
        },
    )

    logger.info(
        f"Orchestrating synthesis for literature run {literature_run_id} "
        f"({artifact_count} artifacts)"
    )

    # Step 5: Invoke sourcelit runtime synthesis
    try:
        sourcelit_handle = run_sourcelit_runtime(
            literature_manifest_relpath=literature_manifest_relpath,
            tmp_root=tmp_root,
        )
    except SourcelitRuntimeError as e:
        # Synthesis failed - wrap error with context
        logger.error(f"Sourcelit synthesis failed: {e}")
        raise SourcelitOrchestrationError(
            f"Synthesis failed during runtime execution: {e}"
        ) from e

    # Step 6: Log orchestration completion
    log_event(
        "orchestration_ready",
        {
            "component": "sourcelit_orchestrator",
            "allowed": True,
            "mode": mode.value,
            "run_id": sourcelit_handle.run_id,
            "literature_run_id": literature_run_id,
            "artifact_count": artifact_count,
            "ready": sourcelit_handle.ready,
        },
    )

    logger.info(
        f"Synthesis complete: run_id={sourcelit_handle.run_id}, "
        f"ready={sourcelit_handle.ready}"
    )

    # Step 7: Return orchestration handle
    return SourcelitOrchestrationHandle(
        status=sourcelit_handle.status,
        sourcelit_run_id=sourcelit_handle.run_id,
        literature_run_id=literature_run_id,
        artifact_count=sourcelit_handle.artifact_count,
        ready=sourcelit_handle.ready,
        manifest_relpath=sourcelit_handle.manifest_relpath,
        reason_code=None,
    )


def _validate_governance() -> None:
    """Validate MODE=SANDBOX and NO_NETWORK=1 (fail-closed).

    Raises:
        SourcelitOrchestrationError: If not SANDBOX mode or NO_NETWORK != 1
    """
    mode = get_current_mode()

    # Check MODE == SANDBOX
    if mode != RosMode.SANDBOX:
        log_event(
            "orchestration_blocked",
            {
                "component": "sourcelit_orchestrator",
                "allowed": False,
                "mode": mode.value,
                "reason_code": "MODE_NOT_SANDBOX",
            },
        )
        raise SourcelitOrchestrationError(
            f"Orchestration is SANDBOX-only. Current mode: {mode.value}. "
            f"Expected: SANDBOX (MOCK_ONLY=1, NO_NETWORK=1, ALLOW_UPLOADS=1)."
        )

    # Check NO_NETWORK == 1
    no_network = os.getenv("NO_NETWORK", "1")
    if no_network != "1":
        log_event(
            "orchestration_blocked",
            {
                "component": "sourcelit_orchestrator",
                "allowed": False,
                "mode": mode.value,
                "reason_code": "NO_NETWORK_REQUIRED",
            },
        )
        raise SourcelitOrchestrationError(
            f"Offline-only synthesis requires NO_NETWORK=1. "
            f"Current value: NO_NETWORK={no_network}."
        )

    logger.debug("Governance validation passed: SANDBOX mode + NO_NETWORK=1")


def _validate_literature_manifest(manifest_path: Path) -> dict:
    """Load and validate literature manifest schema.

    Args:
        manifest_path: Path to literature manifest file

    Returns:
        Validated manifest dictionary

    Raises:
        SourcelitOrchestrationError: If manifest invalid or not found
    """
    # Check existence
    if not manifest_path.exists():
        raise SourcelitOrchestrationError(
            f"Literature manifest not found at: {manifest_path}. "
            f"Ensure literature runtime has completed and manifest exists."
        )

    # Load JSON
    try:
        manifest = json.loads(manifest_path.read_text())
    except json.JSONDecodeError as e:
        raise SourcelitOrchestrationError(
            f"Invalid literature manifest JSON at {manifest_path}: {e}. "
            f"Manifest file may be corrupted."
        )

    # Validate schema version
    schema_version = manifest.get("schema_version")
    if schema_version != "1.0.0":
        raise SourcelitOrchestrationError(
            f"Unsupported literature manifest schema version: {schema_version}. "
            f"Expected: 1.0.0."
        )

    # Validate ready flag
    if not manifest.get("ready"):
        raise SourcelitOrchestrationError(
            f"Literature manifest not ready (ready={manifest.get('ready')}). "
            f"Literature runtime must complete successfully before synthesis."
        )

    # Validate status
    status = manifest.get("status")
    if status != "SUCCESS":
        raise SourcelitOrchestrationError(
            f"Literature manifest status is {status} (expected SUCCESS). "
            f"Only successful literature runs can be synthesized."
        )

    # Validate run_id present
    if "run_id" not in manifest:
        raise SourcelitOrchestrationError(
            "Literature manifest missing required field 'run_id'."
        )

    logger.debug(
        f"Literature manifest validated: run_id={manifest['run_id']}, "
        f"artifacts={len(manifest.get('artifact_ids', []))}"
    )

    return manifest


def _validate_artifacts_normalized(manifest: dict, tmp_root: Path) -> None:
    """Validate all artifacts have normalized_ready=true.

    Args:
        manifest: Validated literature manifest dictionary
        tmp_root: Repository .tmp/ directory

    Raises:
        SourcelitOrchestrationError: If any artifacts missing or not normalized
    """
    artifact_ids = manifest.get("artifact_ids", [])
    non_normalized = []
    missing = []

    for artifact_id in artifact_ids:
        artifact_path = (
            tmp_root / "literature_runtime" / "artifacts" / f"artifact_{artifact_id}.json"
        )

        if not artifact_path.exists():
            missing.append(artifact_id)
            continue

        try:
            artifact = json.loads(artifact_path.read_text())
        except json.JSONDecodeError:
            missing.append(artifact_id)
            continue

        if not artifact.get("normalized_ready"):
            non_normalized.append(artifact_id)

    # Detailed error for missing artifacts
    if missing:
        artifact_ids_str = ", ".join(missing[:5])
        if len(missing) > 5:
            artifact_ids_str += f" ...and {len(missing) - 5} more"
        raise SourcelitOrchestrationError(
            f"Missing {len(missing)} artifact file(s) referenced in manifest: {artifact_ids_str}. "
            f"Expected location: .tmp/literature_runtime/artifacts/. "
            f"Ensure literature runtime completed without errors."
        )

    # Detailed error for non-normalized artifacts
    if non_normalized:
        artifact_ids_str = ", ".join(non_normalized[:5])
        if len(non_normalized) > 5:
            artifact_ids_str += f" ...and {len(non_normalized) - 5} more"
        raise SourcelitOrchestrationError(
            f"{len(non_normalized)} artifact(s) not normalized (normalized_ready != true): {artifact_ids_str}. "
            f"Artifacts must complete normalization before synthesis. "
            f"Check literature runtime logs for parsing failures."
        )

    logger.debug(f"All {len(artifact_ids)} artifacts validated as normalized")

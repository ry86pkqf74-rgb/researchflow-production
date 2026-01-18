"""SANDBOX Sourcelit synthesis runtime (PR9B-3)

Integrates Sourcelit synthesis with normalized literature artifacts produced by PR9B-2.

Hard requirements:
- SANDBOX-only: hard-fail in STANDBY/LIVE/other modes
- Offline-only: require NO_NETWORK=1
- Fail-closed: blocked/invalid runs write no artifacts
- Runtime-only: all artifacts limited to `.tmp/sourcelit_runtime/` with atomic writes
- Decisions-only provenance events (no content, no filenames, no paths)

Provenance events:
- synth_requested
- synth_blocked
- synth_ready
- synth_failed

Last Updated: 2026-01-09
"""

from __future__ import annotations

import hashlib
import json
import os
import platform
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from web_frontend.provenance_logger import log_event

from src.governance.capabilities import RosMode, get_current_mode
from src.literature.store import LiteratureStoreError, load_artifact, load_manifest

from .contract import (
    SCHEMA_VERSION,
    atomic_write_json,
    ensure_dirs,
    input_path,
    manifest_path,
    output_path,
)


class SourcelitRuntimeError(RuntimeError):
    """Raised when Sourcelit synthesis is blocked by governance/runtime rules."""


@dataclass(frozen=True)
class SourcelitRunHandle:
    run_id: str
    ready: bool
    status: str
    literature_run_id: str
    artifact_count: int
    manifest_relpath: str


def run_sourcelit_runtime(
    literature_manifest_relpath: str,
    *,
    tmp_root: Path = Path(".tmp"),
) -> SourcelitRunHandle:
    """Run SANDBOX-only, offline-only synthesis over literature runtime artifacts.

    Args:
        literature_manifest_relpath: Relpath to `.tmp/literature_runtime/manifests/manifest_<id>.json`
        tmp_root: Repository `.tmp/` directory.

    Returns:
        SourcelitRunHandle

    Raises:
        SourcelitRuntimeError: On governance violations or invalid/unsafe inputs.
    """

    mode = get_current_mode()

    if mode != RosMode.SANDBOX:
        _log_decision(
            "synth_requested",
            {
                "component": "sourcelit_runtime",
                "allowed": False,
                "mode": mode.value,
                "reason_code": "MODE_BLOCKED",
            },
        )
        _log_decision(
            "synth_blocked",
            {
                "component": "sourcelit_runtime",
                "allowed": False,
                "mode": mode.value,
                "reason_code": "MODE_BLOCKED",
            },
        )
        raise SourcelitRuntimeError(
            f"Sourcelit synthesis is SANDBOX-only; current mode is {mode.value}"
        )

    if os.getenv("NO_NETWORK", "1") != "1":
        _log_decision(
            "synth_requested",
            {
                "component": "sourcelit_runtime",
                "allowed": False,
                "mode": mode.value,
                "reason_code": "NO_NETWORK_REQUIRED",
            },
        )
        _log_decision(
            "synth_blocked",
            {
                "component": "sourcelit_runtime",
                "allowed": False,
                "mode": mode.value,
                "reason_code": "NO_NETWORK_REQUIRED",
            },
        )
        raise SourcelitRuntimeError("Offline-only synthesis requires NO_NETWORK=1")

    # Load and validate literature manifest + artifacts before creating any new runtime dirs.
    try:
        literature_manifest = load_manifest(tmp_root, literature_manifest_relpath)
    except LiteratureStoreError as e:
        _log_decision(
            "synth_failed",
            {
                "component": "sourcelit_runtime",
                "allowed": True,
                "mode": mode.value,
                "reason_code": "LITERATURE_MANIFEST_INVALID",
            },
        )
        raise SourcelitRuntimeError("Invalid literature manifest") from e

    literature_run_id = str(literature_manifest.get("run_id", ""))
    artifact_ids = list(literature_manifest.get("artifact_ids", []) or [])

    if not literature_run_id or not isinstance(literature_run_id, str):
        _log_decision(
            "synth_failed",
            {
                "component": "sourcelit_runtime",
                "allowed": True,
                "mode": mode.value,
                "reason_code": "LITERATURE_MANIFEST_MISSING_RUN_ID",
            },
        )
        raise SourcelitRuntimeError("Literature manifest missing run_id")

    _log_decision(
        "synth_requested",
        {
            "component": "sourcelit_runtime",
            "allowed": True,
            "mode": mode.value,
            "literature_run_id": literature_run_id,
            "artifact_count": int(len(artifact_ids)),
        },
    )

    inputs: list[dict] = []

    try:
        for artifact_id in artifact_ids:
            rel = str(
                Path(".tmp")
                / "literature_runtime"
                / "artifacts"
                / f"artifact_{artifact_id}.json"
            )
            record = load_artifact(tmp_root, rel)

            if record.get("normalized_ready") is not True:
                _log_decision(
                    "synth_blocked",
                    {
                        "component": "sourcelit_runtime",
                        "allowed": False,
                        "mode": mode.value,
                        "reason_code": "LITERATURE_NOT_NORMALIZED",
                        "literature_run_id": literature_run_id,
                        "artifact_id": artifact_id,
                    },
                )
                raise SourcelitRuntimeError(
                    "Synthesis requires normalized literature artifacts (normalized_ready=true)"
                )

            input_entry = {
                "schema_version": SCHEMA_VERSION,
                "artifact_id": artifact_id,
                "literature_run_id": literature_run_id,
                "input_file_hash": record.get("input_file_hash"),
                "ext": record.get("ext"),
                "declared_type": record.get("declared_type"),
                "byte_size": record.get("byte_size"),
                "page_count": record.get("page_count"),
                "char_count": record.get("char_count"),
                "token_estimate": record.get("token_estimate"),
                "section_count": record.get("section_count"),
                "parser_name": record.get("parser_name"),
            }

            input_hash = _sha256_json(input_entry)
            input_entry["input_entry_hash"] = f"sha256:{input_hash}"
            inputs.append(input_entry)

    except LiteratureStoreError as e:
        _log_decision(
            "synth_failed",
            {
                "component": "sourcelit_runtime",
                "allowed": True,
                "mode": mode.value,
                "reason_code": "LITERATURE_ARTIFACT_INVALID",
                "literature_run_id": literature_run_id,
            },
        )
        raise SourcelitRuntimeError("Invalid literature artifact record") from e

    run_id = _run_id(literature_run_id, artifact_ids)
    created_at = _utc_now_iso()
    python_version = platform.python_version()

    # Now that inputs are validated, create runtime dirs + write artifacts.
    ensure_dirs(tmp_root)

    for entry in inputs:
        atomic_write_json(input_path(tmp_root, entry["artifact_id"]), entry)

    output_payload = {
        "schema_version": SCHEMA_VERSION,
        "run_id": run_id,
        "literature_run_id": literature_run_id,
        "created_at": created_at,
        "status": "SUCCESS",
        "artifact_count": int(len(inputs)),
        "input_entry_hashes": sorted([e["input_entry_hash"] for e in inputs]),
        "tool_versions": {
            "python": python_version,
        },
    }
    output_hash = _sha256_json(output_payload)
    output_payload["output_hash"] = f"sha256:{output_hash}"

    atomic_write_json(output_path(tmp_root, run_id), output_payload)

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "run_id": run_id,
        "literature_run_id": literature_run_id,
        "created_at": created_at,
        "ready": True,
        "artifact_count": int(len(inputs)),
        "artifact_ids": sorted([e["artifact_id"] for e in inputs]),
        "input_entry_hashes": sorted([e["input_entry_hash"] for e in inputs]),
        "output_hash": output_payload["output_hash"],
    }

    atomic_write_json(manifest_path(tmp_root, run_id), manifest)

    _log_decision(
        "synth_ready",
        {
            "component": "sourcelit_runtime",
            "allowed": True,
            "mode": mode.value,
            "run_id": run_id,
            "literature_run_id": literature_run_id,
            "artifact_count": int(len(inputs)),
        },
    )

    return SourcelitRunHandle(
        run_id=run_id,
        ready=True,
        status="SUCCESS",
        literature_run_id=literature_run_id,
        artifact_count=len(inputs),
        manifest_relpath=str(
            Path(".tmp") / "sourcelit_runtime" / "manifests" / f"manifest_{run_id}.json"
        ),
    )


def _log_decision(event_type: str, meta: dict) -> None:
    log_event(event_type, meta)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _run_id(literature_run_id: str, artifact_ids: list[str]) -> str:
    token = {
        "literature_run_id": literature_run_id,
        "artifact_ids": sorted(list(artifact_ids)),
    }
    return hashlib.sha256(
        json.dumps(token, sort_keys=True).encode("utf-8")
    ).hexdigest()[:12]


def _sha256_json(payload: dict) -> str:
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode("utf-8")
    ).hexdigest()

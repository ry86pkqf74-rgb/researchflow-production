"""Sourcelit runtime tmp contract (PR9B-3)

Defines and enforces the `.tmp/sourcelit_runtime/` directory contract.

Contract:
- `.tmp/sourcelit_runtime/manifests/manifest_<run_id>.json` (direct children only)
- `.tmp/sourcelit_runtime/inputs/input_<artifact_id>.json` (direct children only)
- `.tmp/sourcelit_runtime/outputs/output_<run_id>.json` (direct children only)

Rules:
- Nothing written outside `.tmp/sourcelit_runtime/` for runtime artifacts
- No nested subdirectories under manifests/, inputs/, outputs/
- Files are JSON only
- Each record includes `schema_version`

Last Updated: 2026-01-09
"""

from __future__ import annotations

import json
import os
from pathlib import Path

SCHEMA_VERSION = "1.0.0"


class SourcelitContractError(RuntimeError):
    """Raised when runtime tmp contract is violated."""


def sourcelit_root(tmp_root: Path) -> Path:
    tmp_root = Path(tmp_root).resolve()
    if ".tmp" not in tmp_root.parts:
        raise SourcelitContractError(f"tmp_root must be a .tmp/ directory: {tmp_root}")
    return (tmp_root / "sourcelit_runtime").resolve()


def manifests_dir(tmp_root: Path) -> Path:
    return (sourcelit_root(tmp_root) / "manifests").resolve()


def inputs_dir(tmp_root: Path) -> Path:
    return (sourcelit_root(tmp_root) / "inputs").resolve()


def outputs_dir(tmp_root: Path) -> Path:
    return (sourcelit_root(tmp_root) / "outputs").resolve()


def ensure_dirs(tmp_root: Path) -> None:
    root = sourcelit_root(tmp_root)
    for d in (
        root,
        manifests_dir(tmp_root),
        inputs_dir(tmp_root),
        outputs_dir(tmp_root),
    ):
        d.mkdir(parents=True, exist_ok=True)


def manifest_path(tmp_root: Path, run_id: str) -> Path:
    p = manifests_dir(tmp_root) / f"manifest_{run_id}.json"
    _ensure_direct_child(p, manifests_dir(tmp_root))
    _ensure_json_only(p)
    return p


def input_path(tmp_root: Path, artifact_id: str) -> Path:
    p = inputs_dir(tmp_root) / f"input_{artifact_id}.json"
    _ensure_direct_child(p, inputs_dir(tmp_root))
    _ensure_json_only(p)
    return p


def output_path(tmp_root: Path, run_id: str) -> Path:
    p = outputs_dir(tmp_root) / f"output_{run_id}.json"
    _ensure_direct_child(p, outputs_dir(tmp_root))
    _ensure_json_only(p)
    return p


def atomic_write_json(path: Path, payload: dict) -> None:
    """Write JSON to path atomically (temp file + replace)."""
    _ensure_json_only(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    tmp_path = path.with_suffix(path.suffix + ".tmp")
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, sort_keys=True)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
    except Exception:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise


def _ensure_direct_child(candidate: Path, parent: Path) -> None:
    candidate = candidate.resolve()
    parent = parent.resolve()

    if candidate.parent != parent:
        raise SourcelitContractError(
            f"Contract violation: file must be a direct child of {parent}"
        )


def _ensure_json_only(path: Path) -> None:
    if path.suffix != ".json":
        raise SourcelitContractError(f"Contract violation: JSON only: {path}")

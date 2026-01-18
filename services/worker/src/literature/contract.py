"""Literature runtime tmp contract (PR9B-1)

Defines and enforces the `.tmp/literature_runtime/` directory contract.

Contract:
- `.tmp/literature_runtime/manifests/manifest_<run_id>.json` (direct children only)
- `.tmp/literature_runtime/artifacts/artifact_<artifact_id>.json` (direct children only)
- `.tmp/literature_runtime/failed/failed_<artifact_id>.json` (direct children only)

Rules:
- Nothing written outside `.tmp/literature_runtime/` for runtime artifacts
- No nested subdirectories under manifests/, artifacts/, failed/
- Files are JSON only
- Each record includes `schema_version`

Last Updated: 2026-01-09
"""

from __future__ import annotations

import json
import os
from pathlib import Path

SCHEMA_VERSION = "1.0.0"


class LiteratureContractError(RuntimeError):
    """Raised when runtime tmp contract is violated."""


def literature_root(tmp_root: Path) -> Path:
    tmp_root = Path(tmp_root).resolve()
    if ".tmp" not in tmp_root.parts:
        raise LiteratureContractError(f"tmp_root must be a .tmp/ directory: {tmp_root}")
    return (tmp_root / "literature_runtime").resolve()


def manifests_dir(tmp_root: Path) -> Path:
    return (literature_root(tmp_root) / "manifests").resolve()


def artifacts_dir(tmp_root: Path) -> Path:
    return (literature_root(tmp_root) / "artifacts").resolve()


def failed_dir(tmp_root: Path) -> Path:
    return (literature_root(tmp_root) / "failed").resolve()


def ensure_dirs(tmp_root: Path) -> None:
    root = literature_root(tmp_root)
    for d in (
        root,
        manifests_dir(tmp_root),
        artifacts_dir(tmp_root),
        failed_dir(tmp_root),
    ):
        d.mkdir(parents=True, exist_ok=True)


def manifest_path(tmp_root: Path, run_id: str) -> Path:
    p = manifests_dir(tmp_root) / f"manifest_{run_id}.json"
    _ensure_direct_child(p, manifests_dir(tmp_root))
    _ensure_json_only(p)
    return p


def artifact_path(tmp_root: Path, artifact_id: str) -> Path:
    p = artifacts_dir(tmp_root) / f"artifact_{artifact_id}.json"
    _ensure_direct_child(p, artifacts_dir(tmp_root))
    _ensure_json_only(p)
    return p


def failure_path(tmp_root: Path, artifact_id: str) -> Path:
    p = failed_dir(tmp_root) / f"failed_{artifact_id}.json"
    _ensure_direct_child(p, failed_dir(tmp_root))
    _ensure_json_only(p)
    return p


def validate_relpath_is_direct_child(
    tmp_root: Path, relpath: str, *, kind: str
) -> Path:
    """Validate that a relpath points to a direct child JSON file within the contract."""
    tmp_root = Path(tmp_root).resolve()
    root = literature_root(tmp_root)

    rel = Path(relpath)
    parts = list(rel.parts)
    if ".tmp" in parts:
        idx = parts.index(".tmp")
        rel = Path(*parts[idx + 1 :])

    candidate = (tmp_root / rel).resolve()
    if root not in candidate.parents and candidate != root:
        raise LiteratureContractError("Path must be under .tmp/literature_runtime/")

    if kind == "manifest":
        parent = manifests_dir(tmp_root)
    elif kind == "artifact":
        parent = artifacts_dir(tmp_root)
    elif kind == "failed":
        parent = failed_dir(tmp_root)
    else:
        raise ValueError(f"Unknown kind: {kind}")

    if candidate.parent != parent:
        raise LiteratureContractError(
            f"{kind} files must be direct children of {parent.relative_to(tmp_root)}"
        )

    _ensure_json_only(candidate)
    return candidate


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
        raise LiteratureContractError(
            f"Contract violation: file must be a direct child of {parent}"
        )


def _ensure_json_only(path: Path) -> None:
    if path.suffix != ".json":
        raise LiteratureContractError(f"Contract violation: JSON only: {path}")

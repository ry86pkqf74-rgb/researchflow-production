"""Literature runtime artifact loaders (PR9B-1)

Read-only helpers for loading run manifests and per-input artifact records.
Enforces the `.tmp/literature_runtime/` contract (direct children only).

Last Updated: 2026-01-09
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .contract import validate_relpath_is_direct_child


class LiteratureStoreError(RuntimeError):
    """Raised when runtime artifact access is invalid."""


def load_manifest(tmp_root: Path, manifest_relpath: str) -> dict[str, Any]:
    p = validate_relpath_is_direct_child(tmp_root, manifest_relpath, kind="manifest")
    if not p.exists():
        raise LiteratureStoreError(f"Manifest not found: {manifest_relpath}")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        raise LiteratureStoreError(f"Invalid manifest JSON: {manifest_relpath}") from e


def load_artifact(tmp_root: Path, artifact_relpath: str) -> dict[str, Any]:
    p = validate_relpath_is_direct_child(tmp_root, artifact_relpath, kind="artifact")
    if not p.exists():
        raise LiteratureStoreError(f"Artifact not found: {artifact_relpath}")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        raise LiteratureStoreError(f"Invalid artifact JSON: {artifact_relpath}") from e


def load_failed(tmp_root: Path, failed_relpath: str) -> dict[str, Any]:
    p = validate_relpath_is_direct_child(tmp_root, failed_relpath, kind="failed")
    if not p.exists():
        raise LiteratureStoreError(f"Failure record not found: {failed_relpath}")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        raise LiteratureStoreError(f"Invalid failure JSON: {failed_relpath}") from e

"""Metadata-only loaders for literature/sourcelit UI (PR9B-4)

Provides read-only access to runtime metadata from .tmp/ directories.

Last Updated: 2026-01-09
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class LiteratureUiError(RuntimeError):
    """Raised when UI metadata loading fails."""


def list_literature_runs(tmp_root: Path) -> list[str]:
    """List available literature run manifests (relpaths).

    Returns:
        List of relpaths like 'literature_runtime/manifests/manifest_<run_id>.json'

    Raises:
        LiteratureUiError: If manifests directory is inaccessible.
    """
    manifests_dir = tmp_root / "literature_runtime" / "manifests"

    if not manifests_dir.exists():
        return []

    if not manifests_dir.is_dir():
        raise LiteratureUiError(f"Expected directory: {manifests_dir}")

    try:
        results = []
        for p in sorted(manifests_dir.glob("manifest_*.json")):
            if p.is_file():
                relpath = str(p.relative_to(tmp_root))
                results.append(relpath)
        return results
    except Exception as e:
        raise LiteratureUiError(f"Failed to list literature runs: {e}") from e


def load_literature_run_metadata(
    tmp_root: Path, manifest_relpath: str
) -> dict[str, Any]:
    """Load literature run manifest metadata (metadata-only).

    Args:
        tmp_root: Repository .tmp/ directory.
        manifest_relpath: Relpath like 'literature_runtime/manifests/manifest_<id>.json'

    Returns:
        Manifest dict with keys: run_id, ready, status, recorded_count, failed_count, etc.
        No raw_text or file paths returned.

    Raises:
        LiteratureUiError: If manifest is missing or invalid.
    """
    manifest_path = tmp_root / manifest_relpath

    if not manifest_path.exists():
        raise LiteratureUiError(f"Manifest not found: {manifest_relpath}")

    if not manifest_path.is_file():
        raise LiteratureUiError(f"Not a file: {manifest_relpath}")

    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise LiteratureUiError(f"Invalid JSON: {manifest_relpath}") from e

    # Redact sensitive fields if present
    if "artifact_relpaths" in data:
        data["artifact_relpaths"] = [
            _redact_filename(p) for p in data["artifact_relpaths"]
        ]
    if "failed_relpaths" in data:
        data["failed_relpaths"] = [_redact_filename(p) for p in data["failed_relpaths"]]

    return data


def list_sourcelit_runs(tmp_root: Path) -> list[str]:
    """List available sourcelit run manifests (relpaths).

    Returns:
        List of relpaths like 'sourcelit_runtime/manifests/manifest_<run_id>.json'

    Raises:
        LiteratureUiError: If manifests directory is inaccessible.
    """
    manifests_dir = tmp_root / "sourcelit_runtime" / "manifests"

    if not manifests_dir.exists():
        return []

    if not manifests_dir.is_dir():
        raise LiteratureUiError(f"Expected directory: {manifests_dir}")

    try:
        results = []
        for p in sorted(manifests_dir.glob("manifest_*.json")):
            if p.is_file():
                relpath = str(p.relative_to(tmp_root))
                results.append(relpath)
        return results
    except Exception as e:
        raise LiteratureUiError(f"Failed to list sourcelit runs: {e}") from e


def load_sourcelit_run_metadata(
    tmp_root: Path, manifest_relpath: str
) -> dict[str, Any]:
    """Load sourcelit run manifest metadata (metadata-only).

    Args:
        tmp_root: Repository .tmp/ directory.
        manifest_relpath: Relpath like 'sourcelit_runtime/manifests/manifest_<id>.json'

    Returns:
        Manifest dict with keys: run_id, ready, status, artifact_count, etc.
        No synthesis outputs or raw text returned.

    Raises:
        LiteratureUiError: If manifest is missing or invalid.
    """
    manifest_path = tmp_root / manifest_relpath

    if not manifest_path.exists():
        raise LiteratureUiError(f"Manifest not found: {manifest_relpath}")

    if not manifest_path.is_file():
        raise LiteratureUiError(f"Not a file: {manifest_relpath}")

    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise LiteratureUiError(f"Invalid JSON: {manifest_relpath}") from e

    # Redact sensitive fields if present
    if "literature_manifest_relpath" in data:
        data["literature_manifest_relpath"] = _redact_filename(
            data["literature_manifest_relpath"]
        )

    return data


def _redact_filename(path_str: str) -> str:
    """Replace filename with hash for decisions-only provenance."""
    if not path_str:
        return "[redacted]"
    return "[redacted]"

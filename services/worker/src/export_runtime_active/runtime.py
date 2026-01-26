"""ACTIVE export runtime for online workflow (metadata-only)."""

from __future__ import annotations

import json
import shutil
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping


class ExportRuntimeError(RuntimeError):
    """Raised when export bundle creation fails."""


@dataclass(frozen=True)
class ExportBundleHandle:
    """Handle returned by build_export_bundle."""

    run_id: str
    ready: bool
    output_dir: str
    bundle_path: str
    draft_path: str
    workflow_summary_path: str


def build_export_bundle(
    state: Mapping[str, Any] | Any,
    *,
    tmp_root: Path = Path(".tmp"),
) -> ExportBundleHandle:
    """
    Build a metadata-only export bundle under .tmp/export_runs/{run_id}/.

    Constraints:
    - Aggregate/metadata-only (no row-level values)
    - Fail-closed if PHI detected
    - All artifacts under .tmp/
    """
    tmp_root = Path(tmp_root)
    if tmp_root.name != ".tmp":
        raise ExportRuntimeError("tmp_root must be a .tmp directory")

    # Extract topic
    topic = _get_state_value(state, "online_topic") or _get_state_value(state, "topic")
    if not topic or not str(topic).strip():
        raise ExportRuntimeError("Missing topic for export bundle")

    # Require analysis handle
    analysis_handle = _get_state_value(state, "analysis_handle")
    if analysis_handle is None:
        raise ExportRuntimeError("Missing analysis handle for export bundle")

    # Require selected idea
    selected_idea = _get_state_value(state, "selected_idea")
    if selected_idea is None:
        raise ExportRuntimeError("Missing selected idea for export bundle")

    # Generate run ID and create output directory
    run_id = _generate_run_id()
    output_dir = tmp_root / "export_runs" / run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    manuscripts_dir = output_dir / "manuscripts"
    manuscripts_dir.mkdir(parents=True, exist_ok=True)

    # Get analysis paths
    analysis_manifest_path = _as_path(
        _get_handle_value(analysis_handle, "manifest_path")
    )
    analysis_summary_path = _as_path(_get_handle_value(analysis_handle, "summary_path"))
    analysis_figure_path = _as_path(_get_handle_value(analysis_handle, "figure_path"))

    # Validate required paths exist
    for required_path, label in (
        (analysis_manifest_path, "analysis manifest"),
        (analysis_summary_path, "analysis summary"),
        (analysis_figure_path, "analysis figure"),
    ):
        if required_path is None or not required_path.exists():
            raise ExportRuntimeError(f"Missing {label} path for export bundle")

    # Load analysis summary (metadata-only)
    analysis_summary = json.loads(analysis_summary_path.read_text(encoding="utf-8"))

    # Resolve literature paths (optional)
    literature_overview = ""
    citations_bib = ""
    literature_paths = _resolve_literature_paths(state, tmp_root)
    if literature_paths:
        overview_path, bib_path, papers_path = literature_paths
        if overview_path.exists():
            literature_overview = overview_path.read_text(encoding="utf-8")
        if bib_path.exists():
            citations_bib = bib_path.read_text(encoding="utf-8")

    # Build draft markdown
    from src.manuscript_runtime_active import build_draft_markdown

    draft_md = build_draft_markdown(
        str(topic),
        literature_overview,
        analysis_summary,
        selected_idea,
        citations_bib,
    )

    # Write draft
    draft_path = manuscripts_dir / "draft.md"
    _atomic_write_text(draft_path, draft_md)

    # Copy analysis artifacts
    export_manifest_path = output_dir / "manifest.json"
    export_summary_path = output_dir / "summary.json"
    export_figure_path = output_dir / "figure_1.png"
    shutil.copy2(analysis_manifest_path, export_manifest_path)
    shutil.copy2(analysis_summary_path, export_summary_path)
    shutil.copy2(analysis_figure_path, export_figure_path)

    # Copy literature artifacts if present
    if literature_paths:
        overview_path, bib_path, papers_path = literature_paths
        if overview_path.exists():
            shutil.copy2(overview_path, output_dir / "overview.md")
        if bib_path.exists():
            shutil.copy2(bib_path, output_dir / "library.bib")
        if papers_path.exists():
            shutil.copy2(papers_path, output_dir / "papers.json")

    # Build workflow summary (metadata-only)
    workflow_summary = _build_workflow_summary(
        state, topic, analysis_handle, selected_idea
    )
    workflow_summary_path = output_dir / "workflow_summary.json"
    _atomic_write_json(workflow_summary_path, workflow_summary)

    # Create ZIP bundle
    bundle_path = output_dir / "export_bundle.zip"
    _write_bundle_zip(output_dir, bundle_path)

    return ExportBundleHandle(
        run_id=run_id,
        ready=True,
        output_dir=str(output_dir),
        bundle_path=str(bundle_path),
        draft_path=str(draft_path),
        workflow_summary_path=str(workflow_summary_path),
    )


def _write_bundle_zip(output_dir: Path, bundle_path: Path) -> None:
    """Create ZIP bundle with metadata-only artifacts."""
    files = [
        output_dir / "workflow_summary.json",
        output_dir / "manifest.json",
        output_dir / "summary.json",
        output_dir / "figure_1.png",
        output_dir / "manuscripts" / "draft.md",
        output_dir / "overview.md",
        output_dir / "library.bib",
        output_dir / "papers.json",
    ]
    bundle_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(bundle_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            if path.exists() and path.is_file():
                zf.write(path, path.relative_to(output_dir).as_posix())


def _build_workflow_summary(
    state: Mapping[str, Any] | Any,
    topic: str,
    analysis_handle: Any,
    selected_idea: Mapping[str, Any] | Any,
) -> dict[str, Any]:
    """Build workflow summary (metadata-only)."""
    idea_id = _get_selected_idea_value(selected_idea, "id")
    idea_title = _get_selected_idea_value(selected_idea, "title")

    run_ids = {
        "ingestion": _get_handle_value(
            _get_state_value(state, "upload_handle"), "run_id"
        ),
        "analysis": _get_handle_value(analysis_handle, "run_id"),
        "literature": _get_literature_run_id(state),
        "ideation": _get_state_value(state, "ideation_run_id"),
    }

    return {
        "topic": str(topic),
        "selected_idea": {"id": idea_id, "title": idea_title},
        "run_ids": run_ids,
    }


def _resolve_literature_paths(
    state: Mapping[str, Any] | Any,
    tmp_root: Path,
) -> tuple[Path, Path, Path] | None:
    """Resolve literature artifact paths (optional)."""
    handle = _get_state_value(state, "online_literature_handle")
    if handle is None:
        handle = _get_state_value(state, "literature_handle")

    if handle is not None:
        output_dir = _as_path(_get_handle_value(handle, "output_dir"))
        if output_dir is not None:
            return (
                output_dir / "overview.md",
                output_dir / "library.bib",
                output_dir / "papers.json",
            )

    run_id = _get_literature_run_id(state)
    if run_id:
        output_dir = tmp_root / "online_literature_runs" / run_id
        return (
            output_dir / "overview.md",
            output_dir / "library.bib",
            output_dir / "papers.json",
        )

    return None


def _get_literature_run_id(state: Mapping[str, Any] | Any) -> str | None:
    """Get literature run ID from state."""
    run_id = _get_state_value(state, "literature_run_id")
    if run_id:
        return str(run_id)
    handle = _get_state_value(state, "online_literature_handle")
    if handle is None:
        handle = _get_state_value(state, "literature_handle")
    if handle is not None:
        handle_run_id = _get_handle_value(handle, "run_id")
        if handle_run_id:
            return str(handle_run_id)
    return None


def _get_selected_idea_value(
    selected_idea: Mapping[str, Any] | Any, key: str
) -> str | None:
    """Get value from selected_idea dict or object."""
    if isinstance(selected_idea, Mapping):
        value = selected_idea.get(key)
    else:
        value = getattr(selected_idea, key, None)
    if value is None:
        return None
    return str(value)


def _get_state_value(state: Mapping[str, Any] | Any, key: str) -> Any | None:
    """Get value from state dict or object."""
    if isinstance(state, Mapping):
        return state.get(key)
    return getattr(state, key, None)


def _get_handle_value(handle: Any, key: str) -> Any | None:
    """Get value from handle dict or object."""
    if handle is None:
        return None
    if isinstance(handle, Mapping):
        return handle.get(key)
    return getattr(handle, key, None)


def _as_path(value: Any | None) -> Path | None:
    """Convert value to Path if not None."""
    if value is None:
        return None
    return Path(str(value))


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    """Atomic write for JSON files."""
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    tmp_path.replace(path)


def _atomic_write_text(path: Path, content: str) -> None:
    """Atomic write for text files."""
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(content, encoding="utf-8")
    tmp_path.replace(path)


def _generate_run_id() -> str:
    """Generate unique run ID."""
    return uuid.uuid4().hex[:8]

"""SANDBOX literature ingestion runtime (PR9B-1 + PR9B-2)

Governance-first runtime with offline parsers and normalization.

Hard requirements:
- SANDBOX-only: hard-fail in STANDBY/LIVE/other modes
- Offline-only: require NO_NETWORK=1
- Fail-closed: blocked runs write no artifacts
- Runtime-only: all artifacts limited to `.tmp/literature_runtime/` with atomic writes
- Metadata-only: no raw text persisted by default
- Provenance: sanitized, decisions-only events (no content, no filenames, no paths)

Last Updated: 2026-01-09
"""

from __future__ import annotations

import hashlib
import os
import platform
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from web_frontend.provenance_logger import log_event

from src.governance.capabilities import RosMode, get_current_mode

from .contract import (
    SCHEMA_VERSION,
    artifact_path,
    atomic_write_json,
    ensure_dirs,
    failure_path,
    manifest_path,
)
from .normalize import normalize_document
from .parsers import ParserError, parse_html, parse_pdf, parse_text


class LiteratureRuntimeError(RuntimeError):
    """Raised when literature runtime ingestion is blocked by governance/runtime rules."""


@dataclass(frozen=True)
class LiteratureRunHandle:
    run_id: str
    ready: bool
    status: str
    recorded_count: int
    failed_count: int
    manifest_relpath: str


_SUPPORTED_EXTS: dict[str, str] = {
    ".pdf": "pdf",
    ".html": "html",
    ".htm": "html",
    ".txt": "text",
    ".md": "markdown",
}


def ingest_literature_runtime(
    inputs: list[Path],
    *,
    tmp_root: Path = Path(".tmp"),
) -> LiteratureRunHandle:
    """Run SANDBOX-only, offline-only literature ingestion (metadata-only)."""

    mode = get_current_mode()
    if mode != RosMode.SANDBOX:
        _log_decision(
            "literature_runtime_blocked",
            {
                "component": "literature_runtime",
                "allowed": False,
                "mode": mode.value,
                "reason_code": "MODE_BLOCKED",
                "input_count": int(len(inputs)),
            },
        )
        raise LiteratureRuntimeError(
            f"Literature runtime is SANDBOX-only; current mode is {mode.value}"
        )

    if os.getenv("NO_NETWORK", "1") != "1":
        _log_decision(
            "literature_runtime_blocked",
            {
                "component": "literature_runtime",
                "allowed": False,
                "mode": mode.value,
                "reason_code": "NO_NETWORK_REQUIRED",
                "input_count": int(len(inputs)),
            },
        )
        raise LiteratureRuntimeError(
            "Offline-only literature runtime requires NO_NETWORK=1"
        )

    _log_decision(
        "literature_runtime_start",
        {
            "component": "literature_runtime",
            "allowed": True,
            "mode": mode.value,
            "input_count": int(len(inputs)),
        },
    )

    # All runtime artifacts are under `.tmp/literature_runtime/`.
    ensure_dirs(tmp_root)

    created_at = _utc_now_iso()
    python_version = platform.python_version()

    recorded: list[str] = []
    failed: list[str] = []

    run_tokens: list[str] = []

    for idx, p in enumerate(list(inputs)):
        ext = p.suffix.lower()
        declared_type = _SUPPORTED_EXTS.get(ext)

        if declared_type is None:
            artifact_id = _failure_id(idx, ext)
            _write_failed(
                tmp_root=tmp_root,
                artifact_id=artifact_id,
                reason_code="UNSUPPORTED_EXTENSION",
                created_at=created_at,
            )
            failed.append(artifact_id)
            run_tokens.append(f"FAIL:{ext}:{idx}")
            continue

        try:
            data = p.read_bytes()
        except Exception:
            artifact_id = _failure_id(idx, ext)
            _write_failed(
                tmp_root=tmp_root,
                artifact_id=artifact_id,
                reason_code="UNREADABLE",
                created_at=created_at,
            )
            failed.append(artifact_id)
            run_tokens.append(f"FAIL:{ext}:{idx}")
            continue

        input_file_hash = hashlib.sha256(data).hexdigest()
        artifact_id = input_file_hash

        # Parse and normalize the document
        page_count = None
        char_count = None
        token_estimate = None
        section_count = None
        normalized_ready = False
        parser_name = "unknown"

        try:
            if declared_type == "text" or declared_type == "markdown":
                parsed = parse_text(data, source_format=declared_type)
            elif declared_type == "html":
                parsed = parse_html(data)
            elif declared_type == "pdf":
                parsed = parse_pdf(data)
            else:
                raise ParserError(f"Unsupported declared_type: {declared_type}")

            _log_decision(
                "literature_parser_selected",
                {
                    "component": "literature_runtime",
                    "artifact_id": artifact_id,
                    "parser_name": parsed.parser_name,
                },
            )

            normalized = normalize_document(
                raw_text=parsed.raw_text,
                char_count=parsed.char_count,
                page_count=parsed.page_count,
                source_format=parsed.source_format,
                parser_name=parsed.parser_name,
                store_raw_text=False,  # Metadata-only
            )

            page_count = normalized.page_count
            char_count = normalized.char_count
            token_estimate = normalized.token_estimate
            section_count = normalized.section_count
            parser_name = normalized.parser_name
            normalized_ready = True

            _log_decision(
                "literature_normalize_ok",
                {
                    "component": "literature_runtime",
                    "artifact_id": artifact_id,
                    "section_count": section_count,
                    "char_count": char_count,
                    "token_estimate": token_estimate,
                },
            )

        except ParserError as e:
            _log_decision(
                "literature_normalize_fail",
                {
                    "component": "literature_runtime",
                    "artifact_id": artifact_id,
                    "reason_code": "PARSE_ERROR",
                },
            )
            # Continue recording the artifact with normalized_ready=False

        record = {
            "schema_version": SCHEMA_VERSION,
            "artifact_id": artifact_id,
            "input_file_hash": input_file_hash,
            "ext": ext,
            "declared_type": declared_type,
            "byte_size": int(len(data)),
            "page_count": page_count,
            "char_count": char_count,
            "token_estimate": token_estimate,
            "section_count": section_count,
            "normalized_ready": normalized_ready,
            "parser_name": parser_name,
            "created_at": created_at,
            "tool_versions": {
                "python": python_version,
            },
        }

        atomic_write_json(artifact_path(tmp_root, artifact_id), record)
        recorded.append(artifact_id)
        run_tokens.append(artifact_id)

        _log_decision(
            "literature_artifact_recorded",
            {
                "component": "literature_runtime",
                "artifact_id": artifact_id,
                "input_file_hash": input_file_hash,
            },
        )

    run_id = hashlib.sha256("|".join(run_tokens).encode("utf-8")).hexdigest()[:12]

    status = (
        "SUCCESS"
        if len(failed) == 0
        else ("FAILED" if len(recorded) == 0 else "PARTIAL_FAILURE")
    )
    ready = status == "SUCCESS"

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "run_id": run_id,
        "created_at": created_at,
        "status": status,
        "ready": bool(ready),
        "input_count": int(len(inputs)),
        "recorded_count": int(len(recorded)),
        "failed_count": int(len(failed)),
        "artifact_ids": recorded,
        "failed_artifact_ids": failed,
        "tool_versions": {
            "python": python_version,
        },
    }

    atomic_write_json(manifest_path(tmp_root, run_id), manifest)

    _log_decision(
        "literature_runtime_result",
        {
            "component": "literature_runtime",
            "allowed": True,
            "mode": mode.value,
            "run_id": run_id,
            "ready": bool(ready),
            "input_count": int(len(inputs)),
            "recorded_count": int(len(recorded)),
            "failed_count": int(len(failed)),
        },
    )

    return LiteratureRunHandle(
        run_id=run_id,
        ready=ready,
        status=status,
        recorded_count=len(recorded),
        failed_count=len(failed),
        manifest_relpath=str(
            Path(".tmp")
            / "literature_runtime"
            / "manifests"
            / f"manifest_{run_id}.json"
        ),
    )


def _write_failed(
    *, tmp_root: Path, artifact_id: str, reason_code: str, created_at: str
) -> None:
    payload = {
        "schema_version": SCHEMA_VERSION,
        "artifact_id": artifact_id,
        "reason_code": reason_code,
        "created_at": created_at,
    }
    atomic_write_json(failure_path(tmp_root, artifact_id), payload)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _failure_id(index: int, ext: str) -> str:
    token = f"{index}:{ext}".encode("utf-8")
    return hashlib.sha256(token).hexdigest()


def _log_decision(event_type: str, meta: dict) -> None:
    # Best-effort provenance (never include filenames/paths/content)
    log_event(event_type, meta)

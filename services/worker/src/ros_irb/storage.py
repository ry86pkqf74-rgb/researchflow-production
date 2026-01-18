"""IRB submission state persistence and draft storage.

Manages the persistent flag indicating that IRB submission has been completed,
and provides secure storage for IRB draft documents with PHI governance and retention policies.

This module enforces fail-closed PHI detection and automatic retention policies
to comply with PHI_BOUNDARIES.md governance requirements.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from ros_irb.generate_irb_request import IRBDraft
from ros_irb.phi_guard import contains_phi


def default_irb_drafts_dir() -> Path:
    """Get the default directory for IRB draft storage.

    Returns:
        Path to the IRB drafts directory (creates if needed).
    """
    root = os.environ.get("ROS_IRB_DRAFT_DIR", ".tmp/irb_drafts")
    return Path(root)


def retention_days() -> int:
    """Get the retention period for IRB drafts in days.

    Returns:
        Number of days to retain drafts (minimum 1, default 30).
    """
    val = os.environ.get("ROS_IRB_DRAFT_RETENTION_DAYS", "30")
    try:
        return max(1, int(val))
    except Exception:
        return 30


def _assert_no_phi(draft: IRBDraft) -> None:
    """Assert that draft does not contain PHI/PII patterns.

    Args:
        draft: The IRB draft to check.

    Raises:
        ValueError: If PHI/PII patterns are detected in the draft.
    """
    blob = json.dumps(
        {
            "study_title": draft.study_title,
            "answers": draft.answers,
            "literature_summary": draft.literature_summary,
        },
        ensure_ascii=False,
    )
    if contains_phi(blob):
        raise ValueError("Draft appears to contain PHI/PII patterns and will not be stored.")


def save_draft(draft: IRBDraft, base_dir: Optional[Path] = None) -> Path:
    """Save an IRB draft to persistent storage with PHI guard.

    Args:
        draft: The IRB draft to save.
        base_dir: Optional custom storage directory. If None, uses default.

    Returns:
        Path to the saved draft file.

    Raises:
        ValueError: If draft contains PHI/PII patterns.
    """
    base = base_dir or default_irb_drafts_dir()
    base.mkdir(parents=True, exist_ok=True)

    _assert_no_phi(draft)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = base / f"irb_draft_{ts}.json"
    path.write_text(json.dumps(asdict(draft), indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def load_draft(path: Path) -> IRBDraft:
    """Load an IRB draft from persistent storage.

    Args:
        path: Path to the draft JSON file.

    Returns:
        The loaded IRB draft.
    """
    payload = json.loads(path.read_text(encoding="utf-8"))
    return IRBDraft(**payload)


def purge_expired_drafts(base_dir: Optional[Path] = None, days: Optional[int] = None) -> int:
    """Delete IRB drafts older than the retention period.

    Args:
        base_dir: Optional custom storage directory. If None, uses default.
        days: Optional retention period in days. If None, uses configured value.

    Returns:
        Number of drafts deleted.
    """
    base = base_dir or default_irb_drafts_dir()
    if not base.exists():
        return 0

    keep_days = days or retention_days()
    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)
    deleted = 0

    for p in base.glob("irb_draft_*.json"):
        try:
            mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
            if mtime < cutoff:
                p.unlink(missing_ok=True)
                deleted += 1
        except Exception:
            continue

    return deleted


def _get_default_flag_path() -> Path:
    """Get the default path for the IRB submitted flag file.

    Returns:
        Path to the IRB submitted flag file.
    """
    flag_dir = default_irb_drafts_dir()
    flag_dir.mkdir(parents=True, exist_ok=True)
    return flag_dir / "irb_submitted.flag"


def is_irb_submitted(flag_path: Optional[Path] = None) -> bool:
    """Check if IRB has been marked as submitted.

    Args:
        flag_path: Optional custom path to the flag file. If None, uses default.

    Returns:
        True if IRB has been marked as submitted, False otherwise.
    """
    if flag_path is None:
        flag_path = _get_default_flag_path()

    return flag_path.exists()


def mark_irb_submitted(flag_path: Optional[Path] = None) -> None:
    """Mark IRB as submitted by creating the flag file.

    Args:
        flag_path: Optional custom path to the flag file. If None, uses default.
    """
    if flag_path is None:
        flag_path = _get_default_flag_path()

    # Ensure parent directory exists
    flag_path.parent.mkdir(parents=True, exist_ok=True)

    # Create the flag file (empty file as marker)
    flag_path.touch()

"""
Unified provenance event logger.

Provides log_event() function for appending ProvenanceEvent records
to user-scoped JSONL files with fallback handling.

Governance:
- Append-only writes preserve audit chain
- User-scoped: .tmp/workspaces/<user_id>/provenance/provenance.jsonl
- Fallback: .tmp/workspaces/<user_id>/provenance/provenance.jsonl (maintains user-scoped structure when user context unavailable)
- Silent fail: logging errors don't break application
- CI-safe: directory creation is idempotent
"""

import json
from pathlib import Path
from typing import Optional

from pydantic import ValidationError

from src.provenance.event import ProvenanceEvent

# Try to import centralized identity helpers for user-scoped logging.
# This avoids mismatches where one caller resolves a different user_id
# than another (e.g., session_state vs env vs defaults).
try:
    from web_frontend.utils.identity import (
        get_user_id_compat as get_user_id,
        get_user_workspace_dir,
    )

    IDENTITY_AVAILABLE = True
except ImportError:
    # Fallback when web_frontend not available (e.g., core pipeline runs)
    IDENTITY_AVAILABLE = False
    get_user_id = None
    get_user_workspace_dir = None


def log_event(event: ProvenanceEvent, user_id: Optional[str] = None) -> bool:
    """
    Log a provenance event to user-scoped JSONL file.

    Appends event to .tmp/workspaces/<user_id>/provenance/provenance.jsonl with
    graceful fallback and error handling.

    Args:
        event: ProvenanceEvent instance to log
        user_id: Optional explicit user_id (auto-detected if not provided)

    Returns:
        True if event was successfully logged, False otherwise

    File locations:
        - .tmp/workspaces/<user_id>/provenance/provenance.jsonl (user-scoped)
        - Fallback uses the same user-scoped structure when user context is unavailable

    Error handling:
        - Malformed events (validation errors): logged to stderr, rejected
        - I/O errors: logged to stderr, returns False
        - Never raises exceptions (silent fail to avoid breaking callers)

    Example:
        >>> from src.provenance.event import ProvenanceEvent, EventType, RuntimeMode, Classification
        >>> event = ProvenanceEvent(
        ...     event_type=EventType.DATA_EXPORT,
        ...     user_id="alice",
        ...     mode=RuntimeMode.OFFLINE,
        ...     classification=Classification.INTERNAL,
        ...     success=True,
        ...     details={"format": "parquet", "row_count": 1000}
        ... )
        >>> success = log_event(event)
        >>> assert success is True

    Thread safety:
        This function is not thread-safe. For concurrent writes, consider
        using file locking or message queue patterns.
    """
    try:
        # Validate event (Pydantic validation)
        if not isinstance(event, ProvenanceEvent):
            print(
                f"Warning: Invalid event type: {type(event)}. Expected ProvenanceEvent."
            )
            return False

        # Determine user_id
        resolved_user_id = user_id
        if resolved_user_id is None and IDENTITY_AVAILABLE:
            try:
                if get_user_id is not None:
                    resolved_user_id = get_user_id()
            except Exception:
                # Best-effort user context resolution; must not break offline/CI environments
                pass

        # Use user_id from event if still not resolved
        if resolved_user_id is None:
            resolved_user_id = event.user_id or "guest"

        # Determine log directory
        log_dir = _get_log_directory(resolved_user_id)
        log_dir.mkdir(parents=True, exist_ok=True)

        # Determine log file path
        log_file = log_dir / "provenance.jsonl"

        # Serialize event to JSON
        # For backward compatibility, check if legacy_event_type is in details
        event_dict = event.model_dump()
        if "legacy_event_type" in event.details:
            legacy_type = event.details["legacy_event_type"]
            # Only override event_type if legacy_event_type is a valid EventType value
            from src.provenance.event import EventType

            valid_event_types = {e.value for e in EventType}
            if legacy_type in valid_event_types:
                # Override event_type with legacy value for backward compatibility
                event_dict["event_type"] = legacy_type
                # Remove legacy_event_type from details to avoid duplication
                if (
                    "details" in event_dict
                    and "legacy_event_type" in event_dict["details"]
                ):
                    del event_dict["details"]["legacy_event_type"]

        event_json = json.dumps(event_dict)

        # Append to JSONL file (one event per line)
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(event_json + "\n")

        return True

    except ValidationError as exc:
        # Pydantic validation error - malformed event
        print(f"Warning: Malformed provenance event rejected: {exc}")
        return False

    except (IOError, OSError) as exc:
        # File I/O error
        print(f"Warning: Failed to write provenance event: {exc}")
        return False

    except Exception as exc:
        # Catch-all for unexpected errors
        print(f"Warning: Unexpected error logging provenance event: {exc}")
        return False


def _get_log_directory(user_id: str) -> Path:
    """
    Get log directory for user-scoped provenance logs.

    Priority:
        1. .tmp/workspaces/<user_id>/provenance/ (if user_context available)
        2. .tmp/workspaces/<user_id>/provenance/ (fallback maintains user-scoped structure)

    Args:
        user_id: User identifier

    Returns:
        Path to log directory
    """
    if IDENTITY_AVAILABLE and get_user_workspace_dir is not None:
        try:
            workspace_dir = get_user_workspace_dir(user_id=user_id)
            return workspace_dir / "provenance"
        except Exception:
            pass

    # Fallback to .tmp/workspaces/<user_id>/provenance
    # (mimics structure even without user_context module)
    workspace_dir = Path(".tmp") / "workspaces" / user_id
    return workspace_dir / "provenance"


def load_events(
    user_id: Optional[str] = None,
    event_type: Optional[str] = None,
    success_only: bool = False,
) -> list[ProvenanceEvent]:
    """
    Load provenance events from user-scoped log file.

    Args:
        user_id: User identifier (auto-detected if not provided)
        event_type: Optional filter by event type
        success_only: If True, only return successful events

    Returns:
        List of ProvenanceEvent instances (may be empty)

    Example:
        >>> events = load_events(user_id="alice", event_type="llm_request", success_only=True)
        >>> len(events)
        42
    """
    try:
        # Determine user_id
        resolved_user_id = user_id
        if resolved_user_id is None and IDENTITY_AVAILABLE:
            try:
                if get_user_id is not None:
                    resolved_user_id = get_user_id()
            except Exception:
                # Best-effort user context resolution; must not break offline/CI environments
                pass

        if resolved_user_id is None:
            resolved_user_id = "guest"

        # Get log file
        log_dir = _get_log_directory(resolved_user_id)
        log_file = log_dir / "provenance.jsonl"

        if not log_file.exists():
            return []

        # Load and parse events
        events = []
        with open(log_file, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue

                try:
                    event_dict = json.loads(line)
                    event = ProvenanceEvent(**event_dict)

                    # Apply filters
                    if event_type and event.event_type != event_type:
                        continue
                    if success_only and not event.success:
                        continue

                    events.append(event)

                except (json.JSONDecodeError, ValidationError) as exc:
                    print(
                        f"Warning: Skipping malformed event on line {line_num}: {exc}"
                    )
                    continue

        return events

    except Exception as exc:
        print(f"Warning: Failed to load provenance events: {exc}")
        return []


def get_event_summary(user_id: Optional[str] = None) -> dict:
    """
    Get summary statistics for user's provenance events.

    Args:
        user_id: User identifier (auto-detected if not provided)

    Returns:
        Dictionary with summary statistics

    Example:
        >>> summary = get_event_summary(user_id="alice")
        >>> summary["total_events"]
        1024
        >>> summary["event_type_counts"]["llm_request"]
        42
    """
    events = load_events(user_id=user_id)

    if not events:
        return {
            "total_events": 0,
            "event_type_counts": {},
            "success_count": 0,
            "failure_count": 0,
            "first_event": None,
            "last_event": None,
        }

    # Count event types
    event_type_counts = {}
    success_count = 0
    failure_count = 0

    for event in events:
        event_type_counts[event.event_type] = (
            event_type_counts.get(event.event_type, 0) + 1
        )
        if event.success:
            success_count += 1
        else:
            failure_count += 1

    return {
        "total_events": len(events),
        "event_type_counts": event_type_counts,
        "success_count": success_count,
        "failure_count": failure_count,
        "first_event": events[0].timestamp if events else None,
        "last_event": events[-1].timestamp if events else None,
    }

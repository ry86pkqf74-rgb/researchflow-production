"""Shared network gates for online literature access."""

from __future__ import annotations

import os


class OnlineLiteratureError(RuntimeError):
    """Raised when the online literature provider fails."""


class NetworkBlockedError(OnlineLiteratureError):
    """Raised when network calls are blocked by mode or NO_NETWORK flag."""


def ensure_network_allowed() -> None:
    """Ensure network calls are allowed by mode and NO_NETWORK flag.

    Raises:
        NetworkBlockedError: If NO_NETWORK=1 or runtime mode is not 'online'
    """
    no_network = os.getenv("NO_NETWORK", "1") == "1"
    if no_network:
        raise NetworkBlockedError(
            "ONLINE_LITERATURE_BLOCKED: NO_NETWORK=1 blocks online literature search. "
            "Set NO_NETWORK=0 to enable."
        )

    # Import here to avoid circular imports
    from web_frontend.utils.runtime_mode import detect_runtime_mode

    mode = detect_runtime_mode()
    if mode != "online":
        raise NetworkBlockedError(
            f"ONLINE_LITERATURE_BLOCKED: Online mode required (runtime_mode={mode}). "
            "Set NO_NETWORK=0 and ALLOW_UPLOADS=1 to enable online mode."
        )

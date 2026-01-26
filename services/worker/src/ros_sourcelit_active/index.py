"""SANDBOX-specific index builder with expanded scope.

Additive wrapper around Phase 8 indexer for expanded indexing.
Outputs to .tmp/sourcelit_active/index.json (separate from Phase 8).

Design:
- Reuses Phase 8 functions (no duplication)
- Expanded scope: src/, schemas/, config/, tests/
- Performance-hardened: fail-closed limits
- Git metadata: reuses Phase 8 staleness tracking

Created: 2026-01-14 (Task D - Phase 9)
"""

import logging
from typing import Any, Dict

import yaml

# Import Phase 8 functions (reuse, don't duplicate)
from src.ros_sourcelit.index import (
    build_index as _phase8_build_index,
    check_index_staleness,
    get_current_head_sha,
)

logger = logging.getLogger(__name__)


def build_expanded_index(
    config_path: str = "config/sourcelit_active_index.yaml",
    output_path: str = ".tmp/sourcelit_active/index.json",
) -> Dict[str, Any]:
    """Build expanded SANDBOX index using Phase 8 functions.

    Strategy:
    1. Load and validate config (with performance limits)
    2. Delegate to Phase 8 build_index() - reuses all logic
    3. Phase 8 handles: file scanning, hashing, git metadata, deterministic ordering
    4. Returns expanded index with same schema as Phase 8

    Args:
        config_path: Path to expanded index config
        output_path: Output location (separate from Phase 8)

    Returns:
        Index dictionary with schema:
        {
            "version": "1.0.0",
            "generated_at": "...",
            "entries": [...],
            "git_metadata": {...},
            "index_hash": "sha256:..."
        }

    Raises:
        RuntimeError: If performance limits exceeded or validation fails
    """
    logger.info(f"Building expanded index from {config_path}")

    # Validate config (fail-closed)
    _validate_config(config_path)

    # Delegate to Phase 8 builder (reuse proven logic)
    # Phase 8 builder handles:
    # - Path traversal protection
    # - Deterministic ordering
    # - Git metadata tracking
    # - Atomic writes with lock
    # - Index hash computation
    index = _phase8_build_index(config_path, output_path)

    logger.info(f"Expanded index built: {len(index['entries'])} entries")

    return index


def _validate_config(config_path: str) -> None:
    """Load config and validate structure (fail-closed).

    Args:
        config_path: Path to config YAML

    Raises:
        RuntimeError: If config invalid or missing required sections
    """
    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        raise RuntimeError(f"Config not found: {config_path}")
    except yaml.YAMLError as e:
        raise RuntimeError(f"Failed to load config: {e}")

    # Validate required sections
    if "indexing" not in config:
        raise RuntimeError("Config missing 'indexing' section")

    if "performance_limits" not in config:
        raise RuntimeError("Config missing 'performance_limits' section")

    # Validate exclude_patterns include data/ (CRITICAL safety)
    exclude_patterns = config.get("indexing", {}).get("exclude_patterns", [])
    has_data_exclusion = any("data/" in p or "data/**" in p for p in exclude_patterns)
    if not has_data_exclusion:
        raise RuntimeError(
            "Config MUST exclude 'data/' directory. "
            "Add 'data/**' to indexing.exclude_patterns for safety."
        )

    logger.debug("Config validation passed")


# Re-export Phase 8 functions for convenience
__all__ = [
    "build_expanded_index",
    "check_index_staleness",
    "get_current_head_sha",
]

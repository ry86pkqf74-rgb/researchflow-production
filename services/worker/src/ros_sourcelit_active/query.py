"""SANDBOX query engine with bounded, PHI-guarded snippets.

This module implements Task B: content search with snippet extraction
that respects Task A policy decisions and guards all snippets against PHI.

Key Features:
- Path matching (fast, metadata-only) - works in all modes
- Content matching (bounded, allowlist-filtered) - SANDBOX+NO_NETWORK only
- Snippet extraction (bounded by max_chars) - SANDBOX only
- PHI guard integration (fail-closed) - MANDATORY for all snippets
- Path traversal protection - follows Phase 8 patterns
- Whitelist-only output schema - never includes forbidden keys

Created: 2026-01-14 (Task B - Phase 9)
"""

import fnmatch
import hashlib
import json
import logging
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

from src.governance.capabilities import RosMode, get_current_mode
from src.governance.output_phi_guard import guard_text
from src.ros_sourcelit_active.policy import SourcelitPolicy, SourcelitPolicyDecision

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration and Index Loading
# =============================================================================


def _load_config(config_path: str) -> Optional[Dict[str, Any]]:
    """Load query configuration YAML.

    Args:
        config_path: Path to configuration file

    Returns:
        Config dict or None if loading fails
    """
    try:
        with open(config_path) as f:
            return yaml.safe_load(f)
    except (FileNotFoundError, yaml.YAMLError) as e:
        logger.error(f"Failed to load config from {config_path}: {e}")
        return None


def _load_index(index_path: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Load Phase 8 index JSON (read-only).

    Args:
        index_path: Path to index JSON file

    Returns:
        Tuple of (index_dict, error_message)
        If successful: (index_dict, None)
        If failed: (None, error_message)
    """
    try:
        with open(index_path) as f:
            index = json.load(f)

        # Validate required fields
        if "version" not in index:
            return None, "Index missing 'version' field"
        if "entries" not in index:
            return None, "Index missing 'entries' field"

        return index, None

    except FileNotFoundError:
        return None, f"Index not found at {index_path}"
    except json.JSONDecodeError as e:
        return None, f"Invalid JSON in index: {e}"
    except Exception as e:
        return None, f"Failed to load index: {e}"


# =============================================================================
# Performance Guards (Task D)
# =============================================================================


@contextmanager
def _query_timeout(seconds: float):
    """Context manager for query timeout enforcement.

    The timeout mechanism itself is fail-closed (raises TimeoutError), but
    when used in _search_content(), timeouts are caught and return partial
    results (fail-soft behavior). Individual file operations are not
    interrupted - timeout is checked at loop boundaries only.

    Args:
        seconds: Maximum allowed query time

    Yields:
        check function that raises TimeoutError if exceeded

    Raises:
        TimeoutError: If query exceeds time budget (at check() calls)

    Example:
        >>> with _query_timeout(1.5) as check:
        ...     for item in large_list:
        ...         check()  # Raises if timeout exceeded
        ...         process(item)
    """
    start_time = time.time()

    def check_timeout():
        elapsed = time.time() - start_time
        if elapsed > seconds:
            raise TimeoutError(
                f"Query exceeded time budget ({seconds}s). "
                f"This is a safety guard to prevent runaway queries."
            )

    yield check_timeout


def _validate_index_size(index: Dict[str, Any], max_files: int) -> None:
    """Validate index size is within bounds (fail-closed).

    This prevents queries against unexpectedly large indexes that could
    cause performance issues or excessive memory usage.

    Args:
        index: Index dictionary
        max_files: Maximum allowed indexed files

    Raises:
        RuntimeError: If index exceeds limits
    """
    entry_count = len(index.get("entries", []))
    if entry_count > max_files:
        raise RuntimeError(
            f"Index contains {entry_count} files, exceeds safety limit of {max_files}. "
            f"This guard prevents queries against unexpectedly large indexes. "
            f"Adjust max_indexed_files in config if this is expected."
        )


# =============================================================================
# Path Traversal Protection (following Phase 8 pattern)
# =============================================================================


def _is_within_repo(resolved_path: Path, repo_root_resolved: Path) -> bool:
    """Check if resolved path is within repo boundary.

    Follows the pattern from src/ros_sourcelit/index.py:398-404

    Args:
        resolved_path: Path that has been resolved (symlinks followed)
        repo_root_resolved: Resolved repository root path

    Returns:
        True if path is within repo, False otherwise
    """
    try:
        resolved_path.relative_to(repo_root_resolved)
        return True
    except ValueError:
        return False


def _safe_file_read(
    file_path: Path, repo_root: Path, max_bytes: int
) -> Optional[str]:
    """Safely read file with path traversal checks.

    Security:
    1. Resolve symlinks
    2. Check resolved path is within repo_root
    3. Check file size before reading
    4. Read with encoding fallback (utf-8 -> latin1 -> skip)

    Args:
        file_path: Path to file to read
        repo_root: Repository root for boundary check
        max_bytes: Maximum file size to read

    Returns:
        File content or None if unsafe/unreadable
    """
    try:
        # Resolve symlinks and check existence
        resolved = file_path.resolve(strict=True)

        # Check within repo boundary
        if not _is_within_repo(resolved, repo_root.resolve()):
            logger.warning(f"Path traversal attempt blocked: {file_path}")
            return None

        # Check file size
        file_size = resolved.stat().st_size
        if file_size > max_bytes:
            logger.debug(f"File too large ({file_size} > {max_bytes}): {file_path}")
            return None

        # Read with encoding fallback
        try:
            return resolved.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            try:
                return resolved.read_text(encoding="latin1")
            except UnicodeDecodeError:
                logger.debug(f"Failed to decode file: {file_path}")
                return None

    except (FileNotFoundError, RuntimeError) as e:
        logger.debug(f"File not readable: {file_path} - {e}")
        return None
    except Exception as e:
        logger.warning(f"Unexpected error reading {file_path}: {e}")
        return None


# =============================================================================
# Path Filtering (allowlist/exclude patterns)
# =============================================================================


def _matches_any_pattern(path_str: str, patterns: List[str]) -> bool:
    """Check if path matches any of the given patterns.

    Args:
        path_str: Path to check (as string)
        patterns: List of glob patterns

    Returns:
        True if path matches any pattern
    """
    for pattern in patterns:
        if fnmatch.fnmatch(path_str, pattern):
            return True
    return False


def _is_path_allowed(
    path_str: str,
    content_search_paths: List[str],
    exclude_patterns: List[str],
) -> bool:
    """Check if path is allowed for content scanning.

    Args:
        path_str: Path to check
        content_search_paths: Allowlist of path prefixes
        exclude_patterns: Exclusion glob patterns

    Returns:
        True if path is allowed for content scanning
    """
    # Check exclusions first (fail-closed)
    if _matches_any_pattern(path_str, exclude_patterns):
        return False

    # Check if path starts with any allowed prefix
    for allowed_prefix in content_search_paths:
        if path_str.startswith(allowed_prefix):
            return True

    return False


# =============================================================================
# Path Matching (Fast Path - All Modes)
# =============================================================================


def _search_paths(
    query: str, index_entries: List[Dict], case_sensitive: bool
) -> List[Dict[str, Any]]:
    """Search indexed paths (metadata only - no file I/O).

    Args:
        query: Search term
        index_entries: List of index entries from Phase 8 index
        case_sensitive: Whether to do case-sensitive matching

    Returns:
        List of path match results
    """
    results = []
    query_normalized = query if case_sensitive else query.lower()

    for entry in index_entries:
        path = entry.get("path", "")
        path_normalized = path if case_sensitive else path.lower()

        # Substring match
        if query_normalized in path_normalized:
            # Calculate relevance score
            if path_normalized == query_normalized:
                relevance = 1.0  # Exact match
            elif path_normalized.endswith(query_normalized):
                relevance = 0.9  # Ends with query
            elif path_normalized.startswith(query_normalized):
                relevance = 0.8  # Starts with query
            else:
                relevance = 0.5  # Substring match

            results.append(
                {
                    "type": "path_match",
                    "path": path,
                    "sha256": entry.get("sha256", ""),
                    "line": None,
                    "snippet": None,
                    "blocked_reason": None,
                    "relevance_score": relevance,
                }
            )

    return results


# =============================================================================
# Content Matching (Bounded Path - SANDBOX Only)
# =============================================================================


def _search_content(
    query: str,
    index_entries: List[Dict],
    config: Dict,
    repo_root: Path,
    case_sensitive: bool,
) -> List[Dict[str, Any]]:
    """Search file contents (bounded - requires file I/O).

    Only called when policy allows snippets (SANDBOX + NO_NETWORK=1).

    Args:
        query: Search term
        index_entries: List of index entries
        config: Query configuration
        repo_root: Repository root path
        case_sensitive: Whether to do case-sensitive matching

    Returns:
        List of content match results (without snippets - extracted separately)
    """
    results = []

    # Get configuration
    content_search_paths = config.get("indexing", {}).get("content_search_paths", [])
    exclude_patterns = config.get("indexing", {}).get("exclude_patterns", [])
    max_files_to_scan = config.get("query", {}).get("content_matching", {}).get(
        "max_files_to_scan", 250
    )
    max_bytes_per_file = config.get("query", {}).get("content_matching", {}).get(
        "max_bytes_per_file", 200000
    )
    timeout_seconds = config.get("query", {}).get("content_matching", {}).get(
        "timeout_seconds", 1.5
    )

    query_normalized = query if case_sensitive else query.lower()
    files_scanned = 0

    # Enforce time budget (fail-soft: return partial results on timeout)
    try:
        with _query_timeout(timeout_seconds) as check_timeout:
            for entry in index_entries:
                # Check timeout at loop start
                check_timeout()

                if files_scanned >= max_files_to_scan:
                    logger.debug(f"Hit max_files_to_scan limit ({max_files_to_scan})")
                    break

                path = entry.get("path", "")

                # Check if path is in allowlist
                if not _is_path_allowed(path, content_search_paths, exclude_patterns):
                    continue

                # Read file content (with safety checks)
                file_path = repo_root / path
                content = _safe_file_read(file_path, repo_root, max_bytes_per_file)

                if content is None:
                    continue

                files_scanned += 1

                # Search for query in content (case-sensitivity handled per-line below)
                lines = content.splitlines()

                for line_idx, line in enumerate(lines):
                    line_normalized = line if case_sensitive else line.lower()
                    if query_normalized in line_normalized:
                        # Found match - record first match only per file
                        results.append(
                            {
                                "type": "content_match",
                                "path": path,
                                "sha256": entry.get("sha256", ""),
                                "line": line_idx + 1,  # 1-indexed line numbers
                                "snippet": None,  # Will be filled by snippet extraction
                                "blocked_reason": None,
                                "relevance_score": 0.7,  # Content matches score lower than exact path matches
                                "_content": content,  # Temporary field for snippet extraction
                                "_match_line_idx": line_idx,  # Temporary field
                            }
                        )
                        break  # Only first match per file

    except TimeoutError as e:
        # Log timeout event (no content logged)
        logger.warning(
            f"Content search timeout after {timeout_seconds}s",
            extra={"reason_code": "QUERY_TIMEOUT", "files_scanned": files_scanned},
        )
        # Return partial results (fail-soft for timeout - user still gets path matches)

    return results


# =============================================================================
# Snippet Extraction and PHI Guard
# =============================================================================


def _extract_snippet(
    content: str, match_line_idx: int, max_chars: int, context_lines: int = 2
) -> str:
    """Extract bounded snippet around match.

    Args:
        content: Full file content
        match_line_idx: Line index of match (0-indexed)
        max_chars: Maximum snippet length
        context_lines: Number of context lines before/after match

    Returns:
        Bounded snippet (guaranteed <= max_chars)
    """
    lines = content.splitlines()

    # Calculate range with context
    start_line = max(0, match_line_idx - context_lines)
    end_line = min(len(lines), match_line_idx + context_lines + 1)

    # Extract lines
    snippet_lines = lines[start_line:end_line]
    snippet = "\n".join(snippet_lines)

    # Truncate if needed
    if len(snippet) > max_chars:
        # Try reducing context
        if context_lines > 0:
            return _extract_snippet(content, match_line_idx, max_chars, context_lines - 1)
        else:
            # Just truncate with ellipsis
            snippet = snippet[: max_chars - 3] + "..."

    return snippet


def _guard_snippet(snippet: str, file_path: str) -> Tuple[Optional[str], Optional[str]]:
    """Apply PHI guard to snippet (fail-closed).

    Args:
        snippet: Snippet text to guard
        file_path: File path for logging (no content logged)

    Returns:
        Tuple of (snippet, blocked_reason)
        If clean: (snippet, None)
        If PHI detected: (None, "PHI_GUARD")
    """
    try:
        # Use fail_closed=True - raises RuntimeError if PHI detected
        guard_text(snippet, fail_closed=True)
        return (snippet, None)
    except RuntimeError:
        # PHI detected - block snippet
        # Log event without content
        logger.warning(
            f"PHI detected in snippet from {file_path} - snippet blocked",
            extra={"reason_code": "PHI_GUARD", "file_path": file_path},
        )
        return (None, "PHI_GUARD")


def _apply_snippets_to_results(
    results: List[Dict[str, Any]], max_snippet_chars: int, context_lines: int
) -> None:
    """Extract and guard snippets for content match results.

    Modifies results in-place. Only called when policy allows snippets.

    Args:
        results: List of content match results
        max_snippet_chars: Maximum snippet length
        context_lines: Number of context lines
    """
    for result in results:
        if result["type"] != "content_match":
            continue

        # Get temporary fields
        content = result.pop("_content", None)
        match_line_idx = result.pop("_match_line_idx", None)

        if content is None or match_line_idx is None:
            continue

        # Extract snippet
        snippet = _extract_snippet(
            content, match_line_idx, max_snippet_chars, context_lines
        )

        # Apply PHI guard (fail-closed)
        guarded_snippet, blocked_reason = _guard_snippet(snippet, result["path"])

        result["snippet"] = guarded_snippet
        result["blocked_reason"] = blocked_reason


# =============================================================================
# Response Construction (Schema Whitelist)
# =============================================================================


def _build_response(
    query: str,
    mode: RosMode,
    path_results: List[Dict],
    content_results: List[Dict],
    policy_decision: SourcelitPolicyDecision,
    index_hash: str,
    error: Optional[str] = None,
    max_results: int = 20,
) -> Dict[str, Any]:
    """Build whitelisted response (strict schema enforcement).

    Whitelist (NEVER include other keys):
    - query, mode, results[], content_policy, index_hash, error

    Result object whitelist:
    - type, path, sha256, line, snippet, blocked_reason, relevance_score

    BLACKLIST (never include):
    - content, raw, body, text, data, file_content

    Args:
        query: Search query
        mode: Current RosMode
        path_results: Path match results
        content_results: Content match results
        policy_decision: Policy decision from Task A
        index_hash: Index hash for staleness detection
        error: Error message if any
        max_results: Maximum number of results to return

    Returns:
        Whitelisted response dict
    """
    # Merge and sort results
    all_results = path_results + content_results
    all_results.sort(key=lambda r: r["relevance_score"], reverse=True)

    # Enforce max_results limit
    all_results = all_results[:max_results]

    # Build whitelisted response (STRICT)
    return {
        "query": query,
        "mode": mode.value.lower(),
        "results": all_results,
        "content_policy": {
            "allow_snippets": policy_decision.allow_snippets,
            "max_snippet_chars": policy_decision.max_snippet_chars,
            "reason_code": policy_decision.reason_code,
        },
        "index_hash": index_hash,
        "error": error,
    }


# =============================================================================
# Main Query Function
# =============================================================================


def execute_query(
    query: str,
    index_path: str = ".tmp/sourcelit/index.json",
    config_path: str = "config/sourcelit_active_sandbox.yaml",
    mode: Optional[RosMode] = None,
    no_network: Optional[bool] = None,
    repo_root: Optional[Path] = None,
) -> Dict[str, Any]:
    """Execute SANDBOX-aware query with bounded snippets.

    Strategy:
    1. Load config and index
    2. Evaluate policy (Task A)
    3. Execute path search (fast - metadata only)
    4. Execute content search (bounded - if policy allows)
    5. Extract snippets (bounded - if policy allows)
    6. Guard snippets (PHI detection - fail-closed)
    7. Build whitelisted response

    Args:
        query: Search term or pattern
        index_path: Path to Phase 8 index JSON
        config_path: Path to SANDBOX config YAML
        mode: RosMode override (defaults to detect from env)
        no_network: Network isolation override (defaults to env)
        repo_root: Repository root for path resolution

    Returns:
        Query response dict (whitelisted schema only)

    Examples:
        >>> # STANDBY mode - metadata only
        >>> result = execute_query("governance", mode=RosMode.STANDBY)
        >>> assert result["results"][0]["snippet"] is None

        >>> # SANDBOX mode - with snippets
        >>> result = execute_query("governance", mode=RosMode.SANDBOX, no_network=True)
        >>> # Snippets may be present if policy allows
    """
    # Detect mode if not provided
    if mode is None:
        mode = get_current_mode()

    # Detect no_network if not provided
    if no_network is None:
        no_network = os.getenv("NO_NETWORK") == "1"

    # Default repo_root to current directory
    if repo_root is None:
        repo_root = Path.cwd()

    # Load configuration
    config = _load_config(config_path)
    if config is None:
        return _build_response(
            query=query,
            mode=mode,
            path_results=[],
            content_results=[],
            policy_decision=SourcelitPolicyDecision(
                allow_snippets=False,
                max_snippet_chars=0,
                reason="Config load failed",
                reason_code="CONFIG_ERROR",
                mode=mode,
            ),
            index_hash="",
            error="Failed to load configuration",
        )

    # Load index
    index, error = _load_index(index_path)
    if error:
        return _build_response(
            query=query,
            mode=mode,
            path_results=[],
            content_results=[],
            policy_decision=SourcelitPolicyDecision(
                allow_snippets=False,
                max_snippet_chars=0,
                reason="Index load failed",
                reason_code="INDEX_ERROR",
                mode=mode,
            ),
            index_hash="",
            error=error,
        )

    # Validate index size (Task D - fail-closed performance guard)
    max_indexed_files = config.get("security", {}).get("max_indexed_files", 10000)
    try:
        _validate_index_size(index, max_indexed_files)
    except RuntimeError as e:
        return _build_response(
            query=query,
            mode=mode,
            path_results=[],
            content_results=[],
            policy_decision=SourcelitPolicyDecision(
                allow_snippets=False,
                max_snippet_chars=0,
                reason="Index too large",
                reason_code="INDEX_SIZE_EXCEEDED",
                mode=mode,
            ),
            index_hash="",
            error=str(e),
        )

    # Evaluate policy (Task A integration)
    policy = SourcelitPolicy(mode=mode, no_network=no_network)
    decision = policy.evaluate()

    # Get configuration values
    case_sensitive = config.get("query", {}).get("path_matching", {}).get(
        "case_sensitive", False
    )
    max_results = config.get("query", {}).get("max_results", 20)
    context_lines = config.get("content_policy", {}).get("snippet_context_lines", 2)

    # Execute path matching (fast path - works in all modes)
    path_results = _search_paths(query, index.get("entries", []), case_sensitive)

    # Execute content matching (bounded path - only if policy allows)
    content_results = []
    if decision.allow_snippets:
        content_results = _search_content(
            query,
            index.get("entries", []),
            config,
            repo_root,
            case_sensitive,
        )

        # Extract and guard snippets
        _apply_snippets_to_results(
            content_results, decision.max_snippet_chars, context_lines
        )

    # Build whitelisted response
    return _build_response(
        query=query,
        mode=mode,
        path_results=path_results,
        content_results=content_results,
        policy_decision=decision,
        index_hash=index.get("index_hash", ""),
        max_results=max_results,
    )

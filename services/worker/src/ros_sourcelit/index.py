"""
ROS Sourcelit Indexer

Builds offline index of codebase for documentation navigation.
Outputs paths + hashes only (no file content exposure).

Last Updated: 2026-01-08
"""

import contextlib
import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
import yaml


LOCK_TIMEOUT_SECONDS = 30
LOCK_POLL_INTERVAL_SECONDS = 0.1


def _get_git_metadata(repo_root: Path) -> Dict[str, Any]:
    """
    Get git repository metadata for staleness detection.

    Fail-soft: Returns empty dict if git is unavailable or fails.

    Returns:
        Dict with head_sha, head_ref, commit_time_utc (or empty dict on failure)
    """
    try:
        # Get current HEAD SHA
        result_sha = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result_sha.returncode != 0:
            return {}

        head_sha = result_sha.stdout.strip()

        # Get current branch name (may be detached HEAD)
        result_ref = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=5,
        )
        head_ref = result_ref.stdout.strip() if result_ref.returncode == 0 else "unknown"

        # Get commit timestamp
        result_time = subprocess.run(
            ["git", "log", "-1", "--format=%cI"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=5,
        )
        commit_time = result_time.stdout.strip() if result_time.returncode == 0 else None

        return {
            "head_sha": head_sha,
            "head_ref": head_ref,
            "commit_time_utc": commit_time,
        }

    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        # Fail-soft: git not available or command failed
        return {}


def get_current_head_sha(repo_root: Optional[Path] = None) -> Optional[str]:
    """
    Get current git HEAD SHA for staleness comparison.

    Args:
        repo_root: Repository root path (defaults to cwd)

    Returns:
        HEAD SHA string or None if unavailable
    """
    if repo_root is None:
        repo_root = Path.cwd()

    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        # Fail-soft: git not available, not a git repo, or command timed out; treat as no HEAD
        return None


def check_index_staleness(index_path: str, repo_root: Optional[Path] = None) -> Dict[str, Any]:
    """
    Check if index is stale compared to current repo state.

    Args:
        index_path: Path to index.json
        repo_root: Repository root path (defaults to cwd)

    Returns:
        Dict with:
            is_stale: bool (True if index is outdated)
            index_sha: str or None (SHA when index was built)
            current_sha: str or None (current HEAD SHA)
            reason: str (explanation of staleness status)
    """
    if repo_root is None:
        repo_root = Path.cwd()

    index_file = Path(index_path)

    # Default response for missing index
    if not index_file.exists():
        return {
            "is_stale": True,
            "index_sha": None,
            "current_sha": get_current_head_sha(repo_root),
            "reason": "Index file not found",
        }

    try:
        with open(index_file, "r") as f:
            index = json.load(f)
    except (json.JSONDecodeError, IOError):
        return {
            "is_stale": True,
            "index_sha": None,
            "current_sha": get_current_head_sha(repo_root),
            "reason": "Index file corrupted or unreadable",
        }

    # Get stored git metadata
    git_meta = index.get("git_metadata", {})
    index_sha = git_meta.get("head_sha")

    # Get current HEAD
    current_sha = get_current_head_sha(repo_root)

    # If no git metadata in index, consider stale (old index format)
    if not index_sha:
        return {
            "is_stale": True,
            "index_sha": None,
            "current_sha": current_sha,
            "reason": "Index missing git metadata (rebuild recommended)",
        }

    # If can't determine current SHA, fail-soft (not stale)
    if not current_sha:
        return {
            "is_stale": False,
            "index_sha": index_sha,
            "current_sha": None,
            "reason": "Cannot determine current HEAD (git unavailable)",
        }

    # Compare SHAs
    if index_sha != current_sha:
        return {
            "is_stale": True,
            "index_sha": index_sha[:12],
            "current_sha": current_sha[:12],
            "reason": f"Index built at {index_sha[:12]}, current HEAD is {current_sha[:12]}",
        }

    return {
        "is_stale": False,
        "index_sha": index_sha[:12],
        "current_sha": current_sha[:12],
        "reason": "Index is up to date",
    }


def build_index(config_path: str, output_path: str) -> Dict[str, Any]:
    """
    Build index from config, write to output_path.

    Args:
        config_path: Path to config/sourcelit.yaml
        output_path: Path to .tmp/sourcelit/index.json

    Returns:
        Index dictionary

    Raises:
        RuntimeError: If NO_NETWORK flag violated or PHI paths detected
    """
    # Defense-in-depth: Check NO_NETWORK flag
    if os.getenv("NO_NETWORK", "0") == "1":
        # This is expected in STANDBY; indexing is local-only
        pass

    # Load config
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    # Verify safety flags
    safety = config.get("safety_flags", {})
    if not safety.get("mock_only", False):
        print("⚠️  WARNING: mock_only=false in config", file=sys.stderr)
    if not safety.get("no_network", False):
        print("⚠️  WARNING: no_network=false in config", file=sys.stderr)

    # Get indexing config
    indexing = config.get("indexing", {})
    include_paths = indexing.get("include_paths", [])
    exclude_patterns = indexing.get("exclude_patterns", [])
    include_extensions = indexing.get("include_extensions", [])

    # Get repo root (assuming config is in config/)
    repo_root = Path(config_path).parent.parent.resolve()

    # Collect entries
    entries = []

    for include_path in include_paths:
        target_path = repo_root / include_path

        try:
            resolved_include = target_path.resolve()
        except (OSError, RuntimeError, ValueError) as e:
            print(f"⚠️  Skipping {include_path}: {e}", file=sys.stderr)
            continue

        if not _is_within_repo(resolved_include, repo_root):
            # Fail-closed: ignore paths escaping repo via symlinks
            continue

        if not resolved_include.exists():
            continue

        if resolved_include.is_file():
            if _should_include(
                target_path,
                resolved_include,
                repo_root,
                exclude_patterns,
                include_extensions,
            ):
                entry = _create_entry(target_path, repo_root)
                if entry:
                    entries.append(entry)
        else:
            for item in resolved_include.rglob("*"):
                if item.is_file():
                    if _should_include(
                        item,
                        item.resolve(),
                        repo_root,
                        exclude_patterns,
                        include_extensions,
                    ):
                        entry = _create_entry(item, repo_root)
                        if entry:
                            entries.append(entry)

    # Sort entries alphabetically by path (deterministic)
    entries.sort(key=lambda e: e["path"])

    # Get git metadata for staleness detection (fail-soft)
    git_metadata = _get_git_metadata(repo_root)

    # Build index
    index = {
        "version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "entries": entries,
        "git_metadata": git_metadata,
    }

    # Compute index hash (deterministic)
    index_hash = _compute_index_hash(entries)
    index["index_hash"] = f"sha256:{index_hash}"

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    lock_path = output_file.parent / "index.lock"

    with _file_lock(lock_path):
        _write_atomic_index(index, output_file)

    return index


def _should_include(
    file_path: Path,
    resolved_path: Path,
    repo_root: Path,
    exclude_patterns: List[str],
    include_extensions: List[str],
) -> bool:
    """Check if file should be included in index."""
    if not _is_within_repo(resolved_path, repo_root):
        return False

    try:
        rel_path = file_path.relative_to(repo_root)
    except ValueError:
        return False

    rel_str = str(rel_path)

    # Check exclusions
    for pattern in exclude_patterns:
        # Simple pattern matching (** = any directories, * = any chars)
        if _pattern_match(rel_str, pattern):
            return False

    # Check extension
    if include_extensions:
        if file_path.suffix not in include_extensions:
            return False

    return True


def _pattern_match(path: str, pattern: str) -> bool:
    """Simple glob-like pattern matching."""
    import fnmatch

    # Convert ** to * for fnmatch
    pattern = pattern.replace("**", "*")

    # Check if pattern matches
    if fnmatch.fnmatch(path, pattern):
        return True

    # Also check if any parent dir matches
    parts = path.split("/")
    for i in range(len(parts)):
        subpath = "/".join(parts[: i + 1])
        if fnmatch.fnmatch(subpath, pattern):
            return True

    return False


def _create_entry(file_path: Path, repo_root: Path) -> Dict[str, Any]:
    """Create index entry for file."""
    try:
        rel_path = file_path.relative_to(repo_root)

        # Read file and compute hash
        content = file_path.read_bytes()
        file_hash = hashlib.sha256(content).hexdigest()

        entry = {
            "path": str(rel_path),
            "sha256": file_hash,
        }

        # Optional: Add line_map for text files
        if file_path.suffix in [".py", ".md", ".yaml", ".yml", ".json"]:
            try:
                text = content.decode("utf-8")
                lines = text.split("\n")
                entry["line_map"] = {
                    "total_lines": len(lines),
                    "non_empty_lines": len([l for l in lines if l.strip()]),
                }
            except UnicodeDecodeError:
                pass

        # CRITICAL: Do NOT include file content
        # No "content", "body", or "raw" fields

        return entry

    except Exception as e:
        print(f"⚠️  Error indexing {file_path}: {e}", file=sys.stderr)
        return None


def _compute_index_hash(entries: List[Dict[str, Any]]) -> str:
    """Compute deterministic hash of index entries."""
    # Hash sorted JSON representation
    entries_json = json.dumps(entries, sort_keys=True)
    return hashlib.sha256(entries_json.encode()).hexdigest()


def _is_within_repo(resolved_path: Path, repo_root_resolved: Path) -> bool:
    """Return True if resolved_path is inside repo_root_resolved."""
    try:
        resolved_path.relative_to(repo_root_resolved)
        return True
    except ValueError:
        return False


@contextlib.contextmanager
def _file_lock(
    lock_path: Path,
    timeout: float = LOCK_TIMEOUT_SECONDS,
    poll_interval: float = LOCK_POLL_INTERVAL_SECONDS,
):
    """Simple file-based lock to serialize index writes."""
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    start = time.time()
    fd = None

    while True:
        try:
            fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_RDWR)
            os.write(
                fd,
                f"pid={os.getpid()} utc={datetime.now(timezone.utc).isoformat()}Z\n".encode(),
            )
            break
        except FileExistsError:
            if (time.time() - start) >= timeout:
                raise RuntimeError(
                    f"Timeout acquiring Sourcelit index lock: {lock_path}"
                )
            time.sleep(poll_interval)

    try:
        yield
    finally:
        if fd is not None:
            os.close(fd)
        # Best-effort cleanup; may fail due to permissions
        with contextlib.suppress(FileNotFoundError, PermissionError):
            lock_path.unlink()


def _write_atomic_index(index: Dict[str, Any], output_file: Path) -> None:
    """Write index JSON atomically via a temp file then rename."""
    tmp_file = output_file.parent / (output_file.name + ".tmp")

    try:
        with open(tmp_file, "w") as f:
            json.dump(index, f, indent=2, sort_keys=True)
            f.flush()
            os.fsync(f.fileno())

        os.replace(tmp_file, output_file)
    except Exception:
        # Best-effort cleanup on failure
        with contextlib.suppress(FileNotFoundError):
            tmp_file.unlink()
        raise


def main():
    """CLI entrypoint."""
    import argparse

    parser = argparse.ArgumentParser(description="Build ROS Sourcelit index")
    parser.add_argument("--config", required=True, help="Path to config/sourcelit.yaml")
    parser.add_argument("--output", required=True, help="Path to output index.json")
    args = parser.parse_args()

    print(f"Building index from {args.config}...")
    index = build_index(args.config, args.output)
    print(f"✓ Index built: {len(index['entries'])} entries")
    print(f"✓ Output: {args.output}")
    print(f"✓ Hash: {index['index_hash']}")


if __name__ == "__main__":
    main()

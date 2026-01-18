"""
Artifact storage for provenance tracking.

Provides deterministic artifact storage with:
- Unique run IDs (timestamp + random hex)
- SHA256 content hashing
- Immutable metadata (frozen dataclass)
- Configurable storage location (ROS_REPORTS_DIR env var)

All artifacts stored in reports/ directory (gitignored, not committed).

Usage:
    from src.provenance.artifact_store import new_run_id, store_text

    run_id = new_run_id("analysis")
    artifact = store_text(
        run_id=run_id,
        category="figures",
        filename="plot.txt",
        text="figure data"
    )
    print(f"Stored: {artifact.path} (SHA256: {artifact.sha256})")
"""

from __future__ import annotations

import hashlib
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal


class ArtifactStoreError(ValueError):
    """Exception raised for invalid artifact storage parameters."""

    pass


def _utc_stamp() -> str:
    """Generate UTC timestamp string.

    Returns:
        Timestamp string in format: 20260113T180000Z
    """
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def new_run_id(prefix: str = "run") -> str:
    """Generate unique run identifier with timestamp and random hex.

    Format: {prefix}_{YYYYMMDDTHHMMSSZ}_{hex8}

    Args:
        prefix: Prefix for the run ID (default: "run")

    Returns:
        Unique run identifier, e.g., "analysis_20260113T180000Z_a1b2c3d4"

    Example:
        >>> run_id = new_run_id("literature")
        >>> print(run_id)
        literature_20260113T180000Z_f4e3d2c1
    """
    return f"{prefix}_{_utc_stamp()}_{secrets.token_hex(4)}"


def sha256_bytes(b: bytes) -> str:
    """Compute SHA256 hash of byte content.

    Args:
        b: Byte content to hash

    Returns:
        SHA256 hex digest (64 characters)

    Example:
        >>> content = b"hello world"
        >>> hash_val = sha256_bytes(content)
        >>> len(hash_val)
        64
    """
    return hashlib.sha256(b).hexdigest()


@dataclass(frozen=True)
class StoredArtifact:
    """Immutable metadata for a stored artifact.

    Attributes:
        run_id: Unique run identifier
        category: Artifact category (e.g., "figures", "literature_search")
        path: Absolute path to stored file
        sha256: SHA256 hex digest (64 characters)
        size_bytes: File size in bytes

    Example:
        >>> artifact = StoredArtifact(
        ...     run_id="run_20260113T180000Z_a1b2c3d4",
        ...     category="figures",
        ...     path="/path/to/reports/figures/run_20260113T180000Z_a1b2c3d4/plot.png",
        ...     sha256="abc123...",
        ...     size_bytes=1024
        ... )
    """

    run_id: str
    category: str
    path: str
    sha256: str
    size_bytes: int


def reports_root() -> Path:
    """Get reports directory from environment or default.

    Reads ROS_REPORTS_DIR environment variable. If not set, uses "reports".

    Returns:
        Path to reports directory

    Example:
        >>> import os
        >>> os.environ['ROS_REPORTS_DIR'] = '/tmp/artifacts'
        >>> root = reports_root()
        >>> print(root)
        /tmp/artifacts
    """
    return Path(os.getenv("ROS_REPORTS_DIR", "reports"))


def _validate_path_component(value: str, param_name: str) -> None:
    """Validate a path component for security.

    Args:
        value: The value to validate
        param_name: Name of the parameter (for error messages)

    Raises:
        ArtifactStoreError: If value is invalid (empty, contains separators, or null bytes)
    """
    if not value or not value.strip():
        raise ArtifactStoreError(f"{param_name} cannot be empty")

    if "\0" in value:
        raise ArtifactStoreError(f"{param_name} contains null byte")

    if "/" in value or "\\" in value or os.sep in value:
        raise ArtifactStoreError(f"{param_name} cannot contain path separators (/, \\)")


def store_text(
    *,
    run_id: str,
    category: str,
    filename: str,
    text: str,
    encoding: str = "utf-8",
) -> StoredArtifact:
    """Store text content as an artifact.

    Creates directory structure: reports/{category}/{run_id}/{filename}

    Args:
        run_id: Unique run identifier
        category: Artifact category (e.g., "literature_search")
        filename: Name of file to create
        text: Text content to store
        encoding: Text encoding (default: "utf-8")

    Returns:
        StoredArtifact with metadata

    Example:
        >>> run_id = new_run_id("analysis")
        >>> artifact = store_text(
        ...     run_id=run_id,
        ...     category="literature_search",
        ...     filename="overview.md",
        ...     text="# Literature Review\\n\\nFindings..."
        ... )
        >>> print(artifact.size_bytes)
        32
    """
    b = text.encode(encoding)
    return store_bytes(run_id=run_id, category=category, filename=filename, content=b)


def store_bytes(
    *,
    run_id: str,
    category: str,
    filename: str,
    content: bytes,
    mode: Literal["wb", "xb"] = "wb",
) -> StoredArtifact:
    """Store binary content as an artifact.

    Creates directory structure: reports/{category}/{run_id}/{filename}

    Args:
        run_id: Unique run identifier
        category: Artifact category (e.g., "figures")
        filename: Name of file to create
        content: Binary content to store
        mode: Write mode - "wb" (write/overwrite) or "xb" (exclusive, fail if exists)

    Returns:
        StoredArtifact with metadata

    Raises:
        ArtifactStoreError: If run_id, category, or filename are invalid
        FileExistsError: If mode="xb" and file already exists

    Example:
        >>> run_id = new_run_id("analysis")
        >>> data = b"binary content"
        >>> artifact = store_bytes(
        ...     run_id=run_id,
        ...     category="figures",
        ...     filename="plot.png",
        ...     content=data,
        ...     mode="wb"
        ... )
        >>> print(artifact.sha256[:8])
        a1b2c3d4
    """
    # Validate all path components for security
    _validate_path_component(run_id, "run_id")
    _validate_path_component(category, "category")
    _validate_path_component(filename, "filename")

    root = reports_root() / category / run_id
    root.mkdir(parents=True, exist_ok=True)
    path = root / filename
    with path.open(mode, buffering=0) as f:
        f.write(content)
    return StoredArtifact(
        run_id=run_id,
        category=category,
        path=str(path),
        sha256=sha256_bytes(content),
        size_bytes=len(content),
    )

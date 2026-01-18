#!/usr/bin/env python3
"""
Shared Parquet I/O utilities with schema version metadata embedding.

Provides centralized functions for reading/writing Parquet files with embedded
schema version information for drift detection and governance.

Metadata Keys:
    - ros.schema_id: Identifier for the schema (e.g., "heart_disease", "thyroid_pathology")
    - ros.schema_version: Version string (e.g., "v1.0.0")

Usage:
    from src.io.parquet_io import write_parquet_with_schema, read_parquet_with_schema

    # Write with schema metadata
    write_parquet_with_schema(
        df,
        path="data/processed/output.parquet",
        schema_id="heart_disease",
        schema_version="v1.0.0"
    )

    # Read and validate schema metadata
    df = read_parquet_with_schema(
        path="data/processed/output.parquet",
        expected_schema_id="heart_disease",
        expected_schema_version="v1.0.0",
        strict=True  # Fail on mismatch
    )

Governance:
    - All new Parquet writes should use write_parquet_with_schema()
    - Existing files without metadata will warn (or fail in strict mode)
    - Migration is explicit via CLI tools (not automatic)
"""

import warnings
from pathlib import Path
from typing import Optional, Dict, Any, Union, TYPE_CHECKING

# Optional dependencies - set to None if not available
# Functions will raise ImportError at call time if needed
pd = None
pa = None
pq = None
_PARQUET_IMPORT_ERROR: Optional[str] = None

try:
    import pandas as pd  # type: ignore[no-redef]
    import pyarrow as pa  # type: ignore[no-redef]
    import pyarrow.parquet as pq  # type: ignore[no-redef]
except ImportError as e:
    _PARQUET_IMPORT_ERROR = str(e)


def _require_parquet_deps() -> None:
    """Raise ImportError if parquet dependencies are not available."""
    if pd is None or pa is None or pq is None:
        raise ImportError(
            f"pyarrow is required for parquet support. "
            f"Install with: pip install pandas pyarrow\n"
            f"Original error: {_PARQUET_IMPORT_ERROR}"
        )


# Metadata key constants
SCHEMA_ID_KEY = "ros.schema_id"
SCHEMA_VERSION_KEY = "ros.schema_version"


def write_parquet_with_schema(
    df: pd.DataFrame,
    path: Union[Path, str],
    schema_id: str,
    schema_version: str,
    **kwargs,
) -> None:
    """
    Write DataFrame to Parquet with embedded schema metadata.

    Args:
        df: DataFrame to write
        path: Output path
        schema_id: Schema identifier (e.g., "heart_disease", "thyroid_pathology")
        schema_version: Schema version (e.g., "v1.0.0")
        **kwargs: Additional arguments passed to pyarrow.parquet.write_table()
                  (e.g., compression='snappy', version='2.6')
                  Note: pandas-specific args like 'index' are not supported

    Raises:
        ValueError: If schema_id or schema_version are empty
        OSError: If file cannot be written

    Example:
        >>> df = pd.DataFrame({'a': [1, 2, 3]})
        >>> write_parquet_with_schema(
        ...     df,
        ...     "data/output.parquet",
        ...     schema_id="example",
        ...     schema_version="v1.0.0",
        ...     compression='snappy'
        ... )
    """
    _require_parquet_deps()
    path = Path(path)

    if not schema_id:
        raise ValueError("schema_id cannot be empty")
    if not schema_version:
        raise ValueError("schema_version cannot be empty")

    # Create parent directories if needed
    path.parent.mkdir(parents=True, exist_ok=True)

    # Convert DataFrame to PyArrow Table (index is excluded by default)
    table = pa.Table.from_pandas(df, preserve_index=False)

    # Add schema metadata
    metadata = {
        SCHEMA_ID_KEY: schema_id,
        SCHEMA_VERSION_KEY: schema_version,
    }

    # Merge with existing metadata (if any)
    existing_metadata = table.schema.metadata or {}
    merged_metadata = {
        **existing_metadata,
        **{k.encode(): v.encode() for k, v in metadata.items()},
    }

    # Create new schema with updated metadata
    new_schema = table.schema.with_metadata(merged_metadata)
    table = table.cast(new_schema)

    # Write to Parquet
    pq.write_table(table, str(path), **kwargs)


def read_parquet_with_schema(
    path: Union[Path, str],
    expected_schema_id: Optional[str] = None,
    expected_schema_version: Optional[str] = None,
    strict: bool = False,
    **kwargs,
) -> pd.DataFrame:
    """
    Read Parquet file and optionally validate schema metadata.

    Args:
        path: Path to Parquet file
        expected_schema_id: Expected schema identifier (None to skip validation)
        expected_schema_version: Expected schema version (None to skip validation)
        strict: If True, fail on missing metadata or mismatch; if False, warn only
        **kwargs: Additional arguments passed to read_parquet() (e.g., engine='pyarrow')

    Returns:
        DataFrame

    Raises:
        FileNotFoundError: If file does not exist
        ValueError: If strict=True and metadata is missing or mismatched

    Warnings:
        UserWarning: If strict=False and metadata is missing or mismatched

    Example:
        >>> df = read_parquet_with_schema(
        ...     "data/output.parquet",
        ...     expected_schema_id="example",
        ...     expected_schema_version="v1.0.0",
        ...     strict=True
        ... )
    """
    _require_parquet_deps()
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Parquet file not found: {path}")

    # Read metadata first
    parquet_file = pq.read_table(str(path))
    metadata = parquet_file.schema.metadata or {}

    # Decode metadata
    decoded_metadata = {k.decode(): v.decode() for k, v in metadata.items()}

    actual_schema_id = decoded_metadata.get(SCHEMA_ID_KEY)
    actual_schema_version = decoded_metadata.get(SCHEMA_VERSION_KEY)

    # Validate schema metadata if expected values provided
    if expected_schema_id is not None:
        if actual_schema_id is None:
            msg = f"Missing schema metadata in {path}: {SCHEMA_ID_KEY} not found"
            if strict:
                raise ValueError(msg)
            else:
                warnings.warn(msg, UserWarning)
        elif actual_schema_id != expected_schema_id:
            msg = (
                f"Schema ID mismatch in {path}: "
                f"expected '{expected_schema_id}', got '{actual_schema_id}'"
            )
            if strict:
                raise ValueError(msg)
            else:
                warnings.warn(msg, UserWarning)

    if expected_schema_version is not None:
        if actual_schema_version is None:
            msg = f"Missing schema metadata in {path}: {SCHEMA_VERSION_KEY} not found"
            if strict:
                raise ValueError(msg)
            else:
                warnings.warn(msg, UserWarning)
        elif actual_schema_version != expected_schema_version:
            msg = (
                f"Schema version mismatch in {path}: "
                f"expected '{expected_schema_version}', got '{actual_schema_version}'"
            )
            if strict:
                raise ValueError(msg)
            else:
                warnings.warn(msg, UserWarning)

    # Read DataFrame
    df = pd.read_parquet(path, **kwargs)

    return df


def get_parquet_schema_metadata(path: Union[Path, str]) -> Dict[str, Optional[str]]:
    """
    Extract schema metadata from Parquet file.

    Args:
        path: Path to Parquet file

    Returns:
        Dictionary with keys: schema_id, schema_version (None if not present)

    Raises:
        FileNotFoundError: If file does not exist

    Example:
        >>> metadata = get_parquet_schema_metadata("data/output.parquet")
        >>> print(metadata['schema_id'])
        'heart_disease'
    """
    _require_parquet_deps()
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Parquet file not found: {path}")

    # Read metadata only (no data)
    parquet_file = pq.read_table(str(path))
    metadata = parquet_file.schema.metadata or {}

    # Decode metadata
    decoded_metadata = {k.decode(): v.decode() for k, v in metadata.items()}

    return {
        "schema_id": decoded_metadata.get(SCHEMA_ID_KEY),
        "schema_version": decoded_metadata.get(SCHEMA_VERSION_KEY),
    }


def update_parquet_schema_metadata(
    path: Union[Path, str],
    schema_id: str,
    schema_version: str,
    output_path: Optional[Union[Path, str]] = None,
) -> None:
    """
    Update (or add) schema metadata to existing Parquet file.

    This is a migration utility to add metadata to existing files without metadata.
    By default, overwrites the original file (in-place update).

    Args:
        path: Path to Parquet file
        schema_id: Schema identifier to embed
        schema_version: Schema version to embed
        output_path: Optional output path (if None, overwrites original)

    Raises:
        FileNotFoundError: If file does not exist
        ValueError: If schema_id or schema_version are empty

    Example:
        >>> # In-place update
        >>> update_parquet_schema_metadata(
        ...     "data/old_file.parquet",
        ...     schema_id="example",
        ...     schema_version="v1.0.0"
        ... )

        >>> # Write to new file
        >>> update_parquet_schema_metadata(
        ...     "data/old_file.parquet",
        ...     schema_id="example",
        ...     schema_version="v1.0.0",
        ...     output_path="data/new_file.parquet"
        ... )
    """
    _require_parquet_deps()
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Parquet file not found: {path}")

    if not schema_id:
        raise ValueError("schema_id cannot be empty")
    if not schema_version:
        raise ValueError("schema_version cannot be empty")

    # Read existing data
    df = pd.read_parquet(path, engine="pyarrow")

    # Determine output path
    if output_path is None:
        output_path = path
    else:
        output_path = Path(output_path)

    # Write with metadata
    write_parquet_with_schema(
        df, output_path, schema_id=schema_id, schema_version=schema_version
    )

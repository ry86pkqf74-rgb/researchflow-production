"""High-level ingestion wrapper (PR9A-1)

Implements:
- Load schema (YAML or Python)
- Read input file (CSV/TSV/Parquet) with automatic large-file handling
- Validate fail-closed (no preview/data returned on invalid)
- Emit sanitized provenance decision events via runtime logger

Large File Handling:
- Files > LARGE_FILE_BYTES are processed differently:
  - If DASK_ENABLED=true: Returns Dask DataFrame (lazy, partitioned)
  - If DASK_ENABLED=false: Returns pandas TextFileReader (chunked iterator)
- Small files use standard pandas DataFrame

SAFETY INVARIANTS:
- No persistence outside .tmp/
- No network access
- No PHI handling

Last Updated: 2026-01-23
"""

from __future__ import annotations

import hashlib
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional, Union

import pandas as pd

from .config import IngestionConfig, get_ingestion_config
from .schema_loader import SchemaDefinition, load_schema
from .validator import ValidationError, ValidationResult, validate_dataframe

logger = logging.getLogger("ingestion")

# Type alias for data that can be returned from ingestion
DataType = Union[pd.DataFrame, "pd.io.parsers.readers.TextFileReader"]

# Try to import Dask - it may not be available in all environments
try:
    import dask.dataframe as dd
    DASK_AVAILABLE = True
    DataType = Union[pd.DataFrame, "pd.io.parsers.readers.TextFileReader", dd.DataFrame]
except ImportError:
    DASK_AVAILABLE = False
    dd = None  # type: ignore


@dataclass
class IngestionMetadata:
    """Metadata about how data was ingested.
    
    Attributes:
        is_dask: True if data is a Dask DataFrame
        is_chunked: True if data is a chunked iterator
        is_large_file: True if file exceeded large file threshold
        file_size_bytes: Size of the input file
        partition_count: Number of partitions (Dask) or chunks (estimated)
    """
    is_dask: bool = False
    is_chunked: bool = False
    is_large_file: bool = False
    file_size_bytes: int = 0
    partition_count: Optional[int] = None


def ingest_file(
    data_path: Union[str, Path],
    schema_path: Union[str, Path],
    *,
    enable_provenance: bool = True,
    config: Optional[IngestionConfig] = None,
) -> pd.DataFrame:
    """Ingest a file under a declarative schema.

    Returns the validated DataFrame if and only if validation passes.
    
    Note: This function always returns a pandas DataFrame for backward
    compatibility. For large files with Dask support, use ingest_file_large().

    Raises:
        ValidationError: if schema invalid or data invalid.
    """
    data_path = Path(data_path)
    schema_path = Path(schema_path)

    schema = load_schema(schema_path)
    
    if config is None:
        config = get_ingestion_config()

    # For backward compatibility, always return pandas DataFrame
    df = _read_file_pandas(data_path, schema.file_format)

    result = validate_dataframe(df, schema, coerce_types=True)

    if enable_provenance:
        _log_ingestion_decision(schema=schema, data_path=data_path, result=result)

    result.raise_if_invalid()

    return df


def ingest_file_large(
    data_path: Union[str, Path],
    file_format: str,
    config: Optional[IngestionConfig] = None,
) -> tuple[DataType, IngestionMetadata]:
    """Ingest a file with automatic large-file handling.
    
    For large files (> LARGE_FILE_BYTES):
    - Returns Dask DataFrame if DASK_ENABLED=true
    - Returns pandas TextFileReader iterator if DASK_ENABLED=false
    
    For small files:
    - Returns standard pandas DataFrame
    
    Args:
        data_path: Path to the data file
        file_format: Format of the file (csv, tsv, parquet)
        config: Optional IngestionConfig (uses global config if not provided)
        
    Returns:
        Tuple of (data, metadata) where data is one of:
        - pd.DataFrame (small files or Dask unavailable)
        - dd.DataFrame (large files with Dask enabled)
        - TextFileReader (large files without Dask)
        
    Raises:
        ValidationError: if file not found or unsupported format
    """
    data_path = Path(data_path)
    
    if config is None:
        config = get_ingestion_config()
    
    data, metadata = _read_file(data_path, file_format, config)
    return data, metadata


def _read_file_pandas(path: Path, file_format: str) -> pd.DataFrame:
    """Read file using standard pandas (backward compatibility).
    
    This is the original simple implementation for small files.
    """
    if not path.exists():
        raise ValidationError(f"Data file not found: {path}")

    if file_format == "csv":
        return pd.read_csv(path)

    if file_format == "tsv":
        return pd.read_csv(path, sep="\t")

    if file_format == "parquet":
        return pd.read_parquet(path)

    raise ValidationError(f"Unsupported file_format: {file_format}")


def _read_file(
    path: Path,
    file_format: str,
    config: IngestionConfig,
) -> tuple[DataType, IngestionMetadata]:
    """Read file with automatic large-file detection and handling.
    
    Decision logic:
    1. Get file size
    2. If file_size >= large_file_bytes:
       a. If dask_enabled AND DASK_AVAILABLE: use Dask
       b. Else: use pandas chunked reading
    3. Else: use standard pandas
    
    Returns:
        Tuple of (data, metadata)
    """
    if not path.exists():
        raise ValidationError(f"Data file not found: {path}")
    
    file_size = os.path.getsize(path)
    is_large = file_size >= config.large_file_bytes
    
    metadata = IngestionMetadata(
        file_size_bytes=file_size,
        is_large_file=is_large,
    )
    
    logger.info(
        f"Reading file: {path.name}, size={file_size}, "
        f"is_large={is_large}, dask_enabled={config.dask_enabled}"
    )
    
    # CSV/TSV handling
    if file_format in ("csv", "tsv"):
        sep = "\t" if file_format == "tsv" else ","
        
        if is_large and config.dask_enabled and DASK_AVAILABLE:
            # Use Dask for large files
            data = _read_csv_dask(path, sep, config)
            metadata.is_dask = True
            metadata.partition_count = data.npartitions
            logger.info(f"Using Dask: {data.npartitions} partitions")
            return data, metadata
            
        elif is_large:
            # Use chunked pandas for large files when Dask unavailable
            data = _read_csv_chunked(path, sep, config)
            metadata.is_chunked = True
            # Estimate partition count based on chunk size
            estimated_chunks = max(1, file_size // (config.chunk_size_rows * 100))
            metadata.partition_count = int(estimated_chunks)
            logger.info(f"Using chunked pandas: ~{metadata.partition_count} chunks")
            return data, metadata
            
        else:
            # Standard pandas for small files
            data = pd.read_csv(path, sep=sep)
            logger.info(f"Using pandas: {len(data)} rows")
            return data, metadata
    
    # Parquet handling
    elif file_format == "parquet":
        if is_large and config.dask_enabled and DASK_AVAILABLE:
            data = _read_parquet_dask(path)
            metadata.is_dask = True
            metadata.partition_count = data.npartitions
            logger.info(f"Using Dask parquet: {data.npartitions} partitions")
            return data, metadata
        else:
            data = pd.read_parquet(path)
            logger.info(f"Using pandas parquet: {len(data)} rows")
            return data, metadata
    
    else:
        raise ValidationError(f"Unsupported file_format: {file_format}")


def _read_csv_dask(
    path: Path,
    sep: str,
    config: IngestionConfig,
) -> "dd.DataFrame":
    """Read CSV using Dask for distributed processing.
    
    Creates a lazy, partitioned Dask DataFrame that only loads
    data into memory when operations are computed.
    """
    if not DASK_AVAILABLE or dd is None:
        raise ValidationError("Dask is not available")
    
    return dd.read_csv(
        str(path),
        sep=sep,
        blocksize=config.dask_blocksize_bytes,
        assume_missing=True,  # Allow missing values
    )


def _read_csv_chunked(
    path: Path,
    sep: str,
    config: IngestionConfig,
) -> "pd.io.parsers.readers.TextFileReader":
    """Read CSV in chunks using pandas TextFileReader.
    
    Returns an iterator that yields DataFrames of chunk_size_rows each.
    Caller is responsible for iterating and processing chunks.
    """
    return pd.read_csv(
        path,
        sep=sep,
        chunksize=config.chunk_size_rows,
    )


def _read_parquet_dask(path: Path) -> "dd.DataFrame":
    """Read Parquet using Dask for distributed processing."""
    if not DASK_AVAILABLE or dd is None:
        raise ValidationError("Dask is not available")
    
    return dd.read_parquet(str(path))


def _log_ingestion_decision(
    *, schema: SchemaDefinition, data_path: Path, result: ValidationResult
) -> None:
    # Decisions-only + sanitized metadata; do not include content, row samples, or full paths.
    try:
        from web_frontend.provenance_logger import log_event
    except Exception as e:
        sys.stderr.write(f"provenance logger unavailable: {e.__class__.__name__}\n")
        return

    metadata = {
        "component": "ingestion_schema",
        "schema_name": schema.name,
        "schema_version": schema.version,
        "file_format": schema.file_format,
        "input_file_hash": _hash_path(data_path),
        "valid": result.valid,
        "error_count": len(result.errors),
    }

    if not result.valid:
        # Keep errors bounded and sanitized
        metadata["errors"] = result.errors[:10]

    log_event("ingestion_validation", metadata)


def _hash_path(path: Path) -> str:
    # Do not log file system paths; hash the resolved path string.
    try:
        s = str(path.resolve())
    except Exception:
        s = str(path)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]

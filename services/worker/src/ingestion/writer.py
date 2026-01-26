"""Partitioned Output Writer (Phase 4)

Writes cleaned data to Parquet format with support for:
- Single file output (small datasets)
- Partitioned output (large datasets via Dask or chunked pandas)
- Manifest generation with row/column counts

SAFETY INVARIANTS:
- Writes only to specified output directory
- No PHI handling (data assumed pre-cleaned)
- Generates checksums for integrity verification

Last Updated: 2026-01-23
"""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, List, Optional, Union

import pandas as pd

from .config import IngestionConfig, get_ingestion_config

logger = logging.getLogger("writer")

# Try to import Dask and PyArrow
try:
    import dask.dataframe as dd
    DASK_AVAILABLE = True
except ImportError:
    DASK_AVAILABLE = False
    dd = None  # type: ignore

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
    PYARROW_AVAILABLE = True
except ImportError:
    PYARROW_AVAILABLE = False
    pa = None  # type: ignore
    pq = None  # type: ignore


@dataclass
class WriteResult:
    """Result of writing data to storage.
    
    Attributes:
        output_path: Path to output file or directory
        format: Output format (parquet, csv)
        partitioned: True if output is partitioned across multiple files
        partition_paths: List of individual partition file paths
        row_count: Total number of rows written
        column_count: Number of columns
        total_bytes: Total size in bytes
        checksum: SHA-256 checksum of output (single file) or manifest
        created_at: Timestamp when output was created
        compression: Compression codec used (snappy, gzip, none)
    """
    output_path: str
    format: str = "parquet"
    partitioned: bool = False
    partition_paths: List[str] = field(default_factory=list)
    row_count: int = 0
    column_count: int = 0
    total_bytes: int = 0
    checksum: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    compression: str = "snappy"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "output_path": self.output_path,
            "format": self.format,
            "partitioned": self.partitioned,
            "partition_paths": self.partition_paths,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "total_bytes": self.total_bytes,
            "checksum": self.checksum,
            "created_at": self.created_at,
            "compression": self.compression,
        }


# Type alias for data that can be written
DataType = Union[pd.DataFrame, "pd.io.parsers.readers.TextFileReader"]
if DASK_AVAILABLE:
    DataType = Union[pd.DataFrame, "pd.io.parsers.readers.TextFileReader", "dd.DataFrame"]


def write_cleaned(
    data: DataType,
    output_dir: Union[str, Path],
    *,
    filename: str = "data",
    config: Optional[IngestionConfig] = None,
    compression: str = "snappy",
) -> WriteResult:
    """Write cleaned data to Parquet format.
    
    Automatically selects output strategy based on data type:
    - pandas DataFrame: Single Parquet file
    - Dask DataFrame: Partitioned Parquet directory
    - TextFileReader: Partitioned Parquet files (one per chunk)
    
    Args:
        data: Data to write (DataFrame, Dask DataFrame, or chunk iterator)
        output_dir: Directory for output files
        filename: Base filename (without extension)
        config: Optional IngestionConfig (uses global config if not provided)
        compression: Compression codec (snappy, gzip, none)
        
    Returns:
        WriteResult with output metadata
        
    Raises:
        ValueError: If data type is not supported or output fails
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if config is None:
        config = get_ingestion_config()
    
    # Detect data type and dispatch
    if data is None:
        raise ValueError("Cannot write None data")
    
    # Check for Dask DataFrame
    if DASK_AVAILABLE and dd is not None and isinstance(data, dd.DataFrame):
        logger.info(f"Writing Dask DataFrame with {data.npartitions} partitions")
        return _write_dask_dataframe(data, output_dir, filename, compression)
    
    # Check for TextFileReader (chunk iterator)
    if hasattr(data, '__iter__') and hasattr(data, 'chunksize'):
        logger.info("Writing chunked data (TextFileReader)")
        return _write_chunk_iterator(data, output_dir, filename, compression)
    
    # Standard pandas DataFrame
    if isinstance(data, pd.DataFrame):
        logger.info(f"Writing pandas DataFrame with {len(data)} rows")
        return _write_pandas_dataframe(data, output_dir, filename, compression)
    
    raise ValueError(f"Unsupported data type: {type(data).__name__}")


def _write_pandas_dataframe(
    df: pd.DataFrame,
    output_dir: Path,
    filename: str,
    compression: str,
) -> WriteResult:
    """Write a pandas DataFrame to a single Parquet file."""
    output_path = output_dir / f"{filename}.parquet"
    
    # Write with pandas (uses pyarrow if available)
    df.to_parquet(
        output_path,
        engine="pyarrow" if PYARROW_AVAILABLE else "auto",
        compression=compression if compression != "none" else None,
        index=False,
    )
    
    # Compute checksum
    checksum = _compute_file_checksum(output_path)
    file_size = output_path.stat().st_size
    
    logger.info(f"Wrote {len(df)} rows to {output_path} ({file_size} bytes)")
    
    return WriteResult(
        output_path=str(output_path),
        format="parquet",
        partitioned=False,
        partition_paths=[str(output_path)],
        row_count=len(df),
        column_count=len(df.columns),
        total_bytes=file_size,
        checksum=checksum,
        compression=compression,
    )


def _write_dask_dataframe(
    ddf: "dd.DataFrame",
    output_dir: Path,
    filename: str,
    compression: str,
) -> WriteResult:
    """Write a Dask DataFrame to partitioned Parquet files."""
    if not DASK_AVAILABLE or dd is None:
        raise ValueError("Dask is not available")
    
    partition_dir = output_dir / filename
    partition_dir.mkdir(parents=True, exist_ok=True)
    
    # Write partitioned Parquet
    ddf.to_parquet(
        str(partition_dir),
        engine="pyarrow" if PYARROW_AVAILABLE else "auto",
        compression=compression if compression != "none" else None,
        write_index=False,
        name_function=lambda i: f"part-{i:05d}.parquet",
    )
    
    # Gather partition info
    partition_paths = sorted([
        str(p) for p in partition_dir.glob("*.parquet")
    ])
    
    # Compute totals
    total_bytes = sum(Path(p).stat().st_size for p in partition_paths)
    row_count = len(ddf)  # This triggers computation
    column_count = len(ddf.columns)
    
    # Compute manifest checksum (hash of all partition checksums)
    partition_checksums = [_compute_file_checksum(Path(p)) for p in partition_paths]
    manifest_checksum = hashlib.sha256(
        "".join(partition_checksums).encode()
    ).hexdigest()
    
    logger.info(
        f"Wrote {row_count} rows across {len(partition_paths)} partitions "
        f"to {partition_dir} ({total_bytes} bytes)"
    )
    
    return WriteResult(
        output_path=str(partition_dir),
        format="parquet",
        partitioned=True,
        partition_paths=partition_paths,
        row_count=row_count,
        column_count=column_count,
        total_bytes=total_bytes,
        checksum=manifest_checksum,
        compression=compression,
    )


def _write_chunk_iterator(
    reader: "pd.io.parsers.readers.TextFileReader",
    output_dir: Path,
    filename: str,
    compression: str,
) -> WriteResult:
    """Write chunked data to partitioned Parquet files.
    
    Each chunk is written as a separate partition file.
    Note: This consumes the iterator.
    """
    partition_dir = output_dir / filename
    partition_dir.mkdir(parents=True, exist_ok=True)
    
    partition_paths: List[str] = []
    total_rows = 0
    column_count = 0
    
    for i, chunk_df in enumerate(reader):
        partition_path = partition_dir / f"part-{i:05d}.parquet"
        
        # Write chunk to Parquet
        chunk_df.to_parquet(
            partition_path,
            engine="pyarrow" if PYARROW_AVAILABLE else "auto",
            compression=compression if compression != "none" else None,
            index=False,
        )
        
        partition_paths.append(str(partition_path))
        total_rows += len(chunk_df)
        
        if column_count == 0:
            column_count = len(chunk_df.columns)
        
        logger.debug(f"Wrote chunk {i}: {len(chunk_df)} rows to {partition_path}")
    
    # Compute totals
    total_bytes = sum(Path(p).stat().st_size for p in partition_paths)
    
    # Compute manifest checksum
    partition_checksums = [_compute_file_checksum(Path(p)) for p in partition_paths]
    manifest_checksum = hashlib.sha256(
        "".join(partition_checksums).encode()
    ).hexdigest()
    
    logger.info(
        f"Wrote {total_rows} rows across {len(partition_paths)} partitions "
        f"to {partition_dir} ({total_bytes} bytes)"
    )
    
    return WriteResult(
        output_path=str(partition_dir),
        format="parquet",
        partitioned=True,
        partition_paths=partition_paths,
        row_count=total_rows,
        column_count=column_count,
        total_bytes=total_bytes,
        checksum=manifest_checksum,
        compression=compression,
    )


def _compute_file_checksum(path: Path) -> str:
    """Compute SHA-256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def write_manifest(
    write_result: WriteResult,
    output_path: Union[str, Path],
    *,
    job_id: Optional[str] = None,
    additional_metadata: Optional[dict] = None,
) -> Path:
    """Write a JSON manifest file describing the output.
    
    Args:
        write_result: WriteResult from write_cleaned()
        output_path: Path for manifest JSON file
        job_id: Optional job identifier
        additional_metadata: Optional additional metadata to include
        
    Returns:
        Path to the written manifest file
    """
    import json
    
    output_path = Path(output_path)
    
    manifest = {
        "version": "1.0.0",
        "job_id": job_id,
        "created_at": write_result.created_at,
        "output": write_result.to_dict(),
    }
    
    if additional_metadata:
        manifest["metadata"] = additional_metadata
    
    with open(output_path, "w") as f:
        json.dump(manifest, f, indent=2)
    
    logger.info(f"Wrote manifest to {output_path}")
    return output_path


def cleanup_output(output_path: Union[str, Path]) -> None:
    """Remove output files or directory.
    
    Safely removes single files or partition directories.
    """
    output_path = Path(output_path)
    
    if output_path.is_file():
        output_path.unlink()
        logger.info(f"Removed file: {output_path}")
    elif output_path.is_dir():
        shutil.rmtree(output_path)
        logger.info(f"Removed directory: {output_path}")

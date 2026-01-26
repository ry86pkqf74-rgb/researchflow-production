"""
Ingestion Configuration Module

Provides configuration for large-data ingestion with Dask and chunked processing.

Environment Variables:
- LARGE_FILE_BYTES: Threshold for large file handling (default: 50MB)
- CHUNK_SIZE_ROWS: Rows per chunk for pandas fallback (default: 500,000)
- DASK_ENABLED: Enable Dask distributed processing (default: false)
- DASK_BLOCKSIZE_BYTES: Block size for Dask read_csv (default: 64MB)
- DASK_WORKERS: Number of Dask workers (default: 4)
- DASK_THREADS_PER_WORKER: Threads per worker (default: 2)
- DASK_MEMORY_LIMIT: Memory limit per worker (default: 4GB)
- DASK_SCHEDULER_ADDR: External Dask scheduler address (optional)
- MAX_PARQUET_FILE_SIZE: Max partition file size (default: 100MB)

Last Updated: 2026-01-23
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional


def _parse_bytes(value: Optional[str]) -> Optional[int]:
    """Parse byte size string (e.g., '64MB', '1GB') to integer."""
    if not value:
        return None
    
    value = value.strip().upper()
    
    # Order matters: check longer suffixes first
    multipliers = [
        ('TB', 1024 ** 4),
        ('GB', 1024 ** 3),
        ('MB', 1024 ** 2),
        ('KB', 1024),
        ('B', 1),
    ]
    
    for suffix, multiplier in multipliers:
        if value.endswith(suffix):
            try:
                num = float(value[:-len(suffix)].strip())
                return int(num * multiplier)
            except ValueError:
                return None
    
    # Try parsing as raw integer
    try:
        return int(value)
    except ValueError:
        return None


@dataclass(frozen=True)
class IngestionConfig:
    """Configuration for large-data ingestion.
    
    Attributes:
        large_file_bytes: File size threshold above which streaming or Dask is used.
        chunk_size_rows: Number of rows per chunk for pandas chunked reading.
        dask_enabled: Whether to use Dask for large file processing.
        dask_blocksize_bytes: Block size for Dask read_csv partitions.
        dask_workers: Number of Dask worker processes.
        dask_threads_per_worker: Threads per Dask worker.
        dask_memory_limit: Memory limit per Dask worker.
        dask_scheduler_addr: External Dask scheduler address (optional).
        max_parquet_file_size: Maximum size for individual Parquet partitions.
    """
    
    large_file_bytes: int = 50 * 1024 * 1024  # 50 MB
    chunk_size_rows: int = 500_000
    dask_enabled: bool = False
    dask_blocksize_bytes: Optional[int] = 64 * 1024 * 1024  # 64 MB
    dask_workers: int = 4
    dask_threads_per_worker: int = 2
    dask_memory_limit: str = "4GB"
    dask_scheduler_addr: Optional[str] = None
    max_parquet_file_size: int = 100 * 1024 * 1024  # 100 MB
    
    @classmethod
    def from_env(cls) -> "IngestionConfig":
        """Load configuration from environment variables.
        
        Returns:
            IngestionConfig with values from environment or defaults.
        """
        return cls(
            large_file_bytes=int(
                os.getenv("LARGE_FILE_BYTES", str(50 * 1024 * 1024))
            ),
            chunk_size_rows=int(
                os.getenv("CHUNK_SIZE_ROWS", "500000")
            ),
            dask_enabled=os.getenv("DASK_ENABLED", "false").lower() == "true",
            dask_blocksize_bytes=_parse_bytes(
                os.getenv("DASK_BLOCKSIZE_BYTES", "64MB")
            ),
            dask_workers=int(
                os.getenv("DASK_WORKERS", "4")
            ),
            dask_threads_per_worker=int(
                os.getenv("DASK_THREADS_PER_WORKER", "2")
            ),
            dask_memory_limit=os.getenv("DASK_MEMORY_LIMIT", "4GB"),
            dask_scheduler_addr=os.getenv("DASK_SCHEDULER_ADDR") or None,
            max_parquet_file_size=int(
                os.getenv("MAX_PARQUET_FILE_SIZE", str(100 * 1024 * 1024))
            ),
        )


# Module-level singleton for easy access
_config: Optional[IngestionConfig] = None


def get_ingestion_config() -> IngestionConfig:
    """Get the singleton ingestion configuration.
    
    Returns:
        IngestionConfig loaded from environment.
    """
    global _config
    if _config is None:
        _config = IngestionConfig.from_env()
    return _config


def reset_config() -> None:
    """Reset the configuration singleton (for testing)."""
    global _config
    _config = None


# Auto-refinement configuration for AI self-improvement loop
@dataclass(frozen=True)
class AutoRefineConfig:
    """Configuration for AI self-improvement loop.
    
    Attributes:
        auto_refine_enabled: Enable the self-improvement loop.
        max_refine_attempts: Maximum number of refinement iterations.
        critic_model: Model tier/name for critique (optional).
        actor_model: Model tier/name for refinement (optional).
    """
    
    auto_refine_enabled: bool = False
    max_refine_attempts: int = 1
    critic_model: Optional[str] = None
    actor_model: Optional[str] = None
    
    @classmethod
    def from_env(cls) -> "AutoRefineConfig":
        """Load configuration from environment variables."""
        return cls(
            auto_refine_enabled=os.getenv(
                "AUTO_REFINE_ENABLED", "false"
            ).lower() == "true",
            max_refine_attempts=int(
                os.getenv("MAX_REFINE_ATTEMPTS", "1")
            ),
            critic_model=os.getenv("CRITIC_MODEL") or None,
            actor_model=os.getenv("ACTOR_MODEL") or None,
        )


_auto_refine_config: Optional[AutoRefineConfig] = None


def get_auto_refine_config() -> AutoRefineConfig:
    """Get the singleton auto-refine configuration."""
    global _auto_refine_config
    if _auto_refine_config is None:
        _auto_refine_config = AutoRefineConfig.from_env()
    return _auto_refine_config


def reset_auto_refine_config() -> None:
    """Reset the auto-refine configuration singleton (for testing)."""
    global _auto_refine_config
    _auto_refine_config = None

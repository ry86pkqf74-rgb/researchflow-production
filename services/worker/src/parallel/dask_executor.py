"""
Dask Executor for Parallel Processing

Provides distributed computing capabilities using Dask.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union

logger = logging.getLogger(__name__)

# Feature flags
DASK_ENABLED = os.getenv("DASK_ENABLED", "false").lower() == "true"
DASK_WORKERS = int(os.getenv("DASK_WORKERS", "4"))
DASK_THREADS_PER_WORKER = int(os.getenv("DASK_THREADS_PER_WORKER", "2"))
DASK_MEMORY_LIMIT = os.getenv("DASK_MEMORY_LIMIT", "4GB")

T = TypeVar("T")
R = TypeVar("R")


@dataclass
class DaskConfig:
    """Configuration for Dask executor."""
    n_workers: int = DASK_WORKERS
    threads_per_worker: int = DASK_THREADS_PER_WORKER
    memory_limit: str = DASK_MEMORY_LIMIT
    scheduler: str = "threads"  # threads, processes, synchronous, distributed
    dashboard_address: Optional[str] = None  # e.g., ":8787"


class DaskExecutor:
    """
    Dask-based parallel executor.

    Supports:
    - Local threading
    - Local processes
    - Distributed computing (with dask.distributed)
    """

    def __init__(self, config: Optional[DaskConfig] = None):
        self.config = config or DaskConfig()
        self._client = None
        self._cluster = None
        self._available = None

    def is_available(self) -> bool:
        """Check if Dask is available."""
        if self._available is not None:
            return self._available

        if not DASK_ENABLED:
            self._available = False
            return False

        try:
            import dask
            self._available = True
        except ImportError:
            self._available = False

        return self._available

    def _get_client(self):
        """Get or create a Dask client."""
        if self._client is not None:
            return self._client

        if not self.is_available():
            raise RuntimeError("Dask is not available")

        if self.config.scheduler == "distributed":
            try:
                from dask.distributed import Client, LocalCluster

                # Create local cluster
                self._cluster = LocalCluster(
                    n_workers=self.config.n_workers,
                    threads_per_worker=self.config.threads_per_worker,
                    memory_limit=self.config.memory_limit,
                    dashboard_address=self.config.dashboard_address,
                )
                self._client = Client(self._cluster)
                logger.info(f"Started Dask distributed client: {self._client}")
            except ImportError:
                logger.warning("dask.distributed not available, falling back to threads")
                self.config.scheduler = "threads"

        return self._client

    def shutdown(self):
        """Shutdown the Dask client and cluster."""
        if self._client is not None:
            try:
                self._client.close()
            except Exception as e:
                logger.warning(f"Error closing Dask client: {e}")
            self._client = None

        if self._cluster is not None:
            try:
                self._cluster.close()
            except Exception as e:
                logger.warning(f"Error closing Dask cluster: {e}")
            self._cluster = None

    def map(
        self,
        func: Callable[[T], R],
        items: List[T],
        **kwargs,
    ) -> List[R]:
        """
        Apply a function to each item in parallel.

        Args:
            func: Function to apply
            items: List of items to process
            **kwargs: Additional arguments passed to func

        Returns:
            List of results
        """
        if not self.is_available():
            # Fallback to sequential processing
            return [func(item, **kwargs) for item in items]

        import dask

        # Create delayed tasks
        delayed_results = [dask.delayed(func)(item, **kwargs) for item in items]

        # Execute with configured scheduler
        results = dask.compute(*delayed_results, scheduler=self.config.scheduler)

        return list(results)

    def map_partitions(
        self,
        func: Callable[[List[T]], List[R]],
        items: List[T],
        n_partitions: Optional[int] = None,
        **kwargs,
    ) -> List[R]:
        """
        Apply a function to partitions of items.

        Args:
            func: Function to apply to each partition
            items: List of items to process
            n_partitions: Number of partitions (default: n_workers)
            **kwargs: Additional arguments passed to func

        Returns:
            Flattened list of results
        """
        if not self.is_available():
            return func(items, **kwargs)

        import dask
        import dask.bag as db

        n_parts = n_partitions or self.config.n_workers

        # Create bag and partition
        bag = db.from_sequence(items, npartitions=n_parts)

        # Apply function to partitions
        result_bag = bag.map_partitions(lambda part: func(list(part), **kwargs))

        # Compute results
        results = result_bag.compute(scheduler=self.config.scheduler)

        # Flatten if needed
        if results and isinstance(results[0], list):
            return [item for sublist in results for item in sublist]

        return list(results)

    def dataframe_apply(
        self,
        df,
        func: Callable,
        axis: int = 0,
        meta: Optional[Any] = None,
        **kwargs,
    ):
        """
        Apply a function to a DataFrame in parallel.

        Args:
            df: pandas or dask DataFrame
            func: Function to apply
            axis: 0 for columns, 1 for rows
            meta: Output metadata for dask
            **kwargs: Additional arguments

        Returns:
            Processed DataFrame
        """
        if not self.is_available():
            return df.apply(func, axis=axis, **kwargs)

        import dask.dataframe as dd

        # Convert to dask DataFrame if needed
        if hasattr(df, "compute"):
            ddf = df
        else:
            ddf = dd.from_pandas(df, npartitions=self.config.n_workers)

        # Apply function
        if meta is not None:
            result = ddf.apply(func, axis=axis, meta=meta, **kwargs)
        else:
            result = ddf.apply(func, axis=axis, **kwargs)

        # Compute and return
        return result.compute(scheduler=self.config.scheduler)

    def read_csv_parallel(
        self,
        file_paths: Union[str, List[str]],
        **kwargs,
    ):
        """
        Read CSV files in parallel.

        Args:
            file_paths: Path pattern or list of file paths
            **kwargs: Arguments passed to dask.dataframe.read_csv

        Returns:
            Dask DataFrame
        """
        if not self.is_available():
            import pandas as pd
            if isinstance(file_paths, list):
                return pd.concat([pd.read_csv(f, **kwargs) for f in file_paths])
            return pd.read_csv(file_paths, **kwargs)

        import dask.dataframe as dd
        return dd.read_csv(file_paths, **kwargs)

    def to_parquet_parallel(
        self,
        df,
        path: str,
        **kwargs,
    ):
        """
        Write DataFrame to Parquet in parallel.

        Args:
            df: DataFrame to write
            path: Output path
            **kwargs: Arguments passed to to_parquet
        """
        if not self.is_available():
            df.to_parquet(path, **kwargs)
            return

        import dask.dataframe as dd

        if hasattr(df, "to_parquet"):
            if hasattr(df, "compute"):
                # Already a dask dataframe
                df.to_parquet(path, **kwargs)
            else:
                # Convert pandas to dask
                ddf = dd.from_pandas(df, npartitions=self.config.n_workers)
                ddf.to_parquet(path, **kwargs)

    def __enter__(self):
        """Context manager entry."""
        if self.config.scheduler == "distributed":
            self._get_client()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.shutdown()
        return False


def is_dask_available() -> bool:
    """Check if Dask is available."""
    executor = DaskExecutor()
    return executor.is_available()


def parallel_map(
    func: Callable[[T], R],
    items: List[T],
    n_workers: Optional[int] = None,
    **kwargs,
) -> List[R]:
    """
    Apply a function to items in parallel using Dask.

    Args:
        func: Function to apply
        items: List of items
        n_workers: Number of workers (default: from config)
        **kwargs: Additional arguments

    Returns:
        List of results
    """
    config = DaskConfig(n_workers=n_workers) if n_workers else None
    executor = DaskExecutor(config)
    return executor.map(func, items, **kwargs)


def parallel_dataframe_apply(
    df,
    func: Callable,
    axis: int = 0,
    n_workers: Optional[int] = None,
    **kwargs,
):
    """
    Apply a function to a DataFrame in parallel.

    Args:
        df: DataFrame
        func: Function to apply
        axis: 0 for columns, 1 for rows
        n_workers: Number of workers
        **kwargs: Additional arguments

    Returns:
        Processed DataFrame
    """
    config = DaskConfig(n_workers=n_workers) if n_workers else None
    executor = DaskExecutor(config)
    return executor.dataframe_apply(df, func, axis=axis, **kwargs)

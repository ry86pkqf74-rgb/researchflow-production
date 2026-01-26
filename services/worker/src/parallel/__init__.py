"""
Parallel Processing Module

Provides Dask-based parallelization for data processing tasks.
"""

from .dask_executor import (
    DaskExecutor,
    DaskConfig,
    is_dask_available,
    parallel_map,
    parallel_dataframe_apply,
)

__all__ = [
    "DaskExecutor",
    "DaskConfig",
    "is_dask_available",
    "parallel_map",
    "parallel_dataframe_apply",
]

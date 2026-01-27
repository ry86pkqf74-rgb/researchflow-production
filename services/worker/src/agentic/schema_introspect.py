"""
Schema Introspector

Extracts metadata from datasets WITHOUT exposing PHI.
Only provides column names, types, and aggregate statistics.
"""

import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
import pandas as pd
import numpy as np

from .models import ColumnProfile, DatasetProfile, ColumnType

logger = logging.getLogger(__name__)


class SchemaIntrospector:
    """
    Introspects dataset schema without exposing PHI.

    Only extracts:
    - Column names and types
    - Null counts
    - Cardinality (unique values count)
    - Numeric statistics (mean, std, min, max)

    NEVER extracts:
    - Actual data values
    - Sample rows
    - Individual records
    """

    def __init__(self, max_categories: int = 20):
        """
        Initialize the introspector.

        Args:
            max_categories: Maximum categories to report for categorical columns
        """
        self.max_categories = max_categories

    def profile_dataset(
        self,
        df: pd.DataFrame,
        dataset_id: str
    ) -> DatasetProfile:
        """
        Profile a dataset (metadata only).

        Args:
            df: DataFrame to profile
            dataset_id: Dataset identifier

        Returns:
            DatasetProfile with metadata
        """
        columns = []

        for col in df.columns:
            col_profile = self.profile_column(df[col], col)
            columns.append(col_profile)

        return DatasetProfile(
            dataset_id=dataset_id,
            row_count=len(df),
            column_count=len(df.columns),
            columns=columns,
            memory_usage_mb=df.memory_usage(deep=True).sum() / 1024 / 1024
        )

    def profile_column(
        self,
        series: pd.Series,
        name: str
    ) -> ColumnProfile:
        """
        Profile a single column (metadata only).

        Args:
            series: Pandas Series
            name: Column name

        Returns:
            ColumnProfile with metadata
        """
        dtype = str(series.dtype)
        null_count = int(series.isna().sum())
        null_percent = float(null_count / len(series) * 100) if len(series) > 0 else 0.0
        unique_count = int(series.nunique())

        # Determine column type
        column_type = self._infer_column_type(series)

        profile = ColumnProfile(
            name=name,
            dtype=dtype,
            column_type=column_type,
            null_count=null_count,
            null_percent=round(null_percent, 2),
            unique_count=unique_count
        )

        # Add numeric statistics for numeric columns
        if column_type == ColumnType.NUMERIC:
            numeric_series = pd.to_numeric(series, errors="coerce")
            profile.mean = self._safe_stat(numeric_series.mean)
            profile.std = self._safe_stat(numeric_series.std)
            profile.min_val = self._safe_stat(numeric_series.min)
            profile.max_val = self._safe_stat(numeric_series.max)
            profile.median = self._safe_stat(numeric_series.median)

        # Add category info for categorical columns (names only, no values)
        if column_type == ColumnType.CATEGORICAL:
            if unique_count <= self.max_categories:
                # Only report category NAMES, not counts (to avoid PHI exposure)
                value_counts = series.value_counts()
                profile.top_categories = [str(c) for c in value_counts.head(self.max_categories).index.tolist()]
                # Report counts as they're aggregate statistics, not PHI
                profile.category_counts = {
                    str(k): int(v) for k, v in value_counts.head(self.max_categories).items()
                }

        return profile

    def _infer_column_type(self, series: pd.Series) -> ColumnType:
        """
        Infer the statistical type of a column.

        Args:
            series: Pandas Series

        Returns:
            ColumnType
        """
        dtype = series.dtype

        # Boolean
        if dtype == bool or series.dropna().isin([True, False, 0, 1]).all():
            return ColumnType.BOOLEAN

        # Numeric
        if pd.api.types.is_numeric_dtype(dtype):
            return ColumnType.NUMERIC

        # Datetime
        if pd.api.types.is_datetime64_any_dtype(dtype):
            return ColumnType.DATETIME

        # Try to parse as numeric
        try:
            pd.to_numeric(series.dropna(), errors="raise")
            return ColumnType.NUMERIC
        except (ValueError, TypeError):
            pass

        # Categorical (low cardinality strings)
        unique_ratio = series.nunique() / len(series) if len(series) > 0 else 1
        if unique_ratio < 0.1 and series.nunique() <= 50:
            return ColumnType.CATEGORICAL

        # Default to text
        return ColumnType.TEXT

    def _safe_stat(self, func) -> Optional[float]:
        """
        Safely compute a statistic, returning None on error.

        Args:
            func: Function to call

        Returns:
            Result or None
        """
        try:
            result = func()
            if pd.isna(result) or np.isinf(result):
                return None
            return round(float(result), 6)
        except Exception:
            return None

    def get_metadata_for_ai(
        self,
        profile: DatasetProfile
    ) -> Dict[str, Any]:
        """
        Get PHI-safe metadata for sending to AI.

        Args:
            profile: Dataset profile

        Returns:
            Dictionary safe for external AI
        """
        return {
            "datasetId": profile.dataset_id,
            "rowCount": profile.row_count,
            "columnCount": profile.column_count,
            "columns": [
                {
                    "name": col.name,
                    "type": col.dtype,
                    "statisticalType": col.column_type.value,
                    "nullPercent": col.null_percent,
                    "uniqueCount": col.unique_count,
                    "isNumeric": col.column_type == ColumnType.NUMERIC,
                    "isCategorical": col.column_type == ColumnType.CATEGORICAL,
                }
                for col in profile.columns
            ]
        }

    def load_dataset(
        self,
        dataset_id: str,
        dataset_path: Optional[str] = None,
        data_dir: str = "/app/data"
    ) -> pd.DataFrame:
        """
        Load a dataset from various locations.

        Args:
            dataset_id: Dataset identifier
            dataset_path: Optional explicit path
            data_dir: Base data directory

        Returns:
            Loaded DataFrame
        """
        if dataset_path:
            path = Path(dataset_path)
            if not path.exists():
                raise FileNotFoundError(f"Dataset not found: {dataset_path}")
        else:
            # Search common locations
            possible_paths = [
                Path(data_dir) / f"{dataset_id}.csv",
                Path(data_dir) / f"{dataset_id}.parquet",
                Path(data_dir) / "uploads" / f"{dataset_id}.csv",
                Path("/app/uploads") / f"{dataset_id}.csv",
                Path("/data") / f"{dataset_id}.csv",
                Path("/data/artifacts") / f"{dataset_id}.csv",
            ]

            path = None
            for p in possible_paths:
                if p.exists():
                    path = p
                    logger.info(f"Found dataset at: {path}")
                    break

            if not path:
                raise FileNotFoundError(
                    f"Dataset not found: {dataset_id}. "
                    f"Searched: {[str(p) for p in possible_paths]}"
                )

        # Load based on extension
        ext = path.suffix.lower()
        if ext == ".csv":
            return pd.read_csv(path)
        elif ext == ".tsv":
            return pd.read_csv(path, sep="\t")
        elif ext == ".parquet":
            return pd.read_parquet(path)
        elif ext in [".xlsx", ".xls"]:
            return pd.read_excel(path)
        else:
            return pd.read_csv(path)


# Singleton instance
schema_introspector = SchemaIntrospector()

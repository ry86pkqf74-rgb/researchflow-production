"""Dataset loading and export utilities.

This module provides filesystem-based dataset loading that works with the
metadata-only DatasetRegistry. It locates dataset files in quarantine or
promoted directories and loads them as pandas DataFrames for export.

Key functions:
- get_dataset_path(): Locate dataset directory based on status
- find_dataset_file(): Find data file in dataset directory
- load_dataset_df(): Load DataFrame from filesystem using registry metadata
- export_dataset_to_bytes(): Convert DataFrame to bytes for download
"""

import io
from pathlib import Path
from typing import Optional

import pandas as pd

from .exceptions import (
    DatasetNotFoundError,
    DatasetFileNotFoundError,
    DatasetLoadError,
    UnsupportedFormatError,
)
from .registry import DatasetRegistry


# Base directory for dataset storage
BASE_DIR = Path(".tmp")


def get_dataset_path(dataset_id: str, status: str) -> Optional[Path]:
    """Locate dataset directory based on status.

    Args:
        dataset_id: UUID of dataset
        status: Dataset status ("QUARANTINED", "PROMOTED", or "ARCHIVED")

    Returns:
        Path to dataset directory, or None if not found

    Examples:
        >>> get_dataset_path("abc-123", "QUARANTINED")
        Path('.tmp/quarantine/abc-123')
        >>> get_dataset_path("xyz-789", "PROMOTED")
        Path('.tmp/datasets/xyz-789')
        >>> get_dataset_path("old-123", "ARCHIVED")
        Path('.tmp/archive/old-123')
    """
    if status == "QUARANTINED":
        candidate = BASE_DIR / "quarantine" / dataset_id
    elif status == "PROMOTED":
        candidate = BASE_DIR / "datasets" / dataset_id
    elif status == "ARCHIVED":
        candidate = BASE_DIR / "archive" / dataset_id
    else:
        return None

    # Resolve to absolute path and check existence
    candidate = candidate.resolve()
    return candidate if candidate.exists() and candidate.is_dir() else None


def find_dataset_file(dataset_path: Path) -> Optional[Path]:
    """Find the first data file (CSV or Parquet) in dataset directory.

    Searches for files with .csv or .parquet extensions in the dataset
    directory. Returns the first match found, preferring CSV if both exist.

    Args:
        dataset_path: Directory containing dataset

    Returns:
        Path to data file, or None if not found

    Examples:
        >>> path = Path('.tmp/quarantine/abc-123')
        >>> find_dataset_file(path)
        Path('.tmp/quarantine/abc-123/data.csv')
    """
    if not dataset_path.exists() or not dataset_path.is_dir():
        return None

    # Check for CSV files first
    csv_files = list(dataset_path.glob("*.csv"))
    if csv_files:
        return csv_files[0]

    # Check for Parquet files
    parquet_files = list(dataset_path.glob("*.parquet"))
    if parquet_files:
        return parquet_files[0]

    return None


def load_dataset_df(dataset_id: str, registry: DatasetRegistry) -> pd.DataFrame:
    """Load dataset DataFrame from filesystem using registry metadata.

    This function:
    1. Looks up the dataset in the registry to get its status
    2. Locates the dataset directory based on status
    3. Finds the data file (CSV or Parquet)
    4. Loads the file into a pandas DataFrame
    5. Returns the DataFrame for export

    Args:
        dataset_id: UUID of dataset
        registry: DatasetRegistry instance

    Returns:
        pandas DataFrame with dataset contents

    Raises:
        DatasetNotFoundError: Dataset not in registry
        DatasetFileNotFoundError: Files not found on filesystem
        DatasetLoadError: Cannot parse file

    Examples:
        >>> registry = DatasetRegistry()
        >>> df = load_dataset_df("abc-123", registry)
        >>> print(df.shape)
        (150, 5)
    """
    # Look up dataset in registry
    record = registry.get_dataset(dataset_id)
    if record is None:
        raise DatasetNotFoundError(
            f"Dataset {dataset_id} not found in registry. "
            "Please check the dataset ID and try again."
        )

    # Locate dataset directory
    dataset_path = get_dataset_path(dataset_id, record.status)
    if dataset_path is None:
        raise DatasetFileNotFoundError(
            f"Dataset directory not found for {dataset_id} "
            f"with status {record.status}. "
            "Ensure the dataset has been materialized to the expected storage location."
        )

    # Find data file
    data_file = find_dataset_file(dataset_path)
    if data_file is None:
        raise DatasetFileNotFoundError(
            f"No data files found in {dataset_path}. " "Expected .csv or .parquet file."
        )

    # Load file based on extension
    try:
        if data_file.suffix.lower() == ".csv":
            df = pd.read_csv(data_file)
        elif data_file.suffix.lower() == ".parquet":
            df = pd.read_parquet(data_file)
        else:
            raise DatasetLoadError(
                f"Unsupported file format: {data_file.suffix}. "
                "Only .csv and .parquet files are supported."
            )
    except (pd.errors.ParserError, pd.errors.EmptyDataError) as e:
        raise DatasetLoadError(
            f"Cannot parse data file {data_file.name}: {str(e)}. "
            "The file may be corrupted or in an invalid format."
        ) from e
    except Exception as e:
        raise DatasetLoadError(
            f"Error loading dataset from {data_file.name}: {str(e)}"
        ) from e

    return df


def export_dataset_to_bytes(df: pd.DataFrame, format: str) -> bytes:
    """Convert DataFrame to bytes for download.

    Args:
        df: pandas DataFrame to export
        format: Export format ('csv' or 'parquet')

    Returns:
        Bytes suitable for st.download_button()

    Raises:
        UnsupportedFormatError: Format not supported

    Examples:
        >>> df = pd.DataFrame({'a': [1, 2, 3]})
        >>> csv_bytes = export_dataset_to_bytes(df, 'csv')
        >>> len(csv_bytes) > 0
        True
    """
    format_lower = format.lower()

    if format_lower == "csv":
        # Export as CSV with UTF-8 encoding
        return df.to_csv(index=False).encode("utf-8")
    elif format_lower == "parquet":
        # Export as Parquet using BytesIO buffer
        buffer = io.BytesIO()
        df.to_parquet(buffer, index=False, engine="pyarrow")
        return buffer.getvalue()
    else:
        raise UnsupportedFormatError(
            f"Export format '{format}' not supported. "
            "Supported formats: 'csv', 'parquet'"
        )

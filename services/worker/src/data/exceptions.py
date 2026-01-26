"""Custom exceptions for dataset operations.

This module defines specific exception classes for dataset loading and export
operations. These exceptions provide clear error messaging and allow for
granular error handling in the export page UI.
"""


class DatasetError(Exception):
    """Base exception for dataset operations."""

    pass


class DatasetNotFoundError(DatasetError):
    """Dataset ID not found in registry.

    Raised when attempting to load a dataset that doesn't exist in the
    DatasetRegistry.
    """

    pass


class DatasetFileNotFoundError(DatasetError):
    """Registry entry exists but files not found on filesystem.

    Raised when a dataset is registered but its corresponding data files
    cannot be found in the expected quarantine or promoted directories.
    """

    pass


class DatasetLoadError(DatasetError):
    """File exists but cannot be loaded/parsed.

    Raised when a dataset file exists but pandas cannot parse it,
    typically due to corruption or invalid format.
    """

    pass


class UnsupportedFormatError(DatasetError):
    """Requested export format not supported.

    Raised when attempting to export a dataset in a format that is not
    supported (e.g., not CSV or Parquet).
    """

    pass

"""
Parquet metadata completeness validator.

Validates that Parquet files have required embedded metadata (schema_id, schema_version).
Wraps existing src/validation/schema_version_metadata.py functionality.

This validator ensures that Parquet artifacts include schema version metadata for provenance tracking.
"""

import pyarrow.parquet as pq
from pathlib import Path
from typing import List, Union

from .base import BaseValidator, ValidatorResult


class ParquetMetadataValidator(BaseValidator):
    """
    Validator for Parquet file embedded metadata.

    Checks that Parquet files contain required metadata keys:
    - schema_id: Identifier for the schema used
    - schema_version: Version of the schema (e.g., "v1.0.0")

    This enables provenance tracking and schema evolution management.
    """

    def __init__(self, required_fields: List[str] = None):
        """
        Initialize Parquet metadata validator.

        Args:
            required_fields: List of required metadata keys
                           (default: ["schema_id", "schema_version"])
        """
        self.required_fields = required_fields or ["schema_id", "schema_version"]

    def is_offline_safe(self) -> bool:
        """Parquet metadata check is offline-safe (local file read)."""
        return True

    def _get_parquet_metadata(self, file_path: Path) -> dict:
        """
        Extract custom metadata from Parquet file.

        Args:
            file_path: Path to Parquet file

        Returns:
            Dict of custom metadata (key-value pairs)

        Raises:
            FileNotFoundError: If file does not exist
            ValueError: If file is not a valid Parquet file
        """
        if not file_path.exists():
            raise FileNotFoundError(f"Parquet file not found: {file_path}")

        try:
            # Read Parquet metadata
            parquet_file = pq.ParquetFile(file_path)
            metadata = parquet_file.schema_arrow.metadata

            if metadata is None:
                return {}

            # Decode metadata to strings, handling non-bytes keys/values safely
            decoded_metadata: dict[str, str] = {}
            for k, v in metadata.items():
                # Skip pandas internal metadata only when key is bytes
                if isinstance(k, (bytes, bytearray)):
                    if k.startswith(b"pandas"):
                        continue
                    try:
                        key_str = k.decode("utf-8")
                    except UnicodeDecodeError as decode_err:
                        raise ValueError(f"Parquet metadata key is not valid UTF-8: {decode_err}") from decode_err
                else:
                    # Fallback: use string representation for non-bytes keys
                    key_str = str(k)

                if isinstance(v, (bytes, bytearray)):
                    try:
                        value_str = v.decode("utf-8")
                    except UnicodeDecodeError as decode_err:
                        raise ValueError(f"Parquet metadata value is not valid UTF-8: {decode_err}") from decode_err
                else:
                    # Fallback: use string representation for non-bytes values
                    value_str = str(v)

                decoded_metadata[key_str] = value_str

            return decoded_metadata

        except Exception as e:
            raise ValueError(f"Invalid Parquet file: {e}")

    def _validate_impl(self, artifact: Union[Path, str]) -> ValidatorResult:
        """
        Validate Parquet file metadata completeness.

        Args:
            artifact: Path to Parquet file (str or Path)

        Returns:
            ValidatorResult with:
            - status: "pass" if all required metadata present, "fail" otherwise
            - message: Summary message
            - details: Metadata found and missing fields
        """
        file_path = Path(artifact) if isinstance(artifact, str) else artifact

        try:
            # Extract metadata from Parquet file
            metadata = self._get_parquet_metadata(file_path)

        except (FileNotFoundError, ValueError) as e:
            return ValidatorResult(
                validator_name="ParquetMetadataValidator",
                status="fail",
                message=f"Cannot read Parquet metadata: {str(e)}",
                details={
                    "error": str(e),
                    "file_path": str(file_path),
                    "required_fields": self.required_fields,
                }
            )

        # Check for missing required fields
        missing_fields = [
            field for field in self.required_fields
            if field not in metadata
        ]

        if missing_fields:
            return ValidatorResult(
                validator_name="ParquetMetadataValidator",
                status="fail",
                message=f"Missing required metadata: {', '.join(missing_fields)}",
                details={
                    "file_path": str(file_path),
                    "required_fields": self.required_fields,
                    "missing_fields": missing_fields,
                    "found_metadata": metadata,
                }
            )
        else:
            return ValidatorResult(
                validator_name="ParquetMetadataValidator",
                status="pass",
                message=f"Parquet metadata complete ({len(self.required_fields)} fields validated)",
                details={
                    "file_path": str(file_path),
                    "required_fields": self.required_fields,
                    "metadata": metadata,
                }
            )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"ParquetMetadataValidator(required={self.required_fields}, offline_safe=True)"

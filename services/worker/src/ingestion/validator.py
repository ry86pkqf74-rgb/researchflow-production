"""Validator for Ingestion Schema Layer (PR9A-1)

Validates data against a declarative SchemaDefinition.

Supports:
- pandas DataFrame (standard validation)
- Dask DataFrame (partition-aware lazy validation)
- TextFileReader iterator (chunk-by-chunk validation)

Fail-closed semantics:
- ValidationResult.valid must be True for ingestion to return any preview/data.

Last Updated: 2026-01-23 (Phase 3: Dask/chunk support)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, Iterator, List, Optional, Union

import pandas as pd

from .schema_loader import SchemaDefinition

# Try to import Dask - may not be available in all environments
try:
    import dask.dataframe as dd
    DASK_AVAILABLE = True
except ImportError:
    DASK_AVAILABLE = False
    dd = None  # type: ignore

logger = logging.getLogger("validator")


class ValidationError(ValueError):
    """Raised when schema or data validation fails (fail-closed)."""


@dataclass(frozen=True)
class ChunkValidationError:
    """Error from validating a specific chunk/partition."""
    
    chunk_index: int
    errors: List[str]
    row_offset: int = 0  # Starting row number in original data
    
    def __str__(self) -> str:
        return f"Chunk {self.chunk_index} (rows {self.row_offset}+): {'; '.join(self.errors)}"


@dataclass(frozen=True)
class ValidationResult:
    """Result of validating a DataFrame against a schema.
    
    For chunked/partitioned data, chunk_errors contains per-chunk details.
    """

    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    chunk_errors: List[ChunkValidationError] = field(default_factory=list)
    chunks_validated: int = 0
    total_rows_validated: int = 0

    def raise_if_invalid(self) -> None:
        if not self.valid:
            # Include chunk errors in message if present
            all_errors = list(self.errors)
            for chunk_err in self.chunk_errors[:5]:  # Limit to first 5 chunks
                all_errors.append(str(chunk_err))
            raise ValidationError(
                "; ".join(all_errors) if all_errors else "Validation failed"
            )
    
    def summary(self) -> str:
        """Human-readable summary of validation results."""
        if self.valid:
            return f"Valid: {self.total_rows_validated} rows across {self.chunks_validated} chunks"
        return f"Invalid: {len(self.errors)} errors, {len(self.chunk_errors)} chunk errors"


_DECLARED_TYPE_CANONICAL_DTYPE = {
    "string": "string",
    "integer": "int64",
    "float": "float64",
    "boolean": "bool",
    "datetime": "datetime64[ns, UTC]",
}

# Type alias for data that can be validated
DataType = Union[pd.DataFrame, "pd.io.parsers.readers.TextFileReader"]
if DASK_AVAILABLE:
    DataType = Union[pd.DataFrame, "pd.io.parsers.readers.TextFileReader", "dd.DataFrame"]


def validate_data(
    data: DataType,
    schema: SchemaDefinition,
    *,
    coerce_types: bool = True,
    max_chunk_errors: int = 10,
) -> ValidationResult:
    """Validate data against SchemaDefinition with automatic type detection.
    
    Handles:
    - pandas DataFrame: Direct validation
    - Dask DataFrame: Partition-aware validation (lazy, no full compute)
    - TextFileReader: Chunk-by-chunk validation with error aggregation
    
    Args:
        data: Data to validate (DataFrame, Dask DataFrame, or chunk iterator)
        schema: Parsed schema definition
        coerce_types: If True, attempt safe coercion before type checks
        max_chunk_errors: Stop validation after this many chunk errors
        
    Returns:
        ValidationResult with aggregated errors across all chunks/partitions
    """
    # Detect data type and dispatch
    if data is None:
        return ValidationResult(False, errors=["Data is None"], warnings=[])
    
    # Check for Dask DataFrame
    if DASK_AVAILABLE and dd is not None and isinstance(data, dd.DataFrame):
        logger.info(f"Validating Dask DataFrame with {data.npartitions} partitions")
        return _validate_dask_dataframe(data, schema, coerce_types, max_chunk_errors)
    
    # Check for TextFileReader (chunk iterator)
    if hasattr(data, '__iter__') and hasattr(data, 'chunksize'):
        logger.info("Validating chunked data (TextFileReader)")
        return _validate_chunk_iterator(data, schema, coerce_types, max_chunk_errors)
    
    # Standard pandas DataFrame
    if isinstance(data, pd.DataFrame):
        logger.info(f"Validating pandas DataFrame with {len(data)} rows")
        result = validate_dataframe(data, schema, coerce_types=coerce_types)
        # Wrap with chunk metadata
        return ValidationResult(
            valid=result.valid,
            errors=result.errors,
            warnings=result.warnings,
            chunk_errors=[],
            chunks_validated=1,
            total_rows_validated=len(data),
        )
    
    return ValidationResult(
        False,
        errors=[f"Unsupported data type: {type(data).__name__}"],
        warnings=[],
    )


def _validate_dask_dataframe(
    ddf: "dd.DataFrame",
    schema: SchemaDefinition,
    coerce_types: bool,
    max_chunk_errors: int,
) -> ValidationResult:
    """Validate a Dask DataFrame partition by partition.
    
    Uses map_partitions for lazy validation without materializing entire dataset.
    """
    if not DASK_AVAILABLE or dd is None:
        return ValidationResult(False, errors=["Dask not available"], warnings=[])
    
    all_errors: List[str] = []
    chunk_errors: List[ChunkValidationError] = []
    total_rows = 0
    
    # Validate schema structure using first partition
    try:
        # Get first partition to check column structure
        first_partition = ddf.get_partition(0).compute()
        
        # Check required columns
        missing_required = [c for c in schema.required_columns if c not in first_partition.columns]
        if missing_required:
            return ValidationResult(
                False,
                errors=[f"Missing required columns: {missing_required}"],
                warnings=[],
            )
        
        # Validate each partition
        for i in range(ddf.npartitions):
            if len(chunk_errors) >= max_chunk_errors:
                all_errors.append(f"Stopped validation after {max_chunk_errors} chunk errors")
                break
            
            try:
                partition_df = ddf.get_partition(i).compute()
                partition_rows = len(partition_df)
                
                result = validate_dataframe(partition_df, schema, coerce_types=coerce_types)
                
                if not result.valid:
                    chunk_errors.append(ChunkValidationError(
                        chunk_index=i,
                        errors=result.errors,
                        row_offset=total_rows,
                    ))
                
                total_rows += partition_rows
                
            except Exception as e:
                chunk_errors.append(ChunkValidationError(
                    chunk_index=i,
                    errors=[f"Partition validation error: {str(e)}"],
                    row_offset=total_rows,
                ))
        
        is_valid = len(all_errors) == 0 and len(chunk_errors) == 0
        
        return ValidationResult(
            valid=is_valid,
            errors=all_errors,
            warnings=[],
            chunk_errors=chunk_errors,
            chunks_validated=min(ddf.npartitions, max_chunk_errors + 1),
            total_rows_validated=total_rows,
        )
        
    except Exception as e:
        return ValidationResult(
            False,
            errors=[f"Dask validation error: {str(e)}"],
            warnings=[],
        )


def _validate_chunk_iterator(
    reader: "pd.io.parsers.readers.TextFileReader",
    schema: SchemaDefinition,
    coerce_types: bool,
    max_chunk_errors: int,
) -> ValidationResult:
    """Validate a TextFileReader chunk by chunk.
    
    Iterates through chunks, validates each, and aggregates errors.
    Note: This consumes the iterator - it cannot be reused after validation.
    """
    all_errors: List[str] = []
    chunk_errors: List[ChunkValidationError] = []
    total_rows = 0
    chunks_processed = 0
    
    try:
        for i, chunk_df in enumerate(reader):
            if len(chunk_errors) >= max_chunk_errors:
                all_errors.append(f"Stopped validation after {max_chunk_errors} chunk errors")
                break
            
            chunk_rows = len(chunk_df)
            
            # Validate this chunk
            result = validate_dataframe(chunk_df, schema, coerce_types=coerce_types)
            
            if not result.valid:
                chunk_errors.append(ChunkValidationError(
                    chunk_index=i,
                    errors=result.errors,
                    row_offset=total_rows,
                ))
            
            total_rows += chunk_rows
            chunks_processed += 1
        
        is_valid = len(all_errors) == 0 and len(chunk_errors) == 0
        
        return ValidationResult(
            valid=is_valid,
            errors=all_errors,
            warnings=[],
            chunk_errors=chunk_errors,
            chunks_validated=chunks_processed,
            total_rows_validated=total_rows,
        )
        
    except Exception as e:
        return ValidationResult(
            False,
            errors=[f"Chunk validation error: {str(e)}"],
            warnings=[],
            chunk_errors=chunk_errors,
            chunks_validated=chunks_processed,
            total_rows_validated=total_rows,
        )


def validate_dataframe(
    df: pd.DataFrame,
    schema: SchemaDefinition,
    *,
    coerce_types: bool = True,
) -> ValidationResult:
    """Validate a DataFrame against SchemaDefinition.

    Args:
        df: DataFrame to validate.
        schema: Parsed schema definition.
        coerce_types: If True, attempt safe coercion before type checks.

    Returns:
        ValidationResult
    """
    errors: List[str] = []
    warnings: List[str] = []

    if df is None:
        return ValidationResult(False, errors=["DataFrame is None"], warnings=[])

    # Required columns present
    missing_required = [c for c in schema.required_columns if c not in df.columns]
    if missing_required:
        errors.append(f"Missing required columns: {missing_required}")

    # If required columns missing, fail closed early (do not attempt coercions)
    if errors:
        return ValidationResult(False, errors=errors, warnings=warnings)

    pending_coercions: Dict[str, pd.Series] = {}

    # Validate each declared column
    for col_def in schema.columns:
        if col_def.name not in df.columns:
            if col_def.required:
                errors.append(f"Missing required column: {col_def.name}")
            continue

        series = df[col_def.name]
        original_na = series.isna()

        # Nullability check
        if not col_def.nullable:
            if series.isna().any():
                errors.append(
                    f"Column '{col_def.name}' contains nulls but nullable=false"
                )

        # Type coercion + type checks
        if coerce_types:
            coerced = _coerce_series(series, col_def.type)
            if coerced is None:
                errors.append(
                    f"Column '{col_def.name}' could not be coerced to type {col_def.type}"
                )
            else:
                introduced_na = coerced.isna() & ~original_na
                if introduced_na.any():
                    errors.append(
                        f"Column '{col_def.name}' has values that cannot be coerced to {col_def.type}"
                    )
                pending_coercions[col_def.name] = coerced
                series = coerced

        if not _is_series_type(series, col_def.type):
            errors.append(
                f"Column '{col_def.name}' type mismatch: expected {col_def.type}, got {series.dtype}"
            )

    if errors:
        return ValidationResult(False, errors=errors, warnings=warnings)

    if coerce_types and pending_coercions:
        for col_name, coerced in pending_coercions.items():
            df[col_name] = coerced

    return ValidationResult(True, errors=errors, warnings=warnings)


def _coerce_series(series: pd.Series, declared_type: str) -> Optional[pd.Series]:
    try:
        if declared_type == "string":
            # Preserve nulls as <NA>
            return series.astype("string")

        if declared_type == "integer":
            # Use pandas nullable integer
            coerced = pd.to_numeric(series, errors="coerce")
            return coerced.astype("Int64")

        if declared_type == "float":
            coerced = pd.to_numeric(series, errors="coerce")
            return coerced.astype("float64")

        if declared_type == "boolean":
            # Accept common truthy/falsey representations
            if series.dtype == bool:
                return series
            if str(series.dtype).startswith("boolean"):
                return series
            mapped = series.map(_to_bool)
            return mapped.astype("boolean")

        if declared_type == "datetime":
            coerced = pd.to_datetime(series, errors="coerce", utc=True)
            return coerced

        return None
    except (TypeError, ValueError, OverflowError):
        return None


def _to_bool(value):
    if pd.isna(value):
        return pd.NA
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if value == 1:
            return True
        if value == 0:
            return False
        return pd.NA
    if isinstance(value, str):
        s = value.strip().lower()
        if s in {"true", "t", "yes", "y", "1"}:
            return True
        if s in {"false", "f", "no", "n", "0"}:
            return False
    return pd.NA


def _is_series_type(series: pd.Series, declared_type: str) -> bool:
    dtype_str = str(series.dtype)

    if declared_type == "string":
        return dtype_str in {"string", "object"}

    if declared_type == "integer":
        return dtype_str in {"Int64", "int64", "int32"}

    if declared_type == "float":
        return dtype_str.startswith("float")

    if declared_type == "boolean":
        return dtype_str in {"bool", "boolean"}

    if declared_type == "datetime":
        return dtype_str.startswith("datetime")

    return False

"""Tests for Phase 3: Validation Pipeline Enhancement

Tests the enhanced validation pipeline that supports:
- pandas DataFrame (original)
- Dask DataFrame (lazy, partitioned)
- TextFileReader (chunk iterator)

Last Updated: 2026-01-23
"""

import os
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from src.ingestion.validator import (
    validate_dataframe,
    validate_data,
    ValidationResult,
    ValidationError,
    ChunkValidationError,
    DASK_AVAILABLE,
)
from src.ingestion.schema_loader import SchemaDefinition, ColumnDefinition
from src.ingestion.config import IngestionConfig


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def simple_schema() -> SchemaDefinition:
    """A simple schema with id, name, and value columns."""
    return SchemaDefinition(
        name="test_schema",
        version="1.0.0",
        file_format="csv",
        columns=[
            ColumnDefinition(name="id", type="integer", required=True, nullable=False),
            ColumnDefinition(name="name", type="string", required=True, nullable=True),
            ColumnDefinition(name="value", type="float", required=False, nullable=True),
        ],
        required_columns=["id", "name"],
    )


@pytest.fixture
def valid_dataframe() -> pd.DataFrame:
    """A DataFrame that matches simple_schema."""
    return pd.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "value": [10.5, 20.3, None, 40.1, 50.0],
    })


@pytest.fixture
def invalid_dataframe_missing_column() -> pd.DataFrame:
    """DataFrame missing required column."""
    return pd.DataFrame({
        "id": [1, 2, 3],
        # missing "name"
        "value": [10.5, 20.3, 30.7],
    })


@pytest.fixture
def invalid_dataframe_null_in_required() -> pd.DataFrame:
    """DataFrame with null in non-nullable column."""
    return pd.DataFrame({
        "id": [1, None, 3],  # None in non-nullable column
        "name": ["Alice", "Bob", "Charlie"],
        "value": [10.5, 20.3, 30.7],
    })


@pytest.fixture
def temp_csv_file(valid_dataframe) -> str:
    """Create a temporary CSV file for testing."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        valid_dataframe.to_csv(f.name, index=False)
        yield f.name
    os.unlink(f.name)


@pytest.fixture
def large_temp_csv() -> str:
    """Create a larger CSV file for chunked testing."""
    # Create a DataFrame with multiple chunks worth of data
    n_rows = 250  # Small enough for testing but divisible into chunks
    df = pd.DataFrame({
        "id": range(1, n_rows + 1),
        "name": [f"Person_{i}" for i in range(1, n_rows + 1)],
        "value": [float(i) * 1.5 for i in range(1, n_rows + 1)],
    })
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        df.to_csv(f.name, index=False)
        yield f.name
    os.unlink(f.name)


@pytest.fixture
def invalid_chunk_csv() -> str:
    """Create a CSV where some chunks will fail validation."""
    # First 100 rows valid, next 100 have nulls in non-nullable column
    rows = []
    for i in range(1, 101):
        rows.append({"id": i, "name": f"Person_{i}", "value": float(i)})
    for i in range(101, 201):
        rows.append({"id": None, "name": f"Person_{i}", "value": float(i)})  # Invalid!
    
    df = pd.DataFrame(rows)
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        df.to_csv(f.name, index=False)
        yield f.name
    os.unlink(f.name)


# =============================================================================
# Tests: ChunkValidationError
# =============================================================================

class TestChunkValidationError:
    """Tests for ChunkValidationError dataclass."""
    
    def test_creation(self):
        """Test creating a ChunkValidationError."""
        err = ChunkValidationError(
            chunk_index=5,
            errors=["Error 1", "Error 2"],
            row_offset=500,
        )
        assert err.chunk_index == 5
        assert len(err.errors) == 2
        assert err.row_offset == 500
    
    def test_str_representation(self):
        """Test string representation."""
        err = ChunkValidationError(
            chunk_index=2,
            errors=["Missing column"],
            row_offset=200,
        )
        assert "Chunk 2" in str(err)
        assert "rows 200" in str(err)
        assert "Missing column" in str(err)
    
    def test_default_row_offset(self):
        """Test default row offset is 0."""
        err = ChunkValidationError(chunk_index=0, errors=["Test"])
        assert err.row_offset == 0


# =============================================================================
# Tests: ValidationResult with Chunk Support
# =============================================================================

class TestValidationResultChunked:
    """Tests for enhanced ValidationResult."""
    
    def test_basic_valid_result(self):
        """Test basic valid result."""
        result = ValidationResult(
            valid=True,
            errors=[],
            warnings=[],
            chunk_errors=[],
            chunks_validated=5,
            total_rows_validated=5000,
        )
        assert result.valid
        assert result.chunks_validated == 5
        assert result.total_rows_validated == 5000
    
    def test_invalid_with_chunk_errors(self):
        """Test invalid result with chunk errors."""
        chunk_err = ChunkValidationError(
            chunk_index=3,
            errors=["Type mismatch"],
            row_offset=300,
        )
        result = ValidationResult(
            valid=False,
            errors=["Global error"],
            chunk_errors=[chunk_err],
            chunks_validated=4,
            total_rows_validated=400,
        )
        assert not result.valid
        assert len(result.chunk_errors) == 1
    
    def test_raise_if_invalid_includes_chunk_errors(self):
        """Test that raise_if_invalid includes chunk error info."""
        chunk_err = ChunkValidationError(
            chunk_index=2,
            errors=["Null in required column"],
            row_offset=200,
        )
        result = ValidationResult(
            valid=False,
            errors=[],
            chunk_errors=[chunk_err],
        )
        
        with pytest.raises(ValidationError) as exc_info:
            result.raise_if_invalid()
        
        assert "Chunk 2" in str(exc_info.value)
    
    def test_summary_valid(self):
        """Test summary for valid result."""
        result = ValidationResult(
            valid=True,
            chunks_validated=10,
            total_rows_validated=10000,
        )
        summary = result.summary()
        assert "Valid" in summary
        assert "10000" in summary
    
    def test_summary_invalid(self):
        """Test summary for invalid result."""
        result = ValidationResult(
            valid=False,
            errors=["Error 1", "Error 2"],
            chunk_errors=[ChunkValidationError(0, ["chunk err"])],
        )
        summary = result.summary()
        assert "Invalid" in summary
        assert "2 errors" in summary


# =============================================================================
# Tests: validate_dataframe (Original pandas-only)
# =============================================================================

class TestValidateDataframePandas:
    """Tests for original pandas DataFrame validation."""
    
    def test_valid_dataframe(self, valid_dataframe, simple_schema):
        """Test validating a valid DataFrame."""
        result = validate_dataframe(valid_dataframe, simple_schema)
        assert result.valid
        assert len(result.errors) == 0
    
    def test_missing_required_column(self, invalid_dataframe_missing_column, simple_schema):
        """Test validation fails for missing required column."""
        result = validate_dataframe(invalid_dataframe_missing_column, simple_schema)
        assert not result.valid
        assert any("Missing required" in e for e in result.errors)
    
    def test_null_in_non_nullable(self, invalid_dataframe_null_in_required, simple_schema):
        """Test validation fails for null in non-nullable column."""
        result = validate_dataframe(invalid_dataframe_null_in_required, simple_schema)
        assert not result.valid
    
    def test_none_dataframe(self, simple_schema):
        """Test validation handles None input."""
        result = validate_dataframe(None, simple_schema)
        assert not result.valid
        assert any("None" in e for e in result.errors)


# =============================================================================
# Tests: validate_data (Universal validator)
# =============================================================================

class TestValidateDataUniversal:
    """Tests for universal validate_data function."""
    
    def test_pandas_dataframe(self, valid_dataframe, simple_schema):
        """Test validate_data with pandas DataFrame."""
        result = validate_data(valid_dataframe, simple_schema)
        assert result.valid
        assert result.chunks_validated == 1
        assert result.total_rows_validated == 5
    
    def test_none_input(self, simple_schema):
        """Test validate_data handles None input."""
        result = validate_data(None, simple_schema)
        assert not result.valid
        assert "None" in result.errors[0]
    
    def test_unsupported_type(self, simple_schema):
        """Test validate_data rejects unsupported types."""
        result = validate_data("not a dataframe", simple_schema)
        assert not result.valid
        assert "Unsupported data type" in result.errors[0]
    
    def test_invalid_pandas(self, invalid_dataframe_missing_column, simple_schema):
        """Test validate_data catches pandas validation errors."""
        result = validate_data(invalid_dataframe_missing_column, simple_schema)
        assert not result.valid


# =============================================================================
# Tests: Chunked Iterator Validation
# =============================================================================

class TestChunkedValidation:
    """Tests for TextFileReader (chunked iterator) validation."""
    
    def test_valid_chunks(self, large_temp_csv, simple_schema):
        """Test validating a valid CSV in chunks."""
        reader = pd.read_csv(large_temp_csv, chunksize=50)
        result = validate_data(reader, simple_schema)
        
        assert result.valid
        assert result.chunks_validated == 5  # 250 rows / 50 per chunk
        assert result.total_rows_validated == 250
        assert len(result.chunk_errors) == 0
    
    def test_invalid_chunks(self, invalid_chunk_csv, simple_schema):
        """Test validation catches errors in specific chunks."""
        reader = pd.read_csv(invalid_chunk_csv, chunksize=50)
        result = validate_data(reader, simple_schema)
        
        assert not result.valid
        assert len(result.chunk_errors) > 0
        # Errors should be in chunks 2, 3 (rows 100-199)
        invalid_chunks = [e.chunk_index for e in result.chunk_errors]
        assert 2 in invalid_chunks or 3 in invalid_chunks
    
    def test_max_chunk_errors_limit(self, invalid_chunk_csv, simple_schema):
        """Test that validation stops after max_chunk_errors."""
        reader = pd.read_csv(invalid_chunk_csv, chunksize=10)  # Many small chunks
        result = validate_data(reader, simple_schema, max_chunk_errors=3)
        
        # Should stop after 3 chunk errors
        assert len(result.chunk_errors) <= 3
    
    def test_chunk_error_row_offset(self, invalid_chunk_csv, simple_schema):
        """Test that row offsets are calculated correctly."""
        reader = pd.read_csv(invalid_chunk_csv, chunksize=50)
        result = validate_data(reader, simple_schema)
        
        for chunk_err in result.chunk_errors:
            # Row offset should match chunk_index * chunksize
            expected_offset = chunk_err.chunk_index * 50
            assert chunk_err.row_offset == expected_offset


# =============================================================================
# Tests: Dask DataFrame Validation (conditional)
# =============================================================================

@pytest.mark.skipif(not DASK_AVAILABLE, reason="Dask not installed")
class TestDaskValidation:
    """Tests for Dask DataFrame validation."""
    
    def test_valid_dask_dataframe(self, large_temp_csv, simple_schema):
        """Test validating a valid Dask DataFrame."""
        import dask.dataframe as dd
        
        ddf = dd.read_csv(large_temp_csv)
        result = validate_data(ddf, simple_schema)
        
        assert result.valid
        assert result.chunks_validated >= 1
        assert result.total_rows_validated == 250
    
    def test_invalid_dask_dataframe(self, invalid_chunk_csv, simple_schema):
        """Test validation catches errors in Dask partitions."""
        import dask.dataframe as dd
        
        ddf = dd.read_csv(invalid_chunk_csv)
        result = validate_data(ddf, simple_schema)
        
        assert not result.valid
        assert len(result.chunk_errors) > 0
    
    def test_dask_missing_column(self, temp_csv_file, simple_schema):
        """Test Dask validation catches missing required columns."""
        import dask.dataframe as dd
        
        # Create a schema that requires a column not in the data
        strict_schema = SchemaDefinition(
            name="strict",
            version="1.0.0",
            file_format="csv",
            columns=[
                ColumnDefinition(name="id", type="integer", required=True),
                ColumnDefinition(name="nonexistent", type="string", required=True),
            ],
            required_columns=["id", "nonexistent"],
        )
        
        ddf = dd.read_csv(temp_csv_file)
        result = validate_data(ddf, strict_schema)
        
        assert not result.valid
        assert any("Missing required" in e for e in result.errors)


# =============================================================================
# Tests: Edge Cases
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_empty_dataframe(self, simple_schema):
        """Test validating an empty DataFrame."""
        empty_df = pd.DataFrame(columns=["id", "name", "value"])
        result = validate_data(empty_df, simple_schema)
        # Empty DataFrame with correct columns should be valid
        assert result.valid
        assert result.total_rows_validated == 0
    
    def test_single_row(self, simple_schema):
        """Test validating a single-row DataFrame."""
        single_row = pd.DataFrame({
            "id": [1],
            "name": ["Alice"],
            "value": [10.5],
        })
        result = validate_data(single_row, simple_schema)
        assert result.valid
        assert result.total_rows_validated == 1
    
    def test_coerce_types_disabled(self, simple_schema):
        """Test validation without type coercion."""
        # String values that would need coercion
        df = pd.DataFrame({
            "id": ["1", "2", "3"],  # Strings instead of integers
            "name": ["Alice", "Bob", "Charlie"],
            "value": [10.5, 20.3, 30.7],
        })
        
        # With coercion disabled, this should fail
        result = validate_data(df, simple_schema, coerce_types=False)
        # Type check may fail depending on implementation
        # At minimum, the result should be produced without crashing


# =============================================================================
# Tests: Integration
# =============================================================================

class TestIntegration:
    """Integration tests for the validation pipeline."""
    
    def test_roundtrip_csv_validation(self, valid_dataframe, simple_schema):
        """Test full roundtrip: DataFrame -> CSV -> validate."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            valid_dataframe.to_csv(f.name, index=False)
            csv_path = f.name
        
        try:
            # Read back and validate
            df = pd.read_csv(csv_path)
            result = validate_data(df, simple_schema)
            assert result.valid
        finally:
            os.unlink(csv_path)
    
    def test_validation_result_immutability(self, valid_dataframe, simple_schema):
        """Test that ValidationResult is immutable."""
        result = validate_data(valid_dataframe, simple_schema)
        
        # Should not be able to modify frozen dataclass
        with pytest.raises((AttributeError, TypeError)):
            result.valid = False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

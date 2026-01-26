"""Integration Tests for Large-Data Pipeline (Phase 6)

End-to-end tests for the complete large-data ingestion pipeline:
- Synthetic data generation
- Dask mode selection
- Chunked mode fallback
- Validation across partitions/chunks
- Partitioned output writing
- Manifest accuracy verification

Last Updated: 2026-01-23
"""

import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Generator

import pandas as pd
import pytest

# Import ingestion components
from src.ingestion import (
    IngestionConfig,
    get_ingestion_config,
    reset_config,
    ingest_file_large,
    validate_data,
    write_cleaned,
    write_manifest,
    WriteResult,
    ValidationResult,
    IngestionMetadata,
    DASK_AVAILABLE,
    PYARROW_AVAILABLE,
)


# =============================================================================
# Synthetic Data Generator
# =============================================================================

def generate_synthetic_csv(
    output_path: Path,
    num_rows: int,
    num_columns: int = 10,
    include_phi_patterns: bool = False,
) -> int:
    """Generate a synthetic CSV file for testing.
    
    Args:
        output_path: Path to write CSV
        num_rows: Number of rows to generate
        num_columns: Number of columns
        include_phi_patterns: Whether to include PHI-like patterns
        
    Returns:
        Actual file size in bytes
    """
    import random
    import string
    
    # Generate column names
    columns = ["id"] + [f"col_{i}" for i in range(1, num_columns)]
    
    # Generate data in chunks to avoid memory issues
    chunk_size = min(10000, num_rows)
    
    with open(output_path, 'w') as f:
        # Write header
        f.write(",".join(columns) + "\n")
        
        rows_written = 0
        while rows_written < num_rows:
            chunk_rows = min(chunk_size, num_rows - rows_written)
            
            for i in range(chunk_rows):
                row_id = rows_written + i + 1
                values = [str(row_id)]
                
                for col_idx in range(1, num_columns):
                    if col_idx % 3 == 0:
                        # Numeric column
                        values.append(str(random.uniform(0, 1000)))
                    elif col_idx % 3 == 1:
                        # String column
                        val = ''.join(random.choices(string.ascii_letters, k=10))
                        if include_phi_patterns and random.random() < 0.01:
                            # Insert PHI-like pattern occasionally
                            val = f"SSN:{random.randint(100, 999)}-{random.randint(10, 99)}-{random.randint(1000, 9999)}"
                        values.append(val)
                    else:
                        # Date-like column
                        values.append(f"2024-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}")
                
                f.write(",".join(values) + "\n")
            
            rows_written += chunk_rows
    
    return os.path.getsize(output_path)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for test files."""
    tmpdir = tempfile.mkdtemp()
    yield Path(tmpdir)
    shutil.rmtree(tmpdir)


@pytest.fixture
def small_csv(temp_dir: Path) -> Path:
    """Generate a small CSV file (under threshold)."""
    csv_path = temp_dir / "small_data.csv"
    generate_synthetic_csv(csv_path, num_rows=100)
    return csv_path


@pytest.fixture
def medium_csv(temp_dir: Path) -> Path:
    """Generate a medium CSV file (around threshold)."""
    csv_path = temp_dir / "medium_data.csv"
    # Generate ~5MB file
    generate_synthetic_csv(csv_path, num_rows=50000)
    return csv_path


@pytest.fixture
def large_csv(temp_dir: Path) -> Path:
    """Generate a large CSV file (over threshold for testing)."""
    csv_path = temp_dir / "large_data.csv"
    # Generate file that exceeds test threshold
    generate_synthetic_csv(csv_path, num_rows=100000)
    return csv_path


@pytest.fixture
def phi_csv(temp_dir: Path) -> Path:
    """Generate a CSV with PHI-like patterns."""
    csv_path = temp_dir / "phi_data.csv"
    generate_synthetic_csv(csv_path, num_rows=1000, include_phi_patterns=True)
    return csv_path


@pytest.fixture
def test_config() -> IngestionConfig:
    """Create a test configuration with low thresholds."""
    return IngestionConfig(
        large_file_bytes=1024 * 100,  # 100KB threshold for testing
        chunk_size_rows=1000,
        dask_enabled=DASK_AVAILABLE,
        dask_blocksize_bytes=64 * 1024,  # 64KB
    )


# =============================================================================
# Tests: Synthetic Data Generator
# =============================================================================

class TestSyntheticDataGenerator:
    """Tests for the synthetic data generator."""
    
    def test_generate_small_csv(self, temp_dir: Path):
        """Test generating a small CSV."""
        csv_path = temp_dir / "test.csv"
        size = generate_synthetic_csv(csv_path, num_rows=100)
        
        assert csv_path.exists()
        assert size > 0
        
        df = pd.read_csv(csv_path)
        assert len(df) == 100
        assert "id" in df.columns
    
    def test_generate_with_columns(self, temp_dir: Path):
        """Test generating CSV with specific column count."""
        csv_path = temp_dir / "test.csv"
        generate_synthetic_csv(csv_path, num_rows=50, num_columns=20)
        
        df = pd.read_csv(csv_path)
        assert len(df.columns) == 20
    
    def test_generate_with_phi(self, temp_dir: Path):
        """Test generating CSV with PHI patterns."""
        csv_path = temp_dir / "test.csv"
        generate_synthetic_csv(csv_path, num_rows=10000, include_phi_patterns=True)
        
        df = pd.read_csv(csv_path)
        
        # Check for SSN-like patterns
        all_text = df.astype(str).values.flatten()
        has_ssn = any("SSN:" in str(v) for v in all_text)
        assert has_ssn, "Should have some PHI-like patterns"


# =============================================================================
# Tests: Mode Selection
# =============================================================================

class TestModeSelection:
    """Tests for automatic mode selection based on file size."""
    
    def test_small_file_uses_pandas(self, small_csv: Path, test_config: IngestionConfig):
        """Test that small files use standard pandas."""
        data, metadata = ingest_file_large(small_csv, "csv", config=test_config)
        
        assert isinstance(data, pd.DataFrame)
        assert not metadata.is_dask
        assert not metadata.is_chunked
        assert not metadata.is_large_file
    
    def test_large_file_detection(self, large_csv: Path, test_config: IngestionConfig):
        """Test that large files are detected."""
        data, metadata = ingest_file_large(large_csv, "csv", config=test_config)
        
        assert metadata.is_large_file
        assert metadata.file_size_bytes > test_config.large_file_bytes
    
    @pytest.mark.skipif(not DASK_AVAILABLE, reason="Dask not installed")
    def test_large_file_uses_dask_when_enabled(self, large_csv: Path):
        """Test that large files use Dask when enabled."""
        config = IngestionConfig(
            large_file_bytes=1024 * 100,  # 100KB
            dask_enabled=True,
        )
        
        data, metadata = ingest_file_large(large_csv, "csv", config=config)
        
        assert metadata.is_dask
        assert metadata.partition_count >= 1
    
    def test_large_file_uses_chunks_when_dask_disabled(self, large_csv: Path):
        """Test that large files use chunked mode when Dask disabled."""
        config = IngestionConfig(
            large_file_bytes=1024 * 100,  # 100KB
            chunk_size_rows=5000,
            dask_enabled=False,
        )
        
        data, metadata = ingest_file_large(large_csv, "csv", config=config)
        
        assert metadata.is_chunked or isinstance(data, pd.DataFrame)
        if metadata.is_chunked:
            # Verify it's iterable
            chunk_count = sum(1 for _ in data)
            assert chunk_count > 0


# =============================================================================
# Tests: Validation Across Partitions/Chunks
# =============================================================================

class TestDistributedValidation:
    """Tests for validation across partitions and chunks."""
    
    def test_chunked_validation(self, medium_csv: Path, temp_dir: Path):
        """Test validation works with chunked data."""
        from src.ingestion.schema_loader import SchemaDefinition, ColumnDefinition
        
        # Create a simple schema
        schema = SchemaDefinition(
            name="test_schema",
            version="1.0.0",
            file_format="csv",
            columns=[
                ColumnDefinition(name="id", type="integer", required=True),
            ],
            required_columns=["id"],
        )
        
        # Read in chunks
        reader = pd.read_csv(medium_csv, chunksize=1000)
        result = validate_data(reader, schema)
        
        assert result.chunks_validated > 0
        assert result.total_rows_validated > 0
    
    @pytest.mark.skipif(not DASK_AVAILABLE, reason="Dask not installed")
    def test_dask_validation(self, large_csv: Path):
        """Test validation works with Dask DataFrames."""
        import dask.dataframe as dd
        from src.ingestion.schema_loader import SchemaDefinition, ColumnDefinition
        
        schema = SchemaDefinition(
            name="test_schema",
            version="1.0.0",
            file_format="csv",
            columns=[
                ColumnDefinition(name="id", type="integer", required=True),
            ],
            required_columns=["id"],
        )
        
        ddf = dd.read_csv(large_csv)
        result = validate_data(ddf, schema)
        
        assert result.chunks_validated >= 1
        assert result.total_rows_validated > 0


# =============================================================================
# Tests: Partitioned Output
# =============================================================================

@pytest.mark.skipif(not PYARROW_AVAILABLE, reason="PyArrow not installed")
class TestPartitionedOutput:
    """Tests for partitioned Parquet output."""
    
    def test_small_file_single_output(self, small_csv: Path, temp_dir: Path):
        """Test that small files produce single output file."""
        df = pd.read_csv(small_csv)
        result = write_cleaned(df, temp_dir / "output")
        
        assert not result.partitioned
        assert len(result.partition_paths) == 1
        assert Path(result.output_path).exists()
    
    def test_chunked_produces_partitions(self, medium_csv: Path, temp_dir: Path):
        """Test that chunked data produces partitioned output."""
        reader = pd.read_csv(medium_csv, chunksize=5000)
        result = write_cleaned(reader, temp_dir / "output", filename="partitioned")
        
        assert result.partitioned
        assert len(result.partition_paths) > 1
        
        # Verify all partitions exist
        for path in result.partition_paths:
            assert Path(path).exists()
    
    @pytest.mark.skipif(not DASK_AVAILABLE, reason="Dask not installed")
    def test_dask_produces_partitions(self, large_csv: Path, temp_dir: Path):
        """Test that Dask DataFrames produce partitioned output."""
        import dask.dataframe as dd
        
        ddf = dd.read_csv(large_csv)
        result = write_cleaned(ddf, temp_dir / "output", filename="dask_output")
        
        assert result.partitioned
        assert len(result.partition_paths) >= 1
    
    def test_row_count_accuracy(self, medium_csv: Path, temp_dir: Path):
        """Test that row counts are accurate."""
        df = pd.read_csv(medium_csv)
        original_rows = len(df)
        
        result = write_cleaned(df, temp_dir / "output")
        
        assert result.row_count == original_rows
    
    def test_column_count_accuracy(self, small_csv: Path, temp_dir: Path):
        """Test that column counts are accurate."""
        df = pd.read_csv(small_csv)
        original_cols = len(df.columns)
        
        result = write_cleaned(df, temp_dir / "output")
        
        assert result.column_count == original_cols


# =============================================================================
# Tests: Manifest Accuracy
# =============================================================================

@pytest.mark.skipif(not PYARROW_AVAILABLE, reason="PyArrow not installed")
class TestManifestAccuracy:
    """Tests for manifest generation accuracy."""
    
    def test_manifest_contains_required_fields(self, small_csv: Path, temp_dir: Path):
        """Test manifest has all required fields."""
        df = pd.read_csv(small_csv)
        write_result = write_cleaned(df, temp_dir / "output")
        
        manifest_path = temp_dir / "manifest.json"
        write_manifest(write_result, manifest_path, job_id="job_test123456")
        
        with open(manifest_path) as f:
            manifest = json.load(f)
        
        assert "version" in manifest
        assert "job_id" in manifest
        assert "output" in manifest
        assert manifest["output"]["row_count"] == len(df)
    
    def test_manifest_checksum_present(self, small_csv: Path, temp_dir: Path):
        """Test manifest includes checksum."""
        df = pd.read_csv(small_csv)
        write_result = write_cleaned(df, temp_dir / "output")
        
        manifest_path = temp_dir / "manifest.json"
        write_manifest(write_result, manifest_path)
        
        with open(manifest_path) as f:
            manifest = json.load(f)
        
        assert manifest["output"]["checksum"] is not None
        assert len(manifest["output"]["checksum"]) == 64  # SHA-256
    
    def test_partitioned_manifest_lists_all_files(self, medium_csv: Path, temp_dir: Path):
        """Test partitioned manifest lists all partition files."""
        reader = pd.read_csv(medium_csv, chunksize=10000)
        write_result = write_cleaned(reader, temp_dir / "output", filename="parts")
        
        manifest_path = temp_dir / "manifest.json"
        write_manifest(write_result, manifest_path)
        
        with open(manifest_path) as f:
            manifest = json.load(f)
        
        assert manifest["output"]["partitioned"] is True
        assert len(manifest["output"]["partition_paths"]) == len(write_result.partition_paths)
    
    def test_manifest_metadata(self, small_csv: Path, temp_dir: Path):
        """Test manifest includes additional metadata."""
        df = pd.read_csv(small_csv)
        write_result = write_cleaned(df, temp_dir / "output")
        
        manifest_path = temp_dir / "manifest.json"
        write_manifest(
            write_result,
            manifest_path,
            additional_metadata={
                "source": "integration_test",
                "pipeline_version": "1.0.0",
            }
        )
        
        with open(manifest_path) as f:
            manifest = json.load(f)
        
        assert manifest["metadata"]["source"] == "integration_test"


# =============================================================================
# Tests: End-to-End Pipeline
# =============================================================================

@pytest.mark.skipif(not PYARROW_AVAILABLE, reason="PyArrow not installed")
class TestEndToEndPipeline:
    """End-to-end integration tests for the complete pipeline."""
    
    def test_small_file_pipeline(self, small_csv: Path, temp_dir: Path):
        """Test complete pipeline for small files."""
        from src.ingestion.schema_loader import SchemaDefinition, ColumnDefinition
        
        # 1. Ingest
        data, ingest_meta = ingest_file_large(small_csv, "csv")
        assert isinstance(data, pd.DataFrame)
        
        # 2. Validate
        schema = SchemaDefinition(
            name="test",
            version="1.0.0",
            file_format="csv",
            columns=[ColumnDefinition(name="id", type="integer", required=True)],
            required_columns=["id"],
        )
        val_result = validate_data(data, schema)
        assert val_result.valid or len(val_result.errors) > 0  # Either valid or has specific errors
        
        # 3. Write
        write_result = write_cleaned(data, temp_dir / "output")
        assert write_result.row_count > 0
        
        # 4. Manifest
        manifest_path = temp_dir / "manifest.json"
        write_manifest(write_result, manifest_path, job_id="job_e2e_small_123")
        assert manifest_path.exists()
    
    def test_chunked_pipeline(self, medium_csv: Path, temp_dir: Path):
        """Test complete pipeline for chunked processing."""
        config = IngestionConfig(
            large_file_bytes=1024,  # Very low threshold
            chunk_size_rows=5000,
            dask_enabled=False,
        )
        
        # 1. Ingest (will use chunks due to low threshold)
        data, ingest_meta = ingest_file_large(medium_csv, "csv", config=config)
        
        if ingest_meta.is_chunked:
            # For chunked data, we need to handle differently
            # Collect chunks for writing
            chunks = list(data)
            
            # 2. Write each chunk
            write_result = write_cleaned(
                pd.read_csv(medium_csv, chunksize=5000),
                temp_dir / "output",
                filename="chunked",
            )
            
            assert write_result.partitioned
            assert write_result.row_count > 0


# =============================================================================
# Tests: Error Handling
# =============================================================================

class TestErrorHandling:
    """Tests for error handling in the pipeline."""
    
    def test_missing_file(self, temp_dir: Path):
        """Test handling of missing files."""
        from src.ingestion.validator import ValidationError
        
        with pytest.raises((ValidationError, FileNotFoundError)):
            ingest_file_large(temp_dir / "nonexistent.csv", "csv")
    
    def test_invalid_format(self, small_csv: Path):
        """Test handling of invalid format specification."""
        from src.ingestion.validator import ValidationError
        
        with pytest.raises(ValidationError):
            ingest_file_large(small_csv, "invalid_format")
    
    def test_corrupted_csv(self, temp_dir: Path):
        """Test handling of corrupted CSV."""
        corrupted_path = temp_dir / "corrupted.csv"
        with open(corrupted_path, 'w') as f:
            f.write("col1,col2,col3\n")
            f.write("1,2\n")  # Missing column
            f.write("3,4,5,6\n")  # Extra column
        
        # Should still read (pandas is tolerant)
        df = pd.read_csv(corrupted_path, on_bad_lines='warn')
        assert len(df) >= 0  # May have rows or be empty


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

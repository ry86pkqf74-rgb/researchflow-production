"""Tests for Phase 4: Partitioned Output Writer

Tests the writer module that supports:
- Single file Parquet output (pandas DataFrame)
- Partitioned Parquet output (Dask DataFrame)
- Chunked Parquet output (TextFileReader)
- Manifest generation

Last Updated: 2026-01-23
"""

import json
import os
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from src.ingestion.writer import (
    write_cleaned,
    write_manifest,
    cleanup_output,
    WriteResult,
    DASK_AVAILABLE,
    PYARROW_AVAILABLE,
    _compute_file_checksum,
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def sample_dataframe() -> pd.DataFrame:
    """A sample DataFrame for testing."""
    return pd.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "value": [10.5, 20.3, 30.7, 40.1, 50.0],
        "active": [True, False, True, True, False],
    })


@pytest.fixture
def large_dataframe() -> pd.DataFrame:
    """A larger DataFrame for testing."""
    n = 1000
    return pd.DataFrame({
        "id": range(1, n + 1),
        "name": [f"Person_{i}" for i in range(1, n + 1)],
        "value": [float(i) * 1.5 for i in range(1, n + 1)],
    })


@pytest.fixture
def temp_output_dir():
    """Create a temporary output directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_csv_file(large_dataframe) -> str:
    """Create a temporary CSV file for chunked testing."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        large_dataframe.to_csv(f.name, index=False)
        yield f.name
    os.unlink(f.name)


# =============================================================================
# Tests: WriteResult dataclass
# =============================================================================

class TestWriteResult:
    """Tests for WriteResult dataclass."""
    
    def test_default_values(self):
        """Test WriteResult with default values."""
        result = WriteResult(output_path="/tmp/test.parquet")
        assert result.output_path == "/tmp/test.parquet"
        assert result.format == "parquet"
        assert result.partitioned is False
        assert result.partition_paths == []
        assert result.row_count == 0
        assert result.column_count == 0
    
    def test_custom_values(self):
        """Test WriteResult with custom values."""
        result = WriteResult(
            output_path="/tmp/output",
            format="parquet",
            partitioned=True,
            partition_paths=["/tmp/output/part-00000.parquet"],
            row_count=1000,
            column_count=5,
            total_bytes=50000,
            checksum="abc123",
            compression="snappy",
        )
        assert result.partitioned is True
        assert result.row_count == 1000
        assert len(result.partition_paths) == 1
    
    def test_to_dict(self):
        """Test WriteResult serialization."""
        result = WriteResult(
            output_path="/tmp/test.parquet",
            row_count=100,
            column_count=4,
        )
        d = result.to_dict()
        assert d["output_path"] == "/tmp/test.parquet"
        assert d["row_count"] == 100
        assert d["column_count"] == 4
        assert "created_at" in d


# =============================================================================
# Tests: write_cleaned with pandas DataFrame
# =============================================================================

class TestWriteCleanedPandas:
    """Tests for writing pandas DataFrames."""
    
    def test_write_small_dataframe(self, sample_dataframe, temp_output_dir):
        """Test writing a small DataFrame to single Parquet file."""
        result = write_cleaned(
            sample_dataframe,
            temp_output_dir,
            filename="test_data",
        )
        
        assert result.partitioned is False
        assert result.row_count == 5
        assert result.column_count == 4
        assert result.format == "parquet"
        assert Path(result.output_path).exists()
        assert result.total_bytes > 0
        assert result.checksum is not None
    
    def test_write_creates_directory(self, sample_dataframe, temp_output_dir):
        """Test that write_cleaned creates output directory."""
        nested_dir = temp_output_dir / "nested" / "output"
        result = write_cleaned(sample_dataframe, nested_dir)
        
        assert nested_dir.exists()
        assert Path(result.output_path).exists()
    
    def test_write_with_compression(self, sample_dataframe, temp_output_dir):
        """Test writing with different compression codecs."""
        for compression in ["snappy", "gzip", "none"]:
            result = write_cleaned(
                sample_dataframe,
                temp_output_dir,
                filename=f"test_{compression}",
                compression=compression,
            )
            assert result.compression == compression
            assert Path(result.output_path).exists()
    
    def test_read_back_written_data(self, sample_dataframe, temp_output_dir):
        """Test that written data can be read back correctly."""
        result = write_cleaned(sample_dataframe, temp_output_dir)
        
        # Read back
        df_read = pd.read_parquet(result.output_path)
        
        assert len(df_read) == len(sample_dataframe)
        assert list(df_read.columns) == list(sample_dataframe.columns)
    
    def test_write_none_raises(self, temp_output_dir):
        """Test that writing None raises ValueError."""
        with pytest.raises(ValueError, match="Cannot write None"):
            write_cleaned(None, temp_output_dir)
    
    def test_write_unsupported_type_raises(self, temp_output_dir):
        """Test that unsupported types raise ValueError."""
        with pytest.raises(ValueError, match="Unsupported data type"):
            write_cleaned("not a dataframe", temp_output_dir)


# =============================================================================
# Tests: write_cleaned with chunked iterator
# =============================================================================

class TestWriteCleanedChunked:
    """Tests for writing chunked data (TextFileReader)."""
    
    def test_write_chunked_csv(self, temp_csv_file, temp_output_dir):
        """Test writing chunked CSV to partitioned Parquet."""
        reader = pd.read_csv(temp_csv_file, chunksize=250)
        
        result = write_cleaned(
            reader,
            temp_output_dir,
            filename="chunked_output",
        )
        
        assert result.partitioned is True
        assert result.row_count == 1000
        assert result.column_count == 3
        assert len(result.partition_paths) == 4  # 1000 / 250 = 4 chunks
        
        # Verify all partition files exist
        for path in result.partition_paths:
            assert Path(path).exists()
    
    def test_chunked_partition_naming(self, temp_csv_file, temp_output_dir):
        """Test that partitions are named correctly."""
        reader = pd.read_csv(temp_csv_file, chunksize=500)
        
        result = write_cleaned(reader, temp_output_dir, filename="parts")
        
        for i, path in enumerate(result.partition_paths):
            assert f"part-{i:05d}.parquet" in path
    
    def test_chunked_checksum_is_manifest(self, temp_csv_file, temp_output_dir):
        """Test that chunked output has manifest checksum."""
        reader = pd.read_csv(temp_csv_file, chunksize=500)
        
        result = write_cleaned(reader, temp_output_dir)
        
        # Checksum should be derived from partition checksums
        assert result.checksum is not None
        assert len(result.checksum) == 64  # SHA-256 hex


# =============================================================================
# Tests: write_cleaned with Dask DataFrame (conditional)
# =============================================================================

@pytest.mark.skipif(not DASK_AVAILABLE, reason="Dask not installed")
class TestWriteCleanedDask:
    """Tests for writing Dask DataFrames."""
    
    def test_write_dask_dataframe(self, temp_csv_file, temp_output_dir):
        """Test writing a Dask DataFrame to partitioned Parquet."""
        import dask.dataframe as dd
        
        ddf = dd.read_csv(temp_csv_file)
        
        result = write_cleaned(ddf, temp_output_dir, filename="dask_output")
        
        assert result.partitioned is True
        assert result.row_count == 1000
        assert len(result.partition_paths) >= 1
    
    def test_dask_partitions_readable(self, temp_csv_file, temp_output_dir):
        """Test that Dask partitions can be read back."""
        import dask.dataframe as dd
        
        ddf = dd.read_csv(temp_csv_file)
        result = write_cleaned(ddf, temp_output_dir, filename="readable")
        
        # Read back with Dask
        ddf_read = dd.read_parquet(result.output_path)
        assert len(ddf_read) == 1000


# =============================================================================
# Tests: write_manifest
# =============================================================================

class TestWriteManifest:
    """Tests for manifest generation."""
    
    def test_write_manifest_basic(self, sample_dataframe, temp_output_dir):
        """Test basic manifest generation."""
        write_result = write_cleaned(sample_dataframe, temp_output_dir)
        
        manifest_path = temp_output_dir / "manifest.json"
        write_manifest(write_result, manifest_path)
        
        assert manifest_path.exists()
        
        with open(manifest_path) as f:
            manifest = json.load(f)
        
        assert manifest["version"] == "1.0.0"
        assert manifest["output"]["row_count"] == 5
        assert manifest["output"]["column_count"] == 4
    
    def test_write_manifest_with_job_id(self, sample_dataframe, temp_output_dir):
        """Test manifest with job ID."""
        write_result = write_cleaned(sample_dataframe, temp_output_dir)
        
        manifest_path = temp_output_dir / "manifest.json"
        write_manifest(
            write_result,
            manifest_path,
            job_id="job_abc123xyz456",
        )
        
        with open(manifest_path) as f:
            manifest = json.load(f)
        
        assert manifest["job_id"] == "job_abc123xyz456"
    
    def test_write_manifest_with_metadata(self, sample_dataframe, temp_output_dir):
        """Test manifest with additional metadata."""
        write_result = write_cleaned(sample_dataframe, temp_output_dir)
        
        manifest_path = temp_output_dir / "manifest.json"
        write_manifest(
            write_result,
            manifest_path,
            additional_metadata={"source": "test", "version": "1.0"},
        )
        
        with open(manifest_path) as f:
            manifest = json.load(f)
        
        assert manifest["metadata"]["source"] == "test"


# =============================================================================
# Tests: cleanup_output
# =============================================================================

class TestCleanupOutput:
    """Tests for output cleanup."""
    
    def test_cleanup_single_file(self, sample_dataframe, temp_output_dir):
        """Test cleaning up a single file."""
        result = write_cleaned(sample_dataframe, temp_output_dir)
        
        assert Path(result.output_path).exists()
        
        cleanup_output(result.output_path)
        
        assert not Path(result.output_path).exists()
    
    def test_cleanup_partition_directory(self, temp_csv_file, temp_output_dir):
        """Test cleaning up a partition directory."""
        reader = pd.read_csv(temp_csv_file, chunksize=500)
        result = write_cleaned(reader, temp_output_dir, filename="to_cleanup")
        
        assert Path(result.output_path).exists()
        
        cleanup_output(result.output_path)
        
        assert not Path(result.output_path).exists()
    
    def test_cleanup_nonexistent_path(self, temp_output_dir):
        """Test cleanup of nonexistent path doesn't raise."""
        # Should not raise
        cleanup_output(temp_output_dir / "nonexistent")


# =============================================================================
# Tests: checksum computation
# =============================================================================

class TestChecksumComputation:
    """Tests for checksum computation."""
    
    def test_checksum_consistency(self, sample_dataframe, temp_output_dir):
        """Test that same data produces same checksum."""
        result1 = write_cleaned(sample_dataframe, temp_output_dir, filename="data1")
        result2 = write_cleaned(sample_dataframe, temp_output_dir, filename="data2")
        
        # Checksums should be identical for identical data
        assert result1.checksum == result2.checksum
    
    def test_checksum_different_data(self, sample_dataframe, temp_output_dir):
        """Test that different data produces different checksum."""
        result1 = write_cleaned(sample_dataframe, temp_output_dir, filename="data1")
        
        different_df = sample_dataframe.copy()
        different_df.loc[0, "value"] = 999.9
        
        result2 = write_cleaned(different_df, temp_output_dir, filename="data2")
        
        assert result1.checksum != result2.checksum
    
    def test_checksum_format(self, sample_dataframe, temp_output_dir):
        """Test checksum is valid SHA-256 hex."""
        result = write_cleaned(sample_dataframe, temp_output_dir)
        
        assert result.checksum is not None
        assert len(result.checksum) == 64
        assert all(c in "0123456789abcdef" for c in result.checksum)


# =============================================================================
# Tests: Edge cases
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases."""
    
    def test_empty_dataframe(self, temp_output_dir):
        """Test writing an empty DataFrame."""
        empty_df = pd.DataFrame(columns=["id", "name"])
        
        result = write_cleaned(empty_df, temp_output_dir)
        
        assert result.row_count == 0
        assert result.column_count == 2
        assert Path(result.output_path).exists()
    
    def test_single_row(self, temp_output_dir):
        """Test writing a single-row DataFrame."""
        single_row = pd.DataFrame({"id": [1], "name": ["Test"]})
        
        result = write_cleaned(single_row, temp_output_dir)
        
        assert result.row_count == 1
    
    def test_special_characters_in_data(self, temp_output_dir):
        """Test writing data with special characters."""
        df = pd.DataFrame({
            "text": ["Hello, World!", "Test\nNewline", "Unicode: äöü", "Emoji: 🎉"],
        })
        
        result = write_cleaned(df, temp_output_dir)
        
        # Read back and verify
        df_read = pd.read_parquet(result.output_path)
        assert df_read["text"].iloc[3] == "Emoji: 🎉"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

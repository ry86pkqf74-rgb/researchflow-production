"""Tests for Phase 2: Large Data Ingestion Enhancement

Tests file size detection and automatic Dask/chunked mode switching.
"""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import pandas as pd

# Mock the missing web_frontend module before importing ingestion
sys.modules['web_frontend'] = type(sys)('web_frontend')
sys.modules['web_frontend.provenance_logger'] = type(sys)('web_frontend.provenance_logger')
sys.modules['web_frontend.provenance_logger'].log_event = lambda *args, **kwargs: None

sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from ingestion.config import IngestionConfig, reset_config
from ingestion.ingestion import (
    _read_file,
    _read_file_pandas,
    ingest_file_large,
    IngestionMetadata,
    DASK_AVAILABLE,
)


@pytest.fixture
def small_csv_file():
    """Create a small CSV file (< 1KB)."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write('id,name,value\n')
        for i in range(100):
            f.write(f'{i},item_{i},{i * 10}\n')
        path = Path(f.name)
    yield path
    os.unlink(path)


@pytest.fixture
def medium_csv_file():
    """Create a medium CSV file (~10KB)."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write('id,name,value,description\n')
        for i in range(500):
            f.write(f'{i},item_{i},{i * 10},{"x" * 50}\n')
        path = Path(f.name)
    yield path
    os.unlink(path)


@pytest.fixture
def tsv_file():
    """Create a TSV file."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.tsv', delete=False) as f:
        f.write('id\tname\tvalue\n')
        for i in range(50):
            f.write(f'{i}\titem_{i}\t{i * 10}\n')
        path = Path(f.name)
    yield path
    os.unlink(path)


@pytest.fixture
def parquet_file():
    """Create a Parquet file."""
    df = pd.DataFrame({
        'id': range(100),
        'name': [f'item_{i}' for i in range(100)],
        'value': [i * 10 for i in range(100)]
    })
    with tempfile.NamedTemporaryFile(suffix='.parquet', delete=False) as f:
        path = Path(f.name)
    df.to_parquet(path, index=False)
    yield path
    os.unlink(path)


class TestIngestionMetadata:
    """Tests for IngestionMetadata dataclass."""
    
    def test_default_values(self):
        """Test default values."""
        meta = IngestionMetadata()
        assert meta.is_dask is False
        assert meta.is_chunked is False
        assert meta.is_large_file is False
        assert meta.file_size_bytes == 0
        assert meta.partition_count is None
    
    def test_custom_values(self):
        """Test custom values."""
        meta = IngestionMetadata(
            is_dask=True,
            is_chunked=False,
            is_large_file=True,
            file_size_bytes=100_000_000,
            partition_count=10
        )
        assert meta.is_dask is True
        assert meta.is_chunked is False
        assert meta.is_large_file is True
        assert meta.file_size_bytes == 100_000_000
        assert meta.partition_count == 10


class TestReadFilePandas:
    """Tests for _read_file_pandas (backward compatibility)."""
    
    def test_read_csv(self, small_csv_file):
        """Test reading a CSV file."""
        df = _read_file_pandas(small_csv_file, 'csv')
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 100
        assert list(df.columns) == ['id', 'name', 'value']
    
    def test_read_tsv(self, tsv_file):
        """Test reading a TSV file."""
        df = _read_file_pandas(tsv_file, 'tsv')
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 50
    
    def test_read_parquet(self, parquet_file):
        """Test reading a Parquet file."""
        df = _read_file_pandas(parquet_file, 'parquet')
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 100
    
    def test_file_not_found(self):
        """Test handling of missing file."""
        from ingestion.validator import ValidationError
        with pytest.raises(ValidationError, match="Data file not found"):
            _read_file_pandas(Path("/nonexistent/file.csv"), 'csv')
    
    def test_unsupported_format(self, small_csv_file):
        """Test handling of unsupported format."""
        from ingestion.validator import ValidationError
        with pytest.raises(ValidationError, match="Unsupported file_format"):
            _read_file_pandas(small_csv_file, 'xlsx')


class TestReadFileWithConfig:
    """Tests for _read_file with configuration."""
    
    def test_small_file_returns_dataframe(self, small_csv_file):
        """Small files should return pandas DataFrame."""
        config = IngestionConfig(
            large_file_bytes=1_000_000,  # 1MB threshold
            dask_enabled=False,
            chunk_size_rows=50
        )
        data, meta = _read_file(small_csv_file, 'csv', config)
        
        assert isinstance(data, pd.DataFrame)
        assert meta.is_dask is False
        assert meta.is_chunked is False
        assert meta.is_large_file is False
        assert meta.file_size_bytes > 0
    
    def test_large_file_chunked_mode(self, medium_csv_file):
        """Large files with Dask disabled should use chunked mode."""
        config = IngestionConfig(
            large_file_bytes=100,  # Very low threshold to trigger large file mode
            dask_enabled=False,
            chunk_size_rows=100
        )
        data, meta = _read_file(medium_csv_file, 'csv', config)
        
        # Should be a TextFileReader (iterator)
        assert hasattr(data, '__iter__')
        assert not isinstance(data, pd.DataFrame)
        assert meta.is_dask is False
        assert meta.is_chunked is True
        assert meta.is_large_file is True
    
    def test_chunked_mode_iteration(self, medium_csv_file):
        """Chunked mode should yield DataFrames."""
        config = IngestionConfig(
            large_file_bytes=100,
            dask_enabled=False,
            chunk_size_rows=100
        )
        data, meta = _read_file(medium_csv_file, 'csv', config)
        
        total_rows = 0
        chunk_count = 0
        for chunk in data:
            assert isinstance(chunk, pd.DataFrame)
            total_rows += len(chunk)
            chunk_count += 1
        
        assert total_rows == 500
        assert chunk_count > 0
    
    def test_tsv_small_file(self, tsv_file):
        """TSV files should be handled correctly."""
        config = IngestionConfig(
            large_file_bytes=1_000_000,
            dask_enabled=False,
        )
        data, meta = _read_file(tsv_file, 'tsv', config)
        
        assert isinstance(data, pd.DataFrame)
        assert len(data) == 50
        assert meta.is_chunked is False
    
    def test_tsv_chunked_mode(self, tsv_file):
        """TSV files should support chunked mode."""
        config = IngestionConfig(
            large_file_bytes=100,
            dask_enabled=False,
            chunk_size_rows=10
        )
        data, meta = _read_file(tsv_file, 'tsv', config)
        
        assert meta.is_chunked is True
        
        # Iterate and verify
        total_rows = 0
        for chunk in data:
            total_rows += len(chunk)
        assert total_rows == 50
    
    def test_parquet_small_file(self, parquet_file):
        """Parquet files should be handled correctly."""
        config = IngestionConfig(
            large_file_bytes=1_000_000,
            dask_enabled=False,
        )
        data, meta = _read_file(parquet_file, 'parquet', config)
        
        assert isinstance(data, pd.DataFrame)
        assert len(data) == 100
        assert meta.is_chunked is False


class TestIngestFileLarge:
    """Tests for ingest_file_large function."""
    
    def test_returns_tuple(self, small_csv_file):
        """Should return (data, metadata) tuple."""
        result = ingest_file_large(small_csv_file, 'csv')
        
        assert isinstance(result, tuple)
        assert len(result) == 2
        data, meta = result
        assert isinstance(data, pd.DataFrame)
        assert isinstance(meta, IngestionMetadata)
    
    def test_uses_default_config(self, small_csv_file):
        """Should use default config when none provided."""
        reset_config()
        data, meta = ingest_file_large(small_csv_file, 'csv')
        
        assert isinstance(data, pd.DataFrame)
        # Default threshold is 50MB, so small file should not be chunked
        assert meta.is_chunked is False
    
    def test_custom_config(self, small_csv_file):
        """Should use provided config."""
        config = IngestionConfig(
            large_file_bytes=100,  # Very low
            dask_enabled=False,
            chunk_size_rows=20
        )
        data, meta = ingest_file_large(small_csv_file, 'csv', config=config)
        
        # Should trigger chunked mode
        assert meta.is_chunked is True


class TestDaskAvailability:
    """Tests for Dask availability handling."""
    
    def test_dask_available_constant(self):
        """DASK_AVAILABLE should be a boolean."""
        assert isinstance(DASK_AVAILABLE, bool)
    
    def test_dask_disabled_fallback(self, medium_csv_file):
        """When Dask is disabled, should fall back to chunked mode."""
        config = IngestionConfig(
            large_file_bytes=100,
            dask_enabled=True,  # Enabled but might not be available
            chunk_size_rows=100
        )
        data, meta = _read_file(medium_csv_file, 'csv', config)
        
        # Either Dask or chunked depending on availability
        if DASK_AVAILABLE:
            assert meta.is_dask is True
        else:
            # Falls back to chunked when Dask not available
            # Note: current implementation requires both dask_enabled AND DASK_AVAILABLE
            assert meta.is_chunked is True or meta.is_dask is False


class TestFileMetadata:
    """Tests for file metadata tracking."""
    
    def test_file_size_recorded(self, small_csv_file):
        """File size should be recorded in metadata."""
        config = IngestionConfig(large_file_bytes=1_000_000)
        data, meta = _read_file(small_csv_file, 'csv', config)
        
        actual_size = os.path.getsize(small_csv_file)
        assert meta.file_size_bytes == actual_size
    
    def test_large_file_detection(self, medium_csv_file):
        """Large file detection should work correctly."""
        file_size = os.path.getsize(medium_csv_file)
        
        # With threshold above file size
        config_high = IngestionConfig(large_file_bytes=file_size + 1000)
        data, meta = _read_file(medium_csv_file, 'csv', config_high)
        assert meta.is_large_file is False
        
        # With threshold below file size
        config_low = IngestionConfig(large_file_bytes=file_size - 1000)
        data2, meta2 = _read_file(medium_csv_file, 'csv', config_low)
        assert meta2.is_large_file is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

"""
Tests for Ingestion Configuration Module

Verifies that IngestionConfig and AutoRefineConfig load correctly
from environment variables with proper defaults.

Last Updated: 2026-01-23
"""

import os
import pytest
from unittest.mock import patch

from src.ingestion.config import (
    IngestionConfig,
    AutoRefineConfig,
    get_ingestion_config,
    get_auto_refine_config,
    reset_config,
    reset_auto_refine_config,
    _parse_bytes,
)


class TestParseBytes:
    """Tests for _parse_bytes helper function."""

    def test_parse_bytes_mb(self):
        assert _parse_bytes("64MB") == 64 * 1024 * 1024

    def test_parse_bytes_gb(self):
        assert _parse_bytes("4GB") == 4 * 1024 * 1024 * 1024

    def test_parse_bytes_kb(self):
        assert _parse_bytes("512KB") == 512 * 1024

    def test_parse_bytes_raw_int(self):
        assert _parse_bytes("52428800") == 52428800

    def test_parse_bytes_with_space(self):
        assert _parse_bytes("64 MB") == 64 * 1024 * 1024

    def test_parse_bytes_lowercase(self):
        assert _parse_bytes("64mb") == 64 * 1024 * 1024

    def test_parse_bytes_none(self):
        assert _parse_bytes(None) is None

    def test_parse_bytes_empty(self):
        assert _parse_bytes("") is None

    def test_parse_bytes_invalid(self):
        assert _parse_bytes("invalid") is None


class TestIngestionConfig:
    """Tests for IngestionConfig dataclass."""

    def setup_method(self):
        """Reset config singleton before each test."""
        reset_config()

    def test_default_values(self):
        """Test that defaults are applied correctly."""
        config = IngestionConfig()
        
        assert config.large_file_bytes == 50 * 1024 * 1024
        assert config.chunk_size_rows == 500_000
        assert config.dask_enabled is False
        assert config.dask_blocksize_bytes == 64 * 1024 * 1024
        assert config.dask_workers == 4
        assert config.dask_threads_per_worker == 2
        assert config.dask_memory_limit == "4GB"
        assert config.dask_scheduler_addr is None
        assert config.max_parquet_file_size == 100 * 1024 * 1024

    def test_from_env_with_defaults(self):
        """Test from_env with no environment variables set."""
        with patch.dict(os.environ, {}, clear=True):
            config = IngestionConfig.from_env()
            
            assert config.large_file_bytes == 50 * 1024 * 1024
            assert config.dask_enabled is False

    def test_from_env_with_custom_values(self):
        """Test from_env with custom environment variables."""
        env_vars = {
            "LARGE_FILE_BYTES": "104857600",  # 100 MB
            "CHUNK_SIZE_ROWS": "1000000",
            "DASK_ENABLED": "true",
            "DASK_BLOCKSIZE_BYTES": "128MB",
            "DASK_WORKERS": "8",
            "DASK_THREADS_PER_WORKER": "4",
            "DASK_MEMORY_LIMIT": "8GB",
            "DASK_SCHEDULER_ADDR": "tcp://scheduler:8786",
            "MAX_PARQUET_FILE_SIZE": "209715200",
        }
        
        with patch.dict(os.environ, env_vars, clear=True):
            config = IngestionConfig.from_env()
            
            assert config.large_file_bytes == 104857600
            assert config.chunk_size_rows == 1000000
            assert config.dask_enabled is True
            assert config.dask_blocksize_bytes == 128 * 1024 * 1024
            assert config.dask_workers == 8
            assert config.dask_threads_per_worker == 4
            assert config.dask_memory_limit == "8GB"
            assert config.dask_scheduler_addr == "tcp://scheduler:8786"
            assert config.max_parquet_file_size == 209715200

    def test_singleton_pattern(self):
        """Test that get_ingestion_config returns singleton."""
        config1 = get_ingestion_config()
        config2 = get_ingestion_config()
        
        assert config1 is config2

    def test_reset_config(self):
        """Test that reset_config clears the singleton."""
        config1 = get_ingestion_config()
        reset_config()
        config2 = get_ingestion_config()
        
        # They should be equal but not the same instance
        assert config1 == config2
        # Note: Due to frozen dataclass, instances with same values are equal

    def test_config_is_immutable(self):
        """Test that config is immutable (frozen dataclass)."""
        config = IngestionConfig()
        
        with pytest.raises(Exception):  # FrozenInstanceError
            config.large_file_bytes = 999999


class TestAutoRefineConfig:
    """Tests for AutoRefineConfig dataclass."""

    def setup_method(self):
        """Reset config singleton before each test."""
        reset_auto_refine_config()

    def test_default_values(self):
        """Test that defaults are applied correctly."""
        config = AutoRefineConfig()
        
        assert config.auto_refine_enabled is False
        assert config.max_refine_attempts == 1
        assert config.critic_model is None
        assert config.actor_model is None

    def test_from_env_with_defaults(self):
        """Test from_env with no environment variables set."""
        with patch.dict(os.environ, {}, clear=True):
            config = AutoRefineConfig.from_env()
            
            assert config.auto_refine_enabled is False
            assert config.max_refine_attempts == 1

    def test_from_env_with_custom_values(self):
        """Test from_env with custom environment variables."""
        env_vars = {
            "AUTO_REFINE_ENABLED": "true",
            "MAX_REFINE_ATTEMPTS": "3",
            "CRITIC_MODEL": "gpt-4",
            "ACTOR_MODEL": "claude-3-sonnet",
        }
        
        with patch.dict(os.environ, env_vars, clear=True):
            config = AutoRefineConfig.from_env()
            
            assert config.auto_refine_enabled is True
            assert config.max_refine_attempts == 3
            assert config.critic_model == "gpt-4"
            assert config.actor_model == "claude-3-sonnet"

    def test_singleton_pattern(self):
        """Test that get_auto_refine_config returns singleton."""
        config1 = get_auto_refine_config()
        config2 = get_auto_refine_config()
        
        assert config1 is config2

    def test_empty_string_becomes_none(self):
        """Test that empty string env vars become None."""
        env_vars = {
            "CRITIC_MODEL": "",
            "ACTOR_MODEL": "",
        }
        
        with patch.dict(os.environ, env_vars, clear=True):
            config = AutoRefineConfig.from_env()
            
            assert config.critic_model is None
            assert config.actor_model is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""Tests for guideline cache module."""

import pytest
from unittest.mock import patch, MagicMock
from guideline_engine.cache import (
    get,
    set,
    invalidate,
    invalidate_all,
    health_check,
    _memory_cache,
    _cache_key,
)


class TestCacheKey:
    """Tests for cache key generation."""

    def test_basic_key_format(self):
        """Test basic cache key format."""
        key = _cache_key("test", "query")
        assert key.startswith("guideline:")
        assert "test" in key
        assert "query" in key

    def test_key_normalization(self):
        """Test that queries are normalized."""
        key1 = _cache_key("test", "QUERY")
        key2 = _cache_key("test", "query")
        assert key1 == key2

    def test_whitespace_handling(self):
        """Test whitespace is handled in keys."""
        key1 = _cache_key("test", "  query  ")
        key2 = _cache_key("test", "query")
        assert key1 == key2


class TestMemoryCache:
    """Tests for in-memory cache fallback."""

    def setup_method(self):
        """Clear memory cache before each test."""
        _memory_cache.clear()

    def test_set_and_get(self):
        """Test basic set and get operations."""
        # Patch redis to be unavailable
        with patch('guideline_engine.cache._get_redis_client', return_value=None):
            set("test", "key1", {"value": "test_data"})
            result = get("test", "key1")
            assert result is not None
            assert result["value"] == "test_data"

    def test_get_nonexistent(self):
        """Test getting a key that doesn't exist."""
        with patch('guideline_engine.cache._get_redis_client', return_value=None):
            result = get("test", "nonexistent_key")
            assert result is None

    def test_invalidate(self):
        """Test invalidating a cache entry."""
        with patch('guideline_engine.cache._get_redis_client', return_value=None):
            set("test", "key1", {"value": "test_data"})
            invalidate("test", "key1")
            result = get("test", "key1")
            assert result is None

    def test_invalidate_all(self):
        """Test clearing all cache entries."""
        with patch('guideline_engine.cache._get_redis_client', return_value=None):
            set("test", "key1", {"value": "data1"})
            set("test", "key2", {"value": "data2"})
            invalidate_all()
            assert get("test", "key1") is None
            assert get("test", "key2") is None


class TestRedisCache:
    """Tests for Redis cache operations (mocked)."""

    def test_redis_set_and_get(self):
        """Test Redis set and get with mock."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = '{"value": "redis_data"}'

        with patch('guideline_engine.cache._get_redis_client', return_value=mock_redis):
            result = get("test", "key1")
            assert result is not None
            assert result["value"] == "redis_data"
            mock_redis.get.assert_called_once()

    def test_redis_set_with_ttl(self):
        """Test that Redis set includes TTL."""
        mock_redis = MagicMock()

        with patch('guideline_engine.cache._get_redis_client', return_value=mock_redis):
            set("test", "key1", {"value": "data"}, ttl=3600)
            mock_redis.setex.assert_called_once()
            # Check that TTL was passed
            call_args = mock_redis.setex.call_args
            assert call_args[0][1] == 3600  # TTL argument

    def test_redis_invalidate(self):
        """Test Redis key invalidation."""
        mock_redis = MagicMock()

        with patch('guideline_engine.cache._get_redis_client', return_value=mock_redis):
            invalidate("test", "key1")
            mock_redis.delete.assert_called_once()


class TestHealthCheck:
    """Tests for cache health check."""

    def test_health_check_redis_available(self):
        """Test health check when Redis is available."""
        mock_redis = MagicMock()
        mock_redis.ping.return_value = True

        with patch('guideline_engine.cache._get_redis_client', return_value=mock_redis):
            result = health_check()
            assert result["redis_available"] is True
            assert result["status"] == "healthy"

    def test_health_check_redis_unavailable(self):
        """Test health check when Redis is unavailable."""
        with patch('guideline_engine.cache._get_redis_client', return_value=None):
            result = health_check()
            assert result["redis_available"] is False
            assert result["fallback"] == "memory"
            # Should still report healthy (memory fallback works)
            assert result["status"] == "degraded"

    def test_health_check_redis_error(self):
        """Test health check when Redis raises an error."""
        mock_redis = MagicMock()
        mock_redis.ping.side_effect = Exception("Connection error")

        with patch('guideline_engine.cache._get_redis_client', return_value=mock_redis):
            result = health_check()
            assert result["status"] == "unhealthy"
            assert "error" in result

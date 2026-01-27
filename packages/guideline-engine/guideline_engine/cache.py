"""Redis caching with in-memory fallback for guideline engine.

This module provides a caching abstraction that uses Redis when available
and falls back to an in-memory dictionary when Redis is unavailable.
"""
import os
import json
import hashlib
from typing import Any, Optional

# Try to import redis, fallback to memory-only if not available
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

# In-memory fallback cache
_memory_cache: dict = {}

# Default TTL values (in seconds)
DEFAULT_FETCH_TTL = 86400  # 24 hours for fetched content
DEFAULT_PARSE_TTL = 86400  # 24 hours for parsed results
DEFAULT_SUGGEST_TTL = 3600  # 1 hour for AI suggestions


def _get_redis_client() -> Optional["redis.Redis"]:
    """Get Redis client if available and connected.

    Returns:
        Redis client instance or None if unavailable
    """
    if not REDIS_AVAILABLE:
        return None

    try:
        host = os.getenv("REDIS_HOST", "localhost")
        port = int(os.getenv("REDIS_PORT", "6379"))
        password = os.getenv("REDIS_PASSWORD", None)
        db = int(os.getenv("REDIS_DB", "0"))

        client = redis.Redis(
            host=host,
            port=port,
            password=password,
            db=db,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
        )
        # Test connection
        client.ping()
        return client
    except Exception:
        return None


def _cache_key(prefix: str, query: str) -> str:
    """Generate a cache key from prefix and query.

    Args:
        prefix: Key prefix (e.g., "fetch", "parse", "suggest")
        query: The guideline query string

    Returns:
        Formatted cache key
    """
    # Create hash of query for consistent key length
    query_hash = hashlib.md5(query.lower().strip().encode()).hexdigest()[:12]
    return f"guideline:{prefix}:{query_hash}"


def get(prefix: str, query: str) -> Optional[dict]:
    """Get a cached value.

    Args:
        prefix: Key prefix (e.g., "fetch", "parse", "suggest")
        query: The guideline query string

    Returns:
        Cached dictionary or None if not found
    """
    key = _cache_key(prefix, query)

    # Try Redis first
    client = _get_redis_client()
    if client:
        try:
            val = client.get(key)
            if val:
                return json.loads(val)
        except Exception:
            pass

    # Fallback to memory cache
    return _memory_cache.get(key)


def set(prefix: str, query: str, value: dict, ttl: Optional[int] = None) -> bool:
    """Set a cached value with optional TTL.

    Args:
        prefix: Key prefix (e.g., "fetch", "parse", "suggest")
        query: The guideline query string
        value: Dictionary to cache
        ttl: Time-to-live in seconds (default varies by prefix)

    Returns:
        True if successful
    """
    key = _cache_key(prefix, query)

    # Determine TTL based on prefix if not provided
    if ttl is None:
        ttl_map = {
            "fetch": DEFAULT_FETCH_TTL,
            "parse": DEFAULT_PARSE_TTL,
            "suggest": DEFAULT_SUGGEST_TTL,
        }
        ttl = ttl_map.get(prefix, DEFAULT_PARSE_TTL)

    # Try Redis first
    client = _get_redis_client()
    if client:
        try:
            client.setex(key, ttl, json.dumps(value))
            return True
        except Exception:
            pass

    # Fallback to memory cache (no TTL support in memory)
    _memory_cache[key] = value
    return True


def invalidate(prefix: str, query: str) -> bool:
    """Remove a cached value.

    Args:
        prefix: Key prefix (e.g., "fetch", "parse", "suggest")
        query: The guideline query string

    Returns:
        True if successful
    """
    key = _cache_key(prefix, query)

    # Try Redis first
    client = _get_redis_client()
    if client:
        try:
            client.delete(key)
        except Exception:
            pass

    # Also remove from memory cache
    _memory_cache.pop(key, None)
    return True


def invalidate_all(prefix: Optional[str] = None) -> int:
    """Invalidate all cached values, optionally filtered by prefix.

    Args:
        prefix: Optional prefix to filter (e.g., "fetch", "parse")

    Returns:
        Number of keys invalidated
    """
    count = 0
    pattern = f"guideline:{prefix}:*" if prefix else "guideline:*"

    # Try Redis first
    client = _get_redis_client()
    if client:
        try:
            keys = client.keys(pattern)
            if keys:
                count = client.delete(*keys)
        except Exception:
            pass

    # Also clear memory cache
    if prefix:
        keys_to_remove = [k for k in _memory_cache.keys() if k.startswith(f"guideline:{prefix}:")]
    else:
        keys_to_remove = [k for k in _memory_cache.keys() if k.startswith("guideline:")]

    for key in keys_to_remove:
        _memory_cache.pop(key, None)
        count += 1

    return count


def get_stats() -> dict:
    """Get cache statistics.

    Returns:
        Dictionary with cache statistics
    """
    stats = {
        "redis_available": False,
        "redis_connected": False,
        "memory_cache_size": len(_memory_cache),
        "prefixes": {},
    }

    client = _get_redis_client()
    if client:
        stats["redis_available"] = True
        stats["redis_connected"] = True

        try:
            # Count keys by prefix
            for prefix in ["fetch", "parse", "suggest"]:
                pattern = f"guideline:{prefix}:*"
                keys = client.keys(pattern)
                stats["prefixes"][prefix] = len(keys)
        except Exception:
            stats["redis_connected"] = False

    return stats


def health_check() -> dict:
    """Check cache health status.

    Returns:
        Health check result
    """
    client = _get_redis_client()

    if client:
        try:
            client.ping()
            info = client.info("memory")
            return {
                "status": "healthy",
                "backend": "redis",
                "used_memory": info.get("used_memory_human", "unknown"),
                "connected_clients": client.info("clients").get("connected_clients", 0),
            }
        except Exception as e:
            return {
                "status": "degraded",
                "backend": "memory",
                "error": str(e),
            }
    else:
        return {
            "status": "degraded",
            "backend": "memory",
            "error": "Redis not available",
        }

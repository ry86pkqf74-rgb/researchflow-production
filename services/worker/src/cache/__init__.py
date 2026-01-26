"""
Cache Module

Redis caching with optional Fernet encryption for PHI-safe caching.

Based on document_pdf.pdf specification (pages 17-19).

Usage:
    from cache.redis_cache import RedisCache

    cache = RedisCache.from_env()
    cache.set_json("key", {"data": "value"}, ttl_s=3600)
    data = cache.get_json("key")

PHI Considerations:
    - Default: Do NOT cache PHI-bearing content
    - If caching PHI: Use CACHE_FERNET_KEY for encryption and short TTLs
    - Consider de-identifying data before caching
"""

from .redis_cache import RedisCache, RedisCacheConfig

__all__ = ["RedisCache", "RedisCacheConfig"]

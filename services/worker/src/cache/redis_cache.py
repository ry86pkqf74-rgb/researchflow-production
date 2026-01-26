"""
Redis Cache with Optional Encryption

Generic Redis caching utility with optional Fernet encryption
for PHI-safe caching of sensitive data.

Based on document_pdf.pdf specification (pages 17-19).

Environment Variables:
    REDIS_URL: Redis connection URL (default: redis://localhost:6379/0)
    CACHE_TTL_S: Default TTL in seconds (default: 86400 = 24h)
    CACHE_PREFIX: Key prefix for namespacing (default: "worker")
    CACHE_FERNET_KEY: Optional Fernet key for encryption

PHI Considerations:
    - Safest default: cache only for de-identified inputs
    - If caching PHI: enable encryption with CACHE_FERNET_KEY
    - Use short TTLs for sensitive data
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

import redis

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RedisCacheConfig:
    """
    Redis cache configuration.

    All settings can be loaded from environment variables
    using the from_env() class method.
    """
    url: str
    default_ttl_s: int = 86400  # 24 hours
    prefix: str = "worker"
    fernet_key: Optional[str] = None  # Optional encryption key

    @classmethod
    def from_env(cls) -> "RedisCacheConfig":
        """
        Load configuration from environment variables.

        Optional:
            REDIS_URL: Connection URL (default: redis://localhost:6379/0)
            CACHE_TTL_S: Default TTL (default: 86400)
            CACHE_PREFIX: Key prefix (default: "worker")
            CACHE_FERNET_KEY: Encryption key (optional)
        """
        return cls(
            url=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
            default_ttl_s=int(os.getenv("CACHE_TTL_S", "86400")),
            prefix=os.getenv("CACHE_PREFIX", "worker"),
            fernet_key=os.getenv("CACHE_FERNET_KEY"),
        )


class RedisCache:
    """
    Redis cache with optional Fernet encryption.

    Stores JSON-serializable values with TTL expiration.
    Optionally encrypts values for PHI-safe caching.

    Example:
        cache = RedisCache.from_env()
        cache.set_json("my:key", {"data": "value"}, ttl_s=3600)
        data = cache.get_json("my:key")
    """

    def __init__(self, cfg: RedisCacheConfig) -> None:
        """
        Initialize Redis cache.

        Args:
            cfg: Cache configuration
        """
        self.cfg = cfg
        self.client = redis.Redis.from_url(cfg.url, decode_responses=False)
        self._fernet = None

        if cfg.fernet_key:
            try:
                from cryptography.fernet import Fernet
                self._fernet = Fernet(cfg.fernet_key.encode("utf-8"))
                logger.info("Redis cache encryption enabled")
            except ImportError:
                logger.warning(
                    "cryptography package not installed; "
                    "CACHE_FERNET_KEY will be ignored"
                )
            except Exception as e:
                logger.error(f"Failed to initialize Fernet: {e}")

    @classmethod
    def from_env(cls) -> "RedisCache":
        """Create cache from environment variables."""
        return cls(RedisCacheConfig.from_env())

    def _key(self, key: str) -> str:
        """Build full key with prefix."""
        return f"{self.cfg.prefix}:{key}"

    def _encrypt(self, raw: bytes) -> bytes:
        """Encrypt data if encryption is enabled."""
        if not self._fernet:
            return raw
        return self._fernet.encrypt(raw)

    def _decrypt(self, raw: bytes) -> bytes:
        """Decrypt data if encryption is enabled."""
        if not self._fernet:
            return raw
        return self._fernet.decrypt(raw)

    def get_json(self, key: str) -> Any | None:
        """
        Get JSON value from cache.

        Args:
            key: Cache key (without prefix)

        Returns:
            Deserialized value or None if not found/error
        """
        try:
            raw = self.client.get(self._key(key))
            if raw is None:
                return None

            raw = self._decrypt(raw)
            return json.loads(raw.decode("utf-8"))
        except Exception as e:
            logger.warning(f"Cache get failed for {key}: {e}")
            return None

    def set_json(
        self,
        key: str,
        value: Any,
        *,
        ttl_s: Optional[int] = None
    ) -> bool:
        """
        Set JSON value in cache.

        Args:
            key: Cache key (without prefix)
            value: JSON-serializable value
            ttl_s: TTL in seconds (uses default if not specified)

        Returns:
            True if successful, False otherwise
        """
        try:
            raw = json.dumps(value, ensure_ascii=False).encode("utf-8")
            raw = self._encrypt(raw)

            ttl = ttl_s if ttl_s is not None else self.cfg.default_ttl_s

            # Redis SET with EX (seconds TTL)
            self.client.set(self._key(key), raw, ex=ttl)
            return True
        except Exception as e:
            logger.warning(f"Cache set failed for {key}: {e}")
            return False

    def delete(self, key: str) -> bool:
        """
        Delete key from cache.

        Args:
            key: Cache key (without prefix)

        Returns:
            True if key was deleted, False otherwise
        """
        try:
            result = self.client.delete(self._key(key))
            return result > 0
        except Exception as e:
            logger.warning(f"Cache delete failed for {key}: {e}")
            return False

    def exists(self, key: str) -> bool:
        """
        Check if key exists in cache.

        Args:
            key: Cache key (without prefix)

        Returns:
            True if key exists
        """
        try:
            return self.client.exists(self._key(key)) > 0
        except Exception:
            return False

    def ttl(self, key: str) -> int:
        """
        Get remaining TTL for key.

        Args:
            key: Cache key (without prefix)

        Returns:
            TTL in seconds, -1 if no TTL, -2 if key doesn't exist
        """
        try:
            return self.client.ttl(self._key(key))
        except Exception:
            return -2

    @staticmethod
    def stable_text_key(
        namespace: str,
        text: str,
        *,
        extra: str = ""
    ) -> str:
        """
        Generate a stable cache key from text content.

        Uses SHA-256 hash to create deterministic keys for
        text-based cache lookups (e.g., LLM extraction results).

        Args:
            namespace: Key namespace (e.g., "llm_extract")
            text: Text content to hash
            extra: Additional discriminator (e.g., model name)

        Returns:
            Cache key in format "{namespace}:{hash}"
        """
        h = hashlib.sha256()
        h.update(namespace.encode("utf-8"))
        h.update(b":")
        h.update(extra.encode("utf-8"))
        h.update(b":")
        h.update(text.encode("utf-8"))

        digest = base64.urlsafe_b64encode(h.digest()).decode("ascii").rstrip("=")
        return f"{namespace}:{digest}"

    def ping(self) -> bool:
        """
        Test Redis connection.

        Returns:
            True if connected successfully
        """
        try:
            return self.client.ping()
        except Exception as e:
            logger.error(f"Redis ping failed: {e}")
            return False


def cached_extraction(
    cache: RedisCache,
    extract_fn,
    text: str,
    model: str,
    *,
    ttl_s: Optional[int] = None,
) -> dict:
    """
    Wrapper for caching LLM extraction results.

    Example:
        result = cached_extraction(
            cache,
            llm.extract,
            operative_note_text,
            "gpt-4",
            ttl_s=604800  # 1 week
        )

    Args:
        cache: RedisCache instance
        extract_fn: Extraction function to call on cache miss
        text: Input text
        model: Model identifier (for cache key)
        ttl_s: Cache TTL in seconds

    Returns:
        Extraction result (from cache or fresh)
    """
    key = cache.stable_text_key("llm_extract", text, extra=model)

    # Try cache
    hit = cache.get_json(key)
    if hit is not None:
        logger.debug(f"Cache hit for extraction: {key[:50]}...")
        return hit

    # Cache miss - run extraction
    logger.debug(f"Cache miss for extraction: {key[:50]}...")
    result = extract_fn(text)

    # Store in cache
    cache.set_json(key, result, ttl_s=ttl_s)

    return result

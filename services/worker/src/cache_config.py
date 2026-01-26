"""
Cache Configuration Module

Centralized cache settings for the worker service.
Phase 04: Throughput via Safe Caching

See docs/configuration/env-vars.md for the full registry.
"""

from __future__ import annotations

import os
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)


def _parse_bool(value: str | None, default: bool) -> bool:
    """Parse boolean from environment variable."""
    if value is None:
        return default
    v = value.strip().lower()
    if v in {"1", "true", "t", "yes", "y", "on"}:
        return True
    if v in {"0", "false", "f", "no", "n", "off"}:
        return False
    logger.warning(f"Invalid boolean value '{value}', using default: {default}")
    return default


def _parse_int(value: str | None, default: int) -> int:
    """Parse integer from environment variable."""
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        logger.warning(f"Invalid integer value '{value}', using default: {default}")
        return default


@dataclass(frozen=True)
class LiteratureCacheConfig:
    """
    Literature search cache configuration.

    Environment Variables:
        LIT_CACHE_ENABLED: Enable literature search caching (default: true)
        LIT_CACHE_TTL_SECONDS: Cache TTL in seconds (default: 86400 / 24h)
        LIT_CACHE_MAXSIZE: Maximum cache entries (default: 1000)
        LITERATURE_CACHE_TTL_SECONDS: Legacy alias for TTL
    """
    enabled: bool = True
    ttl_seconds: int = 86400  # 24 hours
    maxsize: int = 1000

    @staticmethod
    def from_env() -> "LiteratureCacheConfig":
        """Load configuration from environment variables."""
        # Check for new vars first, fall back to legacy
        ttl = _parse_int(
            os.getenv("LIT_CACHE_TTL_SECONDS") or os.getenv("LITERATURE_CACHE_TTL_SECONDS"),
            86400
        )
        return LiteratureCacheConfig(
            enabled=_parse_bool(os.getenv("LIT_CACHE_ENABLED"), True),
            ttl_seconds=ttl,
            maxsize=_parse_int(os.getenv("LIT_CACHE_MAXSIZE"), 1000),
        )


@dataclass(frozen=True)
class IRBCacheConfig:
    """
    IRB draft cache configuration.

    WARNING: IRB caching should only be enabled if:
    - Draft output is already redacted or PHI-safe
    - Request body does not contain PHI
    - Inputs are normalized and hashed for keys

    Environment Variables:
        IRB_DRAFT_CACHE_ENABLED: Enable IRB draft caching (default: false)
        IRB_DRAFT_CACHE_TTL_SECONDS: Cache TTL in seconds (default: 3600)
        IRB_DRAFT_CACHE_MAXSIZE: Maximum cache entries (default: 100)
    """
    enabled: bool = False  # Disabled by default for PHI safety
    ttl_seconds: int = 3600  # 1 hour
    maxsize: int = 100

    @staticmethod
    def from_env() -> "IRBCacheConfig":
        """Load configuration from environment variables."""
        return IRBCacheConfig(
            enabled=_parse_bool(os.getenv("IRB_DRAFT_CACHE_ENABLED"), False),
            ttl_seconds=_parse_int(os.getenv("IRB_DRAFT_CACHE_TTL_SECONDS"), 3600),
            maxsize=_parse_int(os.getenv("IRB_DRAFT_CACHE_MAXSIZE"), 100),
        )


@dataclass(frozen=True)
class CacheConfig:
    """
    Unified cache configuration for the worker service.

    Access via: get_cache_config()
    """
    literature: LiteratureCacheConfig
    irb: IRBCacheConfig

    @staticmethod
    def from_env() -> "CacheConfig":
        """Load all cache configurations from environment."""
        return CacheConfig(
            literature=LiteratureCacheConfig.from_env(),
            irb=IRBCacheConfig.from_env(),
        )

    def to_safe_dict(self) -> dict[str, Any]:
        """Return configuration as a dictionary (safe for logging)."""
        return {
            "literature": {
                "enabled": self.literature.enabled,
                "ttl_seconds": self.literature.ttl_seconds,
                "maxsize": self.literature.maxsize,
            },
            "irb": {
                "enabled": self.irb.enabled,
                "ttl_seconds": self.irb.ttl_seconds,
                "maxsize": self.irb.maxsize,
            },
        }


@lru_cache(maxsize=1)
def get_cache_config() -> CacheConfig:
    """
    Get the singleton cache configuration.

    Configuration is loaded once from environment variables
    and cached for the lifetime of the process.

    Returns:
        CacheConfig instance
    """
    config = CacheConfig.from_env()
    logger.info(f"Loaded cache configuration: {config.to_safe_dict()}")
    return config


# Convenience exports
def get_literature_cache_config() -> LiteratureCacheConfig:
    """Get literature cache configuration."""
    return get_cache_config().literature


def get_irb_cache_config() -> IRBCacheConfig:
    """Get IRB cache configuration."""
    return get_cache_config().irb

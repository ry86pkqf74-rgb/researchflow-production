"""Literature provider registry for plugin-style provider management.

Thread Safety / Intended Use:
    This registry uses a module-level dictionary without synchronization primitives.
    It is designed for single-threaded, process-local use (typical for pytest execution
    and lightweight, non-concurrent orchestration).

    This implementation is NOT a production-grade, concurrency-safe registry. Production
    services that require concurrent or multi-threaded access MUST either:
      - wrap this registry with appropriate synchronization in their own process
        boundary, or
      - use a separate, governance-reviewed registry implementation that provides
        explicit concurrency guarantees.

Test Isolation:
    Tests use try-finally blocks to ensure registry cleanup. For pytest parallel
    execution, tests should run serially or use separate processes to avoid
    registry state conflicts.
"""

from __future__ import annotations

from ..provider import OnlineLiteratureProvider, PaperMetadata

# Type alias for clarity (same as OnlineLiteratureProvider)
LiteratureProvider = OnlineLiteratureProvider

_REGISTRY: dict[str, OnlineLiteratureProvider] = {}


def register(name: str, provider: OnlineLiteratureProvider) -> None:
    """Register a literature provider.

    Args:
        name: Unique provider name (lowercase, e.g., 'pubmed', 'semantic_scholar')
        provider: Provider instance implementing OnlineLiteratureProvider protocol.
                 Must have 'name' attribute and 'search' method per protocol.

    Raises:
        ValueError: If name is empty, provider already registered, or provider
                   doesn't implement the required protocol
    """
    if not name or not name.strip():
        raise ValueError("Provider name cannot be empty")

    name = name.lower().strip()

    if name in _REGISTRY:
        raise ValueError(f"Provider '{name}' is already registered")

    # Validate provider implements required protocol
    if not hasattr(provider, "name"):
        raise ValueError(
            f"Provider must have 'name' attribute (OnlineLiteratureProvider protocol)"
        )
    if not hasattr(provider, "search") or not callable(getattr(provider, "search")):
        raise ValueError(
            f"Provider must have callable 'search' method (OnlineLiteratureProvider protocol)"
        )

    _REGISTRY[name] = provider


def get(name: str) -> OnlineLiteratureProvider:
    """Get a registered provider by name.

    Args:
        name: Provider name (case-insensitive)

    Returns:
        Provider instance

    Raises:
        KeyError: If provider not found
    """
    name = name.lower().strip()

    if name not in _REGISTRY:
        available = ", ".join(sorted(_REGISTRY.keys()))
        raise KeyError(
            f"Literature provider '{name}' not registered. "
            f"Available providers: {available or 'none'}"
        )

    return _REGISTRY[name]


def has_provider(name: str) -> bool:
    """Check if a provider is registered.

    Args:
        name: Provider name (case-insensitive)

    Returns:
        True if provider is registered, False otherwise
    """
    return name.lower().strip() in _REGISTRY


def list_providers() -> list[str]:
    """List all registered provider names.

    Returns:
        Sorted list of provider names
    """
    return sorted(_REGISTRY.keys())


def unregister(name: str) -> None:
    """Unregister a provider (primarily for testing).

    Args:
        name: Provider name to remove

    Raises:
        KeyError: If provider not found
    """
    name = name.lower().strip()

    if name not in _REGISTRY:
        raise KeyError(f"Provider '{name}' not registered")

    del _REGISTRY[name]


def _auto_register_builtin_providers() -> None:
    """Auto-register built-in providers on module import."""
    from ..provider import PubMedProvider

    # Only register if not already present (allows override)
    if not has_provider("pubmed"):
        register("pubmed", PubMedProvider())


# Perform auto-registration on import
_auto_register_builtin_providers()


__all__ = [
    "register",
    "get",
    "has_provider",
    "list_providers",
    "unregister",
    "LiteratureProvider",
]

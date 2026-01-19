"""
Vector Store Module
Phase A - Task 32: Weaviate Vector Store
"""

from .weaviate_client import (
    WeaviateClient,
    WeaviateError,
    IndexResult,
    SearchResult,
    get_weaviate_client
)

__all__ = [
    "WeaviateClient",
    "WeaviateError",
    "IndexResult",
    "SearchResult",
    "get_weaviate_client"
]

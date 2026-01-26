"""
Vector Database Module for Phase C

Provides Chroma vector DB integration for semantic literature search.
"""

from .chroma_client import ChromaVectorStore, get_chroma_client
from .embeddings import EmbeddingProvider, get_embedding_provider

__all__ = [
    "ChromaVectorStore",
    "get_chroma_client",
    "EmbeddingProvider",
    "get_embedding_provider",
]

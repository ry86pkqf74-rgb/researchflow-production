"""
Embedding Provider for Vector Search

Supports OpenAI embeddings with fallback to local sentence-transformers.
"""

from __future__ import annotations

import os
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmbeddingResult:
    """Result of an embedding operation."""
    embeddings: List[List[float]]
    model: str
    provider: str
    dimension: int


class BaseEmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name."""
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Embedding dimension."""
        pass

    @abstractmethod
    def embed(self, texts: List[str]) -> EmbeddingResult:
        """Generate embeddings for a list of texts."""
        pass


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """OpenAI embeddings using text-embedding-3-small by default."""

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None):
        self.model = model or os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")

        # Dimension based on model
        self._dimensions = {
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
            "text-embedding-ada-002": 1536,
        }

    @property
    def name(self) -> str:
        return "openai"

    @property
    def dimension(self) -> int:
        return self._dimensions.get(self.model, 1536)

    def embed(self, texts: List[str]) -> EmbeddingResult:
        """Generate embeddings using OpenAI API."""
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY not set for embeddings")

        import httpx

        # Process in batches of 100 (OpenAI limit)
        all_embeddings: List[List[float]] = []
        batch_size = 100

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            response = httpx.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "input": batch,
                    "model": self.model,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()

            # Extract embeddings in order
            for item in sorted(data["data"], key=lambda x: x["index"]):
                all_embeddings.append(item["embedding"])

        return EmbeddingResult(
            embeddings=all_embeddings,
            model=self.model,
            provider="openai",
            dimension=self.dimension,
        )


class SentenceTransformerProvider(BaseEmbeddingProvider):
    """Local sentence-transformers embeddings."""

    def __init__(self, model: Optional[str] = None):
        self.model_name = model or "all-MiniLM-L6-v2"
        self._model = None
        self._dimension = 384  # Default for MiniLM

    @property
    def name(self) -> str:
        return "sentence-transformers"

    @property
    def dimension(self) -> int:
        return self._dimension

    def _get_model(self):
        """Lazy load the model."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
                self._dimension = self._model.get_sentence_embedding_dimension()
            except ImportError:
                raise RuntimeError(
                    "sentence-transformers not installed. "
                    "Install with: pip install sentence-transformers"
                )
        return self._model

    def embed(self, texts: List[str]) -> EmbeddingResult:
        """Generate embeddings using sentence-transformers."""
        model = self._get_model()
        embeddings = model.encode(texts, show_progress_bar=False)

        return EmbeddingResult(
            embeddings=[e.tolist() for e in embeddings],
            model=self.model_name,
            provider="sentence-transformers",
            dimension=self.dimension,
        )


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """Mock embeddings for testing."""

    def __init__(self, dimension: int = 384):
        self._dimension = dimension

    @property
    def name(self) -> str:
        return "mock"

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed(self, texts: List[str]) -> EmbeddingResult:
        """Generate mock embeddings (zeros)."""
        import random
        random.seed(42)

        embeddings = [
            [random.random() for _ in range(self._dimension)]
            for _ in texts
        ]

        return EmbeddingResult(
            embeddings=embeddings,
            model="mock",
            provider="mock",
            dimension=self._dimension,
        )


class EmbeddingProvider:
    """Factory for creating embedding providers."""

    _instance: Optional[BaseEmbeddingProvider] = None

    @classmethod
    def get(cls, provider: Optional[str] = None) -> BaseEmbeddingProvider:
        """Get embedding provider based on configuration."""
        if cls._instance is not None:
            return cls._instance

        provider_name = provider or os.getenv("EMBEDDINGS_PROVIDER", "openai")

        if provider_name == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                cls._instance = OpenAIEmbeddingProvider()
            else:
                logger.warning("OPENAI_API_KEY not set, falling back to local embeddings")
                cls._instance = cls._get_local_provider()
        elif provider_name == "local":
            cls._instance = cls._get_local_provider()
        elif provider_name == "mock":
            cls._instance = MockEmbeddingProvider()
        else:
            logger.warning(f"Unknown embedding provider: {provider_name}, using mock")
            cls._instance = MockEmbeddingProvider()

        return cls._instance

    @classmethod
    def _get_local_provider(cls) -> BaseEmbeddingProvider:
        """Get local embedding provider with fallback to mock."""
        try:
            return SentenceTransformerProvider()
        except Exception as e:
            logger.warning(f"Could not load sentence-transformers: {e}, using mock")
            return MockEmbeddingProvider()

    @classmethod
    def reset(cls):
        """Reset the singleton instance."""
        cls._instance = None


def get_embedding_provider(provider: Optional[str] = None) -> BaseEmbeddingProvider:
    """Get the embedding provider."""
    return EmbeddingProvider.get(provider)

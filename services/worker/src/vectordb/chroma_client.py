"""
Chroma Vector Database Client for Phase C

Provides semantic search capabilities for literature and data.
"""

from __future__ import annotations

import os
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from .embeddings import get_embedding_provider

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SearchResult:
    """Result of a vector search."""
    id: str
    document: str
    metadata: Dict[str, Any]
    score: float


@dataclass(frozen=True)
class IndexResult:
    """Result of an indexing operation."""
    indexed_count: int
    updated_count: int
    collection: str


class ChromaVectorStore:
    """
    Chroma vector database client with support for:
    - Persistent storage
    - Multiple collections
    - Metadata filtering
    - Semantic search
    """

    def __init__(
        self,
        persist_dir: Optional[str] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
    ):
        """
        Initialize Chroma client.

        Args:
            persist_dir: Directory for persistent storage (embedded mode)
            host: Chroma server host (client/server mode)
            port: Chroma server port (client/server mode)
        """
        self.persist_dir = persist_dir or os.getenv("CHROMA_PERSIST_DIR", "/data/chroma")
        self.host = host or os.getenv("CHROMA_HOST")
        self.port = port or int(os.getenv("CHROMA_PORT", "8000"))

        self._client = None
        self._embedding_provider = None

    def _get_client(self):
        """Lazy initialize Chroma client."""
        if self._client is not None:
            return self._client

        try:
            import chromadb
            from chromadb.config import Settings
        except ImportError:
            raise RuntimeError(
                "chromadb not installed. Install with: pip install chromadb"
            )

        if self.host:
            # Client/server mode
            logger.info(f"Connecting to Chroma server at {self.host}:{self.port}")
            self._client = chromadb.HttpClient(
                host=self.host,
                port=self.port,
            )
        else:
            # Embedded mode with persistence
            logger.info(f"Using embedded Chroma with persistence at {self.persist_dir}")
            os.makedirs(self.persist_dir, exist_ok=True)

            self._client = chromadb.Client(Settings(
                chroma_db_impl="duckdb+parquet",
                persist_directory=self.persist_dir,
                anonymized_telemetry=False,
            ))

        return self._client

    def _get_embedding_provider(self):
        """Get the embedding provider."""
        if self._embedding_provider is None:
            self._embedding_provider = get_embedding_provider()
        return self._embedding_provider

    def get_or_create_collection(
        self,
        name: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Get or create a collection."""
        client = self._get_client()
        return client.get_or_create_collection(
            name=name,
            metadata=metadata or {"description": f"Collection: {name}"},
        )

    def delete_collection(self, name: str):
        """Delete a collection."""
        client = self._get_client()
        try:
            client.delete_collection(name)
            logger.info(f"Deleted collection: {name}")
        except Exception as e:
            logger.warning(f"Could not delete collection {name}: {e}")

    def index_documents(
        self,
        collection_name: str,
        documents: List[str],
        ids: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        embeddings: Optional[List[List[float]]] = None,
    ) -> IndexResult:
        """
        Index documents into a collection.

        Args:
            collection_name: Name of the collection
            documents: List of document texts
            ids: List of unique document IDs
            metadatas: Optional list of metadata dicts
            embeddings: Optional pre-computed embeddings

        Returns:
            IndexResult with counts
        """
        if len(documents) != len(ids):
            raise ValueError("documents and ids must have the same length")

        if metadatas and len(metadatas) != len(documents):
            raise ValueError("metadatas must have the same length as documents")

        collection = self.get_or_create_collection(collection_name)

        # Generate embeddings if not provided
        if embeddings is None:
            provider = self._get_embedding_provider()
            result = provider.embed(documents)
            embeddings = result.embeddings

        # Prepare metadata (Chroma requires non-null metadata)
        if metadatas is None:
            metadatas = [{}] * len(documents)

        # Filter out None values from metadata
        clean_metadatas = []
        for m in metadatas:
            clean = {
                k: v for k, v in (m or {}).items()
                if v is not None and not isinstance(v, (list, dict))
            }
            clean_metadatas.append(clean)

        # Check for existing IDs
        existing = set()
        try:
            existing_docs = collection.get(ids=ids)
            existing = set(existing_docs.get("ids", []))
        except Exception:
            pass

        # Separate updates and inserts
        new_ids = []
        new_docs = []
        new_embeddings = []
        new_metadatas = []

        update_ids = []
        update_docs = []
        update_embeddings = []
        update_metadatas = []

        for i, doc_id in enumerate(ids):
            if doc_id in existing:
                update_ids.append(doc_id)
                update_docs.append(documents[i])
                update_embeddings.append(embeddings[i])
                update_metadatas.append(clean_metadatas[i])
            else:
                new_ids.append(doc_id)
                new_docs.append(documents[i])
                new_embeddings.append(embeddings[i])
                new_metadatas.append(clean_metadatas[i])

        # Insert new documents
        if new_ids:
            collection.add(
                ids=new_ids,
                documents=new_docs,
                embeddings=new_embeddings,
                metadatas=new_metadatas,
            )
            logger.info(f"Indexed {len(new_ids)} new documents in {collection_name}")

        # Update existing documents
        if update_ids:
            collection.update(
                ids=update_ids,
                documents=update_docs,
                embeddings=update_embeddings,
                metadatas=update_metadatas,
            )
            logger.info(f"Updated {len(update_ids)} documents in {collection_name}")

        return IndexResult(
            indexed_count=len(new_ids),
            updated_count=len(update_ids),
            collection=collection_name,
        )

    def search(
        self,
        collection_name: str,
        query: str,
        k: int = 10,
        where: Optional[Dict[str, Any]] = None,
        where_document: Optional[Dict[str, Any]] = None,
    ) -> List[SearchResult]:
        """
        Search for similar documents.

        Args:
            collection_name: Name of the collection
            query: Search query text
            k: Number of results to return
            where: Metadata filter
            where_document: Document content filter

        Returns:
            List of SearchResult objects
        """
        collection = self.get_or_create_collection(collection_name)

        # Generate query embedding
        provider = self._get_embedding_provider()
        result = provider.embed([query])
        query_embedding = result.embeddings[0]

        # Search
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            where=where,
            where_document=where_document,
            include=["documents", "metadatas", "distances"],
        )

        # Convert to SearchResult objects
        search_results = []
        if results and results.get("ids") and results["ids"][0]:
            ids = results["ids"][0]
            documents = results["documents"][0] if results.get("documents") else [""] * len(ids)
            metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(ids)
            distances = results["distances"][0] if results.get("distances") else [0.0] * len(ids)

            for i, doc_id in enumerate(ids):
                # Convert distance to similarity score (Chroma uses L2 distance)
                # Lower distance = higher similarity
                score = 1.0 / (1.0 + distances[i]) if distances[i] >= 0 else 0.0

                search_results.append(SearchResult(
                    id=doc_id,
                    document=documents[i] if documents else "",
                    metadata=metadatas[i] if metadatas else {},
                    score=score,
                ))

        return search_results

    def search_by_embedding(
        self,
        collection_name: str,
        embedding: List[float],
        k: int = 10,
        where: Optional[Dict[str, Any]] = None,
    ) -> List[SearchResult]:
        """
        Search by pre-computed embedding.

        Args:
            collection_name: Name of the collection
            embedding: Pre-computed query embedding
            k: Number of results to return
            where: Metadata filter

        Returns:
            List of SearchResult objects
        """
        collection = self.get_or_create_collection(collection_name)

        results = collection.query(
            query_embeddings=[embedding],
            n_results=k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        search_results = []
        if results and results.get("ids") and results["ids"][0]:
            ids = results["ids"][0]
            documents = results["documents"][0] if results.get("documents") else [""] * len(ids)
            metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(ids)
            distances = results["distances"][0] if results.get("distances") else [0.0] * len(ids)

            for i, doc_id in enumerate(ids):
                score = 1.0 / (1.0 + distances[i]) if distances[i] >= 0 else 0.0
                search_results.append(SearchResult(
                    id=doc_id,
                    document=documents[i] if documents else "",
                    metadata=metadatas[i] if metadatas else {},
                    score=score,
                ))

        return search_results

    def get_by_ids(
        self,
        collection_name: str,
        ids: List[str],
    ) -> List[Tuple[str, str, Dict[str, Any]]]:
        """
        Get documents by IDs.

        Args:
            collection_name: Name of the collection
            ids: List of document IDs

        Returns:
            List of (id, document, metadata) tuples
        """
        collection = self.get_or_create_collection(collection_name)
        results = collection.get(ids=ids, include=["documents", "metadatas"])

        output = []
        if results and results.get("ids"):
            for i, doc_id in enumerate(results["ids"]):
                doc = results["documents"][i] if results.get("documents") else ""
                meta = results["metadatas"][i] if results.get("metadatas") else {}
                output.append((doc_id, doc, meta))

        return output

    def delete_by_ids(
        self,
        collection_name: str,
        ids: List[str],
    ) -> int:
        """
        Delete documents by IDs.

        Args:
            collection_name: Name of the collection
            ids: List of document IDs to delete

        Returns:
            Number of documents deleted
        """
        collection = self.get_or_create_collection(collection_name)

        # Get existing IDs
        existing = collection.get(ids=ids)
        existing_ids = set(existing.get("ids", []))
        ids_to_delete = [i for i in ids if i in existing_ids]

        if ids_to_delete:
            collection.delete(ids=ids_to_delete)
            logger.info(f"Deleted {len(ids_to_delete)} documents from {collection_name}")

        return len(ids_to_delete)

    def count(self, collection_name: str) -> int:
        """Get the number of documents in a collection."""
        collection = self.get_or_create_collection(collection_name)
        return collection.count()

    def persist(self):
        """Persist the database to disk (for embedded mode)."""
        client = self._get_client()
        if hasattr(client, "persist"):
            client.persist()
            logger.info("Persisted Chroma database")


# Singleton instance
_chroma_instance: Optional[ChromaVectorStore] = None


def get_chroma_client() -> ChromaVectorStore:
    """Get or create the Chroma client singleton."""
    global _chroma_instance
    if _chroma_instance is None:
        _chroma_instance = ChromaVectorStore()
    return _chroma_instance


def reset_chroma_client():
    """Reset the singleton instance."""
    global _chroma_instance
    _chroma_instance = None

"""
Weaviate Vector Store Client
Phase A - Task 32: Weaviate Vector Store

Provides vector indexing and semantic search for research artifacts.
"""

import os
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import logging
import weaviate
from weaviate.classes.init import Auth
from weaviate.classes.config import Property, DataType, Configure
from weaviate.exceptions import WeaviateBaseError

logger = logging.getLogger(__name__)

# Configuration
WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://weaviate:8080")
WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY")  # Optional for auth


@dataclass(frozen=True)
class IndexResult:
    """Result of vector indexing operation"""
    artifact_id: str
    success: bool
    uuid: Optional[str] = None
    error: Optional[str] = None


@dataclass(frozen=True)
class SearchResult:
    """Individual search result"""
    artifact_id: str
    content: str
    metadata: Dict[str, Any]
    score: Optional[float] = None  # Distance/similarity score
    uuid: Optional[str] = None


class WeaviateError(RuntimeError):
    """Raised when Weaviate operations fail"""
    pass


class WeaviateClient:
    """
    Client for Weaviate vector database

    Following ResearchFlow patterns:
    - Lazy connection (connect on first use)
    - Fail-closed on connection errors
    - Automatic schema management
    - Supports semantic and hybrid search
    """

    # Schema class name
    CLASS_NAME = "ResearchArtifact"

    def __init__(self, url: str = WEAVIATE_URL, api_key: Optional[str] = WEAVIATE_API_KEY):
        self.url = url
        self.api_key = api_key
        self._client = None
        self._schema_ensured = False

    @property
    def client(self):
        """Lazy connection to Weaviate"""
        if self._client is None:
            try:
                logger.info(f"Connecting to Weaviate at {self.url}")

                # Connect with or without authentication
                if self.api_key:
                    self._client = weaviate.Client(
                        url=self.url,
                        auth_client_secret=Auth.api_key(self.api_key)
                    )
                else:
                    self._client = weaviate.Client(url=self.url)

                # Test connection
                if not self._client.is_ready():
                    raise WeaviateError("Weaviate is not ready")

                logger.info("Connected to Weaviate successfully")

                # Ensure schema exists
                if not self._schema_ensured:
                    self._ensure_schema()
                    self._schema_ensured = True

            except WeaviateBaseError as e:
                raise WeaviateError(f"Failed to connect to Weaviate: {e}")
            except Exception as e:
                raise WeaviateError(f"Weaviate connection failed: {e}")

        return self._client

    def _ensure_schema(self) -> None:
        """Create schema if it doesn't exist"""
        try:
            # Check if class already exists
            existing_schema = self.client.schema.get()
            class_names = [c["class"] for c in existing_schema.get("classes", [])]

            if self.CLASS_NAME in class_names:
                logger.info(f"Schema class {self.CLASS_NAME} already exists")
                return

            # Define schema
            schema = {
                "class": self.CLASS_NAME,
                "description": "Research artifacts with vector embeddings",
                "vectorizer": "text2vec-transformers",
                "moduleConfig": {
                    "text2vec-transformers": {
                        "poolingStrategy": "masked_mean",
                        "vectorizeClassName": False
                    }
                },
                "properties": [
                    {
                        "name": "artifactId",
                        "dataType": ["text"],
                        "description": "Unique artifact identifier",
                        "indexInverted": True
                    },
                    {
                        "name": "content",
                        "dataType": ["text"],
                        "description": "Artifact content for vectorization",
                        "moduleConfig": {
                            "text2vec-transformers": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                        }
                    },
                    {
                        "name": "metadata",
                        "dataType": ["object"],
                        "description": "Artifact metadata",
                        "nestedProperties": [
                            {"name": "author", "dataType": ["text"]},
                            {"name": "source", "dataType": ["text"]},
                            {"name": "tags", "dataType": ["text[]"]}
                        ]
                    },
                    {
                        "name": "timestamp",
                        "dataType": ["date"],
                        "description": "Indexing timestamp"
                    }
                ]
            }

            # Create class
            self.client.schema.create_class(schema)
            logger.info(f"Created schema class: {self.CLASS_NAME}")

        except Exception as e:
            raise WeaviateError(f"Schema creation failed: {e}")

    def index_artifact(
        self,
        artifact_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> IndexResult:
        """
        Index research artifact with automatic embedding

        Args:
            artifact_id: Unique identifier for artifact
            content: Text content to vectorize
            metadata: Optional metadata dictionary

        Returns:
            IndexResult with success status

        Raises:
            WeaviateError: If indexing fails
        """
        if not content or len(content.strip()) == 0:
            raise WeaviateError("Content cannot be empty")

        try:
            logger.info(f"Indexing artifact {artifact_id} ({len(content)} chars)")

            # Prepare data object
            data_object = {
                "artifactId": artifact_id,
                "content": content,
                "metadata": metadata or {},
                "timestamp": datetime.utcnow().isoformat()
            }

            # Create object (automatic vectorization)
            uuid = self.client.data_object.create(
                data_object=data_object,
                class_name=self.CLASS_NAME
            )

            logger.info(f"Artifact {artifact_id} indexed successfully (UUID: {uuid})")

            return IndexResult(
                artifact_id=artifact_id,
                success=True,
                uuid=uuid
            )

        except WeaviateBaseError as e:
            error_msg = f"Indexing failed for {artifact_id}: {e}"
            logger.error(error_msg)
            return IndexResult(
                artifact_id=artifact_id,
                success=False,
                error=error_msg
            )

    def semantic_search(
        self,
        query: str,
        limit: int = 10,
        min_certainty: float = 0.7
    ) -> List[SearchResult]:
        """
        Search by semantic similarity

        Args:
            query: Search query text
            limit: Maximum number of results
            min_certainty: Minimum certainty score (0.0-1.0)

        Returns:
            List of SearchResult objects
        """
        try:
            logger.info(f"Semantic search: '{query}' (limit={limit})")

            result = (
                self.client.query
                .get(self.CLASS_NAME, ["artifactId", "content", "metadata"])
                .with_near_text({"concepts": [query], "certainty": min_certainty})
                .with_limit(limit)
                .with_additional(["id", "certainty"])
                .do()
            )

            # Parse results
            search_results = []
            artifacts = result.get("data", {}).get("Get", {}).get(self.CLASS_NAME, [])

            for item in artifacts:
                search_results.append(SearchResult(
                    artifact_id=item.get("artifactId"),
                    content=item.get("content"),
                    metadata=item.get("metadata", {}),
                    score=item.get("_additional", {}).get("certainty"),
                    uuid=item.get("_additional", {}).get("id")
                ))

            logger.info(f"Found {len(search_results)} results")

            return search_results

        except WeaviateBaseError as e:
            raise WeaviateError(f"Semantic search failed: {e}")

    def hybrid_search(
        self,
        query: str,
        limit: int = 10,
        alpha: float = 0.5
    ) -> List[SearchResult]:
        """
        Hybrid BM25 + vector search

        Args:
            query: Search query text
            limit: Maximum number of results
            alpha: Balance between BM25 (0.0) and vector (1.0)

        Returns:
            List of SearchResult objects
        """
        try:
            logger.info(f"Hybrid search: '{query}' (alpha={alpha})")

            result = (
                self.client.query
                .get(self.CLASS_NAME, ["artifactId", "content", "metadata"])
                .with_hybrid(query=query, alpha=alpha)
                .with_limit(limit)
                .with_additional(["id", "score"])
                .do()
            )

            # Parse results
            search_results = []
            artifacts = result.get("data", {}).get("Get", {}).get(self.CLASS_NAME, [])

            for item in artifacts:
                search_results.append(SearchResult(
                    artifact_id=item.get("artifactId"),
                    content=item.get("content"),
                    metadata=item.get("metadata", {}),
                    score=item.get("_additional", {}).get("score"),
                    uuid=item.get("_additional", {}).get("id")
                ))

            logger.info(f"Found {len(search_results)} results")

            return search_results

        except WeaviateBaseError as e:
            raise WeaviateError(f"Hybrid search failed: {e}")

    def delete_artifact(self, artifact_id: str) -> bool:
        """
        Delete artifact by ID

        Args:
            artifact_id: Artifact identifier

        Returns:
            True if deleted, False if not found
        """
        try:
            # Find by artifact_id
            result = (
                self.client.query
                .get(self.CLASS_NAME, ["artifactId"])
                .with_where({
                    "path": ["artifactId"],
                    "operator": "Equal",
                    "valueText": artifact_id
                })
                .with_additional(["id"])
                .do()
            )

            artifacts = result.get("data", {}).get("Get", {}).get(self.CLASS_NAME, [])

            if not artifacts:
                logger.warning(f"Artifact not found: {artifact_id}")
                return False

            # Delete by UUID
            uuid = artifacts[0]["_additional"]["id"]
            self.client.data_object.delete(uuid, class_name=self.CLASS_NAME)

            logger.info(f"Deleted artifact {artifact_id}")
            return True

        except WeaviateBaseError as e:
            raise WeaviateError(f"Delete failed for {artifact_id}: {e}")


# Singleton instance (lazy loading)
_weaviate_client: Optional[WeaviateClient] = None


def get_weaviate_client() -> WeaviateClient:
    """Get global Weaviate client instance"""
    global _weaviate_client
    if _weaviate_client is None:
        _weaviate_client = WeaviateClient()
    return _weaviate_client

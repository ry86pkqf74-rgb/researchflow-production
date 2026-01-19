"""
Literature Vector Index

Specialized indexing for literature papers in Weaviate.
Provides semantic search across paper titles and abstracts.
"""

from __future__ import annotations

import os
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import hashlib

from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)

WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://weaviate:8080")
CLASS_NAME = os.getenv("WEAVIATE_CLASS_LITERATURE", "LiteraturePaper")
ENABLE_VECTOR_INDEXING = os.getenv("ENABLE_VECTOR_INDEXING", "true").lower() == "true"


@dataclass
class LiteratureSearchResult:
    """Search result from literature index"""
    paper_id: str
    title: str
    abstract: Optional[str]
    year: Optional[int]
    doi: Optional[str]
    source: str
    score: float
    metadata: Dict[str, Any]


class LiteratureIndexer:
    """
    Manages literature paper indexing in Weaviate.

    Features:
    - PHI guard on all indexed content
    - Deterministic IDs from DOI/PMID
    - Semantic similarity search
    - Hybrid search (keyword + vector)
    """

    def __init__(self, url: str = WEAVIATE_URL, class_name: str = CLASS_NAME):
        self.url = url
        self.class_name = class_name
        self._client = None
        self._schema_ensured = False

    @property
    def enabled(self) -> bool:
        """Check if vector indexing is enabled"""
        return ENABLE_VECTOR_INDEXING

    def _get_client(self):
        """Lazy connection to Weaviate"""
        if not self.enabled:
            raise RuntimeError("Vector indexing is disabled (ENABLE_VECTOR_INDEXING=false)")

        if self._client is None:
            try:
                import weaviate
                self._client = weaviate.Client(self.url)

                if not self._client.is_ready():
                    raise RuntimeError("Weaviate is not ready")

                if not self._schema_ensured:
                    self._ensure_schema()
                    self._schema_ensured = True

            except ImportError:
                raise RuntimeError("weaviate-client package not installed")
            except Exception as e:
                raise RuntimeError(f"Failed to connect to Weaviate: {e}")

        return self._client

    def _ensure_schema(self):
        """Ensure literature schema exists in Weaviate"""
        client = self._client

        if client.schema.exists(self.class_name):
            logger.debug(f"Schema {self.class_name} already exists")
            return

        logger.info(f"Creating schema {self.class_name}")

        schema = {
            "class": self.class_name,
            "description": "Research literature papers for semantic search",
            "vectorizer": "text2vec-transformers",
            "moduleConfig": {
                "text2vec-transformers": {
                    "vectorizeClassName": False
                }
            },
            "properties": [
                {
                    "name": "paper_id",
                    "dataType": ["string"],
                    "description": "Unique paper identifier (PMID, DOI, arXiv ID)",
                    "moduleConfig": {
                        "text2vec-transformers": {"skip": True}
                    }
                },
                {
                    "name": "title",
                    "dataType": ["text"],
                    "description": "Paper title"
                },
                {
                    "name": "abstract",
                    "dataType": ["text"],
                    "description": "Paper abstract"
                },
                {
                    "name": "year",
                    "dataType": ["int"],
                    "description": "Publication year",
                    "moduleConfig": {
                        "text2vec-transformers": {"skip": True}
                    }
                },
                {
                    "name": "authors",
                    "dataType": ["string[]"],
                    "description": "Author names",
                    "moduleConfig": {
                        "text2vec-transformers": {"skip": True}
                    }
                },
                {
                    "name": "doi",
                    "dataType": ["string"],
                    "description": "Digital Object Identifier",
                    "moduleConfig": {
                        "text2vec-transformers": {"skip": True}
                    }
                },
                {
                    "name": "source",
                    "dataType": ["string"],
                    "description": "Source database (pubmed, arxiv, etc)",
                    "moduleConfig": {
                        "text2vec-transformers": {"skip": True}
                    }
                },
                {
                    "name": "url",
                    "dataType": ["string"],
                    "description": "URL to paper",
                    "moduleConfig": {
                        "text2vec-transformers": {"skip": True}
                    }
                },
                {
                    "name": "indexed_at",
                    "dataType": ["date"],
                    "description": "When paper was indexed",
                    "moduleConfig": {
                        "text2vec-transformers": {"skip": True}
                    }
                }
            ]
        }

        client.schema.create_class(schema)
        logger.info(f"Created schema {self.class_name}")

    def _generate_uuid(self, paper: Dict[str, Any]) -> str:
        """Generate deterministic UUID from paper identifiers"""
        # Use DOI, PMID, or arXiv ID as source for UUID
        identifier = (
            paper.get('doi') or
            paper.get('pmid') or
            paper.get('arxivId') or
            paper.get('paperId') or
            paper.get('title', '')
        )

        # Generate UUID-like hash
        hash_input = f"literature:{identifier}".encode()
        return hashlib.sha256(hash_input).hexdigest()[:32]

    def upsert_papers(
        self,
        papers: List[Dict[str, Any]],
        fail_closed: bool = True
    ) -> Dict[str, Any]:
        """
        Index papers in Weaviate.

        Args:
            papers: List of paper dictionaries
            fail_closed: If True, skip papers with PHI (required in LIVE mode)

        Returns:
            Dictionary with success count and errors
        """
        if not self.enabled:
            return {"success": 0, "skipped": len(papers), "reason": "indexing_disabled"}

        client = self._get_client()
        results = {"success": 0, "skipped": 0, "errors": []}

        for paper in papers:
            try:
                title = paper.get("title") or ""
                abstract = paper.get("abstract") or ""

                # PHI guard before indexing
                _, title_findings = guard_text(title, fail_closed=fail_closed)
                _, abstract_findings = guard_text(abstract, fail_closed=fail_closed)

                if (title_findings or abstract_findings) and fail_closed:
                    logger.warning(f"PHI detected, skipping paper: {title[:50]}...")
                    results["skipped"] += 1
                    continue

                # Build object
                obj = {
                    "paper_id": (
                        paper.get("pmid") or
                        paper.get("doi") or
                        paper.get("arxivId") or
                        paper.get("paperId") or
                        ""
                    ),
                    "title": title,
                    "abstract": abstract,
                    "year": paper.get("year"),
                    "authors": paper.get("authors", []),
                    "doi": paper.get("doi"),
                    "source": paper.get("source", "unknown"),
                    "url": paper.get("url"),
                }

                # Generate deterministic UUID
                uuid = self._generate_uuid(paper)

                # Upsert (create or update)
                client.data_object.create(
                    data_object=obj,
                    class_name=self.class_name,
                    uuid=uuid
                )

                results["success"] += 1

            except Exception as e:
                logger.error(f"Failed to index paper: {e}")
                results["errors"].append(str(e))

        return results

    def search_similar(
        self,
        query: str,
        limit: int = 10,
        min_score: float = 0.5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[LiteratureSearchResult]:
        """
        Semantic search for similar papers.

        Args:
            query: Search query text
            limit: Maximum results to return
            min_score: Minimum similarity score (0-1)
            filters: Optional filters (e.g., year range, source)

        Returns:
            List of search results
        """
        if not self.enabled:
            return []

        client = self._get_client()

        # Build query
        near_text = {"concepts": [query]}

        query_builder = (
            client.query
            .get(self.class_name, [
                "paper_id", "title", "abstract", "year",
                "doi", "source", "url", "authors"
            ])
            .with_near_text(near_text)
            .with_limit(limit)
            .with_additional(["distance", "id"])
        )

        # Add filters if provided
        if filters:
            where_filter = self._build_where_filter(filters)
            if where_filter:
                query_builder = query_builder.with_where(where_filter)

        # Execute query
        result = query_builder.do()

        # Parse results
        papers = result.get("data", {}).get("Get", {}).get(self.class_name, [])

        search_results = []
        for paper in papers:
            additional = paper.get("_additional", {})
            distance = additional.get("distance", 1.0)
            score = 1.0 - distance  # Convert distance to similarity

            if score < min_score:
                continue

            search_results.append(LiteratureSearchResult(
                paper_id=paper.get("paper_id", ""),
                title=paper.get("title", ""),
                abstract=paper.get("abstract"),
                year=paper.get("year"),
                doi=paper.get("doi"),
                source=paper.get("source", "unknown"),
                score=score,
                metadata={
                    "uuid": additional.get("id"),
                    "authors": paper.get("authors", []),
                    "url": paper.get("url")
                }
            ))

        return search_results

    def hybrid_search(
        self,
        query: str,
        limit: int = 10,
        alpha: float = 0.5
    ) -> List[LiteratureSearchResult]:
        """
        Hybrid search combining keyword and semantic search.

        Args:
            query: Search query
            limit: Maximum results
            alpha: Balance between keyword (0) and vector (1) search

        Returns:
            List of search results
        """
        if not self.enabled:
            return []

        client = self._get_client()

        result = (
            client.query
            .get(self.class_name, [
                "paper_id", "title", "abstract", "year",
                "doi", "source", "url", "authors"
            ])
            .with_hybrid(query=query, alpha=alpha)
            .with_limit(limit)
            .with_additional(["score", "id"])
            .do()
        )

        papers = result.get("data", {}).get("Get", {}).get(self.class_name, [])

        search_results = []
        for paper in papers:
            additional = paper.get("_additional", {})
            score = additional.get("score", 0.0)

            search_results.append(LiteratureSearchResult(
                paper_id=paper.get("paper_id", ""),
                title=paper.get("title", ""),
                abstract=paper.get("abstract"),
                year=paper.get("year"),
                doi=paper.get("doi"),
                source=paper.get("source", "unknown"),
                score=score,
                metadata={
                    "uuid": additional.get("id"),
                    "authors": paper.get("authors", []),
                    "url": paper.get("url")
                }
            ))

        return search_results

    def _build_where_filter(self, filters: Dict[str, Any]) -> Optional[Dict]:
        """Build Weaviate where filter from dictionary"""
        conditions = []

        if "year_from" in filters:
            conditions.append({
                "path": ["year"],
                "operator": "GreaterThanEqual",
                "valueInt": filters["year_from"]
            })

        if "year_to" in filters:
            conditions.append({
                "path": ["year"],
                "operator": "LessThanEqual",
                "valueInt": filters["year_to"]
            })

        if "source" in filters:
            conditions.append({
                "path": ["source"],
                "operator": "Equal",
                "valueString": filters["source"]
            })

        if not conditions:
            return None

        if len(conditions) == 1:
            return conditions[0]

        return {
            "operator": "And",
            "operands": conditions
        }

    def delete_paper(self, paper_id: str) -> bool:
        """Delete a paper from the index"""
        if not self.enabled:
            return False

        client = self._get_client()

        # Find by paper_id
        result = (
            client.query
            .get(self.class_name, ["paper_id"])
            .with_where({
                "path": ["paper_id"],
                "operator": "Equal",
                "valueString": paper_id
            })
            .with_additional(["id"])
            .do()
        )

        papers = result.get("data", {}).get("Get", {}).get(self.class_name, [])

        if papers:
            uuid = papers[0].get("_additional", {}).get("id")
            if uuid:
                client.data_object.delete(uuid, self.class_name)
                return True

        return False

    def get_paper(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific paper from the index"""
        if not self.enabled:
            return None

        client = self._get_client()

        result = (
            client.query
            .get(self.class_name, [
                "paper_id", "title", "abstract", "year",
                "doi", "source", "url", "authors"
            ])
            .with_where({
                "path": ["paper_id"],
                "operator": "Equal",
                "valueString": paper_id
            })
            .do()
        )

        papers = result.get("data", {}).get("Get", {}).get(self.class_name, [])

        if papers:
            return papers[0]

        return None


# Module-level convenience functions
_indexer: Optional[LiteratureIndexer] = None


def _get_indexer() -> LiteratureIndexer:
    global _indexer
    if _indexer is None:
        _indexer = LiteratureIndexer()
    return _indexer


def upsert_papers(papers: List[Dict[str, Any]], fail_closed: bool = True) -> Dict[str, Any]:
    """Index papers in Weaviate"""
    return _get_indexer().upsert_papers(papers, fail_closed)


def search_similar(query: str, limit: int = 10, **kwargs) -> List[LiteratureSearchResult]:
    """Semantic search for similar papers"""
    return _get_indexer().search_similar(query, limit, **kwargs)


def delete_paper(paper_id: str) -> bool:
    """Delete a paper from the index"""
    return _get_indexer().delete_paper(paper_id)


def get_paper(paper_id: str) -> Optional[Dict[str, Any]]:
    """Get a paper from the index"""
    return _get_indexer().get_paper(paper_id)

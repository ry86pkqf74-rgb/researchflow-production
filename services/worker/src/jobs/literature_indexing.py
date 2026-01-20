"""
Literature Indexing Job

Indexes literature items into Chroma vector database for semantic search.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from src.vectordb import get_chroma_client

logger = logging.getLogger(__name__)

# Collection name for literature
LITERATURE_COLLECTION = "literature"


@dataclass
class LiteratureIndexingConfig:
    """Configuration for literature indexing job."""
    collection: str = LITERATURE_COLLECTION
    upsert: bool = True
    include_abstract: bool = True
    include_title: bool = True


@dataclass
class LiteratureItem:
    """Literature item to index (mirrors TypeScript schema)."""
    id: str
    provider: str
    title: str
    abstract: Optional[str] = None
    authors: Optional[List[Dict[str, Any]]] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
    arxiv_id: Optional[str] = None
    s2_paper_id: Optional[str] = None
    urls: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    citation_count: Optional[int] = None


def prepare_document_text(item: LiteratureItem, config: LiteratureIndexingConfig) -> str:
    """
    Prepare document text for embedding.

    Combines title and abstract for better semantic matching.
    """
    parts = []

    if config.include_title and item.title:
        parts.append(item.title)

    if config.include_abstract and item.abstract:
        parts.append(item.abstract)

    return "\n\n".join(parts)


def prepare_metadata(item: LiteratureItem) -> Dict[str, Any]:
    """
    Prepare metadata for Chroma storage.

    Note: Chroma only supports primitive types in metadata.
    """
    metadata = {
        "provider": item.provider,
        "title": item.title[:500] if item.title else "",  # Truncate long titles
    }

    if item.year:
        metadata["year"] = item.year

    if item.doi:
        metadata["doi"] = item.doi

    if item.pmid:
        metadata["pmid"] = item.pmid

    if item.arxiv_id:
        metadata["arxiv_id"] = item.arxiv_id

    if item.s2_paper_id:
        metadata["s2_paper_id"] = item.s2_paper_id

    if item.venue:
        metadata["venue"] = item.venue[:200] if item.venue else ""

    if item.citation_count is not None:
        metadata["citation_count"] = item.citation_count

    if item.keywords:
        # Store keywords as comma-separated string (Chroma doesn't support arrays in metadata)
        metadata["keywords"] = ",".join(item.keywords[:10])

    if item.authors:
        # Store first few author names
        author_names = [a.get("name", "") for a in item.authors[:5] if isinstance(a, dict)]
        metadata["authors"] = "; ".join(author_names)

    if item.urls:
        # Store first URL
        metadata["url"] = item.urls[0] if item.urls else ""

    return metadata


def index_literature(
    items: List[Dict[str, Any]],
    config: Optional[LiteratureIndexingConfig] = None,
) -> Dict[str, Any]:
    """
    Index literature items into Chroma.

    Args:
        items: List of literature items (as dicts matching LiteratureItem schema)
        config: Indexing configuration

    Returns:
        Dict with indexing results
    """
    if config is None:
        config = LiteratureIndexingConfig()

    if not items:
        return {
            "indexed_count": 0,
            "updated_count": 0,
            "collection": config.collection,
            "errors": [],
        }

    # Convert dicts to LiteratureItem objects
    literature_items = []
    errors = []

    for i, item_dict in enumerate(items):
        try:
            item = LiteratureItem(
                id=item_dict.get("id", f"item_{i}"),
                provider=item_dict.get("provider", "unknown"),
                title=item_dict.get("title", ""),
                abstract=item_dict.get("abstract"),
                authors=item_dict.get("authors"),
                year=item_dict.get("year"),
                venue=item_dict.get("venue"),
                doi=item_dict.get("doi"),
                pmid=item_dict.get("pmid"),
                arxiv_id=item_dict.get("arxivId") or item_dict.get("arxiv_id"),
                s2_paper_id=item_dict.get("s2PaperId") or item_dict.get("s2_paper_id"),
                urls=item_dict.get("urls"),
                keywords=item_dict.get("keywords") or item_dict.get("meshTerms"),
                citation_count=item_dict.get("citationCount") or item_dict.get("citation_count"),
            )
            literature_items.append(item)
        except Exception as e:
            errors.append({"index": i, "error": str(e)})
            logger.warning(f"Error processing item {i}: {e}")

    if not literature_items:
        return {
            "indexed_count": 0,
            "updated_count": 0,
            "collection": config.collection,
            "errors": errors,
        }

    # Prepare documents, IDs, and metadata
    documents = []
    ids = []
    metadatas = []

    for item in literature_items:
        doc_text = prepare_document_text(item, config)
        if not doc_text.strip():
            continue

        documents.append(doc_text)
        ids.append(item.id)
        metadatas.append(prepare_metadata(item))

    # Index into Chroma
    client = get_chroma_client()
    result = client.index_documents(
        collection_name=config.collection,
        documents=documents,
        ids=ids,
        metadatas=metadatas,
    )

    # Persist
    client.persist()

    return {
        "indexed_count": result.indexed_count,
        "updated_count": result.updated_count,
        "collection": result.collection,
        "total_processed": len(literature_items),
        "errors": errors,
    }


def search_literature(
    query: str,
    k: int = 10,
    collection: str = LITERATURE_COLLECTION,
    year_start: Optional[int] = None,
    year_end: Optional[int] = None,
    providers: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Search literature using semantic similarity.

    Args:
        query: Search query
        k: Number of results
        collection: Collection name
        year_start: Filter by minimum year
        year_end: Filter by maximum year
        providers: Filter by providers

    Returns:
        List of search results with scores
    """
    client = get_chroma_client()

    # Build where filter
    where = None
    conditions = []

    if year_start:
        conditions.append({"year": {"$gte": year_start}})
    if year_end:
        conditions.append({"year": {"$lte": year_end}})
    if providers and len(providers) == 1:
        conditions.append({"provider": providers[0]})

    if len(conditions) == 1:
        where = conditions[0]
    elif len(conditions) > 1:
        where = {"$and": conditions}

    results = client.search(
        collection_name=collection,
        query=query,
        k=k,
        where=where,
    )

    return [
        {
            "id": r.id,
            "document": r.document,
            "metadata": r.metadata,
            "score": r.score,
        }
        for r in results
    ]


def get_collection_stats(collection: str = LITERATURE_COLLECTION) -> Dict[str, Any]:
    """Get statistics about the literature collection."""
    client = get_chroma_client()
    count = client.count(collection)

    return {
        "collection": collection,
        "document_count": count,
    }

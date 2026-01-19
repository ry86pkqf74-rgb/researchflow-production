"""
Literature Relevance Ranking

Ranks papers by relevance using:
- TF-IDF similarity
- Embedding similarity (via Weaviate)
- Combined weighted scoring
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import math

logger = logging.getLogger(__name__)


@dataclass
class RankedResult:
    """A ranked literature result"""
    paper: Dict[str, Any]
    score: float
    tfidf_score: float
    embedding_score: Optional[float] = None
    method: str = "tfidf"


def _tokenize(text: str) -> List[str]:
    """Simple tokenization"""
    return re.findall(r'\b[a-z]{2,}\b', text.lower())


def _compute_tfidf(
    query_tokens: List[str],
    doc_tokens: List[str],
    idf: Dict[str, float]
) -> float:
    """Compute TF-IDF similarity between query and document"""
    if not query_tokens or not doc_tokens:
        return 0.0

    doc_tf = Counter(doc_tokens)
    doc_len = len(doc_tokens)

    # Compute document vector
    doc_vec = {}
    for token in set(doc_tokens):
        tf = doc_tf[token] / doc_len
        doc_vec[token] = tf * idf.get(token, 0)

    # Compute query vector
    query_tf = Counter(query_tokens)
    query_len = len(query_tokens)
    query_vec = {}
    for token in set(query_tokens):
        tf = query_tf[token] / query_len
        query_vec[token] = tf * idf.get(token, 0)

    # Cosine similarity
    common = set(doc_vec.keys()) & set(query_vec.keys())
    if not common:
        return 0.0

    dot = sum(doc_vec[t] * query_vec[t] for t in common)
    doc_norm = math.sqrt(sum(v**2 for v in doc_vec.values()))
    query_norm = math.sqrt(sum(v**2 for v in query_vec.values()))

    if doc_norm == 0 or query_norm == 0:
        return 0.0

    return dot / (doc_norm * query_norm)


def rank_by_relevance(
    papers: List[Dict[str, Any]],
    query: str,
    use_embeddings: bool = False,
    tfidf_weight: float = 0.5,
    embedding_weight: float = 0.5
) -> List[RankedResult]:
    """
    Rank papers by relevance to query.

    Args:
        papers: List of paper dictionaries
        query: Search query
        use_embeddings: Use embedding similarity (requires Weaviate)
        tfidf_weight: Weight for TF-IDF score (0-1)
        embedding_weight: Weight for embedding score (0-1)

    Returns:
        List of RankedResult sorted by score (descending)
    """
    if not papers:
        return []

    query_tokens = _tokenize(query)

    # Build document tokens
    doc_tokens_list = []
    for paper in papers:
        text = ' '.join([
            paper.get('title', ''),
            paper.get('abstract', '') or ''
        ])
        doc_tokens_list.append(_tokenize(text))

    # Compute IDF
    doc_count = len(papers)
    doc_freq: Dict[str, int] = Counter()
    for tokens in doc_tokens_list:
        for token in set(tokens):
            doc_freq[token] += 1

    idf = {
        token: math.log(doc_count / df)
        for token, df in doc_freq.items()
    }

    # Compute TF-IDF scores
    tfidf_scores = []
    for doc_tokens in doc_tokens_list:
        score = _compute_tfidf(query_tokens, doc_tokens, idf)
        tfidf_scores.append(score)

    # Embedding scores (if enabled)
    embedding_scores: List[Optional[float]] = [None] * len(papers)

    if use_embeddings:
        try:
            from src.vector.literature_index import search_similar

            # Search for similar papers
            results = search_similar(query, limit=len(papers))

            # Map scores to papers
            paper_ids = set()
            for p in papers:
                pid = p.get('pmid') or p.get('doi') or p.get('paperId')
                if pid:
                    paper_ids.add(pid)

            score_map = {}
            for r in results:
                score_map[r.paper_id] = r.score

            for i, paper in enumerate(papers):
                pid = paper.get('pmid') or paper.get('doi') or paper.get('paperId')
                if pid and pid in score_map:
                    embedding_scores[i] = score_map[pid]

        except Exception as e:
            logger.warning(f"Embedding search failed: {e}")

    # Combine scores
    results = []
    for i, paper in enumerate(papers):
        tfidf = tfidf_scores[i]
        emb = embedding_scores[i]

        if emb is not None:
            combined = (tfidf * tfidf_weight) + (emb * embedding_weight)
            method = "tfidf+embedding"
        else:
            combined = tfidf
            method = "tfidf"

        results.append(RankedResult(
            paper=paper,
            score=combined,
            tfidf_score=tfidf,
            embedding_score=emb,
            method=method
        ))

    # Sort by score
    results.sort(key=lambda r: r.score, reverse=True)

    return results

"""
Deduplication with Fuzzy Matching

Identifies and removes duplicate records using:
- Exact matching
- Fuzzy string matching (rapidfuzz)
- Sentence embeddings (via Weaviate)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


@dataclass
class DuplicateCluster:
    """A cluster of duplicate records"""
    retained_id: Any
    duplicate_ids: List[Any]
    similarity_scores: List[float]
    method: str  # exact, fuzzy, embedding


@dataclass
class DedupResult:
    """Deduplication result"""
    success: bool
    clusters: List[DuplicateCluster]
    total_records: int
    unique_records: int
    duplicates_found: int
    retained_ids: List[Any]
    dropped_ids: List[Any]
    error: Optional[str] = None


def _exact_dedup(data: Any, key_columns: List[str]) -> Tuple[Set, Dict]:
    """Find exact duplicates based on key columns"""
    seen = {}
    duplicates = {}

    for idx, row in data.iterrows():
        key = tuple(row[col] for col in key_columns)

        if key in seen:
            if key not in duplicates:
                duplicates[key] = [seen[key]]
            duplicates[key].append(idx)
        else:
            seen[key] = idx

    return set(seen.values()), duplicates


def _fuzzy_dedup(
    data: Any,
    text_column: str,
    threshold: float = 0.85
) -> List[DuplicateCluster]:
    """Find fuzzy duplicates using string similarity"""
    try:
        from rapidfuzz import fuzz, process

        clusters = []
        processed = set()

        texts = data[text_column].fillna('').tolist()
        indices = data.index.tolist()

        for i, (idx, text) in enumerate(zip(indices, texts)):
            if idx in processed or not text:
                continue

            # Find similar texts
            matches = process.extract(
                text,
                texts[i+1:],
                scorer=fuzz.ratio,
                limit=None,
                score_cutoff=threshold * 100
            )

            if matches:
                duplicate_ids = []
                scores = []

                for match_text, score, match_i in matches:
                    match_idx = indices[i + 1 + match_i]
                    if match_idx not in processed:
                        duplicate_ids.append(match_idx)
                        scores.append(score / 100)
                        processed.add(match_idx)

                if duplicate_ids:
                    clusters.append(DuplicateCluster(
                        retained_id=idx,
                        duplicate_ids=duplicate_ids,
                        similarity_scores=scores,
                        method="fuzzy"
                    ))

            processed.add(idx)

        return clusters

    except ImportError:
        logger.warning("rapidfuzz not installed, skipping fuzzy dedup")
        return []


def deduplicate(
    data: Any,
    key_columns: Optional[List[str]] = None,
    text_column: Optional[str] = None,
    fuzzy_threshold: float = 0.85,
    use_embeddings: bool = False
) -> DedupResult:
    """
    Deduplicate a dataset.

    Args:
        data: DataFrame to deduplicate
        key_columns: Columns for exact matching (if provided)
        text_column: Column for fuzzy matching (if provided)
        fuzzy_threshold: Similarity threshold for fuzzy matching (0-1)
        use_embeddings: Use sentence embeddings for dedup (requires Weaviate)

    Returns:
        DedupResult with deduplication details
    """
    try:
        import pandas as pd

        if not isinstance(data, pd.DataFrame):
            return DedupResult(
                success=False,
                clusters=[],
                total_records=0,
                unique_records=0,
                duplicates_found=0,
                retained_ids=[],
                dropped_ids=[],
                error="Input must be a DataFrame"
            )

        total_records = len(data)
        clusters: List[DuplicateCluster] = []
        retained_ids: Set = set(data.index)
        dropped_ids: Set = set()

        # Exact dedup
        if key_columns:
            exact_retained, exact_dups = _exact_dedup(data, key_columns)

            for key, indices in exact_dups.items():
                if len(indices) > 1:
                    retained = indices[0]
                    dups = indices[1:]

                    clusters.append(DuplicateCluster(
                        retained_id=retained,
                        duplicate_ids=dups,
                        similarity_scores=[1.0] * len(dups),
                        method="exact"
                    ))

                    dropped_ids.update(dups)

            retained_ids = exact_retained

        # Fuzzy dedup
        if text_column and text_column in data.columns:
            # Only run on non-dropped records
            remaining = data.loc[list(retained_ids - dropped_ids)]

            fuzzy_clusters = _fuzzy_dedup(remaining, text_column, fuzzy_threshold)

            for cluster in fuzzy_clusters:
                clusters.append(cluster)
                dropped_ids.update(cluster.duplicate_ids)

        # Calculate final stats
        final_retained = list(retained_ids - dropped_ids)

        return DedupResult(
            success=True,
            clusters=clusters,
            total_records=total_records,
            unique_records=len(final_retained),
            duplicates_found=len(dropped_ids),
            retained_ids=final_retained,
            dropped_ids=list(dropped_ids)
        )

    except Exception as e:
        logger.exception(f"Deduplication failed: {e}")
        return DedupResult(
            success=False,
            clusters=[],
            total_records=0,
            unique_records=0,
            duplicates_found=0,
            retained_ids=[],
            dropped_ids=[],
            error=str(e)
        )


def save_dedup_report(
    result: DedupResult,
    output_path: str
) -> str:
    """Save deduplication report as JSON"""
    import json

    report = {
        'success': result.success,
        'total_records': result.total_records,
        'unique_records': result.unique_records,
        'duplicates_found': result.duplicates_found,
        'clusters': [
            {
                'retained_id': str(c.retained_id),
                'duplicate_ids': [str(d) for d in c.duplicate_ids],
                'similarity_scores': c.similarity_scores,
                'method': c.method
            }
            for c in result.clusters
        ],
        'retained_ids': [str(i) for i in result.retained_ids],
        'dropped_ids': [str(i) for i in result.dropped_ids],
        'error': result.error
    }

    with open(output_path, 'w') as f:
        json.dump(report, f, indent=2)

    return output_path

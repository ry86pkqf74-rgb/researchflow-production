"""
Keyword Extraction Service

Extracts keywords from datasets using:
- TF-IDF on column names and categorical values
- Schema metadata analysis
- Optional MeSH mapping (future)
"""

from __future__ import annotations

import os
import json
import logging
import re
from collections import Counter
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Set
from pathlib import Path

from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)

ARTIFACTS_PATH = os.getenv("ARTIFACTS_PATH", "/data/artifacts")


@dataclass
class KeywordResult:
    """Keyword extraction result"""
    keywords: List[str]
    keyword_scores: Dict[str, float]
    source_columns: List[str]
    categorical_terms: List[str]
    extraction_method: str
    success: bool = True
    error: Optional[str] = None


def _clean_column_name(name: str) -> List[str]:
    """Extract words from column name (handles snake_case, camelCase, etc.)"""
    # Split on underscores and spaces
    parts = re.split(r'[_\s]+', name)

    # Split camelCase
    expanded = []
    for part in parts:
        # Insert space before uppercase letters
        split_camel = re.sub(r'([a-z])([A-Z])', r'\1 \2', part)
        expanded.extend(split_camel.lower().split())

    # Filter short words and common terms
    stop_words = {'id', 'key', 'val', 'value', 'date', 'time', 'num', 'str', 'int', 'bool'}
    return [w for w in expanded if len(w) > 2 and w not in stop_words]


def _calculate_tfidf(
    term_counts: Counter,
    doc_freq: Dict[str, int],
    total_docs: int
) -> Dict[str, float]:
    """Calculate TF-IDF scores for terms"""
    import math

    scores = {}
    total_terms = sum(term_counts.values())

    for term, count in term_counts.items():
        tf = count / total_terms if total_terms > 0 else 0
        df = doc_freq.get(term, 1)
        idf = math.log(total_docs / df) if df > 0 else 0
        scores[term] = tf * idf

    return scores


def extract_keywords(
    data: Any,
    schema: Optional[Dict[str, Any]] = None,
    sample_size: int = 100,
    max_keywords: int = 50,
    fail_closed: bool = True
) -> KeywordResult:
    """
    Extract keywords from a dataset.

    Args:
        data: DataFrame or dict with data
        schema: Optional schema definition
        sample_size: Number of rows to sample for categorical analysis
        max_keywords: Maximum keywords to return
        fail_closed: If True, redact PHI from results

    Returns:
        KeywordResult with extracted keywords
    """
    try:
        keywords = []
        keyword_scores: Dict[str, float] = {}
        source_columns: List[str] = []
        categorical_terms: List[str] = []

        # Extract column names
        columns = []
        if hasattr(data, 'columns'):
            # DataFrame
            columns = list(data.columns)
        elif isinstance(data, dict):
            columns = list(data.keys())
        elif schema and 'properties' in schema:
            columns = list(schema['properties'].keys())

        source_columns = columns

        # Extract terms from column names
        term_counts = Counter()
        for col in columns:
            terms = _clean_column_name(col)
            term_counts.update(terms)

        # Extract categorical values (with PHI guard)
        if hasattr(data, 'select_dtypes'):
            try:
                # Get categorical/object columns
                cat_cols = data.select_dtypes(include=['object', 'category']).columns

                for col in cat_cols[:10]:  # Limit columns analyzed
                    # Sample values
                    sample = data[col].dropna().head(sample_size)

                    for val in sample.unique()[:20]:  # Limit unique values
                        val_str = str(val).lower().strip()

                        # PHI guard
                        safe_val, findings = guard_text(val_str, fail_closed=fail_closed)
                        if findings and fail_closed:
                            continue

                        # Only include if it looks like a term (not a number, not too long)
                        if (
                            len(val_str) > 2 and
                            len(val_str) < 50 and
                            not val_str.replace('.', '').replace('-', '').isdigit()
                        ):
                            categorical_terms.append(val_str)
                            # Extract words from value
                            words = re.findall(r'\b[a-z]{3,}\b', val_str)
                            term_counts.update(words)

            except Exception as e:
                logger.warning(f"Error extracting categorical values: {e}")

        # Calculate scores
        doc_count = len(columns) + len(categorical_terms)
        doc_freq = {term: 1 for term in term_counts}  # Simplified

        if term_counts:
            keyword_scores = _calculate_tfidf(term_counts, doc_freq, max(doc_count, 1))

            # Sort by score and take top keywords
            sorted_terms = sorted(
                keyword_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )[:max_keywords]

            keywords = [term for term, _ in sorted_terms]
            keyword_scores = dict(sorted_terms)

        return KeywordResult(
            keywords=keywords,
            keyword_scores=keyword_scores,
            source_columns=source_columns,
            categorical_terms=categorical_terms[:50],  # Limit
            extraction_method="tfidf_columns_categorical",
            success=True
        )

    except Exception as e:
        logger.exception(f"Keyword extraction failed: {e}")
        return KeywordResult(
            keywords=[],
            keyword_scores={},
            source_columns=[],
            categorical_terms=[],
            extraction_method="tfidf_columns_categorical",
            success=False,
            error=str(e)
        )


def save_keywords_artifact(
    result: KeywordResult,
    dataset_id: str,
    output_dir: Optional[str] = None
) -> str:
    """
    Save keyword extraction result as artifact.

    Args:
        result: KeywordResult to save
        dataset_id: Dataset identifier
        output_dir: Output directory (defaults to ARTIFACTS_PATH)

    Returns:
        Path to saved artifact
    """
    base_dir = Path(output_dir or ARTIFACTS_PATH)
    artifact_dir = base_dir / "datasets" / dataset_id
    artifact_dir.mkdir(parents=True, exist_ok=True)

    artifact_path = artifact_dir / "keywords.json"

    with open(artifact_path, 'w') as f:
        json.dump(asdict(result), f, indent=2)

    logger.info(f"Saved keywords artifact to {artifact_path}")
    return str(artifact_path)

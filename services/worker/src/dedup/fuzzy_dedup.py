"""
Fuzzy Deduplication

Identifies and removes duplicate records using fuzzy string matching.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from src.provenance.artifact_store import store_text, new_run_id

logger = logging.getLogger(__name__)


@dataclass
class DedupConfig:
    """Configuration for deduplication."""
    threshold: float = 0.85  # Similarity threshold (0-1)
    match_columns: Optional[List[str]] = None  # Columns to use for matching
    exact_match_columns: Optional[List[str]] = None  # Columns for exact matching
    algorithm: str = "ratio"  # ratio, partial_ratio, token_sort_ratio, token_set_ratio
    case_sensitive: bool = False
    keep: str = "first"  # first, last, best_quality
    quality_column: Optional[str] = None  # Column to use for quality scoring


@dataclass
class DuplicateGroup:
    """A group of duplicate records."""
    master_id: str
    duplicate_ids: List[str]
    similarity_scores: Dict[str, float]
    match_columns: List[str]


@dataclass
class DedupResult:
    """Result of deduplication."""
    success: bool
    original_count: int = 0
    unique_count: int = 0
    duplicates_found: int = 0
    duplicate_groups: List[DuplicateGroup] = field(default_factory=list)
    deduped_data: Optional[Any] = None
    removed_ids: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    artifact_run_id: Optional[str] = None


class FuzzyDeduplicator:
    """
    Fuzzy deduplication using rapidfuzz.

    Supports:
    - Multiple similarity algorithms
    - Column-level matching
    - Exact + fuzzy hybrid matching
    - Quality-based duplicate selection
    """

    def __init__(self, config: Optional[DedupConfig] = None):
        self.config = config or DedupConfig()

    def deduplicate(
        self,
        records: List[Dict[str, Any]],
        id_column: str = "id",
        save_artifact: bool = True,
    ) -> DedupResult:
        """
        Deduplicate a list of records.

        Args:
            records: List of record dictionaries
            id_column: Column containing unique identifiers
            save_artifact: Whether to save result as artifact

        Returns:
            DedupResult with deduped data
        """
        if not records:
            return DedupResult(
                success=True,
                original_count=0,
                unique_count=0,
                deduped_data=[],
            )

        try:
            from rapidfuzz import fuzz, process
        except ImportError:
            return DedupResult(
                success=False,
                errors=["rapidfuzz not installed. Install with: pip install rapidfuzz"],
            )

        original_count = len(records)

        # Determine columns for matching
        match_cols = self.config.match_columns
        if not match_cols:
            # Use all string columns
            sample = records[0]
            match_cols = [
                k for k, v in sample.items()
                if isinstance(v, str) and k != id_column
            ]

        if not match_cols:
            return DedupResult(
                success=False,
                original_count=original_count,
                errors=["No columns available for fuzzy matching"],
            )

        # Build comparison strings
        record_strings = {}
        id_to_record = {}

        for i, record in enumerate(records):
            record_id = record.get(id_column, f"record_{i}")
            id_to_record[record_id] = record

            # Build comparison string
            parts = []
            for col in match_cols:
                value = record.get(col, "")
                if value:
                    text = str(value)
                    if not self.config.case_sensitive:
                        text = text.lower()
                    parts.append(text)

            record_strings[record_id] = " ".join(parts)

        # Find duplicates
        duplicate_groups: List[DuplicateGroup] = []
        processed_ids: Set[str] = set()
        removed_ids: List[str] = []

        # Get the similarity function
        sim_func = self._get_similarity_function()

        # Compare all pairs (optimized with early filtering)
        record_ids = list(record_strings.keys())

        for i, id1 in enumerate(record_ids):
            if id1 in processed_ids:
                continue

            str1 = record_strings[id1]
            group_ids = []
            scores = {}

            for j, id2 in enumerate(record_ids[i + 1:], i + 1):
                if id2 in processed_ids:
                    continue

                str2 = record_strings[id2]

                # Check exact match columns first
                if self.config.exact_match_columns:
                    exact_match = all(
                        id_to_record[id1].get(col) == id_to_record[id2].get(col)
                        for col in self.config.exact_match_columns
                    )
                    if not exact_match:
                        continue

                # Calculate similarity
                score = sim_func(str1, str2) / 100.0  # rapidfuzz returns 0-100

                if score >= self.config.threshold:
                    group_ids.append(id2)
                    scores[id2] = score
                    processed_ids.add(id2)

            if group_ids:
                # Determine which record to keep
                master_id = id1
                duplicates = group_ids

                if self.config.keep == "last":
                    master_id = group_ids[-1]
                    duplicates = [id1] + group_ids[:-1]
                elif self.config.keep == "best_quality" and self.config.quality_column:
                    all_ids = [id1] + group_ids
                    best_id = max(
                        all_ids,
                        key=lambda x: id_to_record[x].get(self.config.quality_column, 0) or 0
                    )
                    master_id = best_id
                    duplicates = [x for x in all_ids if x != best_id]

                duplicate_groups.append(DuplicateGroup(
                    master_id=master_id,
                    duplicate_ids=duplicates,
                    similarity_scores=scores,
                    match_columns=match_cols,
                ))
                removed_ids.extend(duplicates)

            processed_ids.add(id1)

        # Build deduplicated data
        removed_set = set(removed_ids)
        deduped_data = [
            record for record in records
            if record.get(id_column, f"record_{records.index(record)}") not in removed_set
        ]

        result = DedupResult(
            success=True,
            original_count=original_count,
            unique_count=len(deduped_data),
            duplicates_found=len(removed_ids),
            duplicate_groups=duplicate_groups,
            deduped_data=deduped_data,
            removed_ids=removed_ids,
        )

        # Save artifact
        if save_artifact and duplicate_groups:
            self._save_artifact(result)

        return result

    def find_duplicates_only(
        self,
        records: List[Dict[str, Any]],
        id_column: str = "id",
    ) -> List[DuplicateGroup]:
        """
        Find duplicates without removing them.

        Args:
            records: List of record dictionaries
            id_column: Column containing unique identifiers

        Returns:
            List of DuplicateGroup objects
        """
        result = self.deduplicate(records, id_column, save_artifact=False)
        return result.duplicate_groups

    def _get_similarity_function(self):
        """Get the similarity function based on config."""
        from rapidfuzz import fuzz

        algorithms = {
            "ratio": fuzz.ratio,
            "partial_ratio": fuzz.partial_ratio,
            "token_sort_ratio": fuzz.token_sort_ratio,
            "token_set_ratio": fuzz.token_set_ratio,
            "WRatio": fuzz.WRatio,
        }

        return algorithms.get(self.config.algorithm, fuzz.ratio)

    def _save_artifact(self, result: DedupResult):
        """Save deduplication result as artifact."""
        try:
            run_id = new_run_id("dedup")

            report = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "original_count": result.original_count,
                "unique_count": result.unique_count,
                "duplicates_found": result.duplicates_found,
                "duplicate_groups": [
                    {
                        "master_id": g.master_id,
                        "duplicate_ids": g.duplicate_ids,
                        "similarity_scores": g.similarity_scores,
                        "match_columns": g.match_columns,
                    }
                    for g in result.duplicate_groups
                ],
                "removed_ids": result.removed_ids[:100],  # Limit for large results
                "config": {
                    "threshold": self.config.threshold,
                    "algorithm": self.config.algorithm,
                    "match_columns": self.config.match_columns,
                    "keep": self.config.keep,
                },
            }

            store_text(
                run_id=run_id,
                category="dedup_report",
                filename="dedup_report.json",
                text=json.dumps(report, indent=2),
            )

            result.artifact_run_id = run_id
            logger.info(f"Saved dedup artifact: {run_id}")

        except Exception as e:
            logger.warning(f"Failed to save artifact: {e}")


def deduplicate_records(
    records: List[Dict[str, Any]],
    threshold: float = 0.85,
    match_columns: Optional[List[str]] = None,
    id_column: str = "id",
    save_artifact: bool = True,
) -> DedupResult:
    """
    Deduplicate a list of records using fuzzy matching.

    Args:
        records: List of record dictionaries
        threshold: Similarity threshold (0-1)
        match_columns: Columns to use for matching
        id_column: Column containing unique identifiers
        save_artifact: Whether to save as artifact

    Returns:
        DedupResult with deduped data
    """
    config = DedupConfig(
        threshold=threshold,
        match_columns=match_columns,
    )
    deduper = FuzzyDeduplicator(config)
    return deduper.deduplicate(records, id_column, save_artifact)


def find_duplicates(
    records: List[Dict[str, Any]],
    threshold: float = 0.85,
    match_columns: Optional[List[str]] = None,
    id_column: str = "id",
) -> List[DuplicateGroup]:
    """
    Find duplicates in a list of records.

    Args:
        records: List of record dictionaries
        threshold: Similarity threshold (0-1)
        match_columns: Columns to use for matching
        id_column: Column containing unique identifiers

    Returns:
        List of DuplicateGroup objects
    """
    config = DedupConfig(
        threshold=threshold,
        match_columns=match_columns,
    )
    deduper = FuzzyDeduplicator(config)
    return deduper.find_duplicates_only(records, id_column)


def exact_deduplicate(
    records: List[Dict[str, Any]],
    columns: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Simple exact deduplication based on column values.

    Args:
        records: List of record dictionaries
        columns: Columns to use for deduplication (all if None)

    Returns:
        Deduplicated list of records
    """
    if not records:
        return []

    seen_hashes: Set[str] = set()
    unique_records = []

    for record in records:
        # Build hash key
        if columns:
            key_data = {k: record.get(k) for k in columns}
        else:
            key_data = record

        key_hash = hashlib.md5(
            json.dumps(key_data, sort_keys=True, default=str).encode()
        ).hexdigest()

        if key_hash not in seen_hashes:
            seen_hashes.add(key_hash)
            unique_records.append(record)

    return unique_records

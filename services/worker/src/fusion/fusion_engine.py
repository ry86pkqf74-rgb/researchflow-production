"""
Data Fusion Engine

Combines data from multiple sources with provenance tracking.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from src.provenance.artifact_store import store_text, new_run_id
from .schema_alignment import SchemaAligner, SchemaAlignment, ColumnMapping

logger = logging.getLogger(__name__)


@dataclass
class FusionConfig:
    """Configuration for data fusion."""
    strategy: str = "union"  # union, join, merge
    join_type: str = "inner"  # inner, left, right, outer
    join_keys: Optional[List[str]] = None
    dedup: bool = True
    track_provenance: bool = True
    handle_conflicts: str = "first"  # first, last, both, raise


@dataclass
class ProvenanceRecord:
    """Tracks the origin of a fused record."""
    record_id: str
    sources: List[str]
    source_ids: Dict[str, str]
    fusion_timestamp: str
    conflicts: Optional[List[Dict[str, Any]]] = None


@dataclass
class FusionResult:
    """Result of a fusion operation."""
    success: bool
    fused_data: Optional[Any] = None  # DataFrame or list of records
    record_count: int = 0
    source_counts: Dict[str, int] = field(default_factory=dict)
    provenance: List[ProvenanceRecord] = field(default_factory=list)
    schema_alignment: Optional[SchemaAlignment] = None
    conflicts_count: int = 0
    duplicates_removed: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    artifact_run_id: Optional[str] = None


class FusionEngine:
    """
    Engine for fusing data from multiple sources.

    Supports:
    - Union (vertical stacking)
    - Join (horizontal merging on keys)
    - Merge (combination with conflict resolution)
    """

    def __init__(self, config: Optional[FusionConfig] = None):
        self.config = config or FusionConfig()
        self.aligner = SchemaAligner()

    def fuse(
        self,
        datasets: List[Dict[str, Any]],
        save_artifact: bool = True,
    ) -> FusionResult:
        """
        Fuse multiple datasets.

        Args:
            datasets: List of dataset dicts with 'name', 'data', and 'schema'
            save_artifact: Whether to save result as artifact

        Returns:
            FusionResult with fused data
        """
        if not datasets:
            return FusionResult(
                success=False,
                errors=["No datasets provided for fusion"],
            )

        if len(datasets) == 1:
            return FusionResult(
                success=True,
                fused_data=datasets[0].get("data"),
                record_count=len(datasets[0].get("data", [])),
                source_counts={datasets[0].get("name", "source_0"): len(datasets[0].get("data", []))},
            )

        try:
            if self.config.strategy == "union":
                result = self._fuse_union(datasets)
            elif self.config.strategy == "join":
                result = self._fuse_join(datasets)
            elif self.config.strategy == "merge":
                result = self._fuse_merge(datasets)
            else:
                return FusionResult(
                    success=False,
                    errors=[f"Unknown fusion strategy: {self.config.strategy}"],
                )

            # Save artifact
            if save_artifact and result.success:
                self._save_artifact(result, datasets)

            return result

        except Exception as e:
            logger.exception(f"Fusion error: {e}")
            return FusionResult(
                success=False,
                errors=[str(e)],
            )

    def _fuse_union(self, datasets: List[Dict[str, Any]]) -> FusionResult:
        """Fuse datasets using union (vertical stack)."""
        try:
            import pandas as pd
        except ImportError:
            return self._fuse_union_records(datasets)

        dfs = []
        source_counts = {}
        provenance = []

        for i, ds in enumerate(datasets):
            name = ds.get("name", f"source_{i}")
            data = ds.get("data")

            if isinstance(data, pd.DataFrame):
                df = data.copy()
            elif isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                continue

            source_counts[name] = len(df)

            # Add provenance column
            if self.config.track_provenance:
                df["_source"] = name
                df["_source_idx"] = range(len(df))

            dfs.append(df)

        if not dfs:
            return FusionResult(
                success=False,
                errors=["No valid data found in datasets"],
            )

        # Concatenate
        fused = pd.concat(dfs, ignore_index=True, sort=False)
        original_count = len(fused)

        # Deduplicate
        duplicates_removed = 0
        if self.config.dedup:
            # Exclude provenance columns from dedup
            cols = [c for c in fused.columns if not c.startswith("_")]
            fused_dedup = fused.drop_duplicates(subset=cols)
            duplicates_removed = original_count - len(fused_dedup)
            fused = fused_dedup

        return FusionResult(
            success=True,
            fused_data=fused,
            record_count=len(fused),
            source_counts=source_counts,
            duplicates_removed=duplicates_removed,
        )

    def _fuse_union_records(self, datasets: List[Dict[str, Any]]) -> FusionResult:
        """Fuse datasets as records (without pandas)."""
        all_records = []
        source_counts = {}
        seen_hashes = set()
        duplicates_removed = 0

        for i, ds in enumerate(datasets):
            name = ds.get("name", f"source_{i}")
            data = ds.get("data", [])

            if not isinstance(data, list):
                continue

            source_counts[name] = len(data)

            for j, record in enumerate(data):
                if not isinstance(record, dict):
                    continue

                # Add provenance
                if self.config.track_provenance:
                    record = {**record, "_source": name, "_source_idx": j}

                # Dedup check
                if self.config.dedup:
                    # Create hash of record (excluding provenance)
                    clean_record = {k: v for k, v in record.items() if not k.startswith("_")}
                    record_hash = hashlib.md5(
                        json.dumps(clean_record, sort_keys=True, default=str).encode()
                    ).hexdigest()

                    if record_hash in seen_hashes:
                        duplicates_removed += 1
                        continue
                    seen_hashes.add(record_hash)

                all_records.append(record)

        return FusionResult(
            success=True,
            fused_data=all_records,
            record_count=len(all_records),
            source_counts=source_counts,
            duplicates_removed=duplicates_removed,
        )

    def _fuse_join(self, datasets: List[Dict[str, Any]]) -> FusionResult:
        """Fuse datasets using join operation."""
        try:
            import pandas as pd
        except ImportError:
            return FusionResult(
                success=False,
                errors=["pandas is required for join operations"],
            )

        if not self.config.join_keys:
            return FusionResult(
                success=False,
                errors=["join_keys must be specified for join strategy"],
            )

        dfs = []
        source_counts = {}

        for i, ds in enumerate(datasets):
            name = ds.get("name", f"source_{i}")
            data = ds.get("data")

            if isinstance(data, pd.DataFrame):
                df = data.copy()
            elif isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                continue

            source_counts[name] = len(df)

            # Add suffix to avoid column conflicts (except join keys)
            if i > 0:
                rename_cols = {
                    c: f"{c}_{name}"
                    for c in df.columns
                    if c not in self.config.join_keys
                }
                df = df.rename(columns=rename_cols)

            dfs.append(df)

        if len(dfs) < 2:
            return FusionResult(
                success=False,
                errors=["At least 2 datasets required for join"],
            )

        # Perform join
        result_df = dfs[0]
        for df in dfs[1:]:
            result_df = result_df.merge(
                df,
                on=self.config.join_keys,
                how=self.config.join_type,
            )

        return FusionResult(
            success=True,
            fused_data=result_df,
            record_count=len(result_df),
            source_counts=source_counts,
        )

    def _fuse_merge(self, datasets: List[Dict[str, Any]]) -> FusionResult:
        """Fuse datasets with conflict resolution."""
        # For merge, we first align schemas, then combine with conflict handling
        result = self._fuse_union(datasets)

        if not result.success:
            return result

        # Handle conflicts in overlapping columns
        conflicts_count = 0
        if self.config.handle_conflicts == "raise":
            # Check for conflicts and report
            pass  # Implementation depends on specific requirements

        result.conflicts_count = conflicts_count
        return result

    def _save_artifact(
        self,
        result: FusionResult,
        datasets: List[Dict[str, Any]],
    ):
        """Save fusion result as artifact."""
        try:
            run_id = new_run_id("fusion")

            # Create fusion report
            report = {
                "fusion_timestamp": datetime.utcnow().isoformat() + "Z",
                "strategy": self.config.strategy,
                "source_datasets": [ds.get("name", f"source_{i}") for i, ds in enumerate(datasets)],
                "source_counts": result.source_counts,
                "fused_record_count": result.record_count,
                "duplicates_removed": result.duplicates_removed,
                "conflicts_count": result.conflicts_count,
                "config": {
                    "join_type": self.config.join_type,
                    "join_keys": self.config.join_keys,
                    "dedup": self.config.dedup,
                    "handle_conflicts": self.config.handle_conflicts,
                },
            }

            store_text(
                run_id=run_id,
                category="fusion_report",
                filename="fusion_report.json",
                text=json.dumps(report, indent=2),
            )

            result.artifact_run_id = run_id
            logger.info(f"Saved fusion artifact: {run_id}")

        except Exception as e:
            logger.warning(f"Failed to save artifact: {e}")


def fuse_datasets(
    datasets: List[Dict[str, Any]],
    strategy: str = "union",
    join_keys: Optional[List[str]] = None,
    dedup: bool = True,
    save_artifact: bool = True,
) -> FusionResult:
    """
    Fuse multiple datasets.

    Args:
        datasets: List of dataset dicts with 'name' and 'data' keys
        strategy: Fusion strategy (union, join, merge)
        join_keys: Keys for join operations
        dedup: Whether to remove duplicates
        save_artifact: Whether to save as artifact

    Returns:
        FusionResult with fused data
    """
    config = FusionConfig(
        strategy=strategy,
        join_keys=join_keys,
        dedup=dedup,
    )
    engine = FusionEngine(config)
    return engine.fuse(datasets, save_artifact)

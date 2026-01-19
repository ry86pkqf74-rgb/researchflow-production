"""
Data Fusion Engine

Merges heterogeneous datasets with configurable join logic.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union
from enum import Enum

logger = logging.getLogger(__name__)


class ConflictResolution(str, Enum):
    """How to resolve conflicting values during merge"""
    KEEP_LEFT = "keep_left"
    KEEP_RIGHT = "keep_right"
    KEEP_BOTH = "keep_both"
    AVERAGE = "average"  # For numeric
    CONCATENATE = "concatenate"  # For strings


@dataclass
class FusionConfig:
    """Configuration for data fusion"""
    join_keys: List[str]
    join_type: str = "inner"  # inner, left, right, outer
    conflict_resolution: ConflictResolution = ConflictResolution.KEEP_LEFT
    fuzzy_match: bool = False
    fuzzy_threshold: float = 0.8
    prefix_left: str = ""
    prefix_right: str = ""
    suffix_left: str = "_x"
    suffix_right: str = "_y"


@dataclass
class FusionResult:
    """Result of data fusion"""
    success: bool
    merged_data: Any = None
    row_count: int = 0
    column_count: int = 0
    matched_rows: int = 0
    unmatched_left: int = 0
    unmatched_right: int = 0
    conflicts_resolved: int = 0
    lineage: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


class FusionEngine:
    """
    Engine for merging/fusing datasets.

    Features:
    - Multiple join types
    - Fuzzy key matching (optional)
    - Conflict resolution
    - Lineage tracking
    """

    def __init__(self, config: FusionConfig):
        self.config = config

    def fuse(
        self,
        left_data: Any,
        right_data: Any,
        left_name: str = "left",
        right_name: str = "right"
    ) -> FusionResult:
        """
        Fuse two datasets together.

        Args:
            left_data: Left DataFrame
            right_data: Right DataFrame
            left_name: Name for left dataset (for lineage)
            right_name: Name for right dataset (for lineage)

        Returns:
            FusionResult with merged data
        """
        try:
            import pandas as pd

            if not isinstance(left_data, pd.DataFrame) or not isinstance(right_data, pd.DataFrame):
                return FusionResult(
                    success=False,
                    error="Both inputs must be DataFrames"
                )

            # Validate join keys exist
            for key in self.config.join_keys:
                if key not in left_data.columns:
                    return FusionResult(
                        success=False,
                        error=f"Join key '{key}' not found in left dataset"
                    )
                if key not in right_data.columns:
                    return FusionResult(
                        success=False,
                        error=f"Join key '{key}' not found in right dataset"
                    )

            # Prepare for merge
            if self.config.fuzzy_match:
                merged = self._fuzzy_merge(left_data, right_data)
            else:
                merged = self._exact_merge(left_data, right_data)

            # Handle conflicts
            conflicts = self._resolve_conflicts(merged)

            # Calculate stats
            left_keys = set(left_data[self.config.join_keys[0]].unique())
            right_keys = set(right_data[self.config.join_keys[0]].unique())
            matched = left_keys & right_keys

            # Build lineage
            lineage = {
                'sources': [
                    {'name': left_name, 'rows': len(left_data), 'columns': len(left_data.columns)},
                    {'name': right_name, 'rows': len(right_data), 'columns': len(right_data.columns)},
                ],
                'join_keys': self.config.join_keys,
                'join_type': self.config.join_type,
                'fuzzy_match': self.config.fuzzy_match,
            }

            return FusionResult(
                success=True,
                merged_data=merged,
                row_count=len(merged),
                column_count=len(merged.columns),
                matched_rows=len(matched),
                unmatched_left=len(left_keys - matched),
                unmatched_right=len(right_keys - matched),
                conflicts_resolved=conflicts,
                lineage=lineage
            )

        except ImportError:
            return FusionResult(
                success=False,
                error="pandas not installed"
            )
        except Exception as e:
            logger.exception(f"Fusion failed: {e}")
            return FusionResult(
                success=False,
                error=str(e)
            )

    def _exact_merge(self, left: Any, right: Any) -> Any:
        """Perform exact key merge"""
        import pandas as pd

        return pd.merge(
            left,
            right,
            on=self.config.join_keys,
            how=self.config.join_type,
            suffixes=(self.config.suffix_left, self.config.suffix_right)
        )

    def _fuzzy_merge(self, left: Any, right: Any) -> Any:
        """Perform fuzzy key merge using rapidfuzz"""
        import pandas as pd

        try:
            from rapidfuzz import fuzz, process

            # For simplicity, handle single join key
            if len(self.config.join_keys) > 1:
                logger.warning("Fuzzy match only supports single join key, using first key")

            key = self.config.join_keys[0]

            # Build mapping of right keys to left keys
            left_keys = left[key].unique()
            right_keys = right[key].unique()

            key_mapping = {}
            for rk in right_keys:
                match = process.extractOne(
                    rk,
                    left_keys,
                    scorer=fuzz.ratio,
                    score_cutoff=self.config.fuzzy_threshold * 100
                )
                if match:
                    key_mapping[rk] = match[0]

            # Create mapped right dataset
            right_mapped = right.copy()
            right_mapped[key] = right_mapped[key].map(lambda x: key_mapping.get(x, x))

            # Perform exact merge with mapped keys
            return pd.merge(
                left,
                right_mapped,
                on=self.config.join_keys,
                how=self.config.join_type,
                suffixes=(self.config.suffix_left, self.config.suffix_right)
            )

        except ImportError:
            logger.warning("rapidfuzz not installed, falling back to exact merge")
            return self._exact_merge(left, right)

    def _resolve_conflicts(self, merged: Any) -> int:
        """Resolve conflicting values in merged data"""
        import pandas as pd

        conflicts = 0

        # Find columns that were duplicated
        left_suffix = self.config.suffix_left
        right_suffix = self.config.suffix_right

        cols = merged.columns.tolist()
        base_cols = set()

        for col in cols:
            if col.endswith(left_suffix):
                base_cols.add(col[:-len(left_suffix)])
            elif col.endswith(right_suffix):
                base_cols.add(col[:-len(right_suffix)])

        for base in base_cols:
            left_col = f"{base}{left_suffix}"
            right_col = f"{base}{right_suffix}"

            if left_col in cols and right_col in cols:
                conflicts += 1

                if self.config.conflict_resolution == ConflictResolution.KEEP_LEFT:
                    merged[base] = merged[left_col]
                    merged.drop([left_col, right_col], axis=1, inplace=True)

                elif self.config.conflict_resolution == ConflictResolution.KEEP_RIGHT:
                    merged[base] = merged[right_col]
                    merged.drop([left_col, right_col], axis=1, inplace=True)

                elif self.config.conflict_resolution == ConflictResolution.AVERAGE:
                    # Only for numeric columns
                    if pd.api.types.is_numeric_dtype(merged[left_col]):
                        merged[base] = merged[[left_col, right_col]].mean(axis=1)
                        merged.drop([left_col, right_col], axis=1, inplace=True)

                # KEEP_BOTH and CONCATENATE leave columns as-is

        return conflicts

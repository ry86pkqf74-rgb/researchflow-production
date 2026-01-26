"""
Temporal consistency validator (offline-safe only).

Validates temporal properties of time-series data:
1. Timestamp monotonicity within groups
2. Date format correctness (ISO 8601)
3. No NULL timestamps where required

EXCLUDED (not offline-safe):
- "No future dates" check (requires trusted time source)

Future dates can be validated in a gated Phase 2 with explicit reference timestamp.
"""

import pandas as pd
from typing import Optional

from .base import BaseValidator, ValidatorResult


class TemporalValidator(BaseValidator):
    """
    Validator for temporal consistency in time-series data.

    Checks offline-safe temporal properties:
        - Timestamps are monotonic (non-decreasing) within groups
            NOTE: Monotonicity is evaluated in the DataFrame's existing row order.
            If inputs are not sorted by timestamp, this validator will (intentionally)
            report a violation.
    - Timestamp format is valid (parseable to datetime)
    - No NULL timestamps where required

    Does NOT check for future dates (requires system clock/trusted time source).
    """

    def __init__(
        self,
        timestamp_col: str,
        group_by_col: Optional[str] = None,
        allow_nulls: bool = False,
        dataset_name: str = "unknown",
    ):
        """
        Initialize temporal validator.

        Args:
            timestamp_col: Column name containing timestamps
            group_by_col: Optional column to group by (e.g., "research_id")
            allow_nulls: If False, fail on NULL timestamps
            dataset_name: Human-readable dataset name
        """
        self.timestamp_col = timestamp_col
        self.group_by_col = group_by_col
        self.allow_nulls = allow_nulls
        self.dataset_name = dataset_name

    def is_offline_safe(self) -> bool:
        """Temporal check is offline-safe (pure DataFrame operations)."""
        return True

    def _check_format(self, df: pd.DataFrame) -> tuple:
        """
        Check timestamp format validity.

        Returns:
            (is_valid, error_count, error_details)
        """
        try:
            # Attempt to parse timestamps
            timestamps = pd.to_datetime(df[self.timestamp_col], errors='coerce')
            invalid_count = timestamps.isna().sum()

            if invalid_count > 0:
                # Find examples of invalid timestamps
                invalid_mask = timestamps.isna() & df[self.timestamp_col].notna()
                invalid_examples = df.loc[invalid_mask, self.timestamp_col].head(5).tolist()

                return False, int(invalid_count), invalid_examples
            else:
                return True, 0, []

        except Exception as e:
            return False, len(df), [str(e)]

    def _check_nulls(self, df: pd.DataFrame) -> tuple:
        """
        Check for NULL timestamps.

        Returns:
            (has_nulls, null_count)
        """
        null_count = df[self.timestamp_col].isna().sum()
        return null_count > 0, int(null_count)

    def _check_monotonicity(self, df: pd.DataFrame) -> tuple:
        """
        Check timestamp monotonicity within groups.

        This check is performed in the DataFrame's current row order (i.e., it does
        not sort within groups). The intent is to enforce an ordering contract for
        downstream time-series operations that assume events are already ordered.

        Returns:
            (is_monotonic, violation_count, violation_examples)
        """
        # Parse timestamps
        df = df.copy()
        df['_parsed_ts'] = pd.to_datetime(df[self.timestamp_col], errors='coerce')

        # Drop rows with invalid timestamps (already caught by format check)
        df_valid = df.dropna(subset=['_parsed_ts'])

        if len(df_valid) == 0:
            return True, 0, []  # No valid timestamps to check

        violations = []

        if self.group_by_col:
            # Check monotonicity within each group
            for group_key, group_df in df_valid.groupby(self.group_by_col):
                # Use is_monotonic_increasing to correctly check monotonicity
                if not group_df['_parsed_ts'].is_monotonic_increasing:
                    # Timestamps not monotonic in this group
                    violations.append({
                        "group": group_key,
                        "rows": len(group_df),
                        "min_ts": group_df['_parsed_ts'].min().isoformat(),
                        "max_ts": group_df['_parsed_ts'].max().isoformat(),
                    })
        else:
            # Check global monotonicity
            if not df_valid['_parsed_ts'].is_monotonic_increasing:
                # Find specific violations using vectorized operations
                ts_series = df_valid['_parsed_ts']
                diffs = ts_series.diff()
                violations_mask = diffs < pd.Timedelta(0)
                violation_indices = df_valid.index[violations_mask]

                # Collect up to 5 example violations
                for idx in violation_indices[:5]:
                    pos = df_valid.index.get_loc(idx)
                    violations.append({
                        "row_index": int(idx),
                        "current_ts": ts_series.iloc[pos].isoformat(),
                        "previous_ts": ts_series.iloc[pos - 1].isoformat(),
                    })

        return len(violations) == 0, len(violations), violations[:5]

    def _validate_impl(self, artifact: pd.DataFrame) -> ValidatorResult:
        """
        Validate temporal consistency.

        Args:
            artifact: DataFrame with timestamp column

        Returns:
            ValidatorResult with temporal validation status
        """
        # Check timestamp column exists
        if self.timestamp_col not in artifact.columns:
            return ValidatorResult(
                validator_name=f"TemporalValidator({self.dataset_name})",
                status="fail",
                message=f"Timestamp column not found: {self.timestamp_col}",
                details={
                    "timestamp_col": self.timestamp_col,
                    "available_columns": list(artifact.columns),
                }
            )

        # Check group_by column exists (if specified)
        if self.group_by_col and self.group_by_col not in artifact.columns:
            return ValidatorResult(
                validator_name=f"TemporalValidator({self.dataset_name})",
                status="fail",
                message=f"Group-by column not found: {self.group_by_col}",
                details={
                    "group_by_col": self.group_by_col,
                    "available_columns": list(artifact.columns),
                }
            )

        # Run temporal checks
        errors = []

        # 1. Check for NULL timestamps
        has_nulls, null_count = self._check_nulls(artifact)
        if has_nulls and not self.allow_nulls:
            errors.append(f"{null_count} NULL timestamps")

        # 2. Check timestamp format
        format_valid, format_error_count, format_examples = self._check_format(artifact)
        if not format_valid:
            errors.append(f"{format_error_count} invalid timestamp formats")

        # 3. Check monotonicity
        monotonic, violation_count, violation_examples = self._check_monotonicity(artifact)
        if not monotonic:
            errors.append(f"{violation_count} monotonicity violations")

        # Aggregate result
        if errors:
            return ValidatorResult(
                validator_name=f"TemporalValidator({self.dataset_name})",
                status="fail",
                message=f"Temporal validation failed: {'; '.join(errors)}",
                details={
                    "timestamp_col": self.timestamp_col,
                    "group_by_col": self.group_by_col,
                    "null_count": null_count if has_nulls else 0,
                    "format_errors": format_error_count if not format_valid else 0,
                    "format_examples": format_examples if not format_valid else [],
                    "monotonicity_violations": violation_count if not monotonic else 0,
                    "violation_examples": violation_examples if not monotonic else [],
                    "total_rows": len(artifact),
                }
            )
        else:
            return ValidatorResult(
                validator_name=f"TemporalValidator({self.dataset_name})",
                status="pass",
                message=f"Temporal validation passed ({len(artifact)} rows)",
                details={
                    "timestamp_col": self.timestamp_col,
                    "group_by_col": self.group_by_col,
                    "total_rows": len(artifact),
                    "null_count": null_count,
                    "all_checks_passed": True,
                }
            )

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"TemporalValidator(ts_col={self.timestamp_col}, "
            f"group_by={self.group_by_col}, offline_safe=True)"
        )

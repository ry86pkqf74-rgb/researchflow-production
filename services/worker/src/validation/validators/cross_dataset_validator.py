"""
Cross-dataset linkage integrity validator.

Validates that linkage keys (e.g., research_id) in one dataset exist in a reference dataset.
This ensures relational integrity across datasets without requiring explicit foreign key constraints.

Example:
    Validate that all research_id values in thyroid_fna_results exist in the patients table.

This validator wraps src/linkage/linkage_validators.py for linkage coverage checks.
"""

import pandas as pd
from pathlib import Path
from typing import Optional, Union

from .base import BaseValidator, ValidatorResult


class CrossDatasetValidator(BaseValidator):
    """
    Validator for cross-dataset linkage integrity.

    Checks that all linkage key values in a dataset exist in a reference dataset.
    Fails-closed if reference dataset is missing or corrupt.
    """

    def __init__(
        self,
        reference_df: Optional[pd.DataFrame] = None,
        reference_path: Optional[Union[str, Path]] = None,
        linkage_key: str = "research_id",
        dataset_name: str = "unknown",
    ):
        """
        Initialize cross-dataset validator.

        Args:
            reference_df: Reference DataFrame (e.g., patients table)
            reference_path: Path to reference DataFrame (Parquet/CSV)
            linkage_key: Column name for linkage key (default: "research_id")
            dataset_name: Human-readable name for this dataset

        Note: Provide either reference_df OR reference_path, not both.
        """
        if reference_df is None and reference_path is None:
            raise ValueError("Must provide either reference_df or reference_path")

        if reference_df is not None and reference_path is not None:
            raise ValueError("Provide only one of reference_df or reference_path")

        self.reference_df = reference_df
        self.reference_path = Path(reference_path) if reference_path else None
        self.linkage_key = linkage_key
        self.dataset_name = dataset_name

    def is_offline_safe(self) -> bool:
        """Cross-dataset check is offline-safe (local file/DataFrame comparison)."""
        return True

    def _load_reference(self) -> pd.DataFrame:
        """
        Load reference DataFrame from path or use provided DataFrame.

        Returns:
            Reference DataFrame

        Raises:
            FileNotFoundError: If reference_path does not exist
            ValueError: If reference DataFrame is empty or missing linkage_key
        """
        if self.reference_df is not None:
            ref_df = self.reference_df
        else:
            # Load from path
            if not self.reference_path.exists():
                raise FileNotFoundError(
                    f"Reference dataset not found: {self.reference_path}"
                )

            if self.reference_path.suffix == ".parquet":
                ref_df = pd.read_parquet(self.reference_path)
            elif self.reference_path.suffix == ".csv":
                ref_df = pd.read_csv(self.reference_path)
            else:
                raise ValueError(
                    f"Unsupported reference file type: {self.reference_path.suffix}"
                )

        # Validate reference DataFrame
        if ref_df.empty:
            raise ValueError("Reference dataset is empty")

        if self.linkage_key not in ref_df.columns:
            raise ValueError(
                f"Reference dataset missing linkage key column: {self.linkage_key}"
            )

        return ref_df

    def _validate_impl(self, artifact: pd.DataFrame) -> ValidatorResult:
        """
        Validate linkage integrity between artifact and reference dataset.

        Args:
            artifact: Dataset DataFrame to validate

        Returns:
            ValidatorResult with:
            - status: "pass" if all linkage keys exist in reference, "fail" otherwise
            - message: Summary message
            - details: Missing keys and coverage statistics
        """
        try:
            # Load reference dataset (fail-closed if missing/corrupt)
            ref_df = self._load_reference()

        except (FileNotFoundError, ValueError) as e:
            # FAIL-CLOSED: If reference unavailable, validation FAILS
            return ValidatorResult(
                validator_name=f"CrossDatasetValidator({self.dataset_name})",
                status="fail",
                message=f"Reference dataset unavailable: {str(e)}",
                details={
                    "error": str(e),
                    "reference_path": str(self.reference_path) if self.reference_path else None,
                    "linkage_key": self.linkage_key,
                }
            )

        # Check artifact has linkage key column
        if self.linkage_key not in artifact.columns:
            return ValidatorResult(
                validator_name=f"CrossDatasetValidator({self.dataset_name})",
                status="fail",
                message=f"Artifact missing linkage key column: {self.linkage_key}",
                details={
                    "linkage_key": self.linkage_key,
                    "artifact_columns": list(artifact.columns),
                }
            )

        # Get unique linkage keys from both datasets
        ref_keys = set(ref_df[self.linkage_key].dropna().unique())
        artifact_keys = set(artifact[self.linkage_key].dropna().unique())

        # Find missing keys (keys in artifact but not in reference)
        missing_keys = artifact_keys - ref_keys

        # Calculate coverage
        total_artifact_keys = len(artifact_keys)
        linked_keys = len(artifact_keys.intersection(ref_keys))
        coverage_pct = (linked_keys / total_artifact_keys * 100) if total_artifact_keys > 0 else 100.0

        if missing_keys:
            return ValidatorResult(
                validator_name=f"CrossDatasetValidator({self.dataset_name})",
                status="fail",
                message=f"Linkage integrity violation: {len(missing_keys)} keys missing from reference",
                details={
                    "linkage_key": self.linkage_key,
                    "missing_keys": sorted(list(missing_keys))[:10],  # Limit to 10 examples
                    "total_missing": len(missing_keys),
                    "coverage_pct": round(coverage_pct, 2),
                    "artifact_unique_keys": total_artifact_keys,
                    "reference_unique_keys": len(ref_keys),
                }
            )
        else:
            return ValidatorResult(
                validator_name=f"CrossDatasetValidator({self.dataset_name})",
                status="pass",
                message=f"Linkage integrity passed: 100% coverage ({linked_keys}/{total_artifact_keys} keys)",
                details={
                    "linkage_key": self.linkage_key,
                    "coverage_pct": 100.0,
                    "artifact_unique_keys": total_artifact_keys,
                    "reference_unique_keys": len(ref_keys),
                }
            )

    def __repr__(self) -> str:
        """Return string representation."""
        ref_source = "DataFrame" if self.reference_df is not None else str(self.reference_path)
        return f"CrossDatasetValidator(reference={ref_source}, key={self.linkage_key}, offline_safe=True)"

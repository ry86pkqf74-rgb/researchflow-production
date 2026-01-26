"""
Concordance Checker - Layer 2

Validates clinical agreement between linked diagnostic modalities.
Examples: CT-ETE vs Path-ETE, TI-RADS vs ROM, Bethesda vs Malignancy
"""

import logging
from typing import Dict, List, Optional
import pandas as pd
import numpy as np

from .layered_verifier import LayerResult, VerificationLayer, VerificationStatus

logger = logging.getLogger(__name__)


class ConcordanceChecker:
    """
    Clinical concordance validation for linked data.

    Checks agreement between:
    - Imaging findings vs pathology outcomes
    - Risk stratification vs actual malignancy
    - Pre-op assessment vs post-op findings
    """

    def __init__(self, min_concordance_pct: float = 85.0):
        """
        Initialize concordance checker.

        Parameters
        ----------
        min_concordance_pct : float
            Minimum acceptable concordance percentage (default: 85%)
        """
        self.min_concordance_pct = min_concordance_pct
        logger.info(
            f"Initialized ConcordanceChecker (min concordance: {min_concordance_pct}%)"
        )

    def check(
        self,
        data: pd.DataFrame,
        linkage_df: pd.DataFrame,
        concordance_pairs: Optional[List[tuple]] = None,
    ) -> LayerResult:
        """
        Check concordance between linked diagnostic modalities.

        Parameters
        ----------
        data : pd.DataFrame
            Primary data with diagnostic features
        linkage_df : pd.DataFrame
            Linkage table connecting modalities
        concordance_pairs : list of tuples, optional
            Feature pairs to check concordance (column1, column2, description)

        Returns
        -------
        LayerResult
        """
        logger.info(f"Checking concordance for {len(linkage_df)} linkages")

        warnings = []
        errors = []
        metrics = {}

        # Default concordance pairs if not specified
        if concordance_pairs is None:
            concordance_pairs = self._detect_concordance_pairs(data, linkage_df)

        if not concordance_pairs:
            logger.warning("No concordance pairs detected, skipping concordance checks")
            return LayerResult(
                layer=VerificationLayer.CONCORDANCE,
                status=VerificationStatus.WARNING,
                passed=True,
                warnings=["No concordance pairs to validate"],
            )

        # Check each concordance pair
        concordance_results = {}

        for col1, col2, description in concordance_pairs:
            if col1 not in data.columns or col2 not in data.columns:
                warnings.append(
                    f"Concordance pair '{description}' skipped: columns not found"
                )
                continue

            # Merge data with linkage
            merged = linkage_df.merge(
                data, left_on="source_id", right_index=True, how="left"
            )

            # Calculate agreement
            merged["agreement"] = merged[col1] == merged[col2]
            concordance_pct = merged["agreement"].mean() * 100

            concordance_results[description] = concordance_pct

            logger.info(f"  {description}: {concordance_pct:.1f}% concordance")

            # Check threshold
            if concordance_pct < self.min_concordance_pct:
                errors.append(
                    f"{description}: {concordance_pct:.1f}% (below {self.min_concordance_pct}% threshold)"
                )
            elif concordance_pct < self.min_concordance_pct + 5:
                warnings.append(
                    f"{description}: {concordance_pct:.1f}% (marginal, close to {self.min_concordance_pct}% threshold)"
                )

        metrics["concordance_pairs_checked"] = len(concordance_results)
        metrics["concordance_results"] = concordance_results
        metrics["mean_concordance"] = (
            np.mean(list(concordance_results.values())) if concordance_results else 0.0
        )

        # Determine overall status
        if errors:
            status = VerificationStatus.FAILED
            passed = False
            logger.error(f"❌ Concordance checks FAILED: {len(errors)} violations")
        elif warnings:
            status = VerificationStatus.WARNING
            passed = True
            logger.warning(
                f"⚠️ Concordance checks WARNING: {len(warnings)} marginal results"
            )
        else:
            status = VerificationStatus.PASSED
            passed = True
            logger.info(f"✅ Concordance checks PASSED")

        return LayerResult(
            layer=VerificationLayer.CONCORDANCE,
            status=status,
            passed=passed,
            warnings=warnings,
            errors=errors,
            metrics=metrics,
        )

    def _detect_concordance_pairs(
        self, data: pd.DataFrame, linkage_df: pd.DataFrame
    ) -> List[tuple]:
        """Auto-detect concordance pairs based on column names"""
        pairs = []

        # Common concordance patterns
        patterns = [
            ("ete_reported", "ete_confirmed", "CT-ETE vs Path-ETE"),
            ("tirads_score", "malignancy_outcome", "TI-RADS vs ROM"),
            ("bethesda_category", "malignancy_outcome", "Bethesda vs Malignancy"),
            ("preop_stage", "postop_stage", "Pre-op vs Post-op Stage"),
        ]

        for col1, col2, desc in patterns:
            if col1 in data.columns and col2 in data.columns:
                pairs.append((col1, col2, desc))

        return pairs


def check_concordance(
    data: pd.DataFrame, linkage_df: pd.DataFrame, min_concordance_pct: float = 85.0
) -> LayerResult:
    """Convenience function for concordance checking"""
    checker = ConcordanceChecker(min_concordance_pct)
    return checker.check(data, linkage_df)


def get_concordance_metrics(result: LayerResult) -> Dict[str, float]:
    """Extract concordance metrics from layer result"""
    return result.metrics.get("concordance_results", {})

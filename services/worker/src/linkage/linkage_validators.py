"""
Linkage CI Validators

This module implements continuous integration validation checks for linkage quality:

1. Time-Gap Bounds: Validates all links respect date tolerance windows
2. Cardinality Constraints: Enforces 1:1, 1:N, or N:M relationships
3. Prohibited Combinations: Prevents invalid linkages (e.g., post-op imaging to pre-op pathology)
4. Linkage Coverage: Monitors percentage of source records successfully linked
5. Concordance Checks: Validates clinical agreement (e.g., CT-ETE vs Path-ETE)

All checks are designed to be run in CI/CD pipelines as quality gates.

Author: Research Operating System
Date: 2025-12-22
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class LinkageValidator:
    """CI validation checks for linkage quality"""

    def __init__(
        self,
        linkage_df: pd.DataFrame,
        source_df: Optional[pd.DataFrame] = None,
        target_df: Optional[pd.DataFrame] = None,
    ):
        """
        Initialize validator with linkage table and optional source/target data.

        Parameters
        ----------
        linkage_df : pd.DataFrame
            Linkage table from linkage_engine
        source_df : pd.DataFrame, optional
            Original source data (for coverage calculations)
        target_df : pd.DataFrame, optional
            Original target data (for coverage calculations)
        """
        self.linkage_df = linkage_df
        self.source_df = source_df
        self.target_df = target_df
        self.validation_results = {}

    def validate_time_gap_bounds(
        self, max_allowed_gap: int, strict: bool = True
    ) -> Dict[str, any]:
        """
        Validate all linkages respect time-gap bounds.

        Check: |days_gap| <= max_allowed_gap for ALL links

        Parameters
        ----------
        max_allowed_gap : int
            Maximum allowed absolute date gap (days)
        strict : bool
            If True, fail validation if ANY link exceeds bound

        Returns
        -------
        dict
            {
                'check_name': 'time_gap_bounds',
                'passed': bool,
                'violations': int,
                'max_gap_observed': int,
                'max_gap_allowed': int,
                'violation_details': list of dicts
            }
        """
        logger.info(f"Validating time-gap bounds: max_allowed_gap={max_allowed_gap}")

        violations = self.linkage_df[self.linkage_df["abs_days_gap"] > max_allowed_gap]

        result = {
            "check_name": "time_gap_bounds",
            "passed": len(violations) == 0,
            "violations": len(violations),
            "max_gap_observed": int(self.linkage_df["abs_days_gap"].max()),
            "max_gap_allowed": max_allowed_gap,
            "violation_details": [],
        }

        if len(violations) > 0:
            # Log first 5 violations
            result["violation_details"] = violations.head(5)[
                ["linkage_id", "abs_days_gap", "link_confidence"]
            ].to_dict("records")

            logger.warning(
                f"⚠️  Time-gap violations: {len(violations)} links exceed {max_allowed_gap} days"
            )
            logger.warning(f"Max gap: {result['max_gap_observed']} days")

            if strict:
                raise ValueError(
                    f"Time-gap validation FAILED: {len(violations)} violations"
                )
        else:
            logger.info(
                f"✅ Time-gap bounds: PASSED (max gap: {result['max_gap_observed']} days)"
            )

        self.validation_results["time_gap_bounds"] = result
        return result

    def validate_cardinality(
        self,
        source_id_col: str,
        target_id_col: str,
        max_links_per_source: int = 1,
        max_links_per_target: Optional[int] = None,
        strict: bool = True,
    ) -> Dict[str, any]:
        """
        Validate cardinality constraints (1:1, 1:N, N:M).

        Checks:
        1. Each source links to ≤ max_links_per_source targets
        2. Each target links to ≤ max_links_per_target sources (if specified)

        Parameters
        ----------
        source_id_col : str
            Column name for source ID (e.g., 'ct_id', 'fna_id')
        target_id_col : str
            Column name for target ID (e.g., 'pathology_id')
        max_links_per_source : int
            Maximum links allowed per source (default: 1 for 1:1)
        max_links_per_target : int, optional
            Maximum links allowed per target (None = no limit)
        strict : bool
            If True, fail validation on violations

        Returns
        -------
        dict
            {
                'check_name': 'cardinality',
                'passed': bool,
                'source_violations': int,
                'target_violations': int,
                'max_links_per_source_observed': int,
                'max_links_per_target_observed': int,
                'violation_details': dict
            }
        """
        logger.info(f"Validating cardinality: {source_id_col} → {target_id_col}")
        logger.info(f"  Max links per source: {max_links_per_source}")
        if max_links_per_target:
            logger.info(f"  Max links per target: {max_links_per_target}")

        # Count links per source
        source_counts = self.linkage_df[source_id_col].value_counts()
        source_violations = source_counts[source_counts > max_links_per_source]

        # Count links per target
        target_counts = self.linkage_df[target_id_col].value_counts()
        if max_links_per_target:
            target_violations = target_counts[target_counts > max_links_per_target]
        else:
            target_violations = pd.Series(dtype=int)

        result = {
            "check_name": "cardinality",
            "passed": len(source_violations) == 0 and len(target_violations) == 0,
            "source_violations": len(source_violations),
            "target_violations": len(target_violations),
            "max_links_per_source_observed": int(source_counts.max()),
            "max_links_per_target_observed": int(target_counts.max()),
            "violation_details": {
                "source_violations": (
                    source_violations.head(5).to_dict()
                    if len(source_violations) > 0
                    else {}
                ),
                "target_violations": (
                    target_violations.head(5).to_dict()
                    if len(target_violations) > 0
                    else {}
                ),
            },
        }

        if not result["passed"]:
            logger.warning(f"⚠️  Cardinality violations:")
            logger.warning(f"  Source violations: {len(source_violations)}")
            logger.warning(f"  Target violations: {len(target_violations)}")

            if strict:
                raise ValueError(f"Cardinality validation FAILED")
        else:
            logger.info(f"✅ Cardinality: PASSED")

        self.validation_results["cardinality"] = result
        return result

    def validate_prohibited_combinations(
        self, prohibited_rules: List[Dict[str, any]], strict: bool = True
    ) -> Dict[str, any]:
        """
        Validate prohibited linkage combinations.

        Example prohibited rules:
        - Post-op imaging linked to pre-op pathology
        - Benign FNA linked to malignant pathology (clinical mismatch)
        - Same-day surgery and post-op imaging (temporal impossibility)

        Parameters
        ----------
        prohibited_rules : list of dict
            List of prohibition rules with format:
            {
                'name': 'post_op_to_pre_op',
                'condition': lambda df: df['days_gap'] > 30,  # Source AFTER target by >30 days
                'description': 'Post-operative imaging should not link to pre-op pathology'
            }
        strict : bool
            If True, fail validation on violations

        Returns
        -------
        dict
            {
                'check_name': 'prohibited_combinations',
                'passed': bool,
                'rules_checked': int,
                'violations_by_rule': dict,
                'total_violations': int
            }
        """
        logger.info(
            f"Validating prohibited combinations: {len(prohibited_rules)} rules"
        )

        violations_by_rule = {}
        total_violations = 0

        for rule in prohibited_rules:
            rule_name = rule["name"]
            condition = rule["condition"]
            description = rule.get("description", "No description")

            # Apply condition to linkage dataframe
            violations = self.linkage_df[condition(self.linkage_df)]

            violations_by_rule[rule_name] = {
                "description": description,
                "violations": len(violations),
                "examples": violations.head(3)[
                    ["linkage_id", "days_gap", "link_confidence"]
                ].to_dict("records"),
            }

            total_violations += len(violations)

            if len(violations) > 0:
                logger.warning(f"⚠️  Rule '{rule_name}': {len(violations)} violations")

        result = {
            "check_name": "prohibited_combinations",
            "passed": total_violations == 0,
            "rules_checked": len(prohibited_rules),
            "violations_by_rule": violations_by_rule,
            "total_violations": total_violations,
        }

        if not result["passed"]:
            logger.warning(
                f"⚠️  Prohibited combinations: {total_violations} total violations"
            )
            if strict:
                raise ValueError(f"Prohibited combinations validation FAILED")
        else:
            logger.info(f"✅ Prohibited combinations: PASSED")

        self.validation_results["prohibited_combinations"] = result
        return result

    def validate_linkage_coverage(
        self, source_id_col: str, min_coverage_pct: float = 80.0, strict: bool = False
    ) -> Dict[str, any]:
        """
        Validate linkage coverage (% of source records linked).

        Check: (linked_sources / total_sources) * 100 >= min_coverage_pct

        Parameters
        ----------
        source_id_col : str
            Column name for source ID
        min_coverage_pct : float
            Minimum required coverage percentage (default: 80%)
        strict : bool
            If True, fail validation if coverage below threshold

        Returns
        -------
        dict
            {
                'check_name': 'linkage_coverage',
                'passed': bool,
                'coverage_pct': float,
                'linked_sources': int,
                'total_sources': int,
                'unlinked_sources': int
            }
        """
        if self.source_df is None:
            logger.warning("Source dataframe not provided, skipping coverage check")
            return {"check_name": "linkage_coverage", "passed": True, "skipped": True}

        logger.info(f"Validating linkage coverage: min_coverage={min_coverage_pct}%")

        linked_sources = self.linkage_df[source_id_col].nunique()
        total_sources = self.source_df[source_id_col].nunique()
        coverage_pct = (linked_sources / total_sources) * 100

        result = {
            "check_name": "linkage_coverage",
            "passed": coverage_pct >= min_coverage_pct,
            "coverage_pct": round(coverage_pct, 2),
            "linked_sources": linked_sources,
            "total_sources": total_sources,
            "unlinked_sources": total_sources - linked_sources,
        }

        if not result["passed"]:
            logger.warning(
                f"⚠️  Linkage coverage: {coverage_pct:.1f}% < {min_coverage_pct}% (threshold)"
            )
            if strict:
                raise ValueError(f"Linkage coverage validation FAILED")
        else:
            logger.info(
                f"✅ Linkage coverage: {coverage_pct:.1f}% (≥ {min_coverage_pct}%)"
            )

        self.validation_results["linkage_coverage"] = result
        return result

    def validate_concordance(
        self,
        source_feature_col: str,
        target_feature_col: str,
        min_agreement_pct: float = 85.0,
        strict: bool = False,
    ) -> Dict[str, any]:
        """
        Validate clinical concordance between linked records.

        Example: CT-reported ETE (extrathyroidal extension) should agree with
        pathology-confirmed ETE in ≥85% of cases.

        Parameters
        ----------
        source_feature_col : str
            Column name for source feature (e.g., 'ct_ete')
        target_feature_col : str
            Column name for target feature (e.g., 'path_ete')
        min_agreement_pct : float
            Minimum required agreement percentage (default: 85%)
        strict : bool
            If True, fail validation if agreement below threshold

        Returns
        -------
        dict
            {
                'check_name': 'concordance',
                'passed': bool,
                'agreement_pct': float,
                'agreements': int,
                'disagreements': int,
                'total_pairs': int
            }
        """
        logger.info(
            f"Validating concordance: {source_feature_col} vs {target_feature_col}"
        )

        # Filter to pairs with both features non-null
        pairs = self.linkage_df[
            self.linkage_df[source_feature_col].notna()
            & self.linkage_df[target_feature_col].notna()
        ].copy()

        if len(pairs) == 0:
            logger.warning(
                "No pairs with both features available, skipping concordance check"
            )
            return {"check_name": "concordance", "passed": True, "skipped": True}

        # Calculate agreement
        pairs["agreement"] = pairs[source_feature_col] == pairs[target_feature_col]
        agreements = pairs["agreement"].sum()
        total_pairs = len(pairs)
        agreement_pct = (agreements / total_pairs) * 100

        result = {
            "check_name": "concordance",
            "feature_pair": f"{source_feature_col} vs {target_feature_col}",
            "passed": agreement_pct >= min_agreement_pct,
            "agreement_pct": round(agreement_pct, 2),
            "agreements": int(agreements),
            "disagreements": int(total_pairs - agreements),
            "total_pairs": total_pairs,
        }

        if not result["passed"]:
            logger.warning(
                f"⚠️  Concordance: {agreement_pct:.1f}% < {min_agreement_pct}% (threshold)"
            )
            if strict:
                raise ValueError(f"Concordance validation FAILED")
        else:
            logger.info(
                f"✅ Concordance: {agreement_pct:.1f}% (≥ {min_agreement_pct}%)"
            )

        self.validation_results["concordance"] = result
        return result

    def get_validation_summary(self) -> Dict[str, any]:
        """
        Get summary of all validation checks run.

        Returns
        -------
        dict
            {
                'all_checks_passed': bool,
                'checks_run': int,
                'checks_passed': int,
                'checks_failed': int,
                'results': dict of individual check results
            }
        """
        checks_passed = sum(
            1
            for r in self.validation_results.values()
            if r.get("passed", False) and not r.get("skipped", False)
        )
        checks_run = len(
            [r for r in self.validation_results.values() if not r.get("skipped", False)]
        )

        return {
            "all_checks_passed": all(
                r.get("passed", False) for r in self.validation_results.values()
            ),
            "checks_run": checks_run,
            "checks_passed": checks_passed,
            "checks_failed": checks_run - checks_passed,
            "results": self.validation_results,
        }


def validate_time_gap_bounds(
    linkage_df: pd.DataFrame, max_allowed_gap: int, strict: bool = True
) -> Dict[str, any]:
    """Convenience function for time-gap validation (delegates to LinkageValidator)"""
    validator = LinkageValidator(linkage_df)
    return validator.validate_time_gap_bounds(max_allowed_gap, strict)


def validate_cardinality(
    linkage_df: pd.DataFrame,
    source_id_col: str,
    target_id_col: str,
    max_links_per_source: int = 1,
    strict: bool = True,
) -> Dict[str, any]:
    """Convenience function for cardinality validation (delegates to LinkageValidator)"""
    validator = LinkageValidator(linkage_df)
    return validator.validate_cardinality(
        source_id_col, target_id_col, max_links_per_source, None, strict
    )


def validate_prohibited_combinations(
    linkage_df: pd.DataFrame,
    prohibited_rules: List[Dict[str, any]],
    strict: bool = True,
) -> Dict[str, any]:
    """Convenience function for prohibited combinations validation (delegates to LinkageValidator)"""
    validator = LinkageValidator(linkage_df)
    return validator.validate_prohibited_combinations(prohibited_rules, strict)


def run_all_validation_checks(
    linkage_df: pd.DataFrame,
    source_df: pd.DataFrame,
    target_df: pd.DataFrame,
    config: Dict[str, any],
    strict: bool = False,
) -> Dict[str, any]:
    """
    Run all validation checks in one call.

    Parameters
    ----------
    linkage_df : pd.DataFrame
        Linkage table
    source_df : pd.DataFrame
        Source data
    target_df : pd.DataFrame
        Target data
    config : dict
        Configuration with keys:
        - max_gap_days: int
        - source_id_col: str
        - target_id_col: str
        - max_links_per_source: int
        - min_coverage_pct: float
        - prohibited_rules: list of dict
    strict : bool
        If True, raise exception on any validation failure

    Returns
    -------
    dict
        Validation summary with all check results
    """
    validator = LinkageValidator(linkage_df, source_df, target_df)

    # Run all checks
    validator.validate_time_gap_bounds(config["max_gap_days"], strict=strict)

    validator.validate_cardinality(
        config["source_id_col"],
        config["target_id_col"],
        config.get("max_links_per_source", 1),
        strict=strict,
    )

    if "prohibited_rules" in config and len(config["prohibited_rules"]) > 0:
        validator.validate_prohibited_combinations(
            config["prohibited_rules"], strict=strict
        )

    validator.validate_linkage_coverage(
        config["source_id_col"], config.get("min_coverage_pct", 80.0), strict=strict
    )

    return validator.get_validation_summary()

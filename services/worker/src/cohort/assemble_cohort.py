"""
Cohort Assembly Orchestration - SAP §2 Aligned Scaffolding.

Provides the main cohort assembly function and result structures.
This is SCAFFOLDING ONLY - no actual analysis is performed.

SAP §2 Reference Structure:
- §2.1: Study Population Definition
- §2.2: Inclusion Criteria
- §2.3: Exclusion Criteria
- §2.4: Sample Size Considerations

GOVERNANCE NOTICE:
- This module provides STRUCTURAL scaffolding only
- NO outcomes, labels, or model features computed
- NO cohort counts for manuscript
- PHI checks enforced upstream

Expected Input Sources (placeholder paths):
- data/processed/thyroid_*.parquet (post PHI-strip, post linkage normalization)
- Validated via Pandera schemas before cohort assembly

Expected Linkage Key:
- research_id (canonical, normalized via src/conform/linkage_key_normalizer.py)
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Union
import uuid

import pandas as pd

__version__ = "v1.0.0"


# -----------------------------------------------------------------------------
# Result Structures
# -----------------------------------------------------------------------------


@dataclass
class ExclusionRecord:
    """
    Record of a single exclusion event.

    Attributes
    ----------
    research_id : str | int
        The excluded patient's research ID
    reason : str
        Human-readable exclusion reason
    rule_id : str
        Identifier for the rule that triggered exclusion (e.g., "EXC-001")
    sap_ref : str
        Reference to SAP section (e.g., "§2.3.1")
    """

    research_id: Union[str, int]
    reason: str
    rule_id: str
    sap_ref: str = ""


@dataclass
class ExclusionsSummary:
    """
    Summary of exclusions by rule.

    Attributes
    ----------
    rule_id : str
        Rule identifier
    reason : str
        Human-readable reason
    count : int
        Number of patients excluded by this rule
    sap_ref : str
        SAP reference
    """

    rule_id: str
    reason: str
    count: int
    sap_ref: str = ""


@dataclass
class CohortResult:
    """
    Structured result of cohort assembly.

    This dataclass captures all outputs of the cohort assembly process
    in a structured format suitable for downstream validation and reporting.

    Attributes
    ----------
    included_ids : List[Union[str, int]]
        Research IDs of patients included in final cohort
    excluded_ids : List[Union[str, int]]
        Research IDs of patients excluded from cohort
    exclusions_log : List[ExclusionRecord]
        Detailed log of each exclusion event
    exclusions_summary : List[ExclusionsSummary]
        Summary counts by exclusion rule
    metadata : Dict[str, Any]
        Assembly metadata including:
        - sap_ref: SAP section reference
        - version: Assembly module version
        - run_id: Unique identifier for this assembly run
        - timestamp: When assembly was performed
        - input_sources: Placeholder for input table paths
        - linkage_key: Expected linkage key column name
        - notes: Additional notes

    GOVERNANCE NOTICE:
    - included_ids/excluded_ids are for STRUCTURAL validation only
    - Do NOT use counts for manuscript results without authorization
    - Do NOT derive outcomes or features from this structure
    """

    included_ids: List[Union[str, int]] = field(default_factory=list)
    excluded_ids: List[Union[str, int]] = field(default_factory=list)
    exclusions_log: List[ExclusionRecord] = field(default_factory=list)
    exclusions_summary: List[ExclusionsSummary] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Initialize metadata defaults if not provided."""
        default_metadata = {
            "sap_ref": "§2",
            "version": __version__,
            "run_id": str(uuid.uuid4())[:8],
            "timestamp": datetime.utcnow().isoformat(),
            "input_sources": [],  # Placeholder for parquet paths
            "linkage_key": "research_id",
            "notes": "SCAFFOLDING ONLY - not for manuscript results",
        }
        for key, value in default_metadata.items():
            if key not in self.metadata:
                self.metadata[key] = value

    @property
    def n_included(self) -> int:
        """Count of included patients."""
        return len(self.included_ids)

    @property
    def n_excluded(self) -> int:
        """Count of excluded patients."""
        return len(self.excluded_ids)

    @property
    def n_total(self) -> int:
        """Total patients considered."""
        return self.n_included + self.n_excluded

    def to_exclusions_dataframe(self) -> pd.DataFrame:
        """
        Convert exclusions summary to DataFrame.

        Returns
        -------
        pd.DataFrame
            Table with columns: rule_id, reason, count, sap_ref
        """
        if not self.exclusions_summary:
            return pd.DataFrame(columns=["rule_id", "reason", "count", "sap_ref"])

        return pd.DataFrame(
            [
                {
                    "rule_id": s.rule_id,
                    "reason": s.reason,
                    "count": s.count,
                    "sap_ref": s.sap_ref,
                }
                for s in self.exclusions_summary
            ]
        )


def create_empty_cohort_result(
    sap_ref: str = "§2",
    notes: str = "",
) -> CohortResult:
    """
    Create an empty CohortResult with initialized metadata.

    Parameters
    ----------
    sap_ref : str
        SAP section reference (default "§2")
    notes : str
        Additional notes for this assembly

    Returns
    -------
    CohortResult
        Empty result structure with metadata initialized
    """
    return CohortResult(
        metadata={
            "sap_ref": sap_ref,
            "notes": notes or "SCAFFOLDING ONLY - not for manuscript results",
        }
    )


# -----------------------------------------------------------------------------
# Main Assembly Function
# -----------------------------------------------------------------------------


def assemble_cohort(
    df: pd.DataFrame,
    inclusion_rules: Optional[List["EligibilityRule"]] = None,
    exclusion_rules: Optional[List["EligibilityRule"]] = None,
    linkage_key: str = "research_id",
    sap_ref: str = "§2",
    input_sources: Optional[List[str]] = None,
) -> CohortResult:
    """
    Assemble cohort by applying inclusion and exclusion criteria.

    This is the main cohort assembly orchestration function. It applies
    eligibility rules sequentially and returns a structured result.

    SCAFFOLDING ONLY - no actual analysis performed.

    Parameters
    ----------
    df : pd.DataFrame
        Input DataFrame with patient data. Must contain:
        - linkage_key column (default: "research_id")
        - Columns referenced by eligibility rules
    inclusion_rules : List[EligibilityRule], optional
        Rules for inclusion (patients must pass ALL inclusion rules)
    exclusion_rules : List[EligibilityRule], optional
        Rules for exclusion (patients failing ANY exclusion rule are excluded)
    linkage_key : str
        Column name for patient identifier (default: "research_id")
    sap_ref : str
        SAP section reference for this assembly
    input_sources : List[str], optional
        Placeholder for input parquet paths (for provenance tracking)

    Returns
    -------
    CohortResult
        Structured result containing:
        - included_ids: Patients passing all criteria
        - excluded_ids: Patients failing any criterion
        - exclusions_log: Detailed exclusion events
        - exclusions_summary: Counts by rule
        - metadata: Assembly metadata

    Raises
    ------
    ValueError
        If linkage_key column is missing from DataFrame

    Examples
    --------
    >>> from src.cohort.eligibility_checks import EligibilityRule
    >>> df = pd.DataFrame({
    ...     "research_id": [1, 2, 3, 4],
    ...     "age": [45, 17, 55, 65],
    ...     "has_fna": [True, True, False, True],
    ... })
    >>> # Define rules (scaffolding - actual rules from SAP)
    >>> inc_rules = [
    ...     EligibilityRule("INC-001", "age", "ge", 18, "§2.2.1", "Age >= 18"),
    ... ]
    >>> exc_rules = [
    ...     EligibilityRule("EXC-001", "has_fna", "eq", False, "§2.3.1", "No FNA"),
    ... ]
    >>> result = assemble_cohort(df, inc_rules, exc_rules)
    >>> result.n_included
    2
    """
    # Import here to avoid circular import
    from src.cohort.eligibility_checks import apply_eligibility_rules

    # Validate linkage key exists
    if linkage_key not in df.columns:
        raise ValueError(
            f"Linkage key '{linkage_key}' not found in DataFrame. "
            f"Available columns: {df.columns.tolist()}"
        )

    # Initialize result
    result = CohortResult(
        metadata={
            "sap_ref": sap_ref,
            "input_sources": input_sources or [],
            "linkage_key": linkage_key,
        }
    )

    # Get all unique patient IDs
    all_ids = set(df[linkage_key].dropna().unique())

    # Track exclusions
    excluded_ids: Set[Union[str, int]] = set()
    exclusions_log: List[ExclusionRecord] = []
    exclusion_counts: Dict[str, int] = {}

    # Apply inclusion rules (must pass ALL)
    if inclusion_rules:
        for rule in inclusion_rules:
            mask = apply_eligibility_rules(df, [rule])
            failing_ids = set(df.loc[~mask, linkage_key].dropna().unique())

            for pid in failing_ids:
                if pid not in excluded_ids:
                    excluded_ids.add(pid)
                    exclusions_log.append(
                        ExclusionRecord(
                            research_id=pid,
                            reason=f"Failed inclusion: {rule.description}",
                            rule_id=rule.rule_id,
                            sap_ref=rule.sap_ref,
                        )
                    )

            # Count for this rule
            new_exclusions = len(failing_ids - (excluded_ids - failing_ids))
            if rule.rule_id not in exclusion_counts:
                exclusion_counts[rule.rule_id] = 0
            exclusion_counts[rule.rule_id] += len(failing_ids)

    # Apply exclusion rules (fail ANY → exclude)
    if exclusion_rules:
        for rule in exclusion_rules:
            # For exclusion rules, we INVERT the logic:
            # If the rule matches (returns True), the patient is EXCLUDED
            mask = apply_eligibility_rules(df, [rule])
            # Patients where mask is True should be EXCLUDED
            matching_ids = set(df.loc[mask, linkage_key].dropna().unique())

            for pid in matching_ids:
                if pid not in excluded_ids:
                    excluded_ids.add(pid)
                    exclusions_log.append(
                        ExclusionRecord(
                            research_id=pid,
                            reason=f"Matched exclusion: {rule.description}",
                            rule_id=rule.rule_id,
                            sap_ref=rule.sap_ref,
                        )
                    )

            # Count for this rule
            if rule.rule_id not in exclusion_counts:
                exclusion_counts[rule.rule_id] = 0
            exclusion_counts[rule.rule_id] += len(matching_ids)

    # Calculate included IDs
    included_ids = all_ids - excluded_ids

    # Build exclusions summary
    all_rules = (inclusion_rules or []) + (exclusion_rules or [])
    rule_lookup = {r.rule_id: r for r in all_rules}

    exclusions_summary = []
    for rule_id, count in sorted(exclusion_counts.items()):
        rule = rule_lookup.get(rule_id)
        exclusions_summary.append(
            ExclusionsSummary(
                rule_id=rule_id,
                reason=rule.description if rule else "Unknown",
                count=count,
                sap_ref=rule.sap_ref if rule else "",
            )
        )

    # Populate result
    result.included_ids = sorted(included_ids, key=str)
    result.excluded_ids = sorted(excluded_ids, key=str)
    result.exclusions_log = exclusions_log
    result.exclusions_summary = exclusions_summary

    return result

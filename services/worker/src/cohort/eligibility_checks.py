"""
Eligibility Rule Checks - SAP §2 Aligned Scaffolding.

Provides individual eligibility rule functions and the EligibilityRule
structure for defining inclusion/exclusion criteria.

SAP §2 Reference Structure:
- §2.2: Inclusion Criteria
- §2.3: Exclusion Criteria

GOVERNANCE NOTICE:
- This module provides STRUCTURAL scaffolding only
- Rule definitions are PLACEHOLDERS aligned to SAP structure
- Actual criteria values come from SAP authorization
- NO outcomes, labels, or model features computed
"""

from dataclasses import dataclass
from typing import Any, Callable, List, Optional, Set, Union

import pandas as pd
import numpy as np

__version__ = "v1.0.0"


# -----------------------------------------------------------------------------
# Rule Structure
# -----------------------------------------------------------------------------


@dataclass
class EligibilityRule:
    """
    Definition of a single eligibility rule.

    Rules can be used for either inclusion or exclusion criteria.
    The interpretation depends on context:
    - Inclusion: Patient must SATISFY rule to be included
    - Exclusion: Patient SATISFYING rule is excluded

    Attributes
    ----------
    rule_id : str
        Unique identifier (e.g., "INC-001", "EXC-002")
    column : str
        Column name to evaluate
    operator : str
        Comparison operator: "eq", "ne", "gt", "ge", "lt", "le", "in", "notin", "notnull", "isnull"
    value : Any
        Comparison value (or list for "in"/"notin")
    sap_ref : str
        SAP section reference (e.g., "§2.2.1")
    description : str
        Human-readable description of the rule

    Examples
    --------
    >>> # Age >= 18 inclusion rule
    >>> rule = EligibilityRule(
    ...     rule_id="INC-001",
    ...     column="age",
    ...     operator="ge",
    ...     value=18,
    ...     sap_ref="§2.2.1",
    ...     description="Age >= 18 years"
    ... )
    """

    rule_id: str
    column: str
    operator: str
    value: Any
    sap_ref: str = ""
    description: str = ""

    def __post_init__(self):
        """Validate operator."""
        valid_operators = {
            "eq",
            "ne",
            "gt",
            "ge",
            "lt",
            "le",
            "in",
            "notin",
            "notnull",
            "isnull",
            "contains",
            "startswith",
            "endswith",
        }
        if self.operator not in valid_operators:
            raise ValueError(
                f"Invalid operator '{self.operator}'. "
                f"Valid operators: {sorted(valid_operators)}"
            )


# -----------------------------------------------------------------------------
# Individual Rule Check Functions
# -----------------------------------------------------------------------------


def check_non_null_linkage_key(
    df: pd.DataFrame,
    linkage_key: str = "research_id",
) -> pd.Series:
    """
    Check that linkage key is non-null.

    This is a fundamental requirement - patients without a valid
    linkage key cannot be included in any cohort.

    Parameters
    ----------
    df : pd.DataFrame
        Input DataFrame
    linkage_key : str
        Column name for linkage key (default: "research_id")

    Returns
    -------
    pd.Series
        Boolean mask where True = has valid linkage key

    Raises
    ------
    ValueError
        If linkage_key column is missing
    """
    if linkage_key not in df.columns:
        raise ValueError(f"Linkage key '{linkage_key}' not found in DataFrame")

    return df[linkage_key].notna()


def check_has_required_column(
    df: pd.DataFrame,
    column: str,
) -> pd.Series:
    """
    Check that a required column exists and has non-null values.

    Parameters
    ----------
    df : pd.DataFrame
        Input DataFrame
    column : str
        Column name to check

    Returns
    -------
    pd.Series
        Boolean mask where True = column exists and value is non-null
    """
    if column not in df.columns:
        return pd.Series([False] * len(df), index=df.index)

    return df[column].notna()


def check_value_in_set(
    df: pd.DataFrame,
    column: str,
    allowed_values: Set[Any],
) -> pd.Series:
    """
    Check that column values are within allowed set.

    Parameters
    ----------
    df : pd.DataFrame
        Input DataFrame
    column : str
        Column name to check
    allowed_values : Set[Any]
        Set of allowed values

    Returns
    -------
    pd.Series
        Boolean mask where True = value is in allowed set
    """
    if column not in df.columns:
        return pd.Series([False] * len(df), index=df.index)

    return df[column].isin(allowed_values)


def check_value_range(
    df: pd.DataFrame,
    column: str,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    inclusive: str = "both",
) -> pd.Series:
    """
    Check that column values are within specified range.

    Parameters
    ----------
    df : pd.DataFrame
        Input DataFrame
    column : str
        Column name to check
    min_value : float, optional
        Minimum allowed value
    max_value : float, optional
        Maximum allowed value
    inclusive : str
        Which bounds are inclusive: "both", "left", "right", "neither"

    Returns
    -------
    pd.Series
        Boolean mask where True = value is within range
    """
    if column not in df.columns:
        return pd.Series([False] * len(df), index=df.index)

    series = df[column]
    mask = pd.Series([True] * len(df), index=df.index)

    if min_value is not None:
        if inclusive in ("both", "left"):
            mask &= series >= min_value
        else:
            mask &= series > min_value

    if max_value is not None:
        if inclusive in ("both", "right"):
            mask &= series <= max_value
        else:
            mask &= series < max_value

    return mask


# -----------------------------------------------------------------------------
# Rule Application
# -----------------------------------------------------------------------------


def _evaluate_single_rule(
    df: pd.DataFrame,
    rule: EligibilityRule,
) -> pd.Series:
    """
    Evaluate a single eligibility rule against DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Input DataFrame
    rule : EligibilityRule
        Rule to evaluate

    Returns
    -------
    pd.Series
        Boolean mask where True = rule is satisfied
    """
    column = rule.column
    operator = rule.operator
    value = rule.value

    # Handle missing column
    if column not in df.columns:
        # For null checks on missing column, return appropriate default
        if operator == "isnull":
            return pd.Series([True] * len(df), index=df.index)
        elif operator == "notnull":
            return pd.Series([False] * len(df), index=df.index)
        else:
            return pd.Series([False] * len(df), index=df.index)

    series = df[column]

    # Evaluate based on operator
    if operator == "eq":
        return series == value
    elif operator == "ne":
        return series != value
    elif operator == "gt":
        return series > value
    elif operator == "ge":
        return series >= value
    elif operator == "lt":
        return series < value
    elif operator == "le":
        return series <= value
    elif operator == "in":
        return series.isin(value if isinstance(value, (list, set, tuple)) else [value])
    elif operator == "notin":
        return ~series.isin(value if isinstance(value, (list, set, tuple)) else [value])
    elif operator == "notnull":
        return series.notna()
    elif operator == "isnull":
        return series.isna()
    elif operator == "contains":
        return series.astype(str).str.contains(str(value), na=False)
    elif operator == "startswith":
        return series.astype(str).str.startswith(str(value), na=False)
    elif operator == "endswith":
        return series.astype(str).str.endswith(str(value), na=False)
    else:
        raise ValueError(f"Unsupported operator: {operator}")


def apply_eligibility_rules(
    df: pd.DataFrame,
    rules: List[EligibilityRule],
    require_all: bool = True,
) -> pd.Series:
    """
    Apply multiple eligibility rules to DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Input DataFrame
    rules : List[EligibilityRule]
        List of rules to apply
    require_all : bool
        If True, all rules must be satisfied (AND logic)
        If False, any rule satisfied is sufficient (OR logic)

    Returns
    -------
    pd.Series
        Boolean mask where True = eligibility criteria met

    Examples
    --------
    >>> rules = [
    ...     EligibilityRule("R1", "age", "ge", 18, "§2.2.1", "Adult"),
    ...     EligibilityRule("R2", "consent", "eq", True, "§2.2.2", "Consented"),
    ... ]
    >>> mask = apply_eligibility_rules(df, rules, require_all=True)
    """
    if not rules:
        # No rules = all patients eligible
        return pd.Series([True] * len(df), index=df.index)

    masks = [_evaluate_single_rule(df, rule) for rule in rules]

    if require_all:
        # AND: all rules must be satisfied
        combined = masks[0]
        for mask in masks[1:]:
            combined = combined & mask
        return combined
    else:
        # OR: any rule satisfied
        combined = masks[0]
        for mask in masks[1:]:
            combined = combined | mask
        return combined


# -----------------------------------------------------------------------------
# SAP-Aligned Rule Builders (Placeholders)
# -----------------------------------------------------------------------------


def build_sap_inclusion_rules() -> List[EligibilityRule]:
    """
    Build inclusion rules aligned to SAP §2.2.

    PLACEHOLDER - actual rules come from authorized SAP.

    Returns
    -------
    List[EligibilityRule]
        Placeholder inclusion rules

    Notes
    -----
    SAP §2.2 Inclusion Criteria (placeholder structure):
    - INC-001: Has valid research_id
    - INC-002: Has thyroid FNA result
    - INC-003: Has pathology outcome (for those with surgery)

    GOVERNANCE: Do NOT populate with actual criteria without authorization.
    """
    return [
        EligibilityRule(
            rule_id="INC-001",
            column="research_id",
            operator="notnull",
            value=None,
            sap_ref="§2.2.1",
            description="Has valid research identifier",
        ),
        # Additional rules are PLACEHOLDERS
        # Actual rules populated from SAP during authorized analysis
    ]


def build_sap_exclusion_rules() -> List[EligibilityRule]:
    """
    Build exclusion rules aligned to SAP §2.3.

    PLACEHOLDER - actual rules come from authorized SAP.

    Returns
    -------
    List[EligibilityRule]
        Placeholder exclusion rules

    Notes
    -----
    SAP §2.3 Exclusion Criteria (placeholder structure):
    - EXC-001: Missing critical data
    - EXC-002: Prior thyroid cancer history
    - EXC-003: Non-diagnostic FNA without follow-up

    GOVERNANCE: Do NOT populate with actual criteria without authorization.
    """
    return [
        # Exclusion rules are PLACEHOLDERS
        # Actual rules populated from SAP during authorized analysis
    ]

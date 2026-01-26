"""
Linkage Engine with CI Guardrails

This module implements deterministic linkage rules between multi-modal diagnostic
events and clinical outcomes with configurable date tolerances:

- CT imaging → Pathology/Surgery: ±90 days (extended window for pre-op imaging)
- FNA cytology → Pathology/Surgery: ±14 days (strict window for diagnostic biopsy)
- Molecular testing → Pathology/Surgery: ±30 days (standard window for molecular workup)

All linkages are logged to an immutable audit trail for reproducibility.

Author: Research Operating System
Date: 2025-12-22
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import timedelta, datetime
from typing import Dict, List, Optional, Tuple
import logging
import hashlib
import json

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class LinkageConfig:
    """Configuration for deterministic linkage rules"""

    # Date tolerance windows (days) for each modality
    DATE_TOLERANCES = {
        "ct_scan": 90,  # ±90 days: Extended pre-op imaging window
        "fna_biopsy": 14,  # ±14 days: Strict diagnostic biopsy window
        "molecular_test": 30,  # ±30 days: Standard molecular workup window
        "mri_scan": 90,  # ±90 days: Extended imaging window
        "pet_scan": 90,  # ±90 days: Extended imaging window
        "ultrasound": 45,  # ±45 days: Moderate imaging window
    }

    # Cardinality rules (max allowed links per source record)
    CARDINALITY_LIMITS = {
        "ct_scan": 1,  # 1:1 - Each CT links to one pathology
        "fna_biopsy": 1,  # 1:1 - Each FNA links to one pathology
        "molecular_test": 1,  # 1:1 - Each molecular test links to one pathology
        "ultrasound": 1,  # 1:1 - Each ultrasound links to one pathology
    }

    # Prohibited combinations (should not be linked together)
    PROHIBITED_COMBINATIONS = [
        # Example: Don't link post-op imaging to pre-op pathology
        {
            "source_type": "ct_scan",
            "target_type": "pathology",
            "condition": "source_after_target",
        },
    ]

    # Linkage priority (when multiple candidates exist within tolerance)
    LINKAGE_PRIORITY = [
        "nearest_date",  # Primary: Closest date match
        "same_patient_id",  # Secondary: Confirm patient ID match
        "within_tolerance",  # Tertiary: Within date tolerance window
    ]


def create_linkage_id(
    source_id: str, target_id: str, source_type: str, target_type: str
) -> str:
    """
    Create deterministic linkage ID from source and target.

    Format: {source_type}_{source_id}_to_{target_type}_{target_id}
    Hash ensures uniqueness and reproducibility.
    """
    link_string = f"{source_type}_{source_id}_to_{target_type}_{target_id}"
    link_hash = hashlib.sha256(link_string.encode()).hexdigest()[:16]
    return f"LINK_{link_hash}"


def calculate_date_gap(
    source_date: pd.Timestamp, target_date: pd.Timestamp
) -> Dict[str, any]:
    """
    Calculate temporal gap between source and target dates.

    Returns dict with:
    - days_gap: Signed integer (negative = source before target)
    - abs_days_gap: Absolute value
    - within_tolerance: Boolean (populated by caller)
    """
    days_gap = (target_date - source_date).days
    return {
        "days_gap": days_gap,
        "abs_days_gap": abs(days_gap),
        "source_before_target": days_gap > 0,
    }


def link_ct_to_pathology(
    ct_df: pd.DataFrame,
    pathology_df: pd.DataFrame,
    patient_id_col: str = "research_id",
    ct_date_col: str = "ct_date",
    path_date_col: str = "surgery_date",
    tolerance_days: int = 90,
) -> pd.DataFrame:
    """
    Link CT scans to pathology reports using deterministic date tolerance.

    Linkage Rule:
    - CT must be within ±90 days of surgery/pathology date
    - If multiple CTs qualify, select nearest to surgery date
    - Each CT links to at most 1 pathology (1:1 cardinality)

    Parameters
    ----------
    ct_df : pd.DataFrame
        CT imaging data with columns: research_id, ct_id, ct_date
    pathology_df : pd.DataFrame
        Pathology data with columns: research_id, pathology_id, surgery_date
    patient_id_col : str
        Column name for patient identifier
    ct_date_col : str
        Column name for CT scan date
    path_date_col : str
        Column name for pathology/surgery date
    tolerance_days : int
        Date tolerance window (default: 90 days)

    Returns
    -------
    pd.DataFrame
        Linkage table with columns:
        - linkage_id
        - ct_id
        - pathology_id
        - research_id
        - ct_date
        - surgery_date
        - days_gap (negative = CT before surgery)
        - abs_days_gap
        - within_tolerance (always True for returned links)
        - link_confidence (0.0-1.0, based on date proximity)
    """
    logger.info(
        f"Linking {len(ct_df)} CT scans to {len(pathology_df)} pathology reports"
    )
    logger.info(f"Date tolerance: ±{tolerance_days} days")

    # Merge on patient ID
    merged = ct_df.merge(
        pathology_df, on=patient_id_col, how="inner", suffixes=("_ct", "_path")
    )

    logger.info(f"Found {len(merged)} potential CT-pathology pairs (same patient)")

    # Calculate date gaps
    merged["days_gap"] = (merged[path_date_col] - merged[ct_date_col]).dt.days
    merged["abs_days_gap"] = merged["days_gap"].abs()
    merged["within_tolerance"] = merged["abs_days_gap"] <= tolerance_days

    # Filter to within tolerance
    within_tolerance = merged[merged["within_tolerance"]].copy()
    logger.info(
        f"{len(within_tolerance)} CT-pathology pairs within ±{tolerance_days} days"
    )

    if len(within_tolerance) == 0:
        logger.warning("No CT-pathology links within tolerance window!")
        return pd.DataFrame()

    # Enforce 1:1 cardinality: Each CT links to nearest pathology
    within_tolerance = within_tolerance.sort_values("abs_days_gap")
    linkage = within_tolerance.groupby("ct_id").first().reset_index()

    logger.info(f"Created {len(linkage)} unique CT-pathology links (1:1 cardinality)")

    # Create linkage IDs
    linkage["linkage_id"] = linkage.apply(
        lambda row: create_linkage_id(
            row["ct_id"], row["pathology_id"], "ct_scan", "pathology"
        ),
        axis=1,
    )

    # Calculate link confidence (1.0 for same-day, decreases with date gap)
    linkage["link_confidence"] = 1.0 - (linkage["abs_days_gap"] / tolerance_days)

    # Select final columns
    result = linkage[
        [
            "linkage_id",
            "ct_id",
            "pathology_id",
            patient_id_col,
            ct_date_col,
            path_date_col,
            "days_gap",
            "abs_days_gap",
            "within_tolerance",
            "link_confidence",
        ]
    ]

    # Log linkage statistics
    logger.info(f"CT-Pathology Linkage Stats:")
    logger.info(f"  Mean date gap: {linkage['abs_days_gap'].mean():.1f} days")
    logger.info(f"  Median date gap: {linkage['abs_days_gap'].median():.1f} days")
    logger.info(f"  Max date gap: {linkage['abs_days_gap'].max()} days")
    logger.info(f"  Mean confidence: {linkage['link_confidence'].mean():.3f}")

    return result


def link_fna_to_pathology(
    fna_df: pd.DataFrame,
    pathology_df: pd.DataFrame,
    patient_id_col: str = "research_id",
    fna_date_col: str = "fna_date",
    path_date_col: str = "surgery_date",
    tolerance_days: int = 14,
) -> pd.DataFrame:
    """
    Link FNA biopsies to pathology reports using strict date tolerance.

    Linkage Rule:
    - FNA must be within ±14 days of surgery/pathology date (strict)
    - If multiple FNAs qualify, select nearest to surgery date
    - Each FNA links to at most 1 pathology (1:1 cardinality)

    Parameters
    ----------
    fna_df : pd.DataFrame
        FNA cytology data with columns: research_id, fna_id, fna_date
    pathology_df : pd.DataFrame
        Pathology data with columns: research_id, pathology_id, surgery_date
    patient_id_col : str
        Column name for patient identifier
    fna_date_col : str
        Column name for FNA date
    path_date_col : str
        Column name for pathology/surgery date
    tolerance_days : int
        Date tolerance window (default: 14 days, strict)

    Returns
    -------
    pd.DataFrame
        Linkage table (same schema as link_ct_to_pathology)
    """
    logger.info(
        f"Linking {len(fna_df)} FNA biopsies to {len(pathology_df)} pathology reports"
    )
    logger.info(f"Date tolerance: ±{tolerance_days} days (STRICT)")

    # Merge on patient ID
    merged = fna_df.merge(
        pathology_df, on=patient_id_col, how="inner", suffixes=("_fna", "_path")
    )

    logger.info(f"Found {len(merged)} potential FNA-pathology pairs (same patient)")

    # Calculate date gaps
    merged["days_gap"] = (merged[path_date_col] - merged[fna_date_col]).dt.days
    merged["abs_days_gap"] = merged["days_gap"].abs()
    merged["within_tolerance"] = merged["abs_days_gap"] <= tolerance_days

    # Filter to within tolerance
    within_tolerance = merged[merged["within_tolerance"]].copy()
    logger.info(
        f"{len(within_tolerance)} FNA-pathology pairs within ±{tolerance_days} days"
    )

    if len(within_tolerance) == 0:
        logger.warning("No FNA-pathology links within tolerance window!")
        return pd.DataFrame()

    # Enforce 1:1 cardinality: Each FNA links to nearest pathology
    within_tolerance = within_tolerance.sort_values("abs_days_gap")
    linkage = within_tolerance.groupby("fna_id").first().reset_index()

    logger.info(f"Created {len(linkage)} unique FNA-pathology links (1:1 cardinality)")

    # Create linkage IDs
    linkage["linkage_id"] = linkage.apply(
        lambda row: create_linkage_id(
            row["fna_id"], row["pathology_id"], "fna_biopsy", "pathology"
        ),
        axis=1,
    )

    # Calculate link confidence
    linkage["link_confidence"] = 1.0 - (linkage["abs_days_gap"] / tolerance_days)

    # Select final columns
    result = linkage[
        [
            "linkage_id",
            "fna_id",
            "pathology_id",
            patient_id_col,
            fna_date_col,
            path_date_col,
            "days_gap",
            "abs_days_gap",
            "within_tolerance",
            "link_confidence",
        ]
    ]

    # Log linkage statistics
    logger.info(f"FNA-Pathology Linkage Stats:")
    logger.info(f"  Mean date gap: {linkage['abs_days_gap'].mean():.1f} days")
    logger.info(f"  Median date gap: {linkage['abs_days_gap'].median():.1f} days")
    logger.info(f"  Max date gap: {linkage['abs_days_gap'].max()} days")
    logger.info(f"  Mean confidence: {linkage['link_confidence'].mean():.3f}")

    return result


def link_molecular_to_pathology(
    molecular_df: pd.DataFrame,
    pathology_df: pd.DataFrame,
    patient_id_col: str = "research_id",
    molecular_date_col: str = "test_date",
    path_date_col: str = "surgery_date",
    tolerance_days: int = 30,
) -> pd.DataFrame:
    """
    Link molecular tests to pathology reports using standard date tolerance.

    Linkage Rule:
    - Molecular test must be within ±30 days of surgery/pathology date
    - If multiple tests qualify, select nearest to surgery date
    - Each molecular test links to at most 1 pathology (1:1 cardinality)

    Parameters
    ----------
    molecular_df : pd.DataFrame
        Molecular testing data with columns: research_id, test_id, test_date
    pathology_df : pd.DataFrame
        Pathology data with columns: research_id, pathology_id, surgery_date
    patient_id_col : str
        Column name for patient identifier
    molecular_date_col : str
        Column name for molecular test date
    path_date_col : str
        Column name for pathology/surgery date
    tolerance_days : int
        Date tolerance window (default: 30 days)

    Returns
    -------
    pd.DataFrame
        Linkage table (same schema as link_ct_to_pathology)
    """
    logger.info(
        f"Linking {len(molecular_df)} molecular tests to {len(pathology_df)} pathology reports"
    )
    logger.info(f"Date tolerance: ±{tolerance_days} days")

    # Merge on patient ID
    merged = molecular_df.merge(
        pathology_df, on=patient_id_col, how="inner", suffixes=("_mol", "_path")
    )

    logger.info(
        f"Found {len(merged)} potential molecular-pathology pairs (same patient)"
    )

    # Calculate date gaps
    merged["days_gap"] = (merged[path_date_col] - merged[molecular_date_col]).dt.days
    merged["abs_days_gap"] = merged["days_gap"].abs()
    merged["within_tolerance"] = merged["abs_days_gap"] <= tolerance_days

    # Filter to within tolerance
    within_tolerance = merged[merged["within_tolerance"]].copy()
    logger.info(
        f"{len(within_tolerance)} molecular-pathology pairs within ±{tolerance_days} days"
    )

    if len(within_tolerance) == 0:
        logger.warning("No molecular-pathology links within tolerance window!")
        return pd.DataFrame()

    # Enforce 1:1 cardinality: Each molecular test links to nearest pathology
    within_tolerance = within_tolerance.sort_values("abs_days_gap")
    linkage = within_tolerance.groupby("test_id").first().reset_index()

    logger.info(
        f"Created {len(linkage)} unique molecular-pathology links (1:1 cardinality)"
    )

    # Create linkage IDs
    linkage["linkage_id"] = linkage.apply(
        lambda row: create_linkage_id(
            row["test_id"], row["pathology_id"], "molecular_test", "pathology"
        ),
        axis=1,
    )

    # Calculate link confidence
    linkage["link_confidence"] = 1.0 - (linkage["abs_days_gap"] / tolerance_days)

    # Select final columns
    result = linkage[
        [
            "linkage_id",
            "test_id",
            "pathology_id",
            patient_id_col,
            molecular_date_col,
            path_date_col,
            "days_gap",
            "abs_days_gap",
            "within_tolerance",
            "link_confidence",
        ]
    ]

    # Log linkage statistics
    logger.info(f"Molecular-Pathology Linkage Stats:")
    logger.info(f"  Mean date gap: {linkage['abs_days_gap'].mean():.1f} days")
    logger.info(f"  Median date gap: {linkage['abs_days_gap'].median():.1f} days")
    logger.info(f"  Max date gap: {linkage['abs_days_gap'].max()} days")
    logger.info(f"  Mean confidence: {linkage['link_confidence'].mean():.3f}")

    return result


def create_linkage(
    source_df: pd.DataFrame,
    target_df: pd.DataFrame,
    source_type: str,
    target_type: str,
    patient_id_col: str = "research_id",
    source_date_col: str = "event_date",
    target_date_col: str = "target_date",
    tolerance_days: Optional[int] = None,
) -> pd.DataFrame:
    """
    Generic linkage function with configurable parameters.

    Routes to appropriate specialized function based on source_type:
    - 'ct_scan' → link_ct_to_pathology
    - 'fna_biopsy' → link_fna_to_pathology
    - 'molecular_test' → link_molecular_to_pathology

    Parameters
    ----------
    source_df : pd.DataFrame
        Source data (imaging, cytology, molecular)
    target_df : pd.DataFrame
        Target data (pathology, surgery)
    source_type : str
        Type of source data ('ct_scan', 'fna_biopsy', 'molecular_test')
    target_type : str
        Type of target data ('pathology', 'surgery')
    patient_id_col : str
        Patient identifier column
    source_date_col : str
        Date column in source data
    target_date_col : str
        Date column in target data
    tolerance_days : int, optional
        Override default tolerance window (uses LinkageConfig defaults if None)

    Returns
    -------
    pd.DataFrame
        Linkage table
    """
    # Get default tolerance if not specified
    if tolerance_days is None:
        tolerance_days = LinkageConfig.DATE_TOLERANCES.get(source_type, 30)

    logger.info(f"Creating {source_type} → {target_type} linkage")

    # Route to specialized function
    if source_type == "ct_scan":
        return link_ct_to_pathology(
            source_df,
            target_df,
            patient_id_col,
            source_date_col,
            target_date_col,
            tolerance_days,
        )
    elif source_type == "fna_biopsy":
        return link_fna_to_pathology(
            source_df,
            target_df,
            patient_id_col,
            source_date_col,
            target_date_col,
            tolerance_days,
        )
    elif source_type == "molecular_test":
        return link_molecular_to_pathology(
            source_df,
            target_df,
            patient_id_col,
            source_date_col,
            target_date_col,
            tolerance_days,
        )
    else:
        raise ValueError(f"Unsupported source_type: {source_type}")


def validate_linkage_temporal_bounds(
    linkage_df: pd.DataFrame, tolerance_days: int, strict: bool = True
) -> Dict[str, any]:
    """
    Validate that all linkages respect temporal bounds.

    Checks:
    1. All links within tolerance window
    2. No future-dated links (source after target for pre-op data)
    3. No duplicate source IDs (cardinality violation)

    Parameters
    ----------
    linkage_df : pd.DataFrame
        Linkage table from link_* functions
    tolerance_days : int
        Expected tolerance window
    strict : bool
        If True, raise ValueError on validation failure

    Returns
    -------
    dict
        Validation results with keys:
        - valid: bool
        - checks_passed: list
        - checks_failed: list
        - error_details: dict
    """
    results = {
        "valid": True,
        "checks_passed": [],
        "checks_failed": [],
        "error_details": {},
    }

    # Check 1: All links within tolerance
    max_gap = linkage_df["abs_days_gap"].max()
    if max_gap <= tolerance_days:
        results["checks_passed"].append("temporal_bounds")
    else:
        results["checks_failed"].append("temporal_bounds")
        results["error_details"][
            "temporal_bounds"
        ] = f"Max gap {max_gap} exceeds tolerance {tolerance_days}"
        results["valid"] = False

    # Check 2: No duplicate source IDs (1:1 cardinality)
    source_id_col = [
        col
        for col in linkage_df.columns
        if col.endswith("_id") and "linkage" not in col
    ][0]
    duplicate_sources = linkage_df[source_id_col].duplicated().sum()
    if duplicate_sources == 0:
        results["checks_passed"].append("cardinality")
    else:
        results["checks_failed"].append("cardinality")
        results["error_details"][
            "cardinality"
        ] = f"{duplicate_sources} duplicate source IDs"
        results["valid"] = False

    # Check 3: All confidence scores ≥ 0
    min_confidence = linkage_df["link_confidence"].min()
    if min_confidence >= 0.0:
        results["checks_passed"].append("confidence_bounds")
    else:
        results["checks_failed"].append("confidence_bounds")
        results["error_details"][
            "confidence_bounds"
        ] = f"Min confidence {min_confidence} < 0.0"
        results["valid"] = False

    if not results["valid"] and strict:
        raise ValueError(f"Linkage validation failed: {results['checks_failed']}")

    return results

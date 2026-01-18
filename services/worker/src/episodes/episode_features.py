"""
Episode Feature Aggregation

This module computes aggregated features for each diagnostic episode by:
1. Aggregating imaging features (TI-RADS, nodule characteristics)
2. Aggregating cytology features (Bethesda classification)
3. Aggregating molecular features (BRAF, RAS, etc.)
4. Aggregating lab features (thyroglobulin, TSH, antibodies)

The result is a materialized feature table (EpisodeFeatures) that can be used
for predictive modeling without temporal leakage.

Author: Research Operating System
Date: 2025-12-22
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


def aggregate_imaging_features(
    episode_events: pd.DataFrame,
    imaging_df: pd.DataFrame,
    event_id_col: str = "event_id",
) -> pd.DataFrame:
    """
    Aggregate imaging features (ultrasound, CT, MRI) for each episode.

    Aggregation strategy:
    - TI-RADS: Maximum score (worst finding)
    - Nodule count: Sum (total nodules identified)
    - Nodule size: Maximum (largest nodule)
    - Thyroid volume: Most recent measurement

    Parameters
    ----------
    episode_events : pd.DataFrame
        Episode-event links
    imaging_df : pd.DataFrame
        Imaging data with features (tirads_score, nodule_count, nodule_size_cm, etc.)
    event_id_col : str
        Column linking events to imaging records

    Returns
    -------
    pd.DataFrame
        Episode-level imaging features: episode_id, tirads_max, nodule_count_total,
        nodule_size_max_cm, thyroid_volume_cc
    """
    logger.info("Aggregating imaging features...")

    # Filter episode_events to imaging modalities
    imaging_events = episode_events[
        episode_events["event_type"].isin(
            ["ultrasound", "ct_scan", "mri_scan", "pet_scan"]
        )
    ].copy()

    if len(imaging_events) == 0:
        logger.warning("No imaging events found")
        return pd.DataFrame()

    # Merge with imaging data
    merged = imaging_events.merge(imaging_df, on=event_id_col, how="inner")

    logger.info(f"Merged {len(merged)} episode-imaging records")

    # Aggregate by episode
    agg_features = (
        merged.groupby("episode_id")
        .agg(
            {
                "tirads_score": "max",  # Worst TI-RADS score
                "nodule_count": "sum",  # Total nodules across all imaging
                "nodule_size_cm": "max",  # Largest nodule
                "thyroid_volume_cc": "last",  # Most recent volume measurement
                "suspicious_features": "sum",  # Count of suspicious features
            }
        )
        .reset_index()
    )

    # Rename columns for clarity
    agg_features = agg_features.rename(
        columns={
            "tirads_score": "tirads_max",
            "nodule_count": "nodule_count_total",
            "nodule_size_cm": "nodule_size_max_cm",
            "thyroid_volume_cc": "thyroid_volume_last_cc",
            "suspicious_features": "suspicious_features_total",
        }
    )

    logger.info(f"Aggregated imaging features for {len(agg_features)} episodes")

    return agg_features


def aggregate_cytology_features(
    episode_events: pd.DataFrame,
    cytology_df: pd.DataFrame,
    event_id_col: str = "event_id",
) -> pd.DataFrame:
    """
    Aggregate cytology features (FNA Bethesda classification) for each episode.

    Aggregation strategy:
    - Bethesda: Maximum score (worst cytology finding)
    - Adequacy: Most recent assessment
    - FNA count: Number of FNA procedures in episode

    Parameters
    ----------
    episode_events : pd.DataFrame
        Episode-event links
    cytology_df : pd.DataFrame
        FNA cytology data with Bethesda classification
    event_id_col : str
        Column linking events to cytology records

    Returns
    -------
    pd.DataFrame
        Episode-level cytology features: episode_id, bethesda_max,
        bethesda_latest, fna_count
    """
    logger.info("Aggregating cytology features...")

    # Filter episode_events to FNA
    fna_events = episode_events[episode_events["event_type"] == "fna_biopsy"].copy()

    if len(fna_events) == 0:
        logger.warning("No FNA events found")
        return pd.DataFrame()

    # Merge with cytology data
    merged = fna_events.merge(cytology_df, on=event_id_col, how="inner")

    # Sort by date for "latest" aggregation
    merged = merged.sort_values("event_date")

    # Aggregate by episode
    agg_features = (
        merged.groupby("episode_id")
        .agg(
            {
                "bethesda_2023_num": ["max", "last", "count"],  # Max, latest, count
                "adequacy": "last",  # Most recent adequacy
            }
        )
        .reset_index()
    )

    # Flatten multi-level columns
    agg_features.columns = [
        "episode_id",
        "bethesda_max",
        "bethesda_latest",
        "fna_count",
        "adequacy_latest",
    ]

    logger.info(f"Aggregated cytology features for {len(agg_features)} episodes")

    return agg_features


def aggregate_molecular_features(
    episode_events: pd.DataFrame,
    molecular_df: pd.DataFrame,
    event_id_col: str = "event_id",
) -> pd.DataFrame:
    """
    Aggregate molecular features (BRAF, RAS, etc.) for each episode.

    Aggregation strategy:
    - Any positive mutation = episode is mutation-positive
    - Most recent molecular classifier score

    Parameters
    ----------
    episode_events : pd.DataFrame
        Episode-event links
    molecular_df : pd.DataFrame
        Molecular testing data (BRAF, RAS, molecular classifier)
    event_id_col : str
        Column linking events to molecular records

    Returns
    -------
    pd.DataFrame
        Episode-level molecular features: episode_id, braf_positive,
        ras_positive, molecular_classifier_score
    """
    logger.info("Aggregating molecular features...")

    # Filter episode_events to molecular tests
    molecular_events = episode_events[
        episode_events["event_type"] == "molecular_test"
    ].copy()

    if len(molecular_events) == 0:
        logger.warning("No molecular test events found")
        return pd.DataFrame()

    # Merge with molecular data
    merged = molecular_events.merge(molecular_df, on=event_id_col, how="inner")

    # Sort by date for "latest" aggregation
    merged = merged.sort_values("event_date")

    # Aggregate by episode (any positive = positive)
    agg_features = (
        merged.groupby("episode_id")
        .agg(
            {
                "braf_mutation": "max",  # Any positive = 1
                "ras_mutation": "max",  # Any positive = 1
                "ret_ptc_fusion": "max",  # Any positive = 1
                "molecular_classifier_score": "last",  # Most recent score
            }
        )
        .reset_index()
    )

    # Rename for clarity
    agg_features = agg_features.rename(
        columns={
            "braf_mutation": "braf_positive",
            "ras_mutation": "ras_positive",
            "ret_ptc_fusion": "ret_ptc_positive",
            "molecular_classifier_score": "molecular_classifier_latest",
        }
    )

    logger.info(f"Aggregated molecular features for {len(agg_features)} episodes")

    return agg_features


def aggregate_lab_features(
    episode_events: pd.DataFrame, labs_df: pd.DataFrame, event_id_col: str = "event_id"
) -> pd.DataFrame:
    """
    Aggregate laboratory features (thyroglobulin, TSH, antibodies) for each episode.

    Aggregation strategy:
    - Thyroglobulin: Mean and max
    - TSH: Most recent value
    - Antibodies: Any positive = positive

    Parameters
    ----------
    episode_events : pd.DataFrame
        Episode-event links
    labs_df : pd.DataFrame
        Lab data with thyroglobulin, TSH, T3, T4, antibodies
    event_id_col : str
        Column linking events to lab records

    Returns
    -------
    pd.DataFrame
        Episode-level lab features: episode_id, thyroglobulin_mean,
        thyroglobulin_max, tsh_latest, anti_tg_positive
    """
    logger.info("Aggregating lab features...")

    # Filter episode_events to lab tests
    lab_events = episode_events[
        episode_events["event_type"].isin(
            ["thyroglobulin_lab", "anti_tg_lab", "tsh_lab", "t3_lab", "t4_lab"]
        )
    ].copy()

    if len(lab_events) == 0:
        logger.warning("No lab events found")
        return pd.DataFrame()

    # Merge with lab data
    merged = lab_events.merge(labs_df, on=event_id_col, how="inner")

    # Sort by date for "latest" aggregation
    merged = merged.sort_values("event_date")

    # Aggregate by episode
    agg_features = (
        merged.groupby("episode_id")
        .agg(
            {
                "thyroglobulin": ["mean", "max"],  # Mean and max thyroglobulin
                "tsh": "last",  # Most recent TSH
                "t3": "last",  # Most recent T3
                "t4": "last",  # Most recent T4
                "anti_tg_antibody": "max",  # Any positive = positive (>0.9)
            }
        )
        .reset_index()
    )

    # Flatten multi-level columns
    agg_features.columns = [
        "episode_id",
        "thyroglobulin_mean",
        "thyroglobulin_max",
        "tsh_latest",
        "t3_latest",
        "t4_latest",
        "anti_tg_max",
    ]

    # Create binary antibody flag (>0.9 IU/mL = positive)
    agg_features["anti_tg_positive"] = (agg_features["anti_tg_max"] > 0.9).astype(int)

    logger.info(f"Aggregated lab features for {len(agg_features)} episodes")

    return agg_features


def compute_episode_features(
    episodes_df: pd.DataFrame,
    episode_events: pd.DataFrame,
    imaging_df: Optional[pd.DataFrame] = None,
    cytology_df: Optional[pd.DataFrame] = None,
    molecular_df: Optional[pd.DataFrame] = None,
    labs_df: Optional[pd.DataFrame] = None,
    output_path: Optional[Path] = None,
) -> pd.DataFrame:
    """
    Compute comprehensive episode-level features by aggregating all modalities.

    This is the main entry point for episode feature engineering. It creates
    a materialized feature table that can be used for predictive modeling.

    Parameters
    ----------
    episodes_df : pd.DataFrame
        Episode metadata (from create_episodes)
    episode_events : pd.DataFrame
        Episode-event links (from create_episodes)
    imaging_df : pd.DataFrame, optional
        Imaging data for aggregation
    cytology_df : pd.DataFrame, optional
        FNA cytology data
    molecular_df : pd.DataFrame, optional
        Molecular testing data
    labs_df : pd.DataFrame, optional
        Laboratory data
    output_path : Path, optional
        Path to save episode features parquet file

    Returns
    -------
    pd.DataFrame
        Episode features with all aggregated modalities

    Examples
    --------
    >>> episodes = create_episodes(events_df, surgeries_df)
    >>> features = compute_episode_features(
    ...     episodes['diagnostic_episodes'],
    ...     episodes['episode_events'],
    ...     imaging_df=imaging,
    ...     cytology_df=fna,
    ...     molecular_df=molecular,
    ...     labs_df=labs
    ... )
    >>> print(f"Created {len(features)} episode feature records")
    """
    logger.info("=" * 80)
    logger.info("EPISODE FEATURE AGGREGATION")
    logger.info("=" * 80)

    # Start with episode metadata
    episode_features = episodes_df[
        [
            "episode_id",
            "research_id",
            "index_event_type",
            "index_event_date",
        ]
    ].copy()

    logger.info(f"Starting with {len(episode_features)} episodes")

    # Aggregate imaging features
    if imaging_df is not None:
        imaging_agg = aggregate_imaging_features(episode_events, imaging_df)
        if len(imaging_agg) > 0:
            episode_features = episode_features.merge(
                imaging_agg, on="episode_id", how="left"
            )
            logger.info(
                f"  ✓ Added imaging features: {len(imaging_agg)} episodes with imaging"
            )

    # Aggregate cytology features
    if cytology_df is not None:
        cytology_agg = aggregate_cytology_features(episode_events, cytology_df)
        if len(cytology_agg) > 0:
            episode_features = episode_features.merge(
                cytology_agg, on="episode_id", how="left"
            )
            logger.info(
                f"  ✓ Added cytology features: {len(cytology_agg)} episodes with FNA"
            )

    # Aggregate molecular features
    if molecular_df is not None:
        molecular_agg = aggregate_molecular_features(episode_events, molecular_df)
        if len(molecular_agg) > 0:
            episode_features = episode_features.merge(
                molecular_agg, on="episode_id", how="left"
            )
            logger.info(
                f"  ✓ Added molecular features: {len(molecular_agg)} episodes with molecular"
            )

    # Aggregate lab features
    if labs_df is not None:
        labs_agg = aggregate_lab_features(episode_events, labs_df)
        if len(labs_agg) > 0:
            episode_features = episode_features.merge(
                labs_agg, on="episode_id", how="left"
            )
            logger.info(f"  ✓ Added lab features: {len(labs_agg)} episodes with labs")

    # Compute feature completeness
    feature_cols = [
        col
        for col in episode_features.columns
        if col
        not in ["episode_id", "research_id", "index_event_type", "index_event_date"]
    ]

    if feature_cols:
        completeness = (
            episode_features[feature_cols].notna().sum() / len(episode_features) * 100
        )
        logger.info("\nFeature completeness:")
        for col, pct in completeness.sort_values(ascending=False).head(10).items():
            logger.info(f"  {col}: {pct:.1f}%")

    # Save if output path provided
    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        episode_features.to_parquet(output_path, index=False)
        logger.info(
            f"\n✓ Saved episode features: {len(episode_features)} rows → {output_path}"
        )

    logger.info("=" * 80)

    return episode_features


if __name__ == "__main__":
    """
    Example usage for testing episode feature aggregation
    """
    logger.info("Testing episode feature aggregation module...")
    logger.info(
        "For production use, import and call compute_episode_features() from your script"
    )

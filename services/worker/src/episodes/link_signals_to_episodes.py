"""
Link Patient-Generated Signals to Diagnostic Episodes

This module implements deterministic temporal linking of patient-generated signals
(PROMs, symptoms, wearables, adherence) to diagnostic episodes based on episode
time windows. Signals are matched to episodes when signal_time falls within the
episode's [episode_start, episode_end] boundaries.

Key Features:
- Deterministic linking based on temporal overlap
- Handles overlapping episodes by choosing closest to episode_start
- Preserves existing episode_id values (controlled by overwrite flag)
- No PHI dependencies (works with de-identified research_id)
- Fully testable with synthetic data

Author: Research Operating System
Date: 2025-12-25
"""

import pandas as pd
import numpy as np
from typing import Optional, Literal
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def link_signals_to_episodes(
    signals_df: pd.DataFrame,
    episodes_df: pd.DataFrame,
    overwrite_existing: bool = False,
    patient_id_col: str = "research_id",
    signal_time_col: str = "signal_time",
    episode_id_col: str = "episode_id",
    episode_start_col: str = "episode_start",
    episode_end_col: str = "episode_end",
) -> pd.DataFrame:
    """
    Link patient-generated signals to diagnostic episodes based on temporal overlap.

    Links signals to episodes when signal_time falls within [episode_start, episode_end].
    For overlapping episodes, chooses the episode whose episode_start is closest to
    signal_time. Ties are broken by selecting the earliest episode_start.

    Args:
        signals_df: DataFrame with patient-generated signals
            Required columns: research_id, signal_time
            Optional column: episode_id (existing linkage)
        episodes_df: DataFrame with episode definitions
            Required columns: research_id, episode_id, episode_start, episode_end
        overwrite_existing: If False, preserve existing episode_id values.
            If True, recompute all linkages.
        patient_id_col: Column name for patient identifier (default: 'research_id')
        signal_time_col: Column name for signal timestamp (default: 'signal_time')
        episode_id_col: Column name for episode identifier (default: 'episode_id')
        episode_start_col: Column name for episode start (default: 'episode_start')
        episode_end_col: Column name for episode end (default: 'episode_end')

    Returns:
        DataFrame with same structure as signals_df, with episode_id populated where
        temporal overlap exists. Adds 'episode_link_source' column indicating:
        - 'existing': episode_id was already present and preserved
        - 'linked': episode_id was assigned by temporal linking
        - 'unlinked': no matching episode found

    Raises:
        ValueError: If required columns are missing
        TypeError: If datetime columns are not datetime type

    Examples:
        >>> signals = pd.DataFrame({
        ...     'research_id': ['P001', 'P001', 'P002'],
        ...     'signal_time': pd.to_datetime(['2024-01-05', '2024-01-15', '2024-02-10']),
        ...     'signal_name': ['fatigue', 'PROMIS_pain', 'steps_daily']
        ... })
        >>> episodes = pd.DataFrame({
        ...     'research_id': ['P001', 'P002'],
        ...     'episode_id': ['EP_001', 'EP_002'],
        ...     'episode_start': pd.to_datetime(['2024-01-01', '2024-02-01']),
        ...     'episode_end': pd.to_datetime(['2024-01-31', '2024-02-28'])
        ... })
        >>> linked = link_signals_to_episodes(signals, episodes)
        >>> linked[['research_id', 'signal_time', 'episode_id', 'episode_link_source']]
    """

    # Validate inputs
    _validate_inputs(
        signals_df,
        episodes_df,
        patient_id_col,
        signal_time_col,
        episode_id_col,
        episode_start_col,
        episode_end_col,
    )

    # Make a copy to avoid modifying input
    result_df = signals_df.copy()

    # Ensure datetime types
    result_df[signal_time_col] = pd.to_datetime(result_df[signal_time_col])
    episodes_df = episodes_df.copy()
    episodes_df[episode_start_col] = pd.to_datetime(episodes_df[episode_start_col])
    episodes_df[episode_end_col] = pd.to_datetime(episodes_df[episode_end_col])

    # Initialize episode_id column if not present
    if episode_id_col not in result_df.columns:
        result_df[episode_id_col] = None
        logger.info(f"Created new '{episode_id_col}' column")

    # Track linkage source
    result_df["episode_link_source"] = "unlinked"

    # Mark existing episode_id values
    if not overwrite_existing:
        has_existing = result_df[episode_id_col].notna()
        result_df.loc[has_existing, "episode_link_source"] = "existing"
        logger.info(f"Preserved {has_existing.sum()} existing episode linkages")

    # Get signals that need linking
    if overwrite_existing:
        signals_to_link = result_df.copy()
    else:
        signals_to_link = result_df[result_df[episode_id_col].isna()].copy()

    if len(signals_to_link) == 0:
        logger.info("No signals to link")
        return result_df

    logger.info(
        f"Linking {len(signals_to_link)} signals to {len(episodes_df)} episodes"
    )

    # Perform temporal linking
    linked_signals = _link_by_temporal_overlap(
        signals_to_link,
        episodes_df,
        patient_id_col,
        signal_time_col,
        episode_id_col,
        episode_start_col,
        episode_end_col,
    )

    # Update result with linked signals
    if overwrite_existing:
        result_df = linked_signals
    else:
        # Only update rows that were unlinked
        idx_to_update = result_df[result_df[episode_id_col].isna()].index
        result_df.loc[idx_to_update, episode_id_col] = linked_signals.loc[
            idx_to_update, episode_id_col
        ]
        result_df.loc[idx_to_update, "episode_link_source"] = linked_signals.loc[
            idx_to_update, "episode_link_source"
        ]

    # Log summary statistics
    linked_count = (result_df["episode_link_source"] == "linked").sum()
    existing_count = (result_df["episode_link_source"] == "existing").sum()
    unlinked_count = (result_df["episode_link_source"] == "unlinked").sum()

    logger.info(
        f"Linking complete: {linked_count} linked, {existing_count} existing, {unlinked_count} unlinked"
    )

    return result_df


def _validate_inputs(
    signals_df: pd.DataFrame,
    episodes_df: pd.DataFrame,
    patient_id_col: str,
    signal_time_col: str,
    episode_id_col: str,
    episode_start_col: str,
    episode_end_col: str,
) -> None:
    """Validate input DataFrames have required columns."""

    # Check signals_df required columns
    required_signal_cols = [patient_id_col, signal_time_col]
    missing_signal_cols = [
        col for col in required_signal_cols if col not in signals_df.columns
    ]
    if missing_signal_cols:
        raise ValueError(f"signals_df missing required columns: {missing_signal_cols}")

    # Check episodes_df required columns
    required_episode_cols = [
        patient_id_col,
        episode_id_col,
        episode_start_col,
        episode_end_col,
    ]
    missing_episode_cols = [
        col for col in required_episode_cols if col not in episodes_df.columns
    ]
    if missing_episode_cols:
        raise ValueError(
            f"episodes_df missing required columns: {missing_episode_cols}"
        )

    logger.debug(
        f"Input validation passed: {len(signals_df)} signals, {len(episodes_df)} episodes"
    )


def _link_by_temporal_overlap(
    signals_df: pd.DataFrame,
    episodes_df: pd.DataFrame,
    patient_id_col: str,
    signal_time_col: str,
    episode_id_col: str,
    episode_start_col: str,
    episode_end_col: str,
) -> pd.DataFrame:
    """
    Link signals to episodes based on temporal overlap.

    For each signal, find all episodes where signal_time falls within
    [episode_start, episode_end] (inclusive). If multiple episodes match,
    choose the one whose episode_start is closest to signal_time.
    Ties are broken by earliest episode_start.
    """

    result_df = signals_df.copy()

    # Merge signals with episodes on patient_id to get all possible combinations
    merged = result_df.merge(
        episodes_df[
            [patient_id_col, episode_id_col, episode_start_col, episode_end_col]
        ],
        on=patient_id_col,
        how="left",
        suffixes=("", "_episode"),
    )

    # Filter to temporal overlaps: signal_time within [episode_start, episode_end]
    overlaps = merged[
        (merged[signal_time_col] >= merged[episode_start_col])
        & (merged[signal_time_col] <= merged[episode_end_col])
    ].copy()

    if len(overlaps) == 0:
        logger.info("No temporal overlaps found")
        result_df["episode_link_source"] = "unlinked"
        return result_df

    # Calculate distance from signal_time to episode_start
    overlaps["_time_distance"] = (
        overlaps[signal_time_col] - overlaps[episode_start_col]
    ).abs()

    # For each signal, find the closest episode
    # Sort by: time_distance (ascending), then episode_start (ascending) for tie-breaking
    overlaps = overlaps.sort_values(
        [patient_id_col, signal_time_col, "_time_distance", episode_start_col]
    )

    # Keep only the first (closest) episode for each signal
    closest_episodes = overlaps.groupby(
        [patient_id_col, signal_time_col], as_index=False
    ).first()

    # Create mapping: (research_id, signal_time) -> episode_id
    signal_key = result_df[[patient_id_col, signal_time_col]].apply(
        lambda row: (row[patient_id_col], row[signal_time_col]), axis=1
    )

    episode_mapping = closest_episodes.set_index([patient_id_col, signal_time_col])[
        episode_id_col + "_episode"
    ]

    # Apply mapping to result
    result_df[episode_id_col] = signal_key.map(episode_mapping)

    # Mark linkage source
    result_df["episode_link_source"] = result_df[episode_id_col].apply(
        lambda x: "linked" if pd.notna(x) else "unlinked"
    )

    logger.debug(
        f"Linked {(result_df['episode_link_source'] == 'linked').sum()} signals"
    )

    return result_df

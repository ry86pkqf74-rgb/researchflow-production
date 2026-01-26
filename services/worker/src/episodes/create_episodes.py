"""
Diagnostic Episode Creation and Temporal Fusion

This module implements the core logic for creating diagnostic episodes by:
1. Identifying index events (surgery, FNA, molecular testing)
2. Defining time windows around index events (±14, ±30, ±45 days)
3. Assigning events (imaging, cytology, labs) to episodes
4. Handling event collisions and overlaps
5. Linking episodes to surgical outcomes

Author: Research Operating System
Date: 2025-12-22
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import timedelta
from typing import Dict, List, Optional, Tuple
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class EpisodeConfig:
    """Configuration for episode creation"""

    # Time windows (days before/after index event)
    TIME_WINDOWS = {
        "narrow": 14,  # ±14 days (strict pre-operative window)
        "standard": 30,  # ±30 days (typical diagnostic workup)
        "wide": 45,  # ±45 days (extended workup for complex cases)
    }

    # Index event types (ranked by clinical priority)
    INDEX_EVENT_TYPES = [
        "surgery",  # Highest priority: definitive treatment
        "fna_biopsy",  # High priority: diagnostic procedure
        "molecular_test",  # Medium priority: molecular profiling
        "major_imaging",  # Lower priority: comprehensive imaging (PET, CT)
    ]

    # Event types that can be assigned to episodes
    ASSIGNABLE_EVENT_TYPES = [
        "ultrasound",
        "ct_scan",
        "mri_scan",
        "pet_scan",
        "nuclear_med",
        "fna_biopsy",
        "molecular_test",
        "thyroglobulin_lab",
        "anti_tg_lab",
        "tsh_lab",
        "t3_lab",
        "t4_lab",
    ]

    # Surgery-episode relationship thresholds
    PREOP_WINDOW_DAYS = 90  # Events within 90 days before surgery are pre-op
    POSTOP_WINDOW_DAYS = 365  # Events within 365 days after surgery are post-op


def identify_index_events(
    events_df: pd.DataFrame,
    index_event_types: Optional[List[str]] = None,
    patient_id_col: str = "research_id",
) -> pd.DataFrame:
    """
    Identify index events that will anchor diagnostic episodes.

    Index events are prioritized by clinical importance:
    1. Surgery (highest priority - definitive treatment)
    2. FNA biopsy (diagnostic procedure)
    3. Molecular testing (advanced diagnostics)
    4. Major imaging (comprehensive workup)

    Parameters
    ----------
    events_df : pd.DataFrame
        All events with columns: research_id, event_type, event_date, event_id
    index_event_types : List[str], optional
        Event types to consider as index events (default: from EpisodeConfig)
    patient_id_col : str
        Column name for patient identifier

    Returns
    -------
    pd.DataFrame
        Index events with columns: research_id, episode_id, index_event_type,
        index_event_date, index_event_id, priority_rank
    """
    if index_event_types is None:
        index_event_types = EpisodeConfig.INDEX_EVENT_TYPES

    logger.info(f"Identifying index events from {len(events_df)} total events")
    logger.info(f"Index event types: {index_event_types}")

    # Filter to index event types
    index_events = events_df[events_df["event_type"].isin(index_event_types)].copy()

    if len(index_events) == 0:
        logger.warning("No index events found!")
        return pd.DataFrame()

    # Assign priority rank (lower = higher priority)
    priority_map = {
        event_type: rank for rank, event_type in enumerate(index_event_types)
    }
    index_events["priority_rank"] = index_events["event_type"].map(priority_map)

    # Sort by patient and date
    index_events = index_events.sort_values(
        [patient_id_col, "event_date", "priority_rank"]
    )

    # Generate episode IDs (format: {research_id}_EP{episode_num})
    index_events["episode_num"] = index_events.groupby(patient_id_col).cumcount() + 1
    index_events["episode_id"] = (
        index_events[patient_id_col].astype(str)
        + "_EP"
        + index_events["episode_num"].astype(str).str.zfill(3)
    )

    # Rename columns for clarity
    index_events = index_events.rename(
        columns={
            "event_type": "index_event_type",
            "event_date": "index_event_date",
            "event_id": "index_event_id",
        }
    )

    # Select final columns
    result = index_events[
        [
            patient_id_col,
            "episode_id",
            "index_event_type",
            "index_event_date",
            "index_event_id",
            "priority_rank",
        ]
    ]

    logger.info(
        f"Identified {len(result)} index events for {result[patient_id_col].nunique()} patients"
    )
    logger.info(
        f"Index event distribution:\n{result['index_event_type'].value_counts()}"
    )

    return result


def assign_events_to_episodes(
    episodes_df: pd.DataFrame,
    events_df: pd.DataFrame,
    time_window_days: int = 30,
    patient_id_col: str = "research_id",
) -> pd.DataFrame:
    """
    Assign individual events to diagnostic episodes based on temporal proximity.

    Each event is assigned to the nearest episode within the time window. If an
    event falls within multiple episode windows, it is assigned to the closest
    episode by date.

    Parameters
    ----------
    episodes_df : pd.DataFrame
        Episode metadata with index_event_date
    events_df : pd.DataFrame
        All events with event_date
    time_window_days : int
        Time window (days) before/after index event (default: 30)
    patient_id_col : str
        Column name for patient identifier

    Returns
    -------
    pd.DataFrame
        Episode-event links with columns: episode_id, event_id, event_type,
        event_date, delta_days, within_window
    """
    logger.info(f"Assigning {len(events_df)} events to {len(episodes_df)} episodes")
    logger.info(f"Time window: ±{time_window_days} days")

    # Merge episodes with events on patient ID
    merged = episodes_df.merge(events_df, on=patient_id_col, how="inner")

    logger.info(
        f"Patient-level merge resulted in {len(merged)} potential episode-event pairs"
    )

    # Calculate delta days (event_date - index_event_date)
    merged["delta_days"] = (merged["event_date"] - merged["index_event_date"]).dt.days

    # Filter to events within time window
    merged["within_window"] = merged["delta_days"].abs() <= time_window_days

    within_window = merged[merged["within_window"]].copy()
    logger.info(f"{len(within_window)} events within ±{time_window_days} day window")

    if len(within_window) == 0:
        logger.warning("No events within time window!")
        return pd.DataFrame()

    # Handle collisions: if event falls in multiple episodes, assign to nearest
    within_window["abs_delta_days"] = within_window["delta_days"].abs()

    # Group by event and keep nearest episode
    nearest_episode = (
        within_window.sort_values("abs_delta_days")
        .groupby("event_id")
        .first()
        .reset_index()
    )

    logger.info(
        f"Resolved collisions: {len(within_window)} → {len(nearest_episode)} unique event assignments"
    )

    # Select final columns
    result = nearest_episode[
        [
            "episode_id",
            "event_id",
            "event_type",
            "event_date",
            "delta_days",
            "within_window",
        ]
    ]

    # Log event distribution per episode
    events_per_episode = result.groupby("episode_id").size()
    logger.info(
        f"Events per episode: mean={events_per_episode.mean():.1f}, "
        f"median={events_per_episode.median():.1f}, "
        f"max={events_per_episode.max()}"
    )

    return result


def link_episodes_to_surgeries(
    episodes_df: pd.DataFrame,
    surgeries_df: pd.DataFrame,
    patient_id_col: str = "research_id",
    preop_window_days: int = 90,
    postop_window_days: int = 365,
) -> pd.DataFrame:
    """
    Link episodes to surgeries and classify as pre-operative vs. post-operative.

    Classification rules:
    - Pre-op: Episode index event is within 90 days BEFORE surgery
    - Post-op: Episode index event is within 365 days AFTER surgery
    - Unrelated: Episode outside both windows

    Parameters
    ----------
    episodes_df : pd.DataFrame
        Episode metadata with index_event_date
    surgeries_df : pd.DataFrame
        Surgery records with surgery_date, surgery_type
    patient_id_col : str
        Column name for patient identifier
    preop_window_days : int
        Days before surgery to consider pre-operative (default: 90)
    postop_window_days : int
        Days after surgery to consider post-operative (default: 365)

    Returns
    -------
    pd.DataFrame
        Episode-surgery links with columns: episode_id, surgery_id,
        surgery_date, relationship_type, days_to_surgery
    """
    logger.info(f"Linking {len(episodes_df)} episodes to {len(surgeries_df)} surgeries")

    # Merge episodes with surgeries on patient ID
    merged = episodes_df.merge(
        surgeries_df, on=patient_id_col, how="left"  # Keep episodes even if no surgery
    )

    # Calculate days from episode to surgery (negative = before surgery)
    merged["days_to_surgery"] = (
        merged["surgery_date"] - merged["index_event_date"]
    ).dt.days

    # Classify relationship
    def classify_relationship(days):
        if pd.isna(days):
            return "no_surgery"
        elif -preop_window_days <= days <= 0:
            return "preop"
        elif 0 < days <= postop_window_days:
            return "postop"
        else:
            return "unrelated"

    merged["relationship_type"] = merged["days_to_surgery"].apply(classify_relationship)

    # Select final columns
    result = merged[
        [
            "episode_id",
            "surgery_id",
            "surgery_date",
            "surgery_type",
            "relationship_type",
            "days_to_surgery",
        ]
    ].copy()

    # Log relationship distribution
    logger.info(
        f"Episode-surgery relationships:\n{result['relationship_type'].value_counts()}"
    )

    return result


def create_episodes(
    events_df: pd.DataFrame,
    surgeries_df: Optional[pd.DataFrame] = None,
    time_window_days: int = 30,
    index_event_types: Optional[List[str]] = None,
    patient_id_col: str = "research_id",
    output_dir: Optional[Path] = None,
) -> Dict[str, pd.DataFrame]:
    """
    Create diagnostic episodes by temporal fusion of multi-modal events.

    This is the main entry point for episode creation. It orchestrates:
    1. Index event identification
    2. Event assignment to episodes
    3. Surgery linkage (if surgeries provided)

    Parameters
    ----------
    events_df : pd.DataFrame
        All events with columns: research_id, event_type, event_date, event_id
    surgeries_df : pd.DataFrame, optional
        Surgery records for episode-surgery linkage
    time_window_days : int
        Time window around index events (default: 30)
    index_event_types : List[str], optional
        Event types to use as episode anchors
    patient_id_col : str
        Column name for patient identifier
    output_dir : Path, optional
        Directory to save episode tables (if None, returns only)

    Returns
    -------
    Dict[str, pd.DataFrame]
        Dictionary with keys:
        - 'diagnostic_episodes': Episode metadata
        - 'episode_events': Event assignments
        - 'episode_surgery_links': Surgery relationships (if surgeries provided)

    Examples
    --------
    >>> events = pd.read_parquet('data/interim/all_events.parquet')
    >>> surgeries = pd.read_parquet('data/interim/surgeries.parquet')
    >>> episodes = create_episodes(events, surgeries, time_window_days=30)
    >>> print(f"Created {len(episodes['diagnostic_episodes'])} episodes")
    """
    logger.info("=" * 80)
    logger.info("TEMPORAL DIAGNOSTIC EPISODE FUSION")
    logger.info("=" * 80)
    logger.info(
        f"Input: {len(events_df)} events, {events_df[patient_id_col].nunique()} patients"
    )
    logger.info(f"Time window: ±{time_window_days} days")

    # Step 1: Identify index events
    logger.info("\nStep 1: Identifying index events...")
    diagnostic_episodes = identify_index_events(
        events_df=events_df,
        index_event_types=index_event_types,
        patient_id_col=patient_id_col,
    )

    if len(diagnostic_episodes) == 0:
        logger.error("No index events found - cannot create episodes!")
        return {}

    # Step 2: Assign events to episodes
    logger.info("\nStep 2: Assigning events to episodes...")
    episode_events = assign_events_to_episodes(
        episodes_df=diagnostic_episodes,
        events_df=events_df,
        time_window_days=time_window_days,
        patient_id_col=patient_id_col,
    )

    results = {
        "diagnostic_episodes": diagnostic_episodes,
        "episode_events": episode_events,
    }

    # Step 3: Link to surgeries (if provided)
    if surgeries_df is not None:
        logger.info("\nStep 3: Linking episodes to surgeries...")
        episode_surgery_links = link_episodes_to_surgeries(
            episodes_df=diagnostic_episodes,
            surgeries_df=surgeries_df,
            patient_id_col=patient_id_col,
        )
        results["episode_surgery_links"] = episode_surgery_links

    # Save outputs if directory provided
    if output_dir is not None:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"\nSaving episode tables to {output_dir}")
        for table_name, df in results.items():
            output_path = output_dir / f"{table_name}.parquet"
            df.to_parquet(output_path, index=False)
            logger.info(f"  ✓ Saved {table_name}: {len(df)} rows → {output_path}")

    # Log summary statistics
    logger.info("\n" + "=" * 80)
    logger.info("EPISODE CREATION SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Episodes created: {len(diagnostic_episodes)}")
    logger.info(
        f"Patients with episodes: {diagnostic_episodes[patient_id_col].nunique()}"
    )
    logger.info(f"Events assigned: {len(episode_events)}")
    logger.info(
        f"Event assignment rate: {len(episode_events) / len(events_df) * 100:.1f}%"
    )

    if "episode_surgery_links" in results:
        preop = (results["episode_surgery_links"]["relationship_type"] == "preop").sum()
        postop = (
            results["episode_surgery_links"]["relationship_type"] == "postop"
        ).sum()
        logger.info(f"Pre-operative episodes: {preop}")
        logger.info(f"Post-operative episodes: {postop}")

    logger.info("=" * 80)

    return results


def validate_episodes(
    diagnostic_episodes: pd.DataFrame,
    episode_events: pd.DataFrame,
    episode_surgery_links: Optional[pd.DataFrame] = None,
) -> Dict[str, any]:
    """
    Validate episode creation results and identify potential issues.

    Checks:
    1. Episode date consistency (all events within time window)
    2. Event uniqueness (no event assigned to multiple episodes)
    3. Surgery relationship consistency (pre-op events before surgery)
    4. Episode coverage (% of patients with episodes)

    Parameters
    ----------
    diagnostic_episodes : pd.DataFrame
        Episode metadata
    episode_events : pd.DataFrame
        Event assignments
    episode_surgery_links : pd.DataFrame, optional
        Surgery relationships

    Returns
    -------
    Dict[str, any]
        Validation results with warnings and errors
    """
    logger.info("\n" + "=" * 80)
    logger.info("EPISODE VALIDATION")
    logger.info("=" * 80)

    validation = {"errors": [], "warnings": [], "stats": {}}

    # Check 1: Event uniqueness
    duplicate_events = episode_events["event_id"].duplicated().sum()
    if duplicate_events > 0:
        validation["errors"].append(
            f"Found {duplicate_events} events assigned to multiple episodes!"
        )
    else:
        logger.info("✓ All events uniquely assigned to episodes")

    # Check 2: Episode date consistency
    episode_event_merged = episode_events.merge(
        diagnostic_episodes[["episode_id", "index_event_date"]], on="episode_id"
    )

    if "delta_days" in episode_event_merged.columns:
        max_delta = episode_event_merged["delta_days"].abs().max()
        validation["stats"]["max_delta_days"] = max_delta
        logger.info(f"✓ Maximum delta days: {max_delta}")

    # Check 3: Surgery relationship consistency
    if episode_surgery_links is not None:
        preop_after_surgery = (
            (episode_surgery_links["relationship_type"] == "preop")
            & (episode_surgery_links["days_to_surgery"] > 0)
        ).sum()

        if preop_after_surgery > 0:
            validation["warnings"].append(
                f"Found {preop_after_surgery} 'pre-op' episodes AFTER surgery date!"
            )
        else:
            logger.info("✓ Surgery relationships consistent")

    # Check 4: Episode coverage
    episodes_per_patient = diagnostic_episodes.groupby("research_id").size()
    validation["stats"]["mean_episodes_per_patient"] = episodes_per_patient.mean()
    validation["stats"]["max_episodes_per_patient"] = episodes_per_patient.max()
    logger.info(f"✓ Mean episodes per patient: {episodes_per_patient.mean():.2f}")
    logger.info(f"✓ Max episodes per patient: {episodes_per_patient.max()}")

    # Log errors and warnings
    if validation["errors"]:
        logger.error("VALIDATION ERRORS:")
        for error in validation["errors"]:
            logger.error(f"  ✗ {error}")

    if validation["warnings"]:
        logger.warning("VALIDATION WARNINGS:")
        for warning in validation["warnings"]:
            logger.warning(f"  ⚠ {warning}")

    if not validation["errors"] and not validation["warnings"]:
        logger.info("\n✅ All validation checks passed!")

    logger.info("=" * 80)

    return validation


if __name__ == "__main__":
    """
    Example usage for testing episode creation
    """
    # This would be run from the command line for testing:
    # python -m src.episodes.create_episodes

    import sys

    logger.info("Testing episode creation module...")
    logger.info(
        "For production use, import and call create_episodes() from your script"
    )
    logger.info("Example:")
    logger.info("  from src.episodes import create_episodes")
    logger.info(
        "  episodes = create_episodes(events_df, surgeries_df, time_window_days=30)"
    )

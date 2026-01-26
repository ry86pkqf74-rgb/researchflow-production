"""
Run Episode Fusion on Thyroid Dataset

This script executes the temporal diagnostic episode fusion pipeline
on the thyroid pilot dataset to create episode-level feature tables.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Import episode creation modules
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.episodes.create_episodes import (
    identify_index_events,
    assign_events_to_episodes,
    link_episodes_to_surgeries,
    validate_episodes,
)


def prepare_events_from_thyroid_data(data_dir: Path) -> pd.DataFrame:
    """
    Load and prepare multi-modal event data from thyroid dataset

    Returns DataFrame with columns:
    - research_id: Patient identifier
    - event_type: Type of event (ultrasound, ct_scan, fna_biopsy, surgery, etc.)
    - event_date: Date of event
    - event_id: Unique identifier for event
    """
    logger.info("=" * 80)
    logger.info("LOADING THYROID DATA FILES")
    logger.info("=" * 80)

    events = []

    # 1. Load surgeries (from benign or tumor pathology - use surgery date)
    try:
        benign = pd.read_parquet(data_dir / "benign_pathology.parquet")
        if "surgical_date" in benign.columns:
            surgery_events = benign[["research_id", "surgical_date"]].copy()
            surgery_events = surgery_events.dropna(subset=["surgical_date"])
            surgery_events["event_type"] = "surgery"
            surgery_events["event_date"] = pd.to_datetime(
                surgery_events["surgical_date"], errors="coerce"
            )
            surgery_events = surgery_events.dropna(subset=["event_date"])
            surgery_events["event_id"] = (
                "SX_"
                + benign["research_id"].astype(str)
                + "_"
                + benign.index.astype(str)
            )
            surgery_events = surgery_events[
                ["research_id", "event_type", "event_date", "event_id"]
            ]
            events.append(surgery_events)
            logger.info(
                f"✓ Loaded {len(surgery_events)} surgery events from benign pathology"
            )

        tumor = pd.read_parquet(data_dir / "tumor_pathology.parquet")
        if "surgical_date" in tumor.columns:
            tumor_surgery = tumor[["research_id", "surgical_date"]].copy()
            tumor_surgery = tumor_surgery.dropna(subset=["surgical_date"])
            tumor_surgery["event_type"] = "surgery"
            tumor_surgery["event_date"] = pd.to_datetime(
                tumor_surgery["surgical_date"], errors="coerce"
            )
            tumor_surgery = tumor_surgery.dropna(subset=["event_date"])
            tumor_surgery["event_id"] = (
                "SX_" + tumor["research_id"].astype(str) + "_" + tumor.index.astype(str)
            )
            tumor_surgery = tumor_surgery[
                ["research_id", "event_type", "event_date", "event_id"]
            ]
            events.append(tumor_surgery)
            logger.info(
                f"✓ Loaded {len(tumor_surgery)} surgery events from tumor pathology"
            )
    except Exception as e:
        logger.warning(f"Could not load surgery events: {e}")

    # 2. Load FNA biopsies
    try:
        fna = pd.read_parquet(data_dir / "fna_results.parquet")
        if "fna_date" in fna.columns:
            fna_events = fna[["research_id", "fna_date"]].copy()
            fna_events = fna_events.dropna(subset=["fna_date"])
            fna_events["event_type"] = "fna_biopsy"
            fna_events["event_date"] = pd.to_datetime(
                fna_events["fna_date"], errors="coerce"
            )
            fna_events = fna_events.dropna(subset=["event_date"])
            fna_events["event_id"] = (
                "FNA_" + fna["research_id"].astype(str) + "_" + fna.index.astype(str)
            )
            fna_events = fna_events[
                ["research_id", "event_type", "event_date", "event_id"]
            ]
            events.append(fna_events)
            logger.info(f"✓ Loaded {len(fna_events)} FNA biopsy events")
    except Exception as e:
        logger.warning(f"Could not load FNA events: {e}")

    # 3. Load ultrasound imaging
    try:
        us = pd.read_parquet(data_dir / "ultrasound_reports.parquet")
        if "us_date" in us.columns:
            us_events = us[["research_id", "us_date"]].copy()
            us_events = us_events.dropna(subset=["us_date"])
            us_events["event_type"] = "ultrasound"
            us_events["event_date"] = pd.to_datetime(
                us_events["us_date"], errors="coerce"
            )
            us_events = us_events.dropna(subset=["event_date"])
            us_events["event_id"] = (
                "US_" + us["research_id"].astype(str) + "_" + us.index.astype(str)
            )
            us_events = us_events[
                ["research_id", "event_type", "event_date", "event_id"]
            ]
            events.append(us_events)
            logger.info(f"✓ Loaded {len(us_events)} ultrasound events")
    except Exception as e:
        logger.warning(f"Could not load ultrasound events: {e}")

    # 4. Load CT scans
    try:
        ct = pd.read_parquet(data_dir / "ct_reports.parquet")
        if "ct_date" in ct.columns:
            ct_events = ct[["research_id", "ct_date"]].copy()
            ct_events = ct_events.dropna(subset=["ct_date"])
            ct_events["event_type"] = "ct_scan"
            ct_events["event_date"] = pd.to_datetime(
                ct_events["ct_date"], errors="coerce"
            )
            ct_events = ct_events.dropna(subset=["event_date"])
            ct_events["event_id"] = (
                "CT_" + ct["research_id"].astype(str) + "_" + ct.index.astype(str)
            )
            ct_events = ct_events[
                ["research_id", "event_type", "event_date", "event_id"]
            ]
            events.append(ct_events)
            logger.info(f"✓ Loaded {len(ct_events)} CT scan events")
    except Exception as e:
        logger.warning(f"Could not load CT events: {e}")

    # 5. Load MRI scans
    try:
        mri = pd.read_parquet(data_dir / "mri_reports.parquet")
        if "mri_date" in mri.columns:
            mri_events = mri[["research_id", "mri_date"]].copy()
            mri_events = mri_events.dropna(subset=["mri_date"])
            mri_events["event_type"] = "mri_scan"
            mri_events["event_date"] = pd.to_datetime(
                mri_events["mri_date"], errors="coerce"
            )
            mri_events = mri_events.dropna(subset=["event_date"])
            mri_events["event_id"] = (
                "MRI_" + mri["research_id"].astype(str) + "_" + mri.index.astype(str)
            )
            mri_events = mri_events[
                ["research_id", "event_type", "event_date", "event_id"]
            ]
            events.append(mri_events)
            logger.info(f"✓ Loaded {len(mri_events)} MRI scan events")
    except Exception as e:
        logger.warning(f"Could not load MRI events: {e}")

    # 6. Load nuclear medicine
    try:
        nm = pd.read_parquet(data_dir / "nuclear_medicine.parquet")
        if "scan_date" in nm.columns:
            nm_events = nm[["research_id", "scan_date"]].copy()
            nm_events = nm_events.dropna(subset=["scan_date"])
            nm_events["event_type"] = "nuclear_med"
            nm_events["event_date"] = pd.to_datetime(
                nm_events["scan_date"], errors="coerce"
            )
            nm_events = nm_events.dropna(subset=["event_date"])
            nm_events["event_id"] = (
                "NM_" + nm["research_id"].astype(str) + "_" + nm.index.astype(str)
            )
            nm_events = nm_events[
                ["research_id", "event_type", "event_date", "event_id"]
            ]
            events.append(nm_events)
            logger.info(f"✓ Loaded {len(nm_events)} nuclear medicine events")
    except Exception as e:
        logger.warning(f"Could not load nuclear medicine events: {e}")

    # Combine all events
    if not events:
        raise ValueError("No events could be loaded from thyroid dataset!")

    all_events = pd.concat(events, ignore_index=True)

    # Remove duplicates
    all_events = all_events.drop_duplicates(
        subset=["research_id", "event_type", "event_date"]
    )

    # Sort by patient and date
    all_events = all_events.sort_values(["research_id", "event_date"])

    logger.info("=" * 80)
    logger.info(f"✓ TOTAL EVENTS LOADED: {len(all_events)}")
    logger.info(f"✓ Unique patients: {all_events['research_id'].nunique()}")
    logger.info(f"✓ Event types: {all_events['event_type'].value_counts().to_dict()}")
    logger.info("=" * 80)

    return all_events


def main():
    """Execute episode fusion pipeline on thyroid data"""

    logger.info("\n" + "=" * 80)
    logger.info("TEMPORAL DIAGNOSTIC EPISODE FUSION - THYROID DATASET")
    logger.info("=" * 80)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Set up paths
    project_root = Path(__file__).parent
    data_dir = project_root / "data" / "interim"
    output_dir = project_root / "data" / "processed" / "episodes"
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"📁 Project root: {project_root}")
    logger.info(f"📁 Data directory: {data_dir}")
    logger.info(f"📁 Output directory: {output_dir}")

    # Step 1: Load and prepare events
    logger.info("\n📥 STEP 1: Loading multi-modal event data...")
    events_df = prepare_events_from_thyroid_data(data_dir)

    # Step 2: Identify index events
    logger.info(
        "\n🎯 STEP 2: Identifying index events (surgery, FNA, major imaging)..."
    )
    index_events_df = identify_index_events(
        events_df,
        index_event_types=[
            "surgery",
            "fna_biopsy",
        ],  # Focus on surgery and FNA as anchors
        patient_id_col="research_id",
    )

    if len(index_events_df) == 0:
        logger.error("❌ No index events found! Cannot create episodes.")
        return

    logger.info(f"✓ Identified {len(index_events_df)} index events")
    logger.info(f"✓ {index_events_df['index_event_type'].value_counts().to_dict()}")

    # Step 3: Assign events to episodes (±30 day window)
    logger.info("\n📌 STEP 3: Assigning events to episodes (±30 day window)...")
    time_window_days = 30

    episode_events_df = assign_events_to_episodes(
        events_df=events_df,
        episodes_df=index_events_df,
        time_window_days=time_window_days,
        patient_id_col="research_id",
    )

    logger.info(f"✓ Assigned {len(episode_events_df)} event-episode relationships")

    # Calculate coverage
    events_with_episodes = episode_events_df["event_id"].nunique()
    total_events = len(events_df)
    coverage_pct = (events_with_episodes / total_events) * 100
    logger.info(
        f"✓ Episode coverage: {events_with_episodes}/{total_events} events ({coverage_pct:.1f}%)"
    )

    # Step 4: Link episodes to surgeries
    logger.info("\n🔗 STEP 4: Linking episodes to surgical outcomes...")

    # Extract surgery events as separate dataframe
    surgery_events = events_df[events_df["event_type"] == "surgery"].copy()
    surgery_events = surgery_events.rename(
        columns={"event_id": "surgery_id", "event_date": "surgery_date"}
    )
    surgery_events = surgery_events[["research_id", "surgery_id", "surgery_date"]]

    if len(surgery_events) > 0:
        episode_surgery_links = link_episodes_to_surgeries(
            episodes_df=index_events_df,
            surgeries_df=surgery_events,
            patient_id_col="research_id",
            preop_window_days=90,
            postop_window_days=365,
        )
        logger.info(f"✓ Created {len(episode_surgery_links)} episode-surgery links")
        logger.info(
            f"✓ {episode_surgery_links['relationship_type'].value_counts().to_dict()}"
        )
    else:
        logger.warning("⚠ No surgery events found for linking")
        episode_surgery_links = None

    # Step 5: Validation
    logger.info("\n✅ STEP 5: Validating episode integrity...")
    validation_results = validate_episodes(
        diagnostic_episodes=index_events_df,
        episode_events=episode_events_df,
        episode_surgery_links=episode_surgery_links,
    )

    # Step 6: Save outputs
    logger.info("\n💾 STEP 6: Saving episode tables...")

    # Save diagnostic episodes
    episodes_output = output_dir / "diagnostic_episodes.parquet"
    index_events_df.to_parquet(episodes_output, index=False)
    logger.info(f"✓ Saved {episodes_output}")

    # Save episode events
    events_output = output_dir / "episode_events.parquet"
    episode_events_df.to_parquet(events_output, index=False)
    logger.info(f"✓ Saved {events_output}")

    # Save episode-surgery links
    if episode_surgery_links is not None:
        surgery_output = output_dir / "episode_surgery_links.parquet"
        episode_surgery_links.to_parquet(surgery_output, index=False)
        logger.info(f"✓ Saved {surgery_output}")

    # Generate summary statistics
    logger.info("\n" + "=" * 80)
    logger.info("EPISODE FUSION SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Total episodes created: {len(index_events_df)}")
    logger.info(f"Total events assigned: {len(episode_events_df)}")
    logger.info(f"Episode coverage: {coverage_pct:.1f}%")
    logger.info(
        f"Mean episodes per patient: {validation_results['stats'].get('mean_episodes_per_patient', 0):.2f}"
    )
    logger.info(
        f"Max episodes per patient: {validation_results['stats'].get('max_episodes_per_patient', 0)}"
    )
    logger.info(f"Time window used: ±{time_window_days} days")
    logger.info("=" * 80)
    logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("✅ Episode fusion complete!")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()

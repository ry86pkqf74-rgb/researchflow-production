"""
Temporal Diagnostic Episode Fusion Module

This module implements temporal fusion of diagnostic events (imaging, cytology,
molecular testing, labs) into coherent diagnostic episodes. This approach:

1. Reduces temporal leakage in predictive models
2. Improves clinical interpretability by grouping related events
3. Enables episode-level feature engineering
4. Supports pre-operative vs. post-operative analysis

Core Concepts:
--------------
- **Diagnostic Episode**: A temporal cluster of diagnostic events within a clinically
  meaningful time window (e.g., ±30 days of an index event)
- **Index Event**: The anchor event that defines an episode (typically surgery,
  FNA biopsy, or major imaging study)
- **Time Window**: The temporal buffer around an index event (configurable: ±14, ±30, ±45 days)
- **Episode Features**: Aggregated features from all events within an episode

Tables:
-------
1. DiagnosticEpisode: Primary episode metadata (patient, index event, window)
2. EpisodeEvent: Links individual events (US, CT, FNA, etc.) to episodes
3. EpisodeSurgeryLink: Connects episodes to surgical outcomes (pre-op vs. post-op)
4. EpisodeFeatures: Materialized aggregated features for each episode

Usage:
------
```python
from src.episodes import create_episodes, compute_episode_features

# Create episodes with 30-day window
episodes = create_episodes(
    patient_df=patients,
    events_df=all_events,
    time_window_days=30,
    index_event_types=['surgery', 'fna', 'molecular']
)

# Compute aggregated features
features = compute_episode_features(episodes)
```

See also:
---------
- docs/governance/TEMPORAL_FUSION.md: Governance and provenance tracking
- docs/checkpoints/CHECKPOINT_20251222_EPISODE_FUSION.md: Implementation checkpoint
"""

__version__ = "1.0.0"
__author__ = "Research Operating System"

from .create_episodes import (
    create_episodes,
    identify_index_events,
    assign_events_to_episodes,
    link_episodes_to_surgeries,
)

from .episode_features import (
    compute_episode_features,
    aggregate_imaging_features,
    aggregate_cytology_features,
    aggregate_molecular_features,
    aggregate_lab_features,
)

__all__ = [
    "create_episodes",
    "identify_index_events",
    "assign_events_to_episodes",
    "link_episodes_to_surgeries",
    "compute_episode_features",
    "aggregate_imaging_features",
    "aggregate_cytology_features",
    "aggregate_molecular_features",
    "aggregate_lab_features",
]

"""
Data Profiling Report Generator

Uses ydata-profiling for comprehensive data quality analysis.
"""

from __future__ import annotations

import os
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

ENABLE_PROFILING = os.getenv("ENABLE_PROFILING", "false").lower() == "true"
ARTIFACTS_PATH = os.getenv("ARTIFACTS_PATH", "/data/artifacts")


@dataclass
class ProfileResult:
    """Profiling result"""
    success: bool
    html_path: Optional[str] = None
    json_path: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


def generate_profile_report(
    data: Any,
    dataset_id: str,
    title: str = "Data Profile Report",
    output_dir: Optional[str] = None,
    minimal: bool = True
) -> ProfileResult:
    """
    Generate a profiling report for a dataset.

    Args:
        data: DataFrame to profile
        dataset_id: Dataset identifier
        title: Report title
        output_dir: Output directory (defaults to ARTIFACTS_PATH)
        minimal: If True, use minimal mode to reduce memory usage

    Returns:
        ProfileResult with paths to generated reports
    """
    if not ENABLE_PROFILING:
        return ProfileResult(
            success=False,
            error="Profiling is disabled (ENABLE_PROFILING=false)"
        )

    try:
        from ydata_profiling import ProfileReport

        # Create output directory
        base_dir = Path(output_dir or ARTIFACTS_PATH)
        artifact_dir = base_dir / "datasets" / dataset_id / "profiling"
        artifact_dir.mkdir(parents=True, exist_ok=True)

        # Generate profile
        logger.info(f"Generating profile report for dataset {dataset_id}")

        profile = ProfileReport(
            data,
            title=title,
            minimal=minimal,
            progress_bar=False
        )

        # Save HTML report
        html_path = str(artifact_dir / "profile_report.html")
        profile.to_file(html_path)

        # Save JSON report
        json_path = str(artifact_dir / "profile_summary.json")
        profile_json = profile.to_json()

        with open(json_path, 'w') as f:
            f.write(profile_json)

        # Extract summary
        summary = {
            'row_count': len(data),
            'column_count': len(data.columns) if hasattr(data, 'columns') else 0,
            'missing_cells': int(data.isnull().sum().sum()) if hasattr(data, 'isnull') else 0,
            'duplicate_rows': int(data.duplicated().sum()) if hasattr(data, 'duplicated') else 0,
        }

        logger.info(f"Profile report saved to {artifact_dir}")

        return ProfileResult(
            success=True,
            html_path=html_path,
            json_path=json_path,
            summary=summary
        )

    except ImportError:
        return ProfileResult(
            success=False,
            error="ydata-profiling not installed. Run: pip install ydata-profiling"
        )
    except Exception as e:
        logger.exception(f"Profiling failed: {e}")
        return ProfileResult(
            success=False,
            error=str(e)
        )


def generate_quick_stats(data: Any) -> Dict[str, Any]:
    """
    Generate quick statistics without full profiling.

    Args:
        data: DataFrame to analyze

    Returns:
        Dictionary of basic statistics
    """
    try:
        import pandas as pd

        if not isinstance(data, pd.DataFrame):
            return {'error': 'Input is not a DataFrame'}

        stats = {
            'row_count': len(data),
            'column_count': len(data.columns),
            'memory_usage_mb': data.memory_usage(deep=True).sum() / 1024 / 1024,
            'columns': {},
        }

        for col in data.columns:
            col_stats = {
                'dtype': str(data[col].dtype),
                'null_count': int(data[col].isnull().sum()),
                'null_pct': float(data[col].isnull().mean() * 100),
                'unique_count': int(data[col].nunique()),
            }

            if data[col].dtype in ['int64', 'float64']:
                col_stats['min'] = float(data[col].min()) if not data[col].isnull().all() else None
                col_stats['max'] = float(data[col].max()) if not data[col].isnull().all() else None
                col_stats['mean'] = float(data[col].mean()) if not data[col].isnull().all() else None

            stats['columns'][col] = col_stats

        return stats

    except Exception as e:
        return {'error': str(e)}

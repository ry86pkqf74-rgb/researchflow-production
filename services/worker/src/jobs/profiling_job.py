"""
Data Profiling Job

Generates comprehensive data quality profiles using ydata-profiling.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from src.provenance.artifact_store import store_text, new_run_id

logger = logging.getLogger(__name__)

# Feature flag for profiling
PROFILING_ENABLED = os.getenv("PROFILING_ENABLED", "false").lower() == "true"


@dataclass
class ProfilingConfig:
    """Configuration for data profiling."""
    minimal: bool = False  # Use minimal mode for large datasets
    explorative: bool = False  # Use explorative mode for detailed analysis
    title: str = "Data Profile Report"
    samples_head: int = 10
    samples_tail: int = 10
    correlations: bool = True
    missing_diagrams: bool = True
    duplicates: bool = True
    interactions: bool = False  # Can be slow
    pool_size: int = 4


@dataclass
class ProfilingSummary:
    """Summary of profiling results."""
    dataset_name: str
    record_count: int
    column_count: int
    missing_cells: int
    missing_cells_percent: float
    duplicate_rows: int
    duplicate_rows_percent: float
    memory_size_mb: float
    variable_types: Dict[str, int]
    alerts: List[str]
    profiled_at: str


@dataclass
class ProfilingResult:
    """Result of profiling job."""
    success: bool
    summary: Optional[ProfilingSummary] = None
    html_report_path: Optional[str] = None
    json_report: Optional[Dict[str, Any]] = None
    artifact_run_id: Optional[str] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def is_profiling_available() -> bool:
    """Check if profiling is available."""
    if not PROFILING_ENABLED:
        return False

    try:
        from ydata_profiling import ProfileReport
        return True
    except ImportError:
        return False


def profile_dataframe(
    df,
    config: Optional[ProfilingConfig] = None,
    dataset_name: str = "dataset",
    save_artifact: bool = True,
) -> ProfilingResult:
    """
    Profile a pandas DataFrame.

    Args:
        df: pandas DataFrame to profile
        config: Profiling configuration
        dataset_name: Name for the dataset
        save_artifact: Whether to save as artifact

    Returns:
        ProfilingResult with summary and reports
    """
    if not is_profiling_available():
        return ProfilingResult(
            success=False,
            errors=["Profiling is not available. Set PROFILING_ENABLED=true and install ydata-profiling."],
        )

    if config is None:
        config = ProfilingConfig()

    try:
        from ydata_profiling import ProfileReport

        # Adjust settings based on dataset size
        row_count = len(df)
        if row_count > 100000 and not config.minimal:
            logger.info("Large dataset detected, using minimal mode")
            config.minimal = True

        # Build profile settings
        profile_settings = {
            "title": config.title or f"Profile: {dataset_name}",
            "samples": {
                "head": config.samples_head,
                "tail": config.samples_tail,
            },
            "correlations": {
                "auto": {"calculate": config.correlations},
            },
            "missing_diagrams": {
                "bar": config.missing_diagrams,
                "heatmap": config.missing_diagrams and row_count < 50000,
            },
            "duplicates": {
                "head": 10 if config.duplicates else 0,
            },
            "interactions": {
                "continuous": config.interactions,
            },
            "pool_size": config.pool_size,
        }

        if config.minimal:
            profile_settings["minimal"] = True
        elif config.explorative:
            profile_settings["explorative"] = True

        # Generate profile
        logger.info(f"Generating profile for {dataset_name} ({row_count} rows, {len(df.columns)} columns)")
        profile = ProfileReport(df, **profile_settings)

        # Extract summary
        description = profile.get_description()

        # Get variable types
        var_types = {}
        if hasattr(description, "variables"):
            for var_name, var_info in description.variables.items():
                var_type = str(var_info.get("type", "unknown"))
                var_types[var_type] = var_types.get(var_type, 0) + 1

        # Get alerts
        alerts = []
        if hasattr(description, "alerts"):
            for alert in description.alerts[:20]:  # Limit alerts
                alerts.append(str(alert))

        # Calculate summary stats
        table_stats = description.table if hasattr(description, "table") else {}
        missing_cells = table_stats.get("n_cells_missing", 0)
        total_cells = row_count * len(df.columns)
        missing_percent = (missing_cells / total_cells * 100) if total_cells > 0 else 0

        duplicate_rows = table_stats.get("n_duplicates", 0)
        duplicate_percent = (duplicate_rows / row_count * 100) if row_count > 0 else 0

        memory_mb = df.memory_usage(deep=True).sum() / 1024 / 1024

        summary = ProfilingSummary(
            dataset_name=dataset_name,
            record_count=row_count,
            column_count=len(df.columns),
            missing_cells=missing_cells,
            missing_cells_percent=round(missing_percent, 2),
            duplicate_rows=duplicate_rows,
            duplicate_rows_percent=round(duplicate_percent, 2),
            memory_size_mb=round(memory_mb, 2),
            variable_types=var_types,
            alerts=alerts,
            profiled_at=datetime.utcnow().isoformat() + "Z",
        )

        result = ProfilingResult(
            success=True,
            summary=summary,
        )

        # Save artifact
        if save_artifact:
            try:
                run_id = new_run_id("profiling")

                # Save HTML report
                with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as tmp:
                    profile.to_file(tmp.name)
                    with open(tmp.name, "r") as f:
                        html_content = f.read()

                    store_text(
                        run_id=run_id,
                        category="profiling_report",
                        filename="report.html",
                        text=html_content,
                    )
                    os.unlink(tmp.name)

                # Save JSON summary
                summary_dict = {
                    "dataset_name": summary.dataset_name,
                    "record_count": summary.record_count,
                    "column_count": summary.column_count,
                    "missing_cells": summary.missing_cells,
                    "missing_cells_percent": summary.missing_cells_percent,
                    "duplicate_rows": summary.duplicate_rows,
                    "duplicate_rows_percent": summary.duplicate_rows_percent,
                    "memory_size_mb": summary.memory_size_mb,
                    "variable_types": summary.variable_types,
                    "alerts": summary.alerts,
                    "profiled_at": summary.profiled_at,
                }

                store_text(
                    run_id=run_id,
                    category="profiling_report",
                    filename="summary.json",
                    text=json.dumps(summary_dict, indent=2),
                )

                result.artifact_run_id = run_id
                result.json_report = summary_dict
                logger.info(f"Saved profiling artifact: {run_id}")

            except Exception as e:
                logger.warning(f"Failed to save artifact: {e}")
                result.warnings.append(f"Artifact save failed: {str(e)}")

        return result

    except Exception as e:
        logger.exception(f"Profiling error: {e}")
        return ProfilingResult(
            success=False,
            errors=[str(e)],
        )


def profile_file(
    file_path: Union[str, Path],
    config: Optional[ProfilingConfig] = None,
    save_artifact: bool = True,
) -> ProfilingResult:
    """
    Profile a data file.

    Args:
        file_path: Path to the data file
        config: Profiling configuration
        save_artifact: Whether to save as artifact

    Returns:
        ProfilingResult with summary and reports
    """
    if not is_profiling_available():
        return ProfilingResult(
            success=False,
            errors=["Profiling is not available."],
        )

    path = Path(file_path)
    ext = path.suffix.lower()

    try:
        import pandas as pd

        # Load data based on format
        if ext == ".csv":
            df = pd.read_csv(path)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(path)
        elif ext == ".parquet":
            df = pd.read_parquet(path)
        elif ext in (".json", ".jsonl"):
            df = pd.read_json(path, lines=(ext == ".jsonl"))
        else:
            return ProfilingResult(
                success=False,
                errors=[f"Unsupported file format: {ext}"],
            )

        return profile_dataframe(
            df,
            config=config,
            dataset_name=path.stem,
            save_artifact=save_artifact,
        )

    except ImportError:
        return ProfilingResult(
            success=False,
            errors=["pandas is required for file profiling"],
        )
    except Exception as e:
        logger.exception(f"Error loading file: {e}")
        return ProfilingResult(
            success=False,
            errors=[str(e)],
        )


def generate_quick_stats(df) -> Dict[str, Any]:
    """
    Generate quick statistics without full profiling.

    Args:
        df: pandas DataFrame

    Returns:
        Dictionary with basic statistics
    """
    import pandas as pd

    stats = {
        "rows": len(df),
        "columns": len(df.columns),
        "memory_mb": round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
        "dtypes": {},
        "missing": {},
        "unique": {},
    }

    for col in df.columns:
        dtype = str(df[col].dtype)
        stats["dtypes"][col] = dtype
        stats["missing"][col] = int(df[col].isna().sum())

        try:
            stats["unique"][col] = int(df[col].nunique())
        except Exception:
            stats["unique"][col] = None

    stats["total_missing"] = sum(stats["missing"].values())
    stats["missing_percent"] = round(
        stats["total_missing"] / (stats["rows"] * stats["columns"]) * 100, 2
    ) if stats["rows"] * stats["columns"] > 0 else 0

    return stats

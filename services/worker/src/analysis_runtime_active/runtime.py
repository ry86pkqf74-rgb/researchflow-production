"""ACTIVE analysis runtime for online workflow (aggregate-only)."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Mapping

import pandas as pd


SCHEMA_VERSION = "1.0.0"


class AnalysisRuntimeError(RuntimeError):
    """Raised when analysis runtime fails."""


@dataclass(frozen=True)
class AnalysisRunHandle:
    """Handle returned by the ACTIVE analysis runtime."""

    run_id: str
    ready: bool
    input_run_id: str | None
    output_dir: str
    manifest_path: str
    summary_path: str
    figure_path: str


def run_analysis_runtime_active(
    input_handle_or_paths: Mapping[str, Any] | Any,
    *,
    tmp_root: Path = Path(".tmp"),
) -> AnalysisRunHandle:
    """Run ACTIVE analysis on sanitized ingestion output."""

    dataset_path, uploaded_bytes, filename, input_run_id, preview_metadata_path = (
        _resolve_inputs(input_handle_or_paths)
    )

    # Extract analysis type and parameters
    analysis_type = "descriptive"
    analysis_params = {}
    if isinstance(input_handle_or_paths, Mapping):
        analysis_type = input_handle_or_paths.get("analysis_type", "descriptive")
        analysis_params = input_handle_or_paths.get("analysis_params", {})

    if preview_metadata_path:
        _ensure_preview_metadata_exists(preview_metadata_path, tmp_root)

    if dataset_path:
        df = _load_dataset_from_path(dataset_path)
    elif uploaded_bytes is not None and filename:
        df = _load_dataset_from_bytes(uploaded_bytes, filename)
    else:
        raise AnalysisRuntimeError("No dataset source provided")

    run_id = _generate_run_id()
    output_dir = tmp_root / "analysis_runtime_active" / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    summary = _build_summary(
        df, analysis_type=analysis_type, analysis_params=analysis_params
    )

    summary_path = output_dir / "summary.json"
    _atomic_write_json(summary_path, summary)

    figure_path = output_dir / "figure_1.png"
    _write_figure(
        df, figure_path, analysis_type=analysis_type, analysis_params=analysis_params
    )

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "run_id": run_id,
        "input_run_id": input_run_id,
        "analysis_type": analysis_type,
        "started_at": summary["created_at"],
        "completed_at": _utc_now_iso(),
        "summary_relpath": str(summary_path.relative_to(tmp_root)),
        "figure_relpath": str(figure_path.relative_to(tmp_root)),
    }

    manifest_path = output_dir / "manifest.json"
    _atomic_write_json(manifest_path, manifest)

    return AnalysisRunHandle(
        run_id=run_id,
        ready=True,
        input_run_id=input_run_id,
        output_dir=str(output_dir),
        manifest_path=str(manifest_path),
        summary_path=str(summary_path),
        figure_path=str(figure_path),
    )


def _resolve_inputs(
    input_handle_or_paths: Mapping[str, Any] | Any,
) -> tuple[Path | None, bytes | None, str | None, str | None, str | None]:
    dataset_path = None
    uploaded_bytes = None
    filename = None
    input_run_id = None
    preview_metadata_path = None

    if isinstance(input_handle_or_paths, Mapping):
        dataset_path = _as_path(input_handle_or_paths.get("dataset_path"))
        uploaded_bytes = input_handle_or_paths.get("uploaded_bytes")
        filename = input_handle_or_paths.get("filename")
        input_run_id = input_handle_or_paths.get(
            "ingestion_run_id"
        ) or input_handle_or_paths.get("input_run_id")
        preview_metadata_path = input_handle_or_paths.get("preview_metadata_path")
    else:
        dataset_path = _as_path(getattr(input_handle_or_paths, "dataset_path", None))
        uploaded_bytes = getattr(input_handle_or_paths, "uploaded_bytes", None)
        filename = getattr(input_handle_or_paths, "filename", None)
        input_run_id = getattr(input_handle_or_paths, "run_id", None)
        preview_metadata_path = getattr(
            input_handle_or_paths, "preview_metadata_path", None
        )

    if preview_metadata_path:
        preview_metadata_path = str(preview_metadata_path)
    if filename:
        filename = str(filename)

    return dataset_path, uploaded_bytes, filename, input_run_id, preview_metadata_path


def _as_path(value: Any) -> Path | None:
    if value is None:
        return None
    return Path(str(value))


def _ensure_preview_metadata_exists(preview_metadata_path: str, tmp_root: Path) -> None:
    preview_path = Path(preview_metadata_path)
    if not preview_path.is_absolute():
        preview_path = tmp_root / preview_metadata_path

    if not preview_path.exists():
        raise AnalysisRuntimeError(
            f"Preview metadata not found: {preview_metadata_path}"
        )


def _load_dataset_from_path(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise AnalysisRuntimeError(f"Dataset path not found: {path}")

    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix == ".tsv":
        return pd.read_csv(path, sep="\t")
    if suffix == ".parquet":
        return pd.read_parquet(path)

    return pd.read_csv(path)


def _load_dataset_from_bytes(data: bytes, filename: str) -> pd.DataFrame:
    buffer = BytesIO(data)
    suffix = Path(filename).suffix.lower()

    if suffix == ".csv":
        return pd.read_csv(buffer)
    if suffix == ".tsv":
        return pd.read_csv(buffer, sep="\t")
    if suffix == ".parquet":
        return pd.read_parquet(buffer)

    return pd.read_csv(buffer)


def _build_summary(
    df: pd.DataFrame,
    analysis_type: str = "descriptive",
    analysis_params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if analysis_params is None:
        analysis_params = {}

    columns = [str(c) for c in df.columns]
    null_counts = {col: int(df[col].isna().sum()) for col in columns}

    numeric_columns = [
        str(c) for c in df.select_dtypes(include=["number"]).columns.tolist()
    ]
    numeric_columns = numeric_columns[:10]

    numeric_stats: dict[str, dict[str, float | None]] = {}
    for col in numeric_columns:
        series = pd.to_numeric(df[col], errors="coerce")
        numeric_stats[col] = {
            "mean": _nan_to_none(series.mean(skipna=True)),
            "median": _nan_to_none(series.median(skipna=True)),
            "std": _nan_to_none(series.std(skipna=True)),
        }

    categorical_columns = [col for col in columns if col not in numeric_columns]
    categorical_columns = categorical_columns[:5]

    categorical_stats: dict[str, dict[str, Any]] = {}
    for col in categorical_columns:
        series = df[col]
        counts = series.dropna().value_counts().head(5)
        categorical_stats[col] = {
            "unique_count": int(series.nunique(dropna=True)),
            "non_null_count": int(series.notna().sum()),
            "top_counts": [int(v) for v in counts.tolist()],
        }

    # Add analysis-specific results
    analysis_results = {}

    if analysis_type == "survival":
        analysis_results = _run_survival_analysis(df, analysis_params)
    elif analysis_type == "comparative":
        analysis_results = _run_comparative_analysis(df, analysis_params)
    elif analysis_type == "predictive":
        analysis_results = _run_predictive_analysis(df, analysis_params)

    return {
        "schema_version": SCHEMA_VERSION,
        "created_at": _utc_now_iso(),
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "analysis_type": analysis_type,
        "missingness": null_counts,
        "numeric_stats": numeric_stats,
        "categorical_stats": categorical_stats,
        "analysis_results": analysis_results,
    }


def _write_figure(
    df: pd.DataFrame,
    path: Path,
    analysis_type: str = "descriptive",
    analysis_params: dict[str, Any] | None = None,
) -> None:
    if analysis_params is None:
        analysis_params = {}

    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    numeric_columns = [
        str(c) for c in df.select_dtypes(include=["number"]).columns.tolist()
    ]

    fig, ax = plt.subplots(figsize=(6, 4))

    if (
        analysis_type == "survival"
        and "time_col" in analysis_params
        and "event_col" in analysis_params
    ):
        _plot_survival_curve(df, ax, analysis_params)
    elif (
        analysis_type == "comparative"
        and "group_col" in analysis_params
        and "outcome_col" in analysis_params
    ):
        _plot_group_comparison(df, ax, analysis_params)
    elif numeric_columns:
        col = numeric_columns[0]
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if series.empty:
            ax.text(0.5, 0.5, "No numeric data", ha="center", va="center")
        else:
            ax.hist(series, bins=10, color="#4C78A8", edgecolor="white")
        ax.set_title(f"Histogram: {col}")
        ax.set_xlabel(col)
        ax.set_ylabel("Count")
    else:
        categorical_columns = [str(c) for c in df.columns]
        if not categorical_columns:
            ax.text(0.5, 0.5, "No data", ha="center", va="center")
        else:
            col = categorical_columns[0]
            counts = df[col].dropna().value_counts().head(5)
            labels = [f"value_{i+1}" for i in range(len(counts))]
            ax.bar(labels, counts.tolist(), color="#72B7B2")
            ax.set_title(f"Top categories: {col}")
            ax.set_xlabel("Category rank")
            ax.set_ylabel("Count")

    fig.tight_layout()

    tmp_path = path.with_suffix(path.suffix + ".tmp")
    fig.savefig(tmp_path, format="png", dpi=150)
    plt.close(fig)
    tmp_path.replace(path)


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    tmp_path.replace(path)


def _nan_to_none(value: float) -> float | None:
    if pd.isna(value):
        return None
    return float(value)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run_survival_analysis(df: pd.DataFrame, params: dict[str, Any]) -> dict[str, Any]:
    """Run survival analysis using lifelines if available."""
    try:
        from lifelines import KaplanMeierFitter

        time_col = params.get("time_col", "time_to_event")
        event_col = params.get("event_col", "event_occurred")

        if time_col not in df.columns or event_col not in df.columns:
            return {"error": f"Required columns not found: {time_col}, {event_col}"}

        # Clean data
        subset = df[[time_col, event_col]].dropna()
        if len(subset) < 2:
            return {"error": "Insufficient data for survival analysis"}

        kmf = KaplanMeierFitter()
        kmf.fit(subset[time_col], subset[event_col])

        return {
            "method": "kaplan_meier",
            "n_observations": int(len(subset)),
            "n_events": int(subset[event_col].sum()),
            "median_survival_time": (
                float(kmf.median_survival_time_) if kmf.median_survival_time_ else None
            ),
        }
    except ImportError:
        return {"error": "lifelines not installed. Run: pip install lifelines"}
    except Exception as e:
        return {"error": str(e)[:200]}


def _run_comparative_analysis(
    df: pd.DataFrame, params: dict[str, Any]
) -> dict[str, Any]:
    """Run group comparison analysis (t-test or chi-square)."""
    try:
        from scipy import stats

        group_col = params.get("group_col", "group")
        outcome_col = params.get("outcome_col", "outcome")

        if group_col not in df.columns or outcome_col not in df.columns:
            return {"error": f"Required columns not found: {group_col}, {outcome_col}"}

        # Clean data
        subset = df[[group_col, outcome_col]].dropna()
        if len(subset) < 2:
            return {"error": "Insufficient data for comparison"}

        groups = subset[group_col].unique()
        if len(groups) != 2:
            return {"error": f"Expected 2 groups, found {len(groups)}"}

        group1_data = subset[subset[group_col] == groups[0]][outcome_col]
        group2_data = subset[subset[group_col] == groups[1]][outcome_col]

        # Determine if outcome is numeric or categorical
        if pd.api.types.is_numeric_dtype(subset[outcome_col]):
            # T-test for numeric outcomes
            statistic, pvalue = stats.ttest_ind(group1_data, group2_data)
            return {
                "method": "t_test",
                "group1": str(groups[0]),
                "group2": str(groups[1]),
                "group1_n": int(len(group1_data)),
                "group2_n": int(len(group2_data)),
                "group1_mean": float(group1_data.mean()),
                "group2_mean": float(group2_data.mean()),
                "statistic": float(statistic),
                "p_value": float(pvalue),
            }
        else:
            # Chi-square for categorical outcomes
            contingency = pd.crosstab(subset[group_col], subset[outcome_col])
            statistic, pvalue, dof, expected = stats.chi2_contingency(contingency)
            return {
                "method": "chi_square",
                "group1": str(groups[0]),
                "group2": str(groups[1]),
                "statistic": float(statistic),
                "p_value": float(pvalue),
                "degrees_of_freedom": int(dof),
            }
    except Exception as e:
        return {"error": str(e)[:200]}


def _run_predictive_analysis(
    df: pd.DataFrame, params: dict[str, Any]
) -> dict[str, Any]:
    """Placeholder for predictive modeling."""
    return {
        "method": "predictive_placeholder",
        "note": "Predictive modeling requires additional configuration",
    }


def _plot_survival_curve(df: pd.DataFrame, ax: Any, params: dict[str, Any]) -> None:
    """Plot Kaplan-Meier survival curve."""
    try:
        from lifelines import KaplanMeierFitter

        time_col = params.get("time_col", "time_to_event")
        event_col = params.get("event_col", "event_occurred")

        if time_col in df.columns and event_col in df.columns:
            subset = df[[time_col, event_col]].dropna()
            if len(subset) >= 2:
                kmf = KaplanMeierFitter()
                kmf.fit(subset[time_col], subset[event_col])
                kmf.plot_survival_function(ax=ax)
                ax.set_title("Kaplan-Meier Survival Curve")
                ax.set_xlabel("Time")
                ax.set_ylabel("Survival Probability")
                return
    except Exception:
        pass

    ax.text(0.5, 0.5, "Survival analysis unavailable", ha="center", va="center")


def _plot_group_comparison(df: pd.DataFrame, ax: Any, params: dict[str, Any]) -> None:
    """Plot group comparison (box plot or bar chart)."""
    try:
        group_col = params.get("group_col", "group")
        outcome_col = params.get("outcome_col", "outcome")

        if group_col in df.columns and outcome_col in df.columns:
            subset = df[[group_col, outcome_col]].dropna()

            if pd.api.types.is_numeric_dtype(subset[outcome_col]):
                # Box plot for numeric outcomes
                groups = subset[group_col].unique()
                data = [
                    subset[subset[group_col] == g][outcome_col].values for g in groups
                ]
                ax.boxplot(data, labels=[str(g) for g in groups])
                ax.set_title(f"{outcome_col} by {group_col}")
                ax.set_ylabel(outcome_col)
                return
    except Exception:
        pass

    ax.text(0.5, 0.5, "Group comparison unavailable", ha="center", va="center")


def _generate_run_id() -> str:
    return uuid.uuid4().hex[:8]

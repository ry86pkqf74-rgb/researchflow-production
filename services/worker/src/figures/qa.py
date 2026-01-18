"""
Figure Quality Assurance (QA) helper for decision-ready and verifiable figures.

This module provides validation for figures to ensure they are:
1. Decision-ready: plotted values match source summary statistics
2. Verifiable: axis transforms are explicitly recorded (e.g., log scale)
3. Complete: units and labels are present

Usage:
    from src.figures.qa import FigureQAValidator, validate_figure

    # Validate a figure against source data
    validator = FigureQAValidator()
    result = validator.validate(
        fig,
        source_stats={"mean": 10.5, "std": 2.3, "n": 100},
        plotted_stats={"mean": 10.5, "std": 2.3, "n": 100},
    )

    if not result.passes:
        print(f"QA failed: {result.issues}")

    # Or use convenience function
    validate_figure(
        fig,
        require_labels=True,
        require_units=True,
        check_transforms=True,
    )

Governance: Offline-first, no external calls, metadata-only validation.
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from pathlib import Path
import json

from matplotlib.figure import Figure

logger = logging.getLogger(__name__)


@dataclass
class FigureQAResult:
    """Result of figure QA validation."""

    passes: bool
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "passes": self.passes,
            "issues": self.issues,
            "warnings": self.warnings,
            "metadata": self.metadata,
        }

    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=2)


@dataclass
class AxisTransform:
    """Record of axis transform applied to figure."""

    axis_name: str  # 'x', 'y', or 'z'
    transform_type: str  # 'log', 'symlog', 'logit', 'linear', etc.
    base: Optional[float] = None  # For log transforms
    params: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "axis_name": self.axis_name,
            "transform_type": self.transform_type,
            "base": self.base,
            "params": self.params,
        }


class FigureQAValidator:
    """
    Validator for figure quality assurance.

    Checks:
    1. Labels present (title, axis labels)
    2. Units specified in labels
    3. Axis transforms recorded (log scale, etc.)
    4. Plotted values match source statistics (within tolerance)
    """

    def __init__(
        self,
        tolerance: float = 1e-6,
        require_labels: bool = True,
        require_units: bool = True,
        check_transforms: bool = True,
    ):
        """
        Initialize validator.

        Args:
            tolerance: Tolerance for numeric comparisons
            require_labels: Require title and axis labels
            require_units: Require units in axis labels
            check_transforms: Check for axis transforms
        """
        self.tolerance = tolerance
        self.require_labels = require_labels
        self.require_units = require_units
        self.check_transforms = check_transforms

    def validate(
        self,
        fig: Figure,
        source_stats: Optional[Dict[str, float]] = None,
        plotted_stats: Optional[Dict[str, float]] = None,
        expected_transforms: Optional[List[AxisTransform]] = None,
    ) -> FigureQAResult:
        """
        Validate a figure for decision-readiness.

        Args:
            fig: Matplotlib figure to validate
            source_stats: Source data summary statistics (e.g., {"mean": 10.5, "std": 2.3})
            plotted_stats: Statistics extracted from plotted data
            expected_transforms: Expected axis transforms

        Returns:
            FigureQAResult with validation results

        Examples:
            >>> validator = FigureQAValidator()
            >>> result = validator.validate(
            ...     fig,
            ...     source_stats={"mean": 10.5, "n": 100},
            ...     plotted_stats={"mean": 10.5, "n": 100},
            ... )
            >>> assert result.passes
        """
        issues = []
        warnings = []
        metadata = {}

        # Check labels
        if self.require_labels:
            label_issues = self._check_labels(fig)
            issues.extend(label_issues)

        # Check units
        if self.require_units:
            unit_issues = self._check_units(fig)
            issues.extend(unit_issues)

        # Check transforms
        if self.check_transforms:
            detected_transforms = self._detect_transforms(fig)
            metadata["transforms"] = [t.to_dict() for t in detected_transforms]

            if expected_transforms is not None:
                transform_issues = self._validate_transforms(
                    detected_transforms, expected_transforms
                )
                issues.extend(transform_issues)
            elif detected_transforms:
                # Warn about transforms without explicit declaration
                warnings.append(
                    f"Axis transforms detected but not explicitly declared: "
                    f"{[t.axis_name + ':' + t.transform_type for t in detected_transforms]}"
                )

        # Check statistics match
        if source_stats is not None and plotted_stats is not None:
            stats_issues = self._check_statistics_match(source_stats, plotted_stats)
            issues.extend(stats_issues)
            metadata["statistics_validated"] = len(stats_issues) == 0

        passes = len(issues) == 0

        return FigureQAResult(
            passes=passes,
            issues=issues,
            warnings=warnings,
            metadata=metadata,
        )

    def _check_labels(self, fig: Figure) -> List[str]:
        """Check that figure has appropriate labels."""
        issues = []

        axes = fig.get_axes()
        if not axes:
            issues.append("Figure has no axes")
            return issues

        for i, ax in enumerate(axes):
            ax_label = f"axes[{i}]"

            # Check title
            title = ax.get_title()
            if not title or not title.strip():
                # Check if there's a figure-level title instead
                if fig._suptitle is None or not fig._suptitle.get_text().strip():
                    issues.append(f"{ax_label}: Missing title or suptitle")

            # Check x-axis label
            xlabel = ax.get_xlabel()
            if not xlabel or not xlabel.strip():
                issues.append(f"{ax_label}: Missing x-axis label")

            # Check y-axis label
            ylabel = ax.get_ylabel()
            if not ylabel or not ylabel.strip():
                issues.append(f"{ax_label}: Missing y-axis label")

        return issues

    def _check_units(self, fig: Figure) -> List[str]:
        """Check that axis labels include units."""
        issues = []

        # Common unit patterns: (unit), [unit], "unit"
        unit_indicators = ["(", "[", "unit"]

        axes = fig.get_axes()
        for i, ax in enumerate(axes):
            ax_label = f"axes[{i}]"

            xlabel = ax.get_xlabel()
            if xlabel and xlabel.strip():
                if not any(ind in xlabel.lower() for ind in unit_indicators):
                    issues.append(
                        f"{ax_label}: X-axis label '{xlabel}' appears to lack units. "
                        "Include units in parentheses or brackets (e.g., 'Time (days)')."
                    )

            ylabel = ax.get_ylabel()
            if ylabel and ylabel.strip():
                if not any(ind in ylabel.lower() for ind in unit_indicators):
                    issues.append(
                        f"{ax_label}: Y-axis label '{ylabel}' appears to lack units. "
                        "Include units in parentheses or brackets (e.g., 'TSH (mIU/L)')."
                    )

        return issues

    def _detect_transforms(self, fig: Figure) -> List[AxisTransform]:
        """Detect axis transforms (log, symlog, etc.)."""
        transforms = []

        axes = fig.get_axes()
        for ax in axes:
            # Check x-axis scale
            xscale = ax.get_xscale()
            if xscale != "linear":
                transforms.append(
                    AxisTransform(
                        axis_name="x",
                        transform_type=xscale,
                        base=10 if "log" in xscale else None,
                    )
                )

            # Check y-axis scale
            yscale = ax.get_yscale()
            if yscale != "linear":
                transforms.append(
                    AxisTransform(
                        axis_name="y",
                        transform_type=yscale,
                        base=10 if "log" in yscale else None,
                    )
                )

            # Check z-axis scale for 3D plots
            try:
                zscale = ax.get_zscale()
                if zscale != "linear":
                    transforms.append(
                        AxisTransform(
                            axis_name="z",
                            transform_type=zscale,
                            base=10 if "log" in zscale else None,
                        )
                    )
            except AttributeError:
                pass  # Not a 3D axes

        return transforms

    def _validate_transforms(
        self,
        detected: List[AxisTransform],
        expected: List[AxisTransform],
    ) -> List[str]:
        """Validate that detected transforms match expected."""
        issues = []

        # Convert to dict for easier comparison
        detected_dict = {(t.axis_name, t.transform_type): t for t in detected}
        expected_dict = {(t.axis_name, t.transform_type): t for t in expected}

        # Check for missing transforms
        for key in expected_dict:
            if key not in detected_dict:
                axis, transform = key
                issues.append(f"Expected {axis}-axis transform '{transform}' not found")

        # Check for unexpected transforms
        for key in detected_dict:
            if key not in expected_dict:
                axis, transform = key
                issues.append(
                    f"Unexpected {axis}-axis transform '{transform}' detected"
                )

        return issues

    def _check_statistics_match(
        self,
        source_stats: Dict[str, float],
        plotted_stats: Dict[str, float],
    ) -> List[str]:
        """Check that plotted statistics match source."""
        issues = []

        for key in source_stats:
            if key not in plotted_stats:
                issues.append(f"Source statistic '{key}' not found in plotted data")
                continue

            source_val = source_stats[key]
            plotted_val = plotted_stats[key]

            # Check if values match within tolerance
            if abs(source_val - plotted_val) > self.tolerance:
                issues.append(
                    f"Statistic '{key}' mismatch: "
                    f"source={source_val}, plotted={plotted_val}, "
                    f"diff={abs(source_val - plotted_val)}"
                )

        return issues


def validate_figure(
    fig: Figure,
    require_labels: bool = True,
    require_units: bool = True,
    check_transforms: bool = True,
    source_stats: Optional[Dict[str, float]] = None,
    plotted_stats: Optional[Dict[str, float]] = None,
    expected_transforms: Optional[List[AxisTransform]] = None,
    raise_on_failure: bool = True,
) -> FigureQAResult:
    """
    Convenience function to validate a figure.

    Args:
        fig: Matplotlib figure to validate
        require_labels: Require title and axis labels
        require_units: Require units in axis labels
        check_transforms: Check for axis transforms
        source_stats: Source data summary statistics
        plotted_stats: Statistics extracted from plotted data
        expected_transforms: Expected axis transforms
        raise_on_failure: Raise ValueError if validation fails

    Returns:
        FigureQAResult

    Raises:
        ValueError: If validation fails and raise_on_failure=True

    Examples:
        >>> validate_figure(fig, require_labels=True)
        FigureQAResult(passes=True, issues=[], warnings=[], metadata={})

        >>> # With statistics validation
        >>> validate_figure(
        ...     fig,
        ...     source_stats={"mean": 10.5, "n": 100},
        ...     plotted_stats={"mean": 10.5, "n": 100},
        ... )
    """
    validator = FigureQAValidator(
        require_labels=require_labels,
        require_units=require_units,
        check_transforms=check_transforms,
    )

    result = validator.validate(
        fig=fig,
        source_stats=source_stats,
        plotted_stats=plotted_stats,
        expected_transforms=expected_transforms,
    )

    if not result.passes and raise_on_failure:
        issues_str = "\n  - ".join(result.issues)
        raise ValueError(f"Figure QA validation failed:\n  - {issues_str}")

    return result


def extract_plotted_statistics(
    fig: Figure,
    axis_index: int = 0,
) -> Dict[str, float]:
    """
    Extract summary statistics from plotted data in a figure.

    Args:
        fig: Matplotlib figure
        axis_index: Index of axes to extract from (default: 0)

    Returns:
        Dictionary of statistics (mean, std, n, min, max)

    Examples:
        >>> stats = extract_plotted_statistics(fig)
        >>> print(stats)
        {'mean': 10.5, 'std': 2.3, 'n': 100, 'min': 5.0, 'max': 15.0}
    """
    import numpy as np

    axes = fig.get_axes()
    if not axes or axis_index >= len(axes):
        return {}

    ax = axes[axis_index]

    # Extract data from all lines
    all_ydata = []
    for line in ax.lines:
        ydata = line.get_ydata()
        all_ydata.extend(ydata)

    if not all_ydata:
        return {}

    # Compute statistics
    all_ydata = np.array(all_ydata)

    return {
        "mean": float(np.mean(all_ydata)),
        "std": float(np.std(all_ydata)),
        "n": len(all_ydata),
        "min": float(np.min(all_ydata)),
        "max": float(np.max(all_ydata)),
    }


def generate_qa_manifest_entry(
    fig: Figure,
    filename: str,
    qa_result: FigureQAResult,
    source_file: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a metadata-only manifest entry for figure QA.

    This creates a lightweight manifest entry with:
    - Filename and QA status
    - Transform metadata
    - Source file reference
    - NO data, NO PHI

    Args:
        fig: Matplotlib figure
        filename: Figure filename
        qa_result: QA validation result
        source_file: Optional path to source data file

    Returns:
        Dictionary manifest entry (metadata-only)

    Examples:
        >>> manifest_entry = generate_qa_manifest_entry(
        ...     fig,
        ...     "figure1.png",
        ...     qa_result,
        ...     source_file="data/processed/cohort.parquet",
        ... )
        >>> with open(".tmp/figure_qa_manifest.jsonl", "a") as f:
        ...     f.write(json.dumps(manifest_entry) + "\\n")
    """
    from datetime import datetime, timezone

    axes = fig.get_axes()

    entry = {
        "filename": filename,
        "qa_passes": qa_result.passes,
        "qa_timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "num_axes": len(axes),
        "transforms": qa_result.metadata.get("transforms", []),
        "source_file": source_file,
        "issues": qa_result.issues,
        "warnings": qa_result.warnings,
        "statistics_validated": qa_result.metadata.get("statistics_validated", False),
    }

    return entry


def save_qa_manifest_entry(
    entry: Dict[str, Any],
    manifest_path: Path = Path(".tmp/figure_qa_manifest.jsonl"),
) -> None:
    """
    Save QA manifest entry to JSONL file.

    Args:
        entry: Manifest entry dictionary
        manifest_path: Path to manifest file

    Examples:
        >>> entry = generate_qa_manifest_entry(fig, "figure1.png", qa_result)
        >>> save_qa_manifest_entry(entry)
    """
    manifest_path = Path(manifest_path)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    with open(manifest_path, "a") as f:
        f.write(json.dumps(entry) + "\n")

    logger.debug(f"QA manifest entry saved: {manifest_path}")

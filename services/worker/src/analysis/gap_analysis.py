from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Optional


@dataclass(frozen=True)
class GapFinding:
    """Represents a detected research gap between dataset and literature.

    Attributes:
        kind: Category of gap (e.g., 'literature_missing', 'dataset_older').
        message: Human-readable description of the gap.
    """

    kind: str
    message: str


@dataclass(frozen=True)
class RecommendedAction:
    """Represents a recommended action based on a gap finding.

    Attributes:
        gap_kind: Gap category that triggered this action.
        action: Human-readable action description.
        target_page: Streamlit page path to navigate to (None if informational).
        reason: Explanation of why this action is recommended.
        priority: Priority level ('high', 'medium', 'low', 'info').
    """

    gap_kind: str
    action: str
    target_page: Optional[str]
    reason: str
    priority: str


def _extract_years_from_references(references: list[dict[str, Any]]) -> list[int]:
    """Extract and parse year values from reference dictionaries.

    Args:
        references: List of reference dictionaries containing year information.

    Returns:
        List of parsed integer years from references.
    """
    years = []
    for r in references:
        y = r.get("year") or r.get("pub_year")
        if isinstance(y, int):
            years.append(y)
        elif isinstance(y, str) and y.isdigit():
            years.append(int(y))
    return years


def _analyze_temporal_gap(
    dataset_summary: dict[str, Any], lit_min: int, lit_max: int
) -> list[GapFinding]:
    """Compare dataset temporal span with literature span.

    Args:
        dataset_summary: Dictionary containing dataset metadata.
        lit_min: Minimum year from literature references.
        lit_max: Maximum year from literature references.

    Returns:
        List of gap findings comparing dataset and literature temporal ranges.
    """
    findings: list[GapFinding] = []
    findings.append(
        GapFinding(
            "literature_year_span", f"Literature years span {lit_min}–{lit_max}."
        )
    )  # noqa: RUF001

    ds_min = dataset_summary.get("year_min")
    ds_max = dataset_summary.get("year_max")
    if isinstance(ds_min, int) and isinstance(ds_max, int):
        if ds_max < lit_max:
            findings.append(
                GapFinding(
                    "dataset_older",
                    "Dataset appears older than the newest literature.",
                )
            )
        if ds_min > lit_min:
            findings.append(
                GapFinding(
                    "dataset_newer",
                    "Dataset appears newer than the oldest literature.",
                )
            )
        if ds_min > lit_max:
            findings.append(
                GapFinding(
                    "dataset_outside_lit",
                    "Dataset years are entirely after literature span.",
                )
            )
    return findings


def simple_gap_analysis(
    *, dataset_summary: dict[str, Any], references: Iterable[dict[str, Any]]
) -> list[GapFinding]:
    """Analyze temporal gaps between dataset and literature references.

    Uses deterministic heuristics to identify potential research gaps:
    - Compares dataset year span with literature year span
    - Flags missing references
    - Identifies temporal mismatches

    Args:
        dataset_summary: Dictionary containing dataset metadata, including
            optional 'year_min' and 'year_max' integer fields.
        references: Iterable of reference dictionaries, each potentially
            containing 'year' or 'pub_year' fields.

    Returns:
        List of GapFinding objects describing detected gaps.
    """
    refs = list(references)
    if not refs:
        return [
            GapFinding(
                kind="literature_missing",
                message="No selected references; cannot compare to literature.",
            )
        ]

    years = _extract_years_from_references(refs)

    if years:
        lit_min, lit_max = min(years), max(years)
        return _analyze_temporal_gap(dataset_summary, lit_min, lit_max)
    else:
        return [
            GapFinding(
                "literature_year_unknown",
                "Literature records contain no parseable years.",
            )
        ]


# Deterministic mapping from gap kinds to recommended actions
_GAP_ACTION_MAP: dict[str, RecommendedAction] = {
    "literature_missing": RecommendedAction(
        gap_kind="literature_missing",
        action="Add literature references",
        target_page="pages/workflow/2_📖_Literature.py",
        reason="No references selected. Add literature to enable comparison.",
        priority="high",
    ),
    "literature_year_unknown": RecommendedAction(
        gap_kind="literature_year_unknown",
        action="Review reference metadata",
        target_page="pages/workflow/2_📖_Literature.py",
        reason="References lack year information. Update reference metadata.",
        priority="medium",
    ),
    "dataset_older": RecommendedAction(
        gap_kind="dataset_older",
        action="Review dataset summary",
        target_page="pages/workflow/5_📊_Summary.py",
        reason="Dataset appears older than newest literature. Verify temporal scope.",
        priority="low",
    ),
    "dataset_newer": RecommendedAction(
        gap_kind="dataset_newer",
        action="Consider adding recent literature",
        target_page="pages/workflow/2_📖_Literature.py",
        reason="Dataset appears newer than oldest literature. Add recent references.",
        priority="medium",
    ),
    "dataset_outside_lit": RecommendedAction(
        gap_kind="dataset_outside_lit",
        action="Update literature or verify dataset scope",
        target_page="pages/workflow/2_📖_Literature.py",
        reason="Dataset years entirely after literature span. Add recent literature.",
        priority="high",
    ),
    "literature_year_span": RecommendedAction(
        gap_kind="literature_year_span",
        action="Continue to next step",
        target_page=None,
        reason="Literature temporal span documented (informational only).",
        priority="info",
    ),
}


def compute_recommended_actions(findings: list[GapFinding]) -> list[RecommendedAction]:
    """Compute recommended actions from gap findings.

    Pure, deterministic function that maps gap findings to actionable recommendations.

    Args:
        findings: List of GapFinding objects from simple_gap_analysis()

    Returns:
        List of RecommendedAction objects, deduplicated and sorted by priority.
        Info-only actions are filtered out if actionable items exist.
    """
    # Collect unique actions (deduplicate by gap_kind)
    seen_kinds: set[str] = set()
    actions: list[RecommendedAction] = []

    for finding in findings:
        if finding.kind in seen_kinds:
            continue
        seen_kinds.add(finding.kind)

        action = _GAP_ACTION_MAP.get(finding.kind)
        if action:
            actions.append(action)

    # Sort by priority (high > medium > low > info)
    priority_order = {"high": 0, "medium": 1, "low": 2, "info": 3}
    actions.sort(key=lambda a: priority_order.get(a.priority, 999))

    # Filter out info-only actions unless it's the only finding
    if len(actions) > 1:
        actions = [a for a in actions if a.priority != "info"]

    return actions

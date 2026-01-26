"""ACTIVE manuscript runtime: build draft markdown from workflow state."""

from __future__ import annotations

from typing import Any, Mapping


def build_draft_markdown(
    topic: str,
    literature_overview: str,
    analysis_summary: dict[str, Any],
    selected_idea: Mapping[str, Any] | Any,
    citations_bib: str,
) -> str:
    """
    Build a markdown manuscript draft from workflow state.

    Args:
        topic: Research topic
        literature_overview: Literature search overview markdown
        analysis_summary: Analysis summary dict (metadata-only)
        selected_idea: Selected manuscript idea
        citations_bib: BibTeX citations

    Returns:
        Draft manuscript as markdown string
    """
    idea_title = _get_idea_value(selected_idea, "title") or "Untitled"
    idea_rationale = _get_idea_value(selected_idea, "rationale") or ""
    idea_question = _get_idea_value(selected_idea, "question") or ""
    idea_analysis_type = (
        _get_idea_value(selected_idea, "analysis_type") or "descriptive"
    )

    sections = []

    sections.append(f"# {idea_title}\n")
    sections.append(f"**Topic:** {topic}\n")
    sections.append(f"**Research Question:** {idea_question}\n")

    if idea_rationale:
        sections.append("## Background and Rationale\n")
        sections.append(f"{idea_rationale}\n")

    if literature_overview:
        sections.append("## Literature Context\n")
        sections.append(f"{literature_overview}\n")

    # Add Methods section
    sections.append("## Methods\n")
    sections.append(_build_methods_section(analysis_summary, idea_analysis_type))

    # Add Results section
    sections.append("## Results\n")
    sections.append(_build_results_section(analysis_summary))

    # Add Discussion section
    sections.append("## Discussion\n")
    sections.append(
        _build_discussion_section(analysis_summary, literature_overview, idea_rationale)
    )

    if citations_bib:
        sections.append("## References\n")
        sections.append("```bibtex\n")
        sections.append(f"{citations_bib}\n")
        sections.append("```\n")

    return "\n".join(sections)


def _build_methods_section(summary: dict[str, Any], analysis_type: str) -> str:
    """Build Methods section from analysis summary."""
    lines = []

    row_count = summary.get("row_count", 0)
    column_count = summary.get("column_count", 0)

    lines.append(f"### Study Population\n")
    lines.append(
        f"This analysis included {row_count} observations with {column_count} variables. "
    )
    lines.append(
        "Data quality checks were performed to identify and handle missing values.\n"
    )

    lines.append(f"### Statistical Analysis\n")

    if analysis_type == "survival":
        lines.append("Survival analysis was conducted using Kaplan-Meier estimation. ")
        lines.append(
            "Time-to-event data were analyzed to estimate survival probabilities. "
        )
        analysis_results = summary.get("analysis_results", {})
        if (
            "median_survival_time" in analysis_results
            and analysis_results["median_survival_time"]
        ):
            lines.append(
                f"Median survival time and associated confidence intervals were calculated.\n"
            )
        else:
            lines.append("Survival curves were plotted for visualization.\n")

    elif analysis_type == "comparative":
        lines.append(
            "Group comparison analysis was performed to assess differences between groups. "
        )
        analysis_results = summary.get("analysis_results", {})
        method = analysis_results.get("method", "")
        if method == "t_test":
            lines.append("Independent t-tests were used for continuous outcomes. ")
        elif method == "chi_square":
            lines.append("Chi-square tests were used for categorical outcomes. ")
        lines.append("Statistical significance was set at p < 0.05.\n")

    elif analysis_type == "predictive":
        lines.append(
            "Predictive modeling was performed to develop outcome prediction models. "
        )
        lines.append("Model performance was evaluated using appropriate metrics.\n")

    else:  # descriptive
        lines.append("Descriptive statistics were calculated for all variables. ")
        lines.append(
            "Continuous variables are reported as mean +/- standard deviation or median (IQR). "
        )
        lines.append(
            "Categorical variables are reported as frequencies and percentages.\n"
        )

    lines.append(f"### Data Processing\n")
    missingness = summary.get("missingness", {})
    if missingness:
        total_missing = sum(missingness.values())
        total_cells = row_count * column_count
        missing_pct = (total_missing / total_cells * 100) if total_cells > 0 else 0
        lines.append(f"Overall missingness was {missing_pct:.1f}%. ")
        lines.append("Missing data patterns were assessed and handled appropriately.\n")

    return "\n".join(lines) + "\n"


def _build_results_section(summary: dict[str, Any]) -> str:
    """Build Results section from analysis summary."""
    lines = []

    row_count = summary.get("row_count", 0)
    column_count = summary.get("column_count", 0)
    analysis_type = summary.get("analysis_type", "descriptive")

    lines.append(f"### Descriptive Statistics\n")
    lines.append(
        f"The dataset included {row_count} observations across {column_count} variables. "
    )

    # Numeric summaries
    numeric_stats = summary.get("numeric_stats", {})
    if numeric_stats:
        lines.append(f"{len(numeric_stats)} numeric variables were analyzed. ")
        lines.append("Key statistics are summarized below:\n")
        for col, stats in list(numeric_stats.items())[:5]:
            mean = stats.get("mean")
            std = stats.get("std")
            if mean is not None and std is not None:
                lines.append(f"- **{col}**: Mean = {mean:.2f}, SD = {std:.2f}")
        lines.append("\n")

    # Categorical summaries
    categorical_stats = summary.get("categorical_stats", {})
    if categorical_stats:
        lines.append(f"{len(categorical_stats)} categorical variables were analyzed.\n")

    # Analysis-specific results
    analysis_results = summary.get("analysis_results", {})

    if analysis_type == "survival" and analysis_results:
        lines.append(f"### Survival Analysis Results\n")
        if "error" in analysis_results:
            lines.append(f"Note: {analysis_results['error']}\n")
        else:
            n_obs = analysis_results.get("n_observations", 0)
            n_events = analysis_results.get("n_events", 0)
            median_surv = analysis_results.get("median_survival_time")
            lines.append(
                f"A total of {n_obs} observations were included in the survival analysis. "
            )
            lines.append(f"{n_events} events were observed. ")
            if median_surv:
                lines.append(
                    f"Median survival time was {median_surv:.2f} time units.\n"
                )
            else:
                lines.append("Median survival time was not reached.\n")

    elif analysis_type == "comparative" and analysis_results:
        lines.append(f"### Group Comparison Results\n")
        if "error" in analysis_results:
            lines.append(f"Note: {analysis_results['error']}\n")
        else:
            method = analysis_results.get("method", "")
            group1 = analysis_results.get("group1", "Group 1")
            group2 = analysis_results.get("group2", "Group 2")

            if method == "t_test":
                g1_mean = analysis_results.get("group1_mean", 0)
                g2_mean = analysis_results.get("group2_mean", 0)
                pval = analysis_results.get("p_value", 1)
                lines.append(
                    f"Comparison between {group1} (mean = {g1_mean:.2f}) and {group2} (mean = {g2_mean:.2f}). "
                )
                lines.append(f"T-test p-value = {pval:.4f}.\n")

            elif method == "chi_square":
                pval = analysis_results.get("p_value", 1)
                lines.append(f"Chi-square test comparing {group1} vs {group2}. ")
                lines.append(f"P-value = {pval:.4f}.\n")

    return "\n".join(lines) + "\n"


def _build_discussion_section(
    summary: dict[str, Any], literature_overview: str, rationale: str
) -> str:
    """Build Discussion section referencing literature and analysis insights."""
    lines = []

    analysis_type = summary.get("analysis_type", "descriptive")
    row_count = summary.get("row_count", 0)

    lines.append("### Summary of Findings\n")
    lines.append(
        f"This {analysis_type} analysis of {row_count} observations provides insights into the research question. "
    )

    # Link to literature
    if literature_overview:
        lines.append(
            "These findings build upon the existing literature base identified in our systematic search. "
        )
        lines.append(
            "Future work should validate these results in independent cohorts.\n"
        )

    lines.append("### Strengths and Limitations\n")
    lines.append(
        "**Strengths:** This analysis utilized structured data with comprehensive quality checks. "
    )
    lines.append(
        "Appropriate statistical methods were applied based on the research question and data characteristics.\n"
    )

    lines.append("**Limitations:** ")
    missingness = summary.get("missingness", {})
    if missingness and sum(missingness.values()) > 0:
        lines.append(
            "Missing data may introduce bias if not missing completely at random. "
        )
    lines.append("Cross-sectional analyses cannot establish causality. ")
    lines.append(
        "Results should be interpreted within the context of the study population.\n"
    )

    lines.append("### Clinical Implications\n")
    lines.append(
        "The findings from this analysis have potential implications for clinical practice and future research. "
    )
    lines.append(
        "Additional validation studies and prospective trials are needed to confirm these observations.\n"
    )

    return "\n".join(lines) + "\n"


def _format_analysis_summary(summary: dict[str, Any]) -> str:
    """Format analysis summary as markdown (metadata-only) - legacy function."""
    lines = []

    # Extract metadata-only fields
    row_count = summary.get("row_count", summary.get("n_records", 0))
    column_count = summary.get("column_count", summary.get("n_features", 0))
    figure_count = summary.get("figure_count", 0)

    lines.append(f"- **Records analyzed:** {row_count}")
    lines.append(f"- **Features:** {column_count}")
    lines.append(f"- **Figures generated:** {figure_count}")

    insights = summary.get("insights", [])
    if insights:
        lines.append("\n**Key Insights:**\n")
        for idx, insight in enumerate(insights, 1):
            lines.append(f"{idx}. {insight}")

    return "\n".join(lines) + "\n"


def _get_idea_value(selected_idea: Mapping[str, Any] | Any, key: str) -> str | None:
    """Get value from selected_idea dict or object."""
    if isinstance(selected_idea, Mapping):
        value = selected_idea.get(key)
    else:
        value = getattr(selected_idea, key, None)
    if value is None:
        return None
    return str(value)

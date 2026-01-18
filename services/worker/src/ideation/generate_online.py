"""
Online Workflow Ideation Generator

Purpose: Generate manuscript ideas for ONLINE workflow Step 5
Classification: Governance-Critical (manuscript ideation)
PHI-Safe: Yes (uses metadata only, no cell values)

Adapts QuestionFramer for online workflow wizard context with:
- Topic declaration
- Dataset column metadata (NO raw values)
- Literature search results metadata (titles/years only)
- Optional focus/constraint string

Version: 1.0.0
Author: ROS Governance Team
Created: 2026-01-09
"""

import json
import hashlib
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional


@dataclass
class ManuscriptIdea:
    """Single manuscript idea with analysis plan."""

    id: str
    title: str
    question: str
    analysis_type: str  # descriptive|comparative|predictive|survival|concordance
    required_variables: List[str]
    rationale: str
    generated_at: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


def generate_manuscript_ideas(
    *,
    topic: str,
    columns: List[str],
    literature_titles: List[str],
    n: int = 7,
    focus: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate manuscript ideas deterministically for online workflow.

    Args:
        topic: Research topic string
        columns: List of dataset column names (metadata only)
        literature_titles: List of literature titles (metadata only)
        n: Number of ideas to generate (5-10)
        focus: Optional focus constraint or subtopic

    Returns:
        Dict with run_id, ready status, and list of ideas
    """
    # Validate inputs
    if not topic or not topic.strip():
        raise ValueError("Topic cannot be empty")

    if n < 5 or n > 10:
        raise ValueError("n must be between 5 and 10")

    # Generate deterministic run_id
    run_id = _generate_run_id(topic, columns, literature_titles, n, focus)

    # Build ideas deterministically
    ideas = []

    # Idea 1: Cohort characteristics (always generated)
    ideas.append(
        ManuscriptIdea(
            id="I1",
            title="Cohort Characteristics and Demographics",
            question=f"What are the demographic and clinical characteristics of the study cohort for {topic}?",
            analysis_type="descriptive",
            required_variables=_select_demographic_vars(columns),
            rationale="Establishing cohort characteristics is essential for understanding the study population and assessing generalizability to other clinical settings.",
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    )

    # Idea 2: Outcome comparison (if appropriate columns exist)
    if _has_outcome_columns(columns):
        ideas.append(
            ManuscriptIdea(
                id="I2",
                title="Outcome Comparison Across Groups",
                question=f"Do clinical outcomes differ significantly between patient subgroups in {topic}?",
                analysis_type="comparative",
                required_variables=_select_outcome_vars(columns),
                rationale="Comparative analysis quantifies outcome differences and identifies patient populations that may benefit from targeted interventions.",
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    # Idea 3: Predictive modeling (if outcome + predictors available)
    if _has_predictive_capability(columns):
        ideas.append(
            ManuscriptIdea(
                id="I3",
                title="Predictive Model Development",
                question=f"Can baseline clinical features accurately predict outcomes in {topic}?",
                analysis_type="predictive",
                required_variables=_select_predictor_vars(columns),
                rationale="Predictive modeling enables risk stratification and supports clinical decision-making through individualized outcome probability estimates.",
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    # Idea 4: Time-to-event analysis (if survival/time columns exist)
    if _has_survival_columns(columns):
        ideas.append(
            ManuscriptIdea(
                id="I4",
                title="Time-to-Event Analysis",
                question=f"What factors influence time to event in {topic}?",
                analysis_type="survival",
                required_variables=_select_survival_vars(columns),
                rationale="Survival analysis models time-dependent outcomes and identifies prognostic factors for long-term patient management.",
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    # Idea 5: Laboratory/biomarker patterns (if lab columns exist)
    if _has_lab_columns(columns):
        ideas.append(
            ManuscriptIdea(
                id="I5",
                title="Laboratory Value Distributions and Associations",
                question=f"Do laboratory values differ systematically across patient groups in {topic}?",
                analysis_type="comparative",
                required_variables=_select_lab_vars(columns),
                rationale="Laboratory value distributions may reveal biological mechanisms and inform diagnostic or prognostic biomarker development.",
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    # Idea 6: Treatment/intervention effect (if treatment columns exist)
    if _has_treatment_columns(columns):
        ideas.append(
            ManuscriptIdea(
                id="I6",
                title="Treatment Effect Assessment",
                question=f"What is the effectiveness of interventions in {topic}?",
                analysis_type="comparative",
                required_variables=_select_treatment_vars(columns),
                rationale="Treatment effect estimation quantifies intervention benefits and guides evidence-based clinical practice recommendations.",
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    # Idea 7: Data quality and integration (always relevant)
    ideas.append(
        ManuscriptIdea(
            id="I7",
            title="Data Quality and Completeness Assessment",
            question=f"How complete and reliable are the data sources for {topic}?",
            analysis_type="descriptive",
            required_variables=_select_quality_vars(columns),
            rationale="Transparent reporting of data quality and missingness patterns enhances scientific credibility and informs interpretation of findings.",
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    )

    # Idea 8: Literature gap addressed (if literature available)
    if literature_titles:
        ideas.append(
            ManuscriptIdea(
                id="I8",
                title="Addressing Literature Gaps",
                question=f"What novel contributions does this analysis make to the {topic} literature?",
                analysis_type="descriptive",
                required_variables=_select_core_vars(columns),
                rationale=f"Positioning findings within existing literature (n={len(literature_titles)} studies identified) clarifies the unique contribution and clinical significance.",
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    # Idea 9: Clinical implications (always relevant)
    ideas.append(
        ManuscriptIdea(
            id="I9",
            title="Clinical Practice Implications",
            question=f"What are the clinical implications of findings for {topic}?",
            analysis_type="descriptive",
            required_variables=_select_core_vars(columns),
            rationale="Translating research findings into actionable clinical recommendations requires explicit discussion of implementation barriers and decision support tools.",
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    )

    # Idea 10: Subgroup/sensitivity analysis (if appropriate)
    if _has_subgroup_capability(columns):
        ideas.append(
            ManuscriptIdea(
                id="I10",
                title="Subgroup and Sensitivity Analyses",
                question=f"Do findings remain robust across patient subgroups and sensitivity scenarios in {topic}?",
                analysis_type="comparative",
                required_variables=_select_subgroup_vars(columns),
                rationale="Subgroup analyses assess heterogeneity of treatment effects and identify patient populations with differential benefit or risk profiles.",
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
        )

    # Filter to requested number (prioritize by order)
    ideas = ideas[:n]

    # Apply focus filter if provided
    if focus:
        ideas = _apply_focus(ideas, focus, topic)

    return {
        "run_id": run_id,
        "ready": True,
        "topic": topic,
        "ideas": [idea.to_dict() for idea in ideas],
        "metadata": {
            "columns_count": len(columns),
            "literature_count": len(literature_titles),
            "focus": focus,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "schema_version": "1.0.0",
        },
    }


def _generate_run_id(
    topic: str,
    columns: List[str],
    literature_titles: List[str],
    n: int,
    focus: Optional[str],
) -> str:
    """Generate deterministic run ID from inputs."""
    # Hash inputs for determinism
    hash_input = json.dumps(
        {
            "topic": topic,
            "columns": sorted(columns),
            "literature_titles": sorted(literature_titles),
            "n": n,
            "focus": focus,
        },
        sort_keys=True,
    )

    hash_digest = hashlib.sha256(hash_input.encode()).hexdigest()[:12]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    return f"ideation_online_{timestamp}_{hash_digest}"


def _select_demographic_vars(columns: List[str]) -> List[str]:
    """Select demographic variables from available columns."""
    demographic_patterns = [
        "age",
        "sex",
        "gender",
        "race",
        "ethnicity",
        "patient",
        "id",
        "cohort",
    ]

    selected = []
    for col in columns:
        col_lower = col.lower()
        if any(pattern in col_lower for pattern in demographic_patterns):
            selected.append(col)

    # Return first 5 or all available
    return selected[:5] if selected else columns[:5]


def _select_outcome_vars(columns: List[str]) -> List[str]:
    """Select outcome variables from available columns."""
    outcome_patterns = [
        "outcome",
        "mortality",
        "survival",
        "death",
        "event",
        "status",
        "diagnosis",
        "disease",
        "malignancy",
        "cancer",
    ]

    selected = []
    for col in columns:
        col_lower = col.lower()
        if any(pattern in col_lower for pattern in outcome_patterns):
            selected.append(col)

    return selected[:5] if selected else columns[:5]


def _select_predictor_vars(columns: List[str]) -> List[str]:
    """Select predictor variables from available columns."""
    predictor_patterns = [
        "age",
        "lab",
        "test",
        "value",
        "level",
        "score",
        "measure",
        "baseline",
        "pre",
    ]

    selected = []
    for col in columns:
        col_lower = col.lower()
        if any(pattern in col_lower for pattern in predictor_patterns):
            selected.append(col)

    return selected[:7] if selected else columns[:7]


def _select_survival_vars(columns: List[str]) -> List[str]:
    """Select survival-related variables from available columns."""
    survival_patterns = [
        "time",
        "duration",
        "followup",
        "follow_up",
        "days",
        "months",
        "years",
        "survival",
        "event",
        "status",
    ]

    selected = []
    for col in columns:
        col_lower = col.lower()
        if any(pattern in col_lower for pattern in survival_patterns):
            selected.append(col)

    return selected[:4] if selected else columns[:4]


def _select_lab_vars(columns: List[str]) -> List[str]:
    """Select laboratory variables from available columns."""
    lab_patterns = [
        "tsh",
        "t3",
        "t4",
        "thyroid",
        "lab",
        "test",
        "value",
        "level",
        "result",
        "measure",
    ]

    selected = []
    for col in columns:
        col_lower = col.lower()
        if any(pattern in col_lower for pattern in lab_patterns):
            selected.append(col)

    return selected[:6] if selected else columns[:6]


def _select_treatment_vars(columns: List[str]) -> List[str]:
    """Select treatment-related variables from available columns."""
    treatment_patterns = [
        "treatment",
        "therapy",
        "intervention",
        "medication",
        "drug",
        "procedure",
        "surgery",
        "operation",
    ]

    selected = []
    for col in columns:
        col_lower = col.lower()
        if any(pattern in col_lower for pattern in treatment_patterns):
            selected.append(col)

    return selected[:4] if selected else columns[:4]


def _select_quality_vars(columns: List[str]) -> List[str]:
    """Select data quality indicator variables."""
    # For quality assessment, we typically look at all variables
    return columns[:10]


def _select_core_vars(columns: List[str]) -> List[str]:
    """Select core variables (first available)."""
    return columns[:8]


def _select_subgroup_vars(columns: List[str]) -> List[str]:
    """Select variables for subgroup analysis."""
    subgroup_patterns = [
        "age",
        "sex",
        "gender",
        "group",
        "category",
        "type",
        "class",
        "stage",
    ]

    selected = []
    for col in columns:
        col_lower = col.lower()
        if any(pattern in col_lower for pattern in subgroup_patterns):
            selected.append(col)

    return selected[:5] if selected else columns[:5]


def _has_outcome_columns(columns: List[str]) -> bool:
    """Check if dataset has outcome-related columns."""
    outcome_patterns = ["outcome", "mortality", "survival", "death", "event", "status"]
    return any(
        any(pattern in col.lower() for pattern in outcome_patterns) for col in columns
    )


def _has_predictive_capability(columns: List[str]) -> bool:
    """Check if dataset supports predictive modeling."""
    # Need outcomes + predictors (>= 5 columns total)
    return len(columns) >= 5 and _has_outcome_columns(columns)


def _has_survival_columns(columns: List[str]) -> bool:
    """Check if dataset has survival analysis columns."""
    survival_patterns = ["time", "duration", "followup", "follow_up", "survival"]
    return any(
        any(pattern in col.lower() for pattern in survival_patterns) for col in columns
    )


def _has_lab_columns(columns: List[str]) -> bool:
    """Check if dataset has laboratory columns."""
    lab_patterns = ["tsh", "t3", "t4", "lab", "test", "value", "level"]
    return any(
        any(pattern in col.lower() for pattern in lab_patterns) for col in columns
    )


def _has_treatment_columns(columns: List[str]) -> bool:
    """Check if dataset has treatment-related columns."""
    treatment_patterns = [
        "treatment",
        "therapy",
        "intervention",
        "medication",
        "surgery",
    ]
    return any(
        any(pattern in col.lower() for pattern in treatment_patterns) for col in columns
    )


def _has_subgroup_capability(columns: List[str]) -> bool:
    """Check if dataset supports subgroup analysis."""
    subgroup_patterns = ["age", "sex", "gender", "group", "category", "type"]
    return any(
        any(pattern in col.lower() for pattern in subgroup_patterns) for col in columns
    )


def _apply_focus(
    ideas: List[ManuscriptIdea], focus: str, topic: str
) -> List[ManuscriptIdea]:
    """Apply focus constraint to refine idea questions and rationales."""
    focus_lower = focus.lower()

    # Refine questions to incorporate focus
    for idea in ideas:
        if focus_lower not in idea.question.lower():
            # Append focus to question
            idea.question = f"{idea.question.rstrip('?')} with emphasis on {focus}?"

        # Add focus note to rationale
        if focus_lower not in idea.rationale.lower():
            idea.rationale += f" (Focus: {focus})"

    return ideas


def write_ideation_artifacts(result: Dict[str, Any], output_dir: Path) -> None:
    """
    Write ideation artifacts to .tmp/ideation_online/{run_id}/.

    Args:
        result: Output from generate_manuscript_ideas()
        output_dir: Base directory (will create run_id subdirectory)
    """
    run_id = result["run_id"]
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    # Write manifest.json
    manifest = {
        "schema_version": "1.0.0",
        "run_id": run_id,
        "workflow": "online",
        "step": "ideation",
        "generated_at": result["metadata"]["generated_at"],
        "topic": result["topic"],
        "idea_count": len(result["ideas"]),
        "artifacts": ["manifest.json", "ideas.json"],
    }

    manifest_path = run_dir / "manifest.json"
    _write_json_atomic(manifest_path, manifest)

    # Write ideas.json
    ideas_data = {
        "run_id": run_id,
        "topic": result["topic"],
        "ideas": result["ideas"],
        "metadata": result["metadata"],
    }

    ideas_path = run_dir / "ideas.json"
    _write_json_atomic(ideas_path, ideas_data)

    print(f"✓ Wrote ideation artifacts to {run_dir}")


def _write_json_atomic(path: Path, payload: Dict[str, Any]) -> None:
    """Write JSON atomically using temp file + rename."""
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        tmp_path.replace(path)
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass

"""Template loader utilities for manuscript drafts.

This module exposes the same interface used by the Streamlit frontend while
remaining deterministic and offline-first for unit tests. YAML files are loaded
from synthetic fixtures under ``tests/web_frontend/templates`` first, then fall
back to the application templates shipped in ``web_frontend/templates``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import yaml
except ImportError as exc:  # pragma: no cover - dependency missing is fatal
    raise ImportError(
        "PyYAML is required to load manuscript templates. Install the 'web' extra"
        " or add PyYAML to your environment."
    ) from exc

REPO_ROOT = Path(__file__).resolve().parents[2]
TEST_TEMPLATE_DIR = REPO_ROOT / "tests" / "web_frontend" / "templates"
APP_TEMPLATE_DIR = REPO_ROOT / "web_frontend" / "templates"
DEFAULT_DRAFT_FILENAME = "draft_outline.yaml"


def _resolve_template_path(filename: str) -> Path:
    """Return the first existing template path for *filename*."""
    for base in (TEST_TEMPLATE_DIR, APP_TEMPLATE_DIR):
        candidate = base / filename
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        f"Unable to locate {filename}. Checked: {TEST_TEMPLATE_DIR} and {APP_TEMPLATE_DIR}"
    )


def _load_yaml(path: Path) -> Dict[str, Any]:
    """Load a YAML file and guarantee a dict result."""
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Template file {path} must contain a YAML mapping")
    return data


def load_draft_outline_config(config_path: Optional[Path] = None) -> Dict[str, Any]:
    """Load ``draft_outline.yaml`` from fixtures or app templates."""
    target = config_path or _resolve_template_path(DEFAULT_DRAFT_FILENAME)
    return _load_yaml(target)


def get_draft_types(config: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Return the raw draft type mapping with guaranteed dict values."""
    draft_types = config.get("draft_types", {})
    if not isinstance(draft_types, dict):
        return {}
    normalized: Dict[str, Dict[str, Any]] = {}
    for key, value in draft_types.items():
        if isinstance(value, dict):
            normalized[key] = value
        else:
            normalized[key] = {"name": str(value)}
    return normalized


def get_sections_for_type(config: Dict[str, Any], draft_type: str) -> List[str]:
    """Return the ordered section slugs for the requested draft type."""
    draft_types = get_draft_types(config)
    type_config = draft_types.get(draft_type, {})
    sections = type_config.get("sections", [])
    if not isinstance(sections, list):
        return []
    return [str(section) for section in sections]


def get_required_elements(config: Dict[str, Any], draft_type: str) -> List[str]:
    """Return required element identifiers for the draft type."""
    draft_types = get_draft_types(config)
    type_config = draft_types.get(draft_type, {})
    required = type_config.get("required_elements", [])
    if not isinstance(required, list):
        return []
    return [str(element) for element in required]


RUO_DRAFT_DISCLAIMER = (
    "---\n\n"
    "## ⚠️ Research Use Only Disclaimer\n\n"
    "This draft is generated inside the ROS Platform using synthetic data only.\n"
    "- No statistical results, p-values, or effect sizes are generated.\n"
    "- All quantitative outputs remain [PENDING] until validated analyses exist.\n"
    "- Human review is required before publishing or sharing externally.\n\n"
    "For additional details see docs/governance/RESEARCH_USE_ONLY_DISCLAIMER.md.\n"
    "---"
)


def generate_section_prompt(
    section: str,
    idea: Optional[Dict[str, Any]] = None,
    data_summary: Optional[Dict[str, Any]] = None,
    draft_type: str = "original_research",
) -> str:
    """Generate deterministic placeholder text for a section."""
    idea = idea or {}
    data_summary = data_summary or {}
    section_lower = section.lower()

    if "abstract" in section_lower:
        keywords = idea.get("key_variables", ["keyword1", "keyword2"])
        return (
            "**Background:** [Context on research gap]\n\n"
            f"**Objective:** {idea.get('description', '[Research objective]')}\n\n"
            "**Methods:** [Study design and analytical approach]\n\n"
            "**Results:** [PENDING — populated only after analysis phase]\n\n"
            "**Conclusions:** [PENDING — conclusions derived from results]\n\n"
            f"**Keywords:** {', '.join(keywords[:4])}"
        )

    if "introduction" in section_lower:
        return (
            "**Opening:** [Clinical/research significance]\n\n"
            f"**Gap:** {idea.get('description', '[Knowledge gap]')}\n\n"
            "**Prior Work:** [Relevant literature]\n\n"
            "**Objective:** This study aims to address the gap by..."
        )

    if "method" in section_lower:
        rows = data_summary.get("rows", "N")
        cols = data_summary.get("columns", "M")
        variables = idea.get("key_variables", ["Variable 1", "Variable 2"])
        formatted_vars = "\n".join(f"- {var}" for var in variables)
        return (
            f"**Study Design:** [Study type per {draft_type.replace('_', ' ')}]\n\n"
            "**Data Source:** Dataset validated via ROS Platform\n"
            f"- Rows: {rows}\n"
            f"- Variables: {cols}\n"
            "- Validation: Schema checks applied\n\n"
            "**Key Variables:**\n"
            f"{formatted_vars}\n\n"
            "**Statistical Analysis:**\n- [Specific methods per study design]\n\n"
            "**Governance:**\n- Data validated against ROS schemas\n- Provenance logged per platform compliance"
        )

    if "result" in section_lower:
        return (
            "**Summary Statistics:**\n[PENDING — populated only after analysis phase]\n\n"
            "**Primary Outcome:** [PENDING — to be defined based on analysis]\n\n"
            "**Secondary Outcomes:** [PENDING — additional findings]\n\n"
            "**Note:** This is a STANDBY-mode template. No statistical results have been generated."
        )

    if "discussion" in section_lower:
        return (
            "**Key Findings:**\n- [Finding 1]\n- [Finding 2]\n\n"
            "**Comparison to Literature:**\n- [Relation to prior work]\n\n"
            "**Limitations:**\n- Retrospective design\n- [Other limitations]\n\n"
            "**Clinical Implications:**\n- [Research context only]\n\n"
            "**Future Directions:**\n- [Next steps]"
        )

    if "conclusion" in section_lower:
        return (
            "**Summary:** [Brief summary of main findings]\n\n"
            "**Implications:** [Research implications — not clinical recommendations]\n\n"
            "**Future Work:** [Directions for future research]\n\n"
            "[PENDING — conclusions require validated analyses]"
        )

    if "reference" in section_lower:
        return (
            "**References:**\n\n1. [Reference 1]\n2. [Reference 2]\n3. [Reference 3]\n\n"
            "*References will be populated after literature review.*"
        )

    return (
        f"[Content placeholder for {section}]\n\n"
        "[PENDING — to be populated once validated outputs are available]"
    )

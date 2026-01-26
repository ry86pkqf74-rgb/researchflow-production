"""
Accessibility Rule Definitions

This module defines the accessibility rules checked during export validation.
Rules are inspired by WCAG guidelines and adapted for research document exports.

Rules:
- RULE_IMG_ALT: All images must have alt text
- RULE_HEADING_HIERARCHY: Headings must not skip levels
- RULE_TABLE_HEADERS: Tables must have th or caption
- RULE_LINK_TEXT: Links must have descriptive text
- RULE_COLOR_CONTRAST: Flag potential contrast issues (warning only)

Last Updated: 2026-01-20
"""

from dataclasses import dataclass
from typing import Literal, Callable, Any, Optional


@dataclass(frozen=True)
class AccessibilityRule:
    """
    Definition of an accessibility rule.

    Attributes:
        rule_id: Unique identifier for the rule
        name: Human-readable name
        description: Detailed description of what the rule checks
        severity: Default severity when violated ("error" or "warning")
        wcag_ref: Optional WCAG reference (e.g., "1.1.1")
        remediation_template: Template for remediation instructions
    """

    rule_id: str
    name: str
    description: str
    severity: Literal["error", "warning"]
    wcag_ref: Optional[str] = None
    remediation_template: str = ""

    def get_remediation(self, context: str = "") -> str:
        """Get remediation message, optionally with context."""
        if context and "{context}" in self.remediation_template:
            return self.remediation_template.format(context=context)
        return self.remediation_template


# =============================================================================
# Rule Definitions
# =============================================================================

RULE_IMG_ALT = AccessibilityRule(
    rule_id="IMG_ALT",
    name="Image Alt Text",
    description=(
        "All images and artifact embeds must have alternative text (alt text) "
        "that describes the content or purpose of the image. This ensures that "
        "users who cannot see images can understand their content through "
        "screen readers or other assistive technologies."
    ),
    severity="error",
    wcag_ref="1.1.1",
    remediation_template=(
        "Add descriptive alt text to the image or artifact embed. "
        "The alt text should convey the same information or purpose as the image. "
        "For decorative images, use an empty alt attribute (alt=\"\")."
    ),
)

RULE_HEADING_HIERARCHY = AccessibilityRule(
    rule_id="HEADING_HIERARCHY",
    name="Heading Hierarchy",
    description=(
        "Headings must follow a hierarchical structure without skipping levels. "
        "For example, an H3 must be preceded by an H2, which must be preceded by "
        "an H1. This helps users navigate the document structure, especially when "
        "using assistive technologies."
    ),
    severity="error",
    wcag_ref="1.3.1",
    remediation_template=(
        "Adjust the heading levels to follow a logical hierarchy. "
        "Do not skip heading levels (e.g., do not jump from H1 to H3). "
        "Each section should use the appropriate heading level based on its "
        "position in the document structure."
    ),
)

RULE_TABLE_HEADERS = AccessibilityRule(
    rule_id="TABLE_HEADERS",
    name="Table Headers",
    description=(
        "Data tables must have header cells (th elements) or a caption to help "
        "users understand the table structure and content. Header cells should "
        "be used to identify row and column headers."
    ),
    severity="error",
    wcag_ref="1.3.1",
    remediation_template=(
        "Add header cells (th elements) to identify row or column headers. "
        "Alternatively, add a caption element to describe the table's purpose. "
        "For complex tables, consider using scope attributes on th elements."
    ),
)

RULE_LINK_TEXT = AccessibilityRule(
    rule_id="LINK_TEXT",
    name="Link Text",
    description=(
        "Links must have descriptive text that indicates the purpose or "
        "destination of the link. Generic text like 'click here' or 'read more' "
        "does not provide sufficient context for users of assistive technologies."
    ),
    severity="warning",
    wcag_ref="2.4.4",
    remediation_template=(
        "Replace generic link text with descriptive text that indicates where "
        "the link goes or what action it performs. For example, instead of "
        "'click here', use 'download the research protocol PDF'."
    ),
)

RULE_COLOR_CONTRAST = AccessibilityRule(
    rule_id="COLOR_CONTRAST",
    name="Color Contrast",
    description=(
        "Text and interactive elements should have sufficient color contrast "
        "against their background to be readable by users with low vision or "
        "color blindness. This rule flags potential contrast issues for review."
    ),
    severity="warning",
    wcag_ref="1.4.3",
    remediation_template=(
        "Review the flagged element for color contrast. Ensure text has a "
        "contrast ratio of at least 4.5:1 for normal text and 3:1 for large text. "
        "Use a color contrast checker tool to verify compliance."
    ),
)


# =============================================================================
# Rule Registry
# =============================================================================

# All rules in order of checking
ALL_RULES = [
    RULE_IMG_ALT,
    RULE_HEADING_HIERARCHY,
    RULE_TABLE_HEADERS,
    RULE_LINK_TEXT,
    RULE_COLOR_CONTRAST,
]

# Error-level rules (block export in STRICT mode)
ERROR_RULES = [rule for rule in ALL_RULES if rule.severity == "error"]

# Warning-level rules (never block export)
WARNING_RULES = [rule for rule in ALL_RULES if rule.severity == "warning"]

# Rule lookup by ID
RULES_BY_ID = {rule.rule_id: rule for rule in ALL_RULES}


def get_rule(rule_id: str) -> Optional[AccessibilityRule]:
    """
    Get a rule by its ID.

    Args:
        rule_id: The rule identifier (e.g., "IMG_ALT")

    Returns:
        The AccessibilityRule or None if not found
    """
    return RULES_BY_ID.get(rule_id)


def get_all_rule_ids() -> list[str]:
    """Get list of all rule IDs."""
    return list(RULES_BY_ID.keys())

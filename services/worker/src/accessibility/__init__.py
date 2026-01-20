"""
Export Accessibility Validation Module

This module provides comprehensive accessibility validation for export documents,
ensuring compliance with accessibility standards (WCAG-inspired checks).

Core Components:
- AccessibilityChecker: Main checker class for document validation
- AccessibilityReport: Machine-readable report dataclass
- AccessibilityIssue: Individual issue representation
- AccessibilityWarning: Warning representation
- AccessibilityMode: STRICT vs WARN mode control

Rules Checked:
- IMG_ALT: All images/artifacts must have alt text
- HEADING_HIERARCHY: Headings must not skip levels (H1 > H2 > H3)
- TABLE_HEADERS: Tables must have th elements or caption
- LINK_TEXT: Links must have descriptive text
- COLOR_CONTRAST: Flag potential contrast issues (warning only)

Usage:
    from src.accessibility import AccessibilityChecker, AccessibilityMode

    checker = AccessibilityChecker()
    report = checker.check_document(content)

    if not report.passed:
        for issue in report.issues:
            print(f"{issue.rule_id}: {issue.message}")

Last Updated: 2026-01-20
"""

from .report import (
    AccessibilityReport,
    AccessibilityIssue,
    AccessibilityWarning,
)
from .rules import (
    RULE_IMG_ALT,
    RULE_HEADING_HIERARCHY,
    RULE_TABLE_HEADERS,
    RULE_LINK_TEXT,
    RULE_COLOR_CONTRAST,
    AccessibilityRule,
)
from .checker import AccessibilityChecker
from .integration import (
    AccessibilityMode,
    validate_export_accessibility,
    ExportAccessibilityError,
)

__all__ = [
    # Report classes
    "AccessibilityReport",
    "AccessibilityIssue",
    "AccessibilityWarning",
    # Rules
    "AccessibilityRule",
    "RULE_IMG_ALT",
    "RULE_HEADING_HIERARCHY",
    "RULE_TABLE_HEADERS",
    "RULE_LINK_TEXT",
    "RULE_COLOR_CONTRAST",
    # Checker
    "AccessibilityChecker",
    # Integration
    "AccessibilityMode",
    "validate_export_accessibility",
    "ExportAccessibilityError",
]

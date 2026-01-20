"""
Accessibility Report Dataclasses

This module defines the data structures for accessibility validation reports.
Reports are stored as artifacts with kind=accessibility_report.

Last Updated: 2026-01-20
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Literal, Optional, Dict, Any
import json
import hashlib


@dataclass
class AccessibilityIssue:
    """
    Represents a single accessibility violation.

    Attributes:
        rule_id: Unique rule identifier (e.g., "IMG_ALT", "HEADING_HIERARCHY")
        severity: Issue severity level - "error" blocks export in STRICT mode
        message: Human-readable description of the issue
        location: Section/element reference (no content - for security)
        remediation: How to fix the issue
    """

    rule_id: str
    severity: Literal["error", "warning"]
    message: str
    location: str
    remediation: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AccessibilityIssue":
        """Create from dictionary."""
        return cls(
            rule_id=data["rule_id"],
            severity=data["severity"],
            message=data["message"],
            location=data["location"],
            remediation=data["remediation"],
        )


@dataclass
class AccessibilityWarning:
    """
    Represents a non-blocking accessibility warning.

    Warnings do not block export but are included in reports for awareness.
    Typically used for recommendations or potential issues that need human review.

    Attributes:
        rule_id: Unique rule identifier
        message: Human-readable warning description
        location: Section/element reference (no content)
        suggestion: Optional suggestion for improvement
    """

    rule_id: str
    message: str
    location: str
    suggestion: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AccessibilityWarning":
        """Create from dictionary."""
        return cls(
            rule_id=data["rule_id"],
            message=data["message"],
            location=data["location"],
            suggestion=data.get("suggestion"),
        )


@dataclass
class AccessibilityReport:
    """
    Complete accessibility validation report.

    This report is stored as an artifact with kind=accessibility_report.
    It provides a machine-readable summary of all accessibility checks
    performed on a document during export.

    Attributes:
        passed: True if no errors (warnings may still exist)
        issues: List of accessibility violations (errors and warnings with severity=error)
        warnings: List of non-blocking warnings
        checked_at: ISO 8601 timestamp of validation
        document_id: Identifier of the validated document
        rules_checked: List of rule IDs that were evaluated
        summary: Quick summary statistics
    """

    passed: bool
    issues: List[AccessibilityIssue] = field(default_factory=list)
    warnings: List[AccessibilityWarning] = field(default_factory=list)
    checked_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    document_id: str = ""
    rules_checked: List[str] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Compute summary statistics after initialization."""
        if not self.summary:
            self._compute_summary()

    def _compute_summary(self) -> None:
        """Compute summary statistics."""
        error_count = sum(1 for issue in self.issues if issue.severity == "error")
        warning_count = len(self.warnings) + sum(
            1 for issue in self.issues if issue.severity == "warning"
        )

        issues_by_rule: Dict[str, int] = {}
        for issue in self.issues:
            issues_by_rule[issue.rule_id] = issues_by_rule.get(issue.rule_id, 0) + 1

        self.summary = {
            "total_issues": len(self.issues),
            "error_count": error_count,
            "warning_count": warning_count,
            "rules_with_issues": list(issues_by_rule.keys()),
            "issues_by_rule": issues_by_rule,
        }

    def add_issue(self, issue: AccessibilityIssue) -> None:
        """Add an issue and update passed status."""
        self.issues.append(issue)
        if issue.severity == "error":
            self.passed = False
        self._compute_summary()

    def add_warning(self, warning: AccessibilityWarning) -> None:
        """Add a warning (does not affect passed status)."""
        self.warnings.append(warning)
        self._compute_summary()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "kind": "accessibility_report",
            "passed": self.passed,
            "issues": [issue.to_dict() for issue in self.issues],
            "warnings": [warning.to_dict() for warning in self.warnings],
            "checked_at": self.checked_at,
            "document_id": self.document_id,
            "rules_checked": self.rules_checked,
            "summary": self.summary,
        }

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AccessibilityReport":
        """Create from dictionary."""
        return cls(
            passed=data["passed"],
            issues=[AccessibilityIssue.from_dict(i) for i in data.get("issues", [])],
            warnings=[
                AccessibilityWarning.from_dict(w) for w in data.get("warnings", [])
            ],
            checked_at=data.get("checked_at", datetime.utcnow().isoformat()),
            document_id=data.get("document_id", ""),
            rules_checked=data.get("rules_checked", []),
            summary=data.get("summary", {}),
        )

    @classmethod
    def from_json(cls, json_str: str) -> "AccessibilityReport":
        """Deserialize from JSON string."""
        return cls.from_dict(json.loads(json_str))

    def get_artifact_id(self) -> str:
        """
        Generate a unique artifact ID for this report.

        Uses document_id and timestamp to create a deterministic hash.
        """
        content = f"{self.document_id}:{self.checked_at}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def human_summary(self) -> str:
        """Generate a human-readable summary."""
        if self.passed and not self.warnings:
            return f"Accessibility check passed for document {self.document_id}"

        lines = []
        if self.passed:
            lines.append(
                f"Accessibility check passed with {len(self.warnings)} warning(s)"
            )
        else:
            error_count = self.summary.get("error_count", 0)
            lines.append(
                f"Accessibility check FAILED: {error_count} error(s) found"
            )

        if self.issues:
            lines.append("\nIssues:")
            for issue in self.issues:
                lines.append(f"  [{issue.severity.upper()}] {issue.rule_id}: {issue.message}")
                lines.append(f"    Location: {issue.location}")
                lines.append(f"    Fix: {issue.remediation}")

        if self.warnings:
            lines.append("\nWarnings:")
            for warning in self.warnings:
                lines.append(f"  [WARN] {warning.rule_id}: {warning.message}")
                if warning.suggestion:
                    lines.append(f"    Suggestion: {warning.suggestion}")

        return "\n".join(lines)

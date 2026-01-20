"""
Accessibility Validation Tests

Tests for the accessibility checker, report generation, and export integration.

Test coverage:
- Image alt text detection
- Heading hierarchy validation
- Table header detection
- STRICT vs WARN mode behavior
- Report artifact generation

Last Updated: 2026-01-20
"""

import pytest
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

from ..checker import AccessibilityChecker
from ..report import AccessibilityReport, AccessibilityIssue, AccessibilityWarning
from ..rules import (
    RULE_IMG_ALT,
    RULE_HEADING_HIERARCHY,
    RULE_TABLE_HEADERS,
    RULE_LINK_TEXT,
    RULE_COLOR_CONTRAST,
    get_rule,
    get_all_rule_ids,
)
from ..integration import (
    AccessibilityMode,
    validate_export_accessibility,
    ExportAccessibilityError,
    get_accessibility_mode,
    ExportAccessibilityHook,
)


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def checker() -> AccessibilityChecker:
    """Create a default accessibility checker."""
    return AccessibilityChecker()


@pytest.fixture
def valid_document() -> Dict[str, Any]:
    """Create a valid document that passes all accessibility checks."""
    return {
        "sections": [
            {
                "title": "Introduction",
                "level": 1,
                "heading": "Introduction",
                "images": [
                    {"alt": "Research methodology diagram", "src": "method.png"},
                ],
                "tables": [
                    {
                        "headers": ["Variable", "Mean", "SD"],
                        "caption": "Table 1: Baseline characteristics",
                        "rows": [["Age", "54.3", "12.8"]],
                    }
                ],
                "links": [
                    {"text": "Download the full protocol document", "href": "/protocol.pdf"},
                ],
            },
            {
                "title": "Methods",
                "level": 2,
                "heading": "Methods",
                "images": [
                    {"alt": "Study flow chart showing participant selection", "src": "flow.png"},
                ],
            },
        ],
        "artifacts": [
            {"alt": "Figure 1: Kaplan-Meier survival curve", "kind": "figure", "id": "fig-1"},
        ],
    }


@pytest.fixture
def invalid_document_missing_alt() -> Dict[str, Any]:
    """Create a document with missing alt text."""
    return {
        "sections": [
            {
                "title": "Results",
                "level": 1,
                "images": [
                    {"src": "chart.png"},  # Missing alt
                    {"alt": "", "src": "graph.png"},  # Empty alt
                ],
            },
        ],
        "artifacts": [
            {"kind": "figure", "id": "fig-2"},  # Missing alt
        ],
    }


@pytest.fixture
def invalid_document_heading_hierarchy() -> Dict[str, Any]:
    """Create a document with heading hierarchy issues."""
    return {
        "sections": [
            {"title": "Introduction", "level": 1, "heading": "Introduction"},
            {"title": "Results", "level": 3, "heading": "Results"},  # Skips H2
            {"title": "Discussion", "level": 2, "heading": "Discussion"},
        ],
    }


@pytest.fixture
def invalid_document_table_headers() -> Dict[str, Any]:
    """Create a document with tables missing headers."""
    return {
        "sections": [
            {
                "title": "Data",
                "level": 1,
                "tables": [
                    {
                        "rows": [["A", "B"], ["C", "D"]],  # No headers or caption
                    },
                ],
            },
        ],
    }


@pytest.fixture
def document_with_generic_links() -> Dict[str, Any]:
    """Create a document with generic link text."""
    return {
        "sections": [
            {
                "title": "References",
                "level": 1,
                "links": [
                    {"text": "click here", "href": "/doc1.pdf"},
                    {"text": "Read More", "href": "/doc2.pdf"},
                    {"text": "here", "href": "/doc3.pdf"},
                ],
            },
        ],
    }


@pytest.fixture
def temp_artifact_dir(tmp_path: Path) -> Path:
    """Create a temporary directory for artifact storage."""
    artifact_dir = tmp_path / "artifacts"
    artifact_dir.mkdir()
    return artifact_dir


# =============================================================================
# Image Alt Text Detection Tests
# =============================================================================


class TestImageAltTextDetection:
    """Tests for IMG_ALT rule detection."""

    def test_valid_alt_text_passes(
        self, checker: AccessibilityChecker, valid_document: Dict[str, Any]
    ) -> None:
        """Documents with proper alt text should pass."""
        report = checker.check_document(valid_document, document_id="test-doc")

        # Should not have any IMG_ALT errors
        img_alt_errors = [i for i in report.issues if i.rule_id == "IMG_ALT"]
        assert len(img_alt_errors) == 0, f"Unexpected IMG_ALT errors: {img_alt_errors}"

    def test_missing_alt_text_detected(
        self, checker: AccessibilityChecker, invalid_document_missing_alt: Dict[str, Any]
    ) -> None:
        """Missing alt text should be detected as error."""
        report = checker.check_document(invalid_document_missing_alt, document_id="test-doc")

        img_alt_errors = [i for i in report.issues if i.rule_id == "IMG_ALT"]
        assert len(img_alt_errors) >= 3, "Should detect at least 3 missing alt texts"

        # Report should not pass
        assert report.passed is False

    def test_empty_alt_text_detected(self, checker: AccessibilityChecker) -> None:
        """Empty alt text should be detected."""
        content = {
            "sections": [
                {
                    "title": "Test",
                    "images": [{"alt": "   ", "src": "test.png"}],  # Whitespace only
                },
            ],
        }

        report = checker.check_document(content)
        img_alt_errors = [i for i in report.issues if i.rule_id == "IMG_ALT"]
        assert len(img_alt_errors) == 1

    def test_artifact_alt_text_checked(self, checker: AccessibilityChecker) -> None:
        """Artifact embeds should also be checked for alt text."""
        content = {
            "artifacts": [
                {"kind": "chart", "id": "chart-1"},  # Missing alt
            ],
        }

        report = checker.check_document(content)
        img_alt_errors = [i for i in report.issues if i.rule_id == "IMG_ALT"]
        assert len(img_alt_errors) == 1
        assert "artifact" in img_alt_errors[0].message.lower()

    def test_alt_text_issue_has_correct_structure(
        self, checker: AccessibilityChecker
    ) -> None:
        """IMG_ALT issues should have proper structure."""
        content = {
            "sections": [
                {"title": "Test", "images": [{"src": "test.png"}]},
            ],
        }

        report = checker.check_document(content)
        issue = report.issues[0]

        assert issue.rule_id == "IMG_ALT"
        assert issue.severity == "error"
        assert issue.location is not None
        assert issue.remediation is not None
        assert len(issue.remediation) > 0


# =============================================================================
# Heading Hierarchy Validation Tests
# =============================================================================


class TestHeadingHierarchyValidation:
    """Tests for HEADING_HIERARCHY rule validation."""

    def test_proper_hierarchy_passes(
        self, checker: AccessibilityChecker, valid_document: Dict[str, Any]
    ) -> None:
        """Proper heading hierarchy should pass."""
        report = checker.check_document(valid_document)

        hierarchy_errors = [i for i in report.issues if i.rule_id == "HEADING_HIERARCHY"]
        assert len(hierarchy_errors) == 0

    def test_skipped_level_detected(
        self, checker: AccessibilityChecker, invalid_document_heading_hierarchy: Dict[str, Any]
    ) -> None:
        """Skipped heading levels should be detected."""
        report = checker.check_document(invalid_document_heading_hierarchy)

        hierarchy_errors = [i for i in report.issues if i.rule_id == "HEADING_HIERARCHY"]
        assert len(hierarchy_errors) >= 1
        assert "H1" in hierarchy_errors[0].message and "H3" in hierarchy_errors[0].message

    def test_h1_to_h2_valid(self, checker: AccessibilityChecker) -> None:
        """H1 followed by H2 is valid."""
        content = {
            "sections": [
                {"title": "Main", "level": 1, "heading": "Main"},
                {"title": "Sub", "level": 2, "heading": "Sub"},
            ],
        }

        report = checker.check_document(content)
        hierarchy_errors = [i for i in report.issues if i.rule_id == "HEADING_HIERARCHY"]
        assert len(hierarchy_errors) == 0

    def test_h2_to_h4_invalid(self, checker: AccessibilityChecker) -> None:
        """H2 followed by H4 (skipping H3) is invalid."""
        content = {
            "sections": [
                {"title": "Intro", "level": 2, "heading": "Intro"},
                {"title": "Details", "level": 4, "heading": "Details"},
            ],
        }

        report = checker.check_document(content)
        hierarchy_errors = [i for i in report.issues if i.rule_id == "HEADING_HIERARCHY"]
        assert len(hierarchy_errors) == 1
        assert "H2" in hierarchy_errors[0].message and "H4" in hierarchy_errors[0].message

    def test_decreasing_levels_valid(self, checker: AccessibilityChecker) -> None:
        """Decreasing heading levels (H3 to H2) is valid (going back up)."""
        content = {
            "sections": [
                {"title": "Main", "level": 1, "heading": "Main"},
                {"title": "Sub", "level": 2, "heading": "Sub"},
                {"title": "SubSub", "level": 3, "heading": "SubSub"},
                {"title": "Another", "level": 2, "heading": "Another"},  # Back to H2
            ],
        }

        report = checker.check_document(content)
        hierarchy_errors = [i for i in report.issues if i.rule_id == "HEADING_HIERARCHY"]
        assert len(hierarchy_errors) == 0


# =============================================================================
# Table Header Detection Tests
# =============================================================================


class TestTableHeaderDetection:
    """Tests for TABLE_HEADERS rule detection."""

    def test_table_with_headers_passes(
        self, checker: AccessibilityChecker, valid_document: Dict[str, Any]
    ) -> None:
        """Tables with headers should pass."""
        report = checker.check_document(valid_document)

        table_errors = [i for i in report.issues if i.rule_id == "TABLE_HEADERS"]
        assert len(table_errors) == 0

    def test_table_without_headers_detected(
        self, checker: AccessibilityChecker, invalid_document_table_headers: Dict[str, Any]
    ) -> None:
        """Tables without headers or caption should be detected."""
        report = checker.check_document(invalid_document_table_headers)

        table_errors = [i for i in report.issues if i.rule_id == "TABLE_HEADERS"]
        assert len(table_errors) == 1
        assert report.passed is False

    def test_table_with_caption_only_passes(self, checker: AccessibilityChecker) -> None:
        """Tables with caption (but no headers) should pass."""
        content = {
            "sections": [
                {
                    "title": "Data",
                    "tables": [
                        {
                            "caption": "Table 1: Data summary",
                            "rows": [["A", "B"], ["C", "D"]],
                        },
                    ],
                },
            ],
        }

        report = checker.check_document(content)
        table_errors = [i for i in report.issues if i.rule_id == "TABLE_HEADERS"]
        assert len(table_errors) == 0

    def test_table_with_has_th_passes(self, checker: AccessibilityChecker) -> None:
        """Tables marked as having th elements should pass."""
        content = {
            "sections": [
                {
                    "title": "Data",
                    "tables": [
                        {
                            "has_th": True,
                            "rows": [["Col1", "Col2"], ["A", "B"]],
                        },
                    ],
                },
            ],
        }

        report = checker.check_document(content)
        table_errors = [i for i in report.issues if i.rule_id == "TABLE_HEADERS"]
        assert len(table_errors) == 0


# =============================================================================
# Link Text Tests
# =============================================================================


class TestLinkTextValidation:
    """Tests for LINK_TEXT rule validation."""

    def test_descriptive_link_text_passes(
        self, checker: AccessibilityChecker, valid_document: Dict[str, Any]
    ) -> None:
        """Descriptive link text should pass."""
        report = checker.check_document(valid_document)

        link_warnings = [w for w in report.warnings if w.rule_id == "LINK_TEXT"]
        assert len(link_warnings) == 0

    def test_generic_link_text_warned(
        self, checker: AccessibilityChecker, document_with_generic_links: Dict[str, Any]
    ) -> None:
        """Generic link text should generate warnings."""
        report = checker.check_document(document_with_generic_links)

        link_warnings = [w for w in report.warnings if w.rule_id == "LINK_TEXT"]
        assert len(link_warnings) >= 3

    def test_link_text_is_warning_not_error(
        self, checker: AccessibilityChecker, document_with_generic_links: Dict[str, Any]
    ) -> None:
        """Link text issues should be warnings, not errors."""
        report = checker.check_document(document_with_generic_links)

        # Link issues should be warnings
        link_issues = [i for i in report.issues if i.rule_id == "LINK_TEXT"]
        assert len(link_issues) == 0

        # Report should still pass (warnings don't fail)
        assert report.passed is True


# =============================================================================
# STRICT vs WARN Mode Tests
# =============================================================================


class TestStrictVsWarnMode:
    """Tests for STRICT and WARN mode behavior."""

    def test_strict_mode_blocks_on_errors(
        self, invalid_document_missing_alt: Dict[str, Any]
    ) -> None:
        """STRICT mode should raise exception on errors."""
        with pytest.raises(ExportAccessibilityError) as exc_info:
            validate_export_accessibility(
                content=invalid_document_missing_alt,
                document_id="test-doc",
                mode_override=AccessibilityMode.STRICT,
            )

        assert exc_info.value.report is not None
        assert exc_info.value.report.passed is False

    def test_strict_mode_passes_valid_document(
        self, valid_document: Dict[str, Any]
    ) -> None:
        """STRICT mode should pass valid documents."""
        report, allowed = validate_export_accessibility(
            content=valid_document,
            document_id="test-doc",
            mode_override=AccessibilityMode.STRICT,
        )

        assert allowed is True
        assert report.passed is True

    def test_warn_mode_allows_errors(
        self, invalid_document_missing_alt: Dict[str, Any]
    ) -> None:
        """WARN mode should allow export despite errors."""
        report, allowed = validate_export_accessibility(
            content=invalid_document_missing_alt,
            document_id="test-doc",
            mode_override=AccessibilityMode.WARN,
        )

        assert allowed is True  # Export allowed
        assert report.passed is False  # But report shows failures
        assert len(report.issues) > 0

    def test_template_mode_setting(self) -> None:
        """Template accessibility_mode should be respected."""
        template_strict = {"accessibility_mode": "strict"}
        template_warn = {"accessibility_mode": "warn"}

        assert get_accessibility_mode(template_strict) == AccessibilityMode.STRICT
        assert get_accessibility_mode(template_warn) == AccessibilityMode.WARN

    def test_live_mode_enforcement(self) -> None:
        """LIVE mode with live_enforce_strict should upgrade to STRICT."""
        template = {
            "accessibility_mode": "warn",
            "live_enforce_strict": True,
        }

        mode = get_accessibility_mode(template, is_live=True)
        assert mode == AccessibilityMode.STRICT

    def test_live_mode_without_enforcement(self) -> None:
        """LIVE mode without enforcement should respect template setting."""
        template = {
            "accessibility_mode": "warn",
            "live_enforce_strict": False,
        }

        mode = get_accessibility_mode(template, is_live=True)
        assert mode == AccessibilityMode.WARN

    def test_default_mode_is_warn(self) -> None:
        """Default mode (no template) should be WARN."""
        mode = get_accessibility_mode(None)
        assert mode == AccessibilityMode.WARN


# =============================================================================
# Report Artifact Generation Tests
# =============================================================================


class TestReportArtifactGeneration:
    """Tests for accessibility report artifact generation."""

    def test_report_to_dict(self, valid_document: Dict[str, Any]) -> None:
        """Report should serialize to dict correctly."""
        checker = AccessibilityChecker()
        report = checker.check_document(valid_document, document_id="doc-123")

        report_dict = report.to_dict()

        assert report_dict["kind"] == "accessibility_report"
        assert report_dict["passed"] is True
        assert report_dict["document_id"] == "doc-123"
        assert "checked_at" in report_dict
        assert "rules_checked" in report_dict
        assert "summary" in report_dict

    def test_report_to_json(self, valid_document: Dict[str, Any]) -> None:
        """Report should serialize to valid JSON."""
        checker = AccessibilityChecker()
        report = checker.check_document(valid_document)

        json_str = report.to_json()
        parsed = json.loads(json_str)

        assert parsed["kind"] == "accessibility_report"
        assert isinstance(parsed["issues"], list)
        assert isinstance(parsed["warnings"], list)

    def test_report_from_json_roundtrip(
        self, invalid_document_missing_alt: Dict[str, Any]
    ) -> None:
        """Report should survive JSON serialization roundtrip."""
        checker = AccessibilityChecker()
        original = checker.check_document(invalid_document_missing_alt, document_id="test")

        json_str = original.to_json()
        restored = AccessibilityReport.from_json(json_str)

        assert restored.passed == original.passed
        assert restored.document_id == original.document_id
        assert len(restored.issues) == len(original.issues)
        assert len(restored.warnings) == len(original.warnings)

    def test_report_artifact_saved(
        self,
        temp_artifact_dir: Path,
        invalid_document_missing_alt: Dict[str, Any],
    ) -> None:
        """Report artifact should be saved to specified directory."""
        report, _ = validate_export_accessibility(
            content=invalid_document_missing_alt,
            document_id="artifact-test",
            mode_override=AccessibilityMode.WARN,
            artifact_dir=temp_artifact_dir,
        )

        # Check that artifact file was created
        artifact_files = list(temp_artifact_dir.glob("accessibility_report_*.json"))
        assert len(artifact_files) == 1

        # Verify content
        artifact_content = json.loads(artifact_files[0].read_text())
        assert artifact_content["kind"] == "accessibility_report"
        assert artifact_content["document_id"] == "artifact-test"

    def test_report_artifact_id_generation(self) -> None:
        """Report artifact ID should be deterministic."""
        report1 = AccessibilityReport(
            passed=True,
            document_id="doc-1",
            checked_at="2026-01-20T12:00:00",
        )
        report2 = AccessibilityReport(
            passed=True,
            document_id="doc-1",
            checked_at="2026-01-20T12:00:00",
        )

        # Same inputs should produce same ID
        assert report1.get_artifact_id() == report2.get_artifact_id()

        # Different inputs should produce different ID
        report3 = AccessibilityReport(
            passed=True,
            document_id="doc-2",
            checked_at="2026-01-20T12:00:00",
        )
        assert report1.get_artifact_id() != report3.get_artifact_id()

    def test_report_summary_statistics(
        self, invalid_document_missing_alt: Dict[str, Any]
    ) -> None:
        """Report summary should include correct statistics."""
        checker = AccessibilityChecker()
        report = checker.check_document(invalid_document_missing_alt)

        assert "total_issues" in report.summary
        assert "error_count" in report.summary
        assert "warning_count" in report.summary
        assert "issues_by_rule" in report.summary

        assert report.summary["total_issues"] > 0
        assert report.summary["error_count"] > 0

    def test_issue_structure(self, invalid_document_missing_alt: Dict[str, Any]) -> None:
        """Issues should have required fields."""
        checker = AccessibilityChecker()
        report = checker.check_document(invalid_document_missing_alt)

        for issue in report.issues:
            assert issue.rule_id is not None
            assert issue.severity in ("error", "warning")
            assert issue.message is not None
            assert issue.location is not None
            assert issue.remediation is not None

    def test_warning_structure(
        self, document_with_generic_links: Dict[str, Any]
    ) -> None:
        """Warnings should have required fields."""
        checker = AccessibilityChecker()
        report = checker.check_document(document_with_generic_links)

        for warning in report.warnings:
            assert warning.rule_id is not None
            assert warning.message is not None
            assert warning.location is not None


# =============================================================================
# Integration Hook Tests
# =============================================================================


class TestExportAccessibilityHook:
    """Tests for the export accessibility hook."""

    def test_hook_pre_export_valid(self, valid_document: Dict[str, Any]) -> None:
        """Hook should return report for valid document."""
        hook = ExportAccessibilityHook(mode=AccessibilityMode.WARN)
        report = hook.pre_export(valid_document, document_id="hook-test")

        assert report.passed is True
        assert hook.get_last_report() is report

    def test_hook_pre_export_strict_raises(
        self, invalid_document_missing_alt: Dict[str, Any]
    ) -> None:
        """Hook with STRICT mode should raise on errors."""
        hook = ExportAccessibilityHook(mode=AccessibilityMode.STRICT)

        with pytest.raises(ExportAccessibilityError):
            hook.pre_export(invalid_document_missing_alt, document_id="hook-test")

    def test_hook_saves_artifact(
        self,
        temp_artifact_dir: Path,
        valid_document: Dict[str, Any],
    ) -> None:
        """Hook with artifact_dir should save report artifact."""
        hook = ExportAccessibilityHook(
            mode=AccessibilityMode.WARN,
            artifact_dir=temp_artifact_dir,
        )
        hook.pre_export(valid_document, document_id="hook-artifact-test")

        artifact_files = list(temp_artifact_dir.glob("accessibility_report_*.json"))
        assert len(artifact_files) == 1


# =============================================================================
# Rule Definition Tests
# =============================================================================


class TestRuleDefinitions:
    """Tests for rule definitions."""

    def test_all_rules_have_required_fields(self) -> None:
        """All rules should have required fields."""
        from ..rules import ALL_RULES

        for rule in ALL_RULES:
            assert rule.rule_id is not None
            assert rule.name is not None
            assert rule.description is not None
            assert rule.severity in ("error", "warning")
            assert rule.remediation_template is not None

    def test_get_rule_by_id(self) -> None:
        """get_rule should return correct rule."""
        rule = get_rule("IMG_ALT")
        assert rule is not None
        assert rule.rule_id == "IMG_ALT"

    def test_get_rule_invalid_id(self) -> None:
        """get_rule should return None for invalid ID."""
        rule = get_rule("INVALID_RULE")
        assert rule is None

    def test_get_all_rule_ids(self) -> None:
        """get_all_rule_ids should return all rule IDs."""
        rule_ids = get_all_rule_ids()

        assert "IMG_ALT" in rule_ids
        assert "HEADING_HIERARCHY" in rule_ids
        assert "TABLE_HEADERS" in rule_ids
        assert "LINK_TEXT" in rule_ids
        assert "COLOR_CONTRAST" in rule_ids


# =============================================================================
# Human Summary Tests
# =============================================================================


class TestHumanSummary:
    """Tests for human-readable report summaries."""

    def test_passed_summary(self, valid_document: Dict[str, Any]) -> None:
        """Passed report should have appropriate summary."""
        checker = AccessibilityChecker()
        report = checker.check_document(valid_document, document_id="summary-test")

        summary = report.human_summary()
        assert "passed" in summary.lower()

    def test_failed_summary(self, invalid_document_missing_alt: Dict[str, Any]) -> None:
        """Failed report should include issue details."""
        checker = AccessibilityChecker()
        report = checker.check_document(invalid_document_missing_alt)

        summary = report.human_summary()
        assert "FAILED" in summary or "failed" in summary.lower()
        assert "IMG_ALT" in summary
        assert "Fix" in summary or "remediation" in summary.lower()


# =============================================================================
# Edge Case Tests
# =============================================================================


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_empty_document(self) -> None:
        """Empty document should pass (no elements to check)."""
        checker = AccessibilityChecker()
        report = checker.check_document({})

        assert report.passed is True
        assert len(report.issues) == 0

    def test_document_with_only_metadata(self) -> None:
        """Document with only metadata should pass."""
        checker = AccessibilityChecker()
        report = checker.check_document({
            "metadata": {"title": "Test", "author": "Tester"},
        })

        assert report.passed is True

    def test_disabled_rules(self) -> None:
        """Disabled rules should not be checked."""
        checker = AccessibilityChecker(enabled_rules=["HEADING_HIERARCHY"])
        content = {
            "sections": [
                {
                    "title": "Test",
                    "images": [{"src": "test.png"}],  # Missing alt
                },
            ],
        }

        report = checker.check_document(content)

        # IMG_ALT should not be in checked rules
        assert "IMG_ALT" not in report.rules_checked
        # And no IMG_ALT errors should be reported
        img_errors = [i for i in report.issues if i.rule_id == "IMG_ALT"]
        assert len(img_errors) == 0

    def test_figures_array_checked(self) -> None:
        """Figures array should be checked like images."""
        checker = AccessibilityChecker()
        content = {
            "figures": [
                {"src": "fig1.png"},  # Missing alt
            ],
        }

        report = checker.check_document(content)
        img_errors = [i for i in report.issues if i.rule_id == "IMG_ALT"]
        assert len(img_errors) == 1

    def test_figure_caption_as_alt(self) -> None:
        """Figure caption can serve as alt text."""
        checker = AccessibilityChecker()
        content = {
            "figures": [
                {"caption": "Figure 1: Study results", "src": "fig1.png"},
            ],
        }

        report = checker.check_document(content)
        img_errors = [i for i in report.issues if i.rule_id == "IMG_ALT"]
        assert len(img_errors) == 0

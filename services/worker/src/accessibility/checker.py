"""
Accessibility Checker

This module provides the main AccessibilityChecker class for validating
document accessibility before export.

The checker validates:
- Image/artifact alt text
- Heading hierarchy
- Table headers
- Link text quality
- Color contrast (warning only)

Last Updated: 2026-01-20
"""

import re
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass

from .report import AccessibilityReport, AccessibilityIssue, AccessibilityWarning
from .rules import (
    RULE_IMG_ALT,
    RULE_HEADING_HIERARCHY,
    RULE_TABLE_HEADERS,
    RULE_LINK_TEXT,
    RULE_COLOR_CONTRAST,
    ALL_RULES,
    get_all_rule_ids,
)

logger = logging.getLogger(__name__)


@dataclass
class DocumentElement:
    """Represents an element found during document parsing."""

    element_type: str  # "image", "heading", "table", "link", "artifact"
    location: str  # Section/path reference
    attributes: Dict[str, Any]  # Element-specific attributes
    index: int  # Position in document


class AccessibilityChecker:
    """
    Accessibility checker for export documents.

    This class validates document content against accessibility rules
    and produces a machine-readable report.

    Usage:
        checker = AccessibilityChecker()
        report = checker.check_document(content, document_id="doc-123")

        if not report.passed:
            for issue in report.issues:
                print(f"{issue.rule_id}: {issue.message}")
    """

    # Generic link text patterns that are considered non-descriptive
    GENERIC_LINK_PATTERNS = [
        r"^click\s*here$",
        r"^here$",
        r"^read\s*more$",
        r"^more$",
        r"^link$",
        r"^this$",
        r"^learn\s*more$",
        r"^details$",
        r"^info$",
        r"^see\s*more$",
    ]

    # Color keywords that may indicate contrast issues
    COLOR_WARNING_PATTERNS = [
        r"color:\s*(lightgray|lightgrey|#[cd][cd][cd]|#[ef][ef][ef])",
        r"color:\s*(yellow|#ff[ef][ef])",
        r"background.*color:\s*(gray|grey|#[89ab][89ab][89ab])",
    ]

    def __init__(self, enabled_rules: Optional[List[str]] = None):
        """
        Initialize the accessibility checker.

        Args:
            enabled_rules: List of rule IDs to check. If None, all rules are enabled.
        """
        if enabled_rules is None:
            self.enabled_rules = get_all_rule_ids()
        else:
            self.enabled_rules = enabled_rules

        self._compile_patterns()
        logger.info(
            f"AccessibilityChecker initialized with rules: {self.enabled_rules}"
        )

    def _compile_patterns(self) -> None:
        """Pre-compile regex patterns for performance."""
        self._generic_link_re = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.GENERIC_LINK_PATTERNS
        ]
        self._color_warning_re = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.COLOR_WARNING_PATTERNS
        ]

    def check_document(
        self, content: Dict[str, Any], document_id: str = ""
    ) -> AccessibilityReport:
        """
        Check a document for accessibility issues.

        The content dict should have a structure that includes:
        - sections: List of document sections
        - artifacts: List of embedded artifacts
        - metadata: Document metadata

        Args:
            content: Document content dictionary
            document_id: Optional document identifier

        Returns:
            AccessibilityReport with all issues and warnings
        """
        report = AccessibilityReport(
            passed=True,
            document_id=document_id,
            rules_checked=self.enabled_rules.copy(),
        )

        # Parse document elements
        elements = self._parse_document_elements(content)

        # Check each enabled rule
        if "IMG_ALT" in self.enabled_rules:
            self._check_image_alt_text(elements, content, report)

        if "HEADING_HIERARCHY" in self.enabled_rules:
            self._check_heading_hierarchy(elements, content, report)

        if "TABLE_HEADERS" in self.enabled_rules:
            self._check_table_headers(elements, content, report)

        if "LINK_TEXT" in self.enabled_rules:
            self._check_link_text(elements, content, report)

        if "COLOR_CONTRAST" in self.enabled_rules:
            self._check_color_contrast(elements, content, report)

        logger.info(
            f"Accessibility check completed for {document_id}: "
            f"passed={report.passed}, issues={len(report.issues)}, "
            f"warnings={len(report.warnings)}"
        )

        return report

    def _parse_document_elements(
        self, content: Dict[str, Any]
    ) -> List[DocumentElement]:
        """
        Parse document content into a list of elements for checking.

        Args:
            content: Document content dictionary

        Returns:
            List of DocumentElement objects
        """
        elements: List[DocumentElement] = []
        element_index = 0

        # Parse sections
        sections = content.get("sections", [])
        for section_idx, section in enumerate(sections):
            section_path = f"sections[{section_idx}]"
            section_name = section.get("name", section.get("title", f"Section {section_idx}"))

            # Check for headings in section
            if "heading" in section or "title" in section:
                heading_level = section.get("level", self._infer_heading_level(section))
                elements.append(
                    DocumentElement(
                        element_type="heading",
                        location=f"{section_path}.heading",
                        attributes={
                            "level": heading_level,
                            "text": section.get("heading", section.get("title", "")),
                        },
                        index=element_index,
                    )
                )
                element_index += 1

            # Check for images in section content
            images = section.get("images", [])
            for img_idx, image in enumerate(images):
                elements.append(
                    DocumentElement(
                        element_type="image",
                        location=f"{section_path}.images[{img_idx}]",
                        attributes={
                            "alt": image.get("alt", image.get("alt_text", "")),
                            "src": image.get("src", image.get("url", "")),
                        },
                        index=element_index,
                    )
                )
                element_index += 1

            # Check for tables in section
            tables = section.get("tables", [])
            for table_idx, table in enumerate(tables):
                elements.append(
                    DocumentElement(
                        element_type="table",
                        location=f"{section_path}.tables[{table_idx}]",
                        attributes={
                            "headers": table.get("headers", table.get("header", [])),
                            "caption": table.get("caption", ""),
                            "rows": table.get("rows", []),
                            "has_th": table.get("has_th", bool(table.get("headers"))),
                        },
                        index=element_index,
                    )
                )
                element_index += 1

            # Check for links in section
            links = section.get("links", [])
            for link_idx, link in enumerate(links):
                elements.append(
                    DocumentElement(
                        element_type="link",
                        location=f"{section_path}.links[{link_idx}]",
                        attributes={
                            "text": link.get("text", link.get("label", "")),
                            "href": link.get("href", link.get("url", "")),
                        },
                        index=element_index,
                    )
                )
                element_index += 1

            # Check for inline content with styles (for color contrast)
            if "style" in section or "styles" in section:
                elements.append(
                    DocumentElement(
                        element_type="styled_content",
                        location=f"{section_path}",
                        attributes={
                            "style": section.get("style", section.get("styles", {})),
                        },
                        index=element_index,
                    )
                )
                element_index += 1

        # Parse artifacts (embedded figures, charts, etc.)
        artifacts = content.get("artifacts", [])
        for artifact_idx, artifact in enumerate(artifacts):
            artifact_path = f"artifacts[{artifact_idx}]"
            elements.append(
                DocumentElement(
                    element_type="artifact",
                    location=artifact_path,
                    attributes={
                        "alt": artifact.get("alt", artifact.get("alt_text", "")),
                        "kind": artifact.get("kind", artifact.get("type", "")),
                        "id": artifact.get("id", ""),
                    },
                    index=element_index,
                )
            )
            element_index += 1

        # Parse embedded figures
        figures = content.get("figures", [])
        for figure_idx, figure in enumerate(figures):
            figure_path = f"figures[{figure_idx}]"
            elements.append(
                DocumentElement(
                    element_type="image",
                    location=figure_path,
                    attributes={
                        "alt": figure.get("alt", figure.get("caption", "")),
                        "src": figure.get("src", figure.get("url", "")),
                    },
                    index=element_index,
                )
            )
            element_index += 1

        return elements

    def _infer_heading_level(self, section: Dict[str, Any]) -> int:
        """
        Infer heading level from section structure.

        Args:
            section: Section dictionary

        Returns:
            Heading level (1-6)
        """
        # Check explicit level
        if "level" in section:
            return int(section["level"])

        # Check heading tag pattern (h1, h2, etc.)
        heading = section.get("heading", section.get("title", ""))
        if isinstance(heading, dict) and "tag" in heading:
            tag = heading["tag"].lower()
            if tag.startswith("h") and len(tag) == 2 and tag[1].isdigit():
                return int(tag[1])

        # Default to level 2 (most common for sections)
        return 2

    def _check_image_alt_text(
        self,
        elements: List[DocumentElement],
        content: Dict[str, Any],
        report: AccessibilityReport,
    ) -> None:
        """
        Check that all images and artifacts have alt text.

        Args:
            elements: List of parsed document elements
            content: Original content dictionary
            report: Report to add issues to
        """
        for element in elements:
            if element.element_type in ("image", "artifact"):
                alt_text = element.attributes.get("alt", "")

                # Check if alt text is missing or empty
                if not alt_text or (isinstance(alt_text, str) and not alt_text.strip()):
                    element_desc = (
                        "artifact embed" if element.element_type == "artifact" else "image"
                    )
                    report.add_issue(
                        AccessibilityIssue(
                            rule_id=RULE_IMG_ALT.rule_id,
                            severity="error",
                            message=f"Missing alt text for {element_desc}",
                            location=element.location,
                            remediation=RULE_IMG_ALT.get_remediation(),
                        )
                    )

    def _check_heading_hierarchy(
        self,
        elements: List[DocumentElement],
        content: Dict[str, Any],
        report: AccessibilityReport,
    ) -> None:
        """
        Check that headings follow a proper hierarchy without skipping levels.

        Args:
            elements: List of parsed document elements
            content: Original content dictionary
            report: Report to add issues to
        """
        # Extract headings in document order
        headings = [
            (element.location, element.attributes.get("level", 1))
            for element in elements
            if element.element_type == "heading"
        ]

        if not headings:
            return

        # Also check top-level headings array if present
        top_headings = content.get("headings", [])
        for h_idx, heading in enumerate(top_headings):
            level = heading.get("level", self._infer_heading_level(heading))
            location = f"headings[{h_idx}]"
            headings.append((location, level))

        # Sort by document order (assuming location encodes order)
        # For this implementation, we rely on parse order

        previous_level = 0
        for location, level in headings:
            # First heading can be any level (though H1 is recommended)
            if previous_level == 0:
                previous_level = level
                continue

            # Check for skipped levels (e.g., H1 -> H3 skips H2)
            if level > previous_level + 1:
                report.add_issue(
                    AccessibilityIssue(
                        rule_id=RULE_HEADING_HIERARCHY.rule_id,
                        severity="error",
                        message=(
                            f"Heading hierarchy skip: jumped from H{previous_level} to H{level}"
                        ),
                        location=location,
                        remediation=RULE_HEADING_HIERARCHY.get_remediation(),
                    )
                )

            previous_level = level

    def _check_table_headers(
        self,
        elements: List[DocumentElement],
        content: Dict[str, Any],
        report: AccessibilityReport,
    ) -> None:
        """
        Check that tables have header cells (th) or captions.

        Args:
            elements: List of parsed document elements
            content: Original content dictionary
            report: Report to add issues to
        """
        for element in elements:
            if element.element_type == "table":
                has_headers = bool(element.attributes.get("headers"))
                has_caption = bool(element.attributes.get("caption"))
                has_th = element.attributes.get("has_th", False)

                # Table must have either headers (th elements) or a caption
                if not has_headers and not has_caption and not has_th:
                    report.add_issue(
                        AccessibilityIssue(
                            rule_id=RULE_TABLE_HEADERS.rule_id,
                            severity="error",
                            message="Table missing headers (th elements) or caption",
                            location=element.location,
                            remediation=RULE_TABLE_HEADERS.get_remediation(),
                        )
                    )

    def _check_link_text(
        self,
        elements: List[DocumentElement],
        content: Dict[str, Any],
        report: AccessibilityReport,
    ) -> None:
        """
        Check that links have descriptive text.

        Args:
            elements: List of parsed document elements
            content: Original content dictionary
            report: Report to add issues to
        """
        for element in elements:
            if element.element_type == "link":
                link_text = element.attributes.get("text", "").strip()

                # Check for empty link text
                if not link_text:
                    report.add_warning(
                        AccessibilityWarning(
                            rule_id=RULE_LINK_TEXT.rule_id,
                            message="Link has no text",
                            location=element.location,
                            suggestion="Add descriptive text to the link",
                        )
                    )
                    continue

                # Check for generic/non-descriptive link text
                for pattern in self._generic_link_re:
                    if pattern.match(link_text):
                        report.add_warning(
                            AccessibilityWarning(
                                rule_id=RULE_LINK_TEXT.rule_id,
                                message="Link text is not descriptive",
                                location=element.location,
                                suggestion=(
                                    "Replace generic text with descriptive text "
                                    "that indicates the link's destination or purpose"
                                ),
                            )
                        )
                        break

    def _check_color_contrast(
        self,
        elements: List[DocumentElement],
        content: Dict[str, Any],
        report: AccessibilityReport,
    ) -> None:
        """
        Check for potential color contrast issues.

        Note: This is a heuristic check that flags potential issues for review.
        Full contrast checking requires rendering and is beyond scope here.

        Args:
            elements: List of parsed document elements
            content: Original content dictionary
            report: Report to add issues to
        """
        for element in elements:
            if element.element_type == "styled_content":
                style = element.attributes.get("style", {})

                # Convert style to string for pattern matching
                if isinstance(style, dict):
                    style_str = "; ".join(
                        f"{k}: {v}" for k, v in style.items()
                    )
                else:
                    style_str = str(style)

                # Check for potentially problematic color patterns
                for pattern in self._color_warning_re:
                    if pattern.search(style_str):
                        report.add_warning(
                            AccessibilityWarning(
                                rule_id=RULE_COLOR_CONTRAST.rule_id,
                                message="Potential color contrast issue detected",
                                location=element.location,
                                suggestion=(
                                    "Review color choices for sufficient contrast. "
                                    "Use a contrast checker tool to verify compliance."
                                ),
                            )
                        )
                        break  # Only one warning per element

        # Also check global styles if present
        global_styles = content.get("styles", content.get("style", {}))
        if global_styles:
            style_str = (
                "; ".join(f"{k}: {v}" for k, v in global_styles.items())
                if isinstance(global_styles, dict)
                else str(global_styles)
            )

            for pattern in self._color_warning_re:
                if pattern.search(style_str):
                    report.add_warning(
                        AccessibilityWarning(
                            rule_id=RULE_COLOR_CONTRAST.rule_id,
                            message="Potential color contrast issue in global styles",
                            location="styles",
                            suggestion=(
                                "Review document-level color choices for sufficient contrast"
                            ),
                        )
                    )
                    break

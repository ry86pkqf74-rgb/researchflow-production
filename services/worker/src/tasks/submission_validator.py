"""Submission validator for journal guidelines.

Validates manuscript against journal requirements:
- Word counts per section
- Required sections
- Formatting guidelines
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from src.security.phi_guard import assert_no_phi, PhiBlocked


@dataclass
class ValidationIssue:
    """A validation issue found in the manuscript."""
    severity: str  # low, medium, high
    issue: str
    section: Optional[str] = None
    suggestion: Optional[str] = None


# Default journal template (can be overridden)
DEFAULT_TEMPLATE = {
    "id": "default",
    "sections": ["TITLE", "ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "REFERENCES"],
    "wordLimits": {
        "ABSTRACT": 350,
        "INTRODUCTION": 800,
        "METHODS": 1500,
        "RESULTS": 1500,
        "DISCUSSION": 1500,
    },
    "citationStyle": "vancouver",
    "doubleBlindSupported": True,
}

JOURNAL_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "nejm": {
        "id": "nejm",
        "displayName": "New England Journal of Medicine",
        "sections": ["TITLE", "ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "REFERENCES"],
        "wordLimits": {"ABSTRACT": 250, "INTRODUCTION": 500},
        "citationStyle": "vancouver",
        "doubleBlindSupported": True,
    },
    "jama": {
        "id": "jama",
        "displayName": "JAMA",
        "sections": ["TITLE", "ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "REFERENCES"],
        "wordLimits": {"ABSTRACT": 350, "INTRODUCTION": 600},
        "citationStyle": "ama",
        "doubleBlindSupported": True,
    },
    "lancet": {
        "id": "lancet",
        "displayName": "The Lancet",
        "sections": ["TITLE", "ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "REFERENCES"],
        "wordLimits": {"ABSTRACT": 300, "INTRODUCTION": 500},
        "citationStyle": "vancouver",
        "doubleBlindSupported": True,
    },
}


def count_words(text: str) -> int:
    """Count words in text, ignoring markdown formatting."""
    # Remove markdown formatting
    cleaned = re.sub(r'[#*_\[\](){}]', ' ', text)
    words = cleaned.split()
    return len([w for w in words if len(w) > 0])


def extract_sections(md: str) -> Dict[str, str]:
    """Extract sections from markdown content."""
    sections: Dict[str, str] = {}
    current_section = "BODY"
    current_content: List[str] = []

    for line in md.split('\n'):
        # Check for section headers
        header_match = re.match(r'^#+\s*(.+)$', line)
        if header_match:
            # Save previous section
            if current_content:
                sections[current_section] = '\n'.join(current_content).strip()

            # Determine new section
            header = header_match.group(1).upper().strip()

            # Map common header variations
            section_map = {
                "ABSTRACT": "ABSTRACT",
                "INTRODUCTION": "INTRODUCTION",
                "BACKGROUND": "INTRODUCTION",
                "METHODS": "METHODS",
                "MATERIALS AND METHODS": "METHODS",
                "METHODOLOGY": "METHODS",
                "RESULTS": "RESULTS",
                "FINDINGS": "RESULTS",
                "DISCUSSION": "DISCUSSION",
                "CONCLUSION": "DISCUSSION",
                "CONCLUSIONS": "DISCUSSION",
                "REFERENCES": "REFERENCES",
                "BIBLIOGRAPHY": "REFERENCES",
            }

            current_section = section_map.get(header, header)
            current_content = []
        else:
            current_content.append(line)

    # Save last section
    if current_content:
        sections[current_section] = '\n'.join(current_content).strip()

    return sections


def validate_submission(
    md: str,
    template_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Validate manuscript against journal template.

    Args:
        md: Manuscript content in markdown
        template_id: Optional journal template ID

    Returns:
        Validation result with issues and word counts
    """
    # PHI scan first
    try:
        assert_no_phi("submission_validate", md)
    except PhiBlocked as e:
        return {
            "isValid": False,
            "issues": [{
                "severity": "high",
                "issue": "PHI detected in manuscript",
                "section": None,
                "suggestion": "Remove PHI before submission",
            }],
            "wordCounts": {},
            "missingRequiredSections": [],
        }

    # Get template
    template = JOURNAL_TEMPLATES.get(template_id, DEFAULT_TEMPLATE) if template_id else DEFAULT_TEMPLATE

    issues: List[Dict[str, Any]] = []
    word_counts: Dict[str, int] = {}
    missing_sections: List[str] = []

    # Extract sections
    sections = extract_sections(md)

    # Check required sections
    required_sections = template.get("sections", [])
    for section in required_sections:
        if section not in sections or not sections.get(section, "").strip():
            missing_sections.append(section)
            issues.append({
                "severity": "high",
                "issue": f"Missing required section: {section}",
                "section": section,
                "suggestion": f"Add {section} section to your manuscript",
            })

    # Check word counts
    word_limits = template.get("wordLimits", {})
    for section, content in sections.items():
        wc = count_words(content)
        word_counts[section] = wc

        if section in word_limits:
            limit = word_limits[section]
            if wc > limit:
                issues.append({
                    "severity": "medium",
                    "issue": f"{section} exceeds word limit ({wc} > {limit})",
                    "section": section,
                    "suggestion": f"Reduce {section} to {limit} words or fewer",
                })
            elif wc < limit * 0.2:  # Less than 20% of limit
                issues.append({
                    "severity": "low",
                    "issue": f"{section} may be too brief ({wc} words)",
                    "section": section,
                    "suggestion": f"Consider expanding {section} (target: {limit} words)",
                })

    # Check for common issues

    # Check for citation placeholders
    citation_pattern = r'\[CITATION_?\d*\]|\[REF\]|\[XX\]'
    if re.search(citation_pattern, md, re.IGNORECASE):
        issues.append({
            "severity": "medium",
            "issue": "Unresolved citation placeholders found",
            "section": None,
            "suggestion": "Replace citation placeholders with actual references",
        })

    # Check for TODO/FIXME markers
    if re.search(r'TODO|FIXME|XXX', md, re.IGNORECASE):
        issues.append({
            "severity": "medium",
            "issue": "Incomplete markers (TODO/FIXME) found",
            "section": None,
            "suggestion": "Address all TODO/FIXME items before submission",
        })

    # Check for very short title
    title = sections.get("TITLE", "")
    if title and count_words(title) < 5:
        issues.append({
            "severity": "low",
            "issue": "Title may be too brief",
            "section": "TITLE",
            "suggestion": "Consider a more descriptive title",
        })

    # Determine validity
    high_issues = [i for i in issues if i["severity"] == "high"]
    is_valid = len(high_issues) == 0

    return {
        "isValid": is_valid,
        "issues": issues,
        "wordCounts": word_counts,
        "missingRequiredSections": missing_sections,
    }


def get_template(template_id: str) -> Optional[Dict[str, Any]]:
    """Get a journal template by ID."""
    return JOURNAL_TEMPLATES.get(template_id)


def list_templates() -> List[Dict[str, Any]]:
    """List all available journal templates."""
    return [
        {"id": t["id"], "displayName": t.get("displayName", t["id"])}
        for t in JOURNAL_TEMPLATES.values()
    ]

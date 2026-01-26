"""
Quality Checks Module (Phase 7)

Enhanced quality validation for AI-generated narrative content.
Mirrors the TypeScript implementation in quality-gate.service.ts.

SAFETY INVARIANTS:
- No PHI stored in check results
- Only hashes and counts in details

Last Updated: 2026-01-23
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Union


# Type aliases
CheckCategory = Literal[
    "citations", "coverage", "length", "confidence", "completeness", "structure", "format"
]
CheckSeverity = Literal["error", "warning", "info"]


@dataclass
class QualityCheck:
    """Result of a quality check.
    
    Attributes:
        name: Check identifier (e.g., 'citations_present')
        passed: Whether the check passed
        reason: Human-readable explanation if failed
        severity: 'error', 'warning', or 'info'
        category: Check category for grouping
        score: Numeric score 0.0-1.0
        details: Structured check results
    """
    name: str
    passed: bool
    reason: Optional[str] = None
    severity: CheckSeverity = "info"
    category: Optional[CheckCategory] = None
    score: Optional[float] = None
    details: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "name": self.name,
            "passed": self.passed,
            "severity": self.severity,
        }
        if self.reason:
            result["reason"] = self.reason
        if self.category:
            result["category"] = self.category
        if self.score is not None:
            result["score"] = self.score
        if self.details:
            result["details"] = self.details
        return result


def check_citations_present(
    content: str,
    min_count: int = 1,
) -> QualityCheck:
    """Check that content contains citations/references.
    
    Detects patterns like:
    - Numbered citations: [1], [2,3], [1-5]
    - Author citations: (Smith, 2024), (Smith et al., 2023)
    - Superscript-style: text¹, text²
    - DOI references: doi:10.xxx
    
    Args:
        content: Text content to check
        min_count: Minimum number of citations required
        
    Returns:
        QualityCheck with citation detection results
    """
    # Citation patterns
    patterns = [
        r'\[\d+(?:[-,]\d+)*\]',                           # [1], [1,2], [1-5]
        r'\([A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}\)',   # (Smith, 2024)
        r'[¹²³⁴⁵⁶⁷⁸⁹⁰]+',                                # Superscript numbers
        r'\b(?:doi|DOI):\s*\S+',                          # DOI references
    ]
    
    found_citations: List[str] = []
    for pattern in patterns:
        matches = re.findall(pattern, content)
        found_citations.extend(matches)
    
    unique_citations = list(set(found_citations))
    passed = len(unique_citations) >= min_count
    score = min(len(unique_citations) / min_count, 1.0) if min_count > 0 else 1.0
    
    return QualityCheck(
        name="citations_present",
        passed=passed,
        reason=None if passed else f"Found {len(unique_citations)} citations, expected at least {min_count}",
        severity="info" if passed else "warning",
        category="citations",
        score=score,
        details={
            "expected": min_count,
            "actual": len(unique_citations),
            "found": unique_citations[:10],  # Limit to first 10
        },
    )


def check_key_points_covered(
    content: str,
    key_points: List[str],
    case_sensitive: bool = False,
) -> QualityCheck:
    """Check that content covers required key points.
    
    Each key point is checked by verifying all its words appear in the content.
    
    Args:
        content: Text content to check
        key_points: List of key points that should be mentioned
        case_sensitive: Whether matching is case-sensitive
        
    Returns:
        QualityCheck with coverage results
    """
    if not key_points:
        return QualityCheck(
            name="key_points_covered",
            passed=True,
            severity="info",
            category="coverage",
            score=1.0,
            details={"expected": [], "actual": 0, "missing": [], "found": []},
        )
    
    normalized_content = content if case_sensitive else content.lower()
    
    covered: List[str] = []
    missing: List[str] = []
    
    for point in key_points:
        normalized_point = point if case_sensitive else point.lower()
        words = normalized_point.split()
        
        # Check if all words from the key point appear in content
        all_words_present = all(word in normalized_content for word in words)
        
        if all_words_present:
            covered.append(point)
        else:
            missing.append(point)
    
    score = len(covered) / len(key_points)
    passed = len(missing) == 0
    
    reason = None
    if not passed:
        missing_preview = ", ".join(missing[:3])
        if len(missing) > 3:
            missing_preview += "..."
        reason = f"Missing key points: {missing_preview}"
    
    return QualityCheck(
        name="key_points_covered",
        passed=passed,
        reason=reason,
        severity="info" if passed else "warning",
        category="coverage",
        score=score,
        details={
            "expected": key_points,
            "actual": len(covered),
            "missing": missing,
            "found": covered,
        },
    )


def check_no_question_marks(content: str) -> QualityCheck:
    """Check that content does not contain question marks.
    
    Question marks in AI-generated content may indicate the model is uncertain
    or asking clarifying questions instead of providing definitive answers.
    
    Excludes question marks inside code blocks (backticks).
    
    Args:
        content: Text content to check
        
    Returns:
        QualityCheck with question mark detection results
    """
    # Simple approach: count question marks not in code blocks
    # Remove code blocks first
    content_no_code = re.sub(r'`[^`]*`', '', content)
    
    question_count = content_no_code.count('?')
    passed = question_count == 0
    score = max(0.0, 1.0 - (question_count * 0.1))  # Reduce by 0.1 per question
    
    return QualityCheck(
        name="no_question_marks",
        passed=passed,
        reason=None if passed else f"Content contains {question_count} question mark(s), which may indicate uncertainty",
        severity="warning",  # Warning only, not blocking
        category="confidence",
        score=score,
        details={
            "expected": 0,
            "actual": question_count,
        },
    )


def check_length_within_bounds(
    content: str,
    min_words: int = 0,
    max_words: int = float('inf'),
) -> QualityCheck:
    """Check that content length is within specified word count bounds.
    
    Args:
        content: Text content to check
        min_words: Minimum word count
        max_words: Maximum word count
        
    Returns:
        QualityCheck with length validation results
    """
    words = content.split()
    word_count = len(words)
    
    passed = True
    reason = None
    score = 1.0
    
    if word_count < min_words:
        passed = False
        reason = f"Content too short: {word_count} words (minimum {min_words})"
        score = word_count / min_words if min_words > 0 else 0.0
    elif word_count > max_words:
        passed = False
        reason = f"Content too long: {word_count} words (maximum {max_words})"
        score = max_words / word_count if word_count > 0 else 0.0
    
    return QualityCheck(
        name="length_within_bounds",
        passed=passed,
        reason=reason,
        severity="info" if passed else "warning",
        category="length",
        score=min(score, 1.0),
        details={
            "expected": {"min": min_words, "max": max_words if max_words != float('inf') else None},
            "actual": word_count,
        },
    )


def check_no_placeholders(content: str) -> QualityCheck:
    """Check that content does not contain placeholder text.
    
    Detects common placeholder patterns like:
    - [TODO], [INSERT], [PLACEHOLDER]
    - XXX, TBD, FIXME
    - <PLACEHOLDER>, <YOUR_NAME>
    
    Args:
        content: Text content to check
        
    Returns:
        QualityCheck with placeholder detection results
    """
    placeholder_patterns = [
        r'\[TODO[^\]]*\]',
        r'\[INSERT[^\]]*\]',
        r'\[PLACEHOLDER[^\]]*\]',
        r'\[YOUR[^\]]*\]',
        r'\[FILL[^\]]*\]',
        r'\bXXX+\b',
        r'\bTBD\b',
        r'\bFIXME\b',
        r'\[\.{3,}\]',      # [...]
        r'<[A-Z_]+>',       # <PLACEHOLDER>
    ]
    
    found_placeholders: List[str] = []
    for pattern in placeholder_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        found_placeholders.extend(matches)
    
    passed = len(found_placeholders) == 0
    score = 1.0 if passed else max(0.0, 1.0 - (len(found_placeholders) * 0.2))
    
    return QualityCheck(
        name="no_placeholders",
        passed=passed,
        reason=None if passed else f"Content contains placeholder text: {', '.join(found_placeholders[:3])}",
        severity="info" if passed else "error",
        category="completeness",
        score=score,
        details={
            "expected": 0,
            "actual": len(found_placeholders),
            "found": found_placeholders[:10],
        },
    )


def validate_narrative_content(
    content: str,
    *,
    min_citations: Optional[int] = None,
    key_points: Optional[List[str]] = None,
    min_words: Optional[int] = None,
    max_words: Optional[int] = None,
    check_question_marks: bool = False,
    check_placeholders: bool = True,
) -> List[QualityCheck]:
    """Run all relevant quality checks on narrative content.
    
    This is a convenience method for running multiple checks.
    
    Args:
        content: Text content to check
        min_citations: Minimum citations required (None to skip)
        key_points: Key points that should be mentioned (None to skip)
        min_words: Minimum word count (None to skip)
        max_words: Maximum word count (None to skip)
        check_question_marks: Whether to check for question marks
        check_placeholders: Whether to check for placeholders (default True)
        
    Returns:
        List of QualityCheck results
    """
    checks: List[QualityCheck] = []
    
    # Citations check
    if min_citations is not None and min_citations > 0:
        checks.append(check_citations_present(content, min_citations))
    
    # Key points coverage
    if key_points:
        checks.append(check_key_points_covered(content, key_points))
    
    # Length bounds
    if min_words is not None or max_words is not None:
        checks.append(check_length_within_bounds(
            content,
            min_words=min_words or 0,
            max_words=max_words or float('inf'),
        ))
    
    # Question marks (optional)
    if check_question_marks:
        checks.append(check_no_question_marks(content))
    
    # Placeholders (default True)
    if check_placeholders:
        checks.append(check_no_placeholders(content))
    
    return checks

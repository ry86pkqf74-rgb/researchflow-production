"""
Enhanced PHI scanning for IRB drafts.

Provides comprehensive detection and redaction of Protected Health Information
in IRB submissions, with support for the new enhanced data model fields.
"""

import re
import copy
from dataclasses import dataclass, field
from typing import List, Dict, Set, Any, Optional, Pattern
from enum import Enum


class PHICategory(str, Enum):
    """Categories of Protected Health Information."""
    NAME = "name"
    SSN = "ssn"
    MRN = "mrn"
    PHONE = "phone"
    EMAIL = "email"
    DATE = "date"
    ADDRESS = "address"
    ZIP_CODE = "zip_code"
    IP_ADDRESS = "ip_address"
    ACCOUNT_NUMBER = "account_number"
    LICENSE_NUMBER = "license_number"
    DEVICE_ID = "device_id"
    URL = "url"
    BIOMETRIC = "biometric"
    PHOTO = "photo"


@dataclass
class PHIFinding:
    """A single PHI finding in text."""
    category: PHICategory
    text: str
    field_name: str
    confidence: float  # 0.0 - 1.0
    start_pos: Optional[int] = None
    end_pos: Optional[int] = None


@dataclass
class PHIScanResult:
    """Result of a PHI scan operation."""
    has_phi: bool
    findings: List[PHIFinding]
    categories_found: Set[PHICategory]
    fields_with_phi: Set[str]
    risk_level: str = "low"  # low, medium, high
    recommendations: List[str] = field(default_factory=list)


# PHI detection patterns
# Each category maps to a list of (pattern, confidence) tuples
PHI_PATTERNS: Dict[PHICategory, List[tuple[str, float]]] = {
    PHICategory.SSN: [
        (r"\b\d{3}-\d{2}-\d{4}\b", 0.95),  # Standard format
        (r"\b\d{9}\b(?=.*ssn|social)", 0.7),  # 9 digits with context
    ],
    PHICategory.PHONE: [
        (r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", 0.85),  # US phone
        (r"\(\d{3}\)\s*\d{3}[-.\s]?\d{4}\b", 0.9),  # (xxx) xxx-xxxx
        (r"\b1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", 0.9),  # With country code
    ],
    PHICategory.EMAIL: [
        (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", 0.95),
    ],
    PHICategory.DATE: [
        (r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", 0.7),  # MM/DD/YYYY
        (r"\b\d{1,2}-\d{1,2}-\d{2,4}\b", 0.7),  # MM-DD-YYYY
        (r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b", 0.8),
    ],
    PHICategory.MRN: [
        (r"\bMRN[:\s]*\d{6,}\b", 0.95),
        (r"\bmedical record[:\s#]*\d{6,}\b", 0.9),
        (r"\bpatient[:\s#]*\d{6,}\b", 0.7),
    ],
    PHICategory.ZIP_CODE: [
        (r"\b\d{5}(?:-\d{4})?\b(?=.*(?:zip|address|street|city))", 0.7),
    ],
    PHICategory.IP_ADDRESS: [
        (r"\b(?:\d{1,3}\.){3}\d{1,3}\b", 0.8),
    ],
    PHICategory.ACCOUNT_NUMBER: [
        (r"\baccount[:\s#]*\d{8,}\b", 0.85),
        (r"\bpolicy[:\s#]*\d{8,}\b", 0.85),
    ],
    PHICategory.URL: [
        (r"https?://[^\s]+patient|record|medical[^\s]*", 0.7),
    ],
}


# Fields to scan in IRB drafts
SCANNABLE_FIELDS = [
    "study_title",
    "short_title",
    "research_question",
    "lay_summary",
    "literature_summary",
]


class EnhancedPHIScanner:
    """
    Enhanced PHI scanner for IRB submissions.

    Scans text and structured data for potential PHI,
    providing findings with confidence levels and recommendations.
    """

    def __init__(self, sensitivity: str = "medium"):
        """
        Initialize scanner with sensitivity level.

        Args:
            sensitivity: Detection sensitivity - "low", "medium", or "high"
                        Higher sensitivity catches more but may have more false positives
        """
        self.sensitivity = sensitivity
        self.confidence_threshold = {
            "low": 0.9,
            "medium": 0.7,
            "high": 0.5,
        }.get(sensitivity, 0.7)

        self.patterns: Dict[PHICategory, List[tuple[Pattern, float]]] = {}
        self._compile_patterns()

    def _compile_patterns(self) -> None:
        """Compile regex patterns for efficiency."""
        for category, pattern_list in PHI_PATTERNS.items():
            self.patterns[category] = [
                (re.compile(pattern, re.IGNORECASE), conf)
                for pattern, conf in pattern_list
            ]

    def scan_text(
        self,
        text: str,
        field_name: str = "unknown",
    ) -> List[PHIFinding]:
        """
        Scan text for PHI.

        Args:
            text: Text to scan
            field_name: Name of the field being scanned (for reporting)

        Returns:
            List of PHIFinding objects
        """
        findings = []

        for category, compiled_patterns in self.patterns.items():
            for pattern, confidence in compiled_patterns:
                if confidence < self.confidence_threshold:
                    continue

                for match in pattern.finditer(text):
                    findings.append(
                        PHIFinding(
                            category=category,
                            text=match.group(),
                            field_name=field_name,
                            confidence=confidence,
                            start_pos=match.start(),
                            end_pos=match.end(),
                        )
                    )

        return findings

    def scan_irb_draft(self, draft_data: Dict[str, Any]) -> PHIScanResult:
        """
        Scan an IRB draft for PHI.

        Args:
            draft_data: Dictionary containing IRB draft data

        Returns:
            PHIScanResult with findings and recommendations
        """
        all_findings: List[PHIFinding] = []

        # Scan standard text fields
        for field in SCANNABLE_FIELDS:
            if field in draft_data and draft_data[field]:
                value = draft_data[field]

                # Handle nested structures
                if isinstance(value, dict):
                    if field == "lay_summary" and value.get("summary_text"):
                        all_findings.extend(
                            self.scan_text(value["summary_text"], "lay_summary.summary_text")
                        )
                else:
                    all_findings.extend(self.scan_text(str(value), field))

        # Scan answers dictionary
        if "answers" in draft_data and isinstance(draft_data["answers"], dict):
            for q_id, answer in draft_data["answers"].items():
                if answer:
                    all_findings.extend(
                        self.scan_text(str(answer), f"answers.{q_id}")
                    )

        # Scan vulnerable populations info
        if "vulnerable_populations" in draft_data and draft_data["vulnerable_populations"]:
            vp = draft_data["vulnerable_populations"]
            if isinstance(vp, dict):
                for vp_field in ["children_assent_process", "parental_consent_process",
                                 "impaired_adults_surrogate_consent", "additional_protections"]:
                    if vp.get(vp_field):
                        all_findings.extend(
                            self.scan_text(str(vp[vp_field]), f"vulnerable_populations.{vp_field}")
                        )

        # Calculate risk level
        risk_level = self._calculate_risk_level(all_findings)

        # Generate recommendations
        recommendations = self._generate_recommendations(all_findings)

        return PHIScanResult(
            has_phi=len(all_findings) > 0,
            findings=all_findings,
            categories_found={f.category for f in all_findings},
            fields_with_phi={f.field_name for f in all_findings},
            risk_level=risk_level,
            recommendations=recommendations,
        )

    def _calculate_risk_level(self, findings: List[PHIFinding]) -> str:
        """Calculate overall risk level based on findings."""
        if not findings:
            return "low"

        # High-risk categories
        high_risk = {PHICategory.SSN, PHICategory.MRN, PHICategory.ACCOUNT_NUMBER}
        medium_risk = {PHICategory.PHONE, PHICategory.EMAIL, PHICategory.DATE}

        categories = {f.category for f in findings}

        if categories & high_risk:
            return "high"
        elif categories & medium_risk:
            return "medium"
        else:
            return "low"

    def _generate_recommendations(self, findings: List[PHIFinding]) -> List[str]:
        """Generate recommendations based on findings."""
        recommendations = []

        if not findings:
            return ["No PHI detected. Review complete."]

        categories = {f.category for f in findings}
        fields = {f.field_name for f in findings}

        if PHICategory.SSN in categories:
            recommendations.append(
                "CRITICAL: Social Security Number detected. Remove immediately."
            )

        if PHICategory.MRN in categories:
            recommendations.append(
                "Medical Record Number detected. Replace with study ID or remove."
            )

        if PHICategory.EMAIL in categories:
            recommendations.append(
                "Email address detected. Consider if this is necessary for IRB review."
            )

        if PHICategory.PHONE in categories:
            recommendations.append(
                "Phone number detected. Remove unless required for contact information section."
            )

        if PHICategory.DATE in categories:
            recommendations.append(
                "Specific dates detected. Consider using ranges or relative dates."
            )

        # Field-specific recommendations
        if any("answers." in f for f in fields):
            recommendations.append(
                "PHI found in question answers. Ensure examples use hypothetical data."
            )

        if "study_title" in fields or "short_title" in fields:
            recommendations.append(
                "PHI found in study title. Study titles should not contain identifiable information."
            )

        return recommendations

    def redact_text(self, text: str) -> str:
        """
        Redact PHI from text.

        Args:
            text: Text to redact

        Returns:
            Text with PHI replaced by category labels
        """
        findings = self.scan_text(text)

        # Sort by position (reverse) to maintain string indices during replacement
        findings.sort(key=lambda f: -(f.start_pos or 0))

        for finding in findings:
            if finding.start_pos is not None and finding.end_pos is not None:
                redaction = f"[{finding.category.value.upper()}]"
                text = text[:finding.start_pos] + redaction + text[finding.end_pos:]
            else:
                text = text.replace(finding.text, f"[{finding.category.value.upper()}]")

        return text


def scan_for_phi(
    draft_data: Dict[str, Any],
    sensitivity: str = "medium",
) -> PHIScanResult:
    """
    Scan IRB draft data for PHI.

    Args:
        draft_data: Dictionary containing IRB draft data
        sensitivity: Detection sensitivity ("low", "medium", "high")

    Returns:
        PHIScanResult with findings and recommendations
    """
    scanner = EnhancedPHIScanner(sensitivity=sensitivity)
    return scanner.scan_irb_draft(draft_data)


def redact_phi_from_draft(
    draft_data: Dict[str, Any],
    sensitivity: str = "medium",
) -> Dict[str, Any]:
    """
    Redact PHI from IRB draft data.

    Args:
        draft_data: Dictionary containing IRB draft data
        sensitivity: Detection sensitivity

    Returns:
        Copy of draft data with PHI redacted
    """
    scanner = EnhancedPHIScanner(sensitivity=sensitivity)
    redacted = copy.deepcopy(draft_data)

    # Redact standard fields
    for field in SCANNABLE_FIELDS:
        if field in redacted and redacted[field]:
            if isinstance(redacted[field], dict):
                if field == "lay_summary" and redacted[field].get("summary_text"):
                    redacted[field]["summary_text"] = scanner.redact_text(
                        redacted[field]["summary_text"]
                    )
            else:
                redacted[field] = scanner.redact_text(str(redacted[field]))

    # Redact answers
    if "answers" in redacted:
        for q_id, answer in redacted["answers"].items():
            if answer:
                redacted["answers"][q_id] = scanner.redact_text(str(answer))

    return redacted


def contains_phi(text: str, sensitivity: str = "medium") -> bool:
    """
    Check if text contains PHI.

    Args:
        text: Text to check
        sensitivity: Detection sensitivity

    Returns:
        True if PHI is detected
    """
    scanner = EnhancedPHIScanner(sensitivity=sensitivity)
    findings = scanner.scan_text(text)
    return len(findings) > 0


def get_phi_categories_found(text: str) -> Set[PHICategory]:
    """Get set of PHI categories found in text."""
    scanner = EnhancedPHIScanner()
    findings = scanner.scan_text(text)
    return {f.category for f in findings}

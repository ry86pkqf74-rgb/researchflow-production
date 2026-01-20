"""
Conference Guideline Extraction Module

Extracts and parses conference submission guidelines from conference URLs.
Provides PHI/PII sanitization before any content is stored or logged.

Supports DEMO mode with fixture data for sample conferences.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# Import centralized PHI patterns for sanitization
from validation.phi_patterns import PHI_PATTERNS_HIGH_CONFIDENCE


# ============ Additional PII/PHI Patterns for Guidelines ============
# These extend the base patterns specifically for web-scraped content

GUIDELINE_PII_PATTERNS: List[Tuple[str, re.Pattern]] = [
    # Email addresses (extends base EMAIL pattern)
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    # US Phone numbers (various formats)
    ("PHONE", re.compile(r"\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")),
    # International phone numbers
    ("INTL_PHONE", re.compile(r"\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b")),
    # Street addresses (simplified pattern for common US formats)
    ("ADDRESS", re.compile(
        r"\b\d{1,5}\s+(?:[A-Z][a-z]+\s?){1,4}"
        r"(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b",
        re.IGNORECASE
    )),
    # PO Box addresses
    ("PO_BOX", re.compile(r"\b(?:P\.?O\.?\s*Box|Post\s*Office\s*Box)\s*\d+\b", re.IGNORECASE)),
    # ZIP codes (5 digit with optional +4)
    ("ZIP_CODE", re.compile(r"\b\d{5}(?:-\d{4})?\b")),
    # Personal names with contact context (e.g., "Contact: John Smith")
    ("CONTACT_NAME", re.compile(
        r"(?:Contact|Coordinator|Chair|Director|Manager):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})",
        re.IGNORECASE
    )),
    # Fax numbers
    ("FAX", re.compile(r"\b(?:Fax|F):\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", re.IGNORECASE)),
]

# Combined patterns for guideline sanitization
ALL_GUIDELINE_PII_PATTERNS: List[Tuple[str, re.Pattern]] = (
    PHI_PATTERNS_HIGH_CONFIDENCE + GUIDELINE_PII_PATTERNS
)


# ============ Data Classes ============

@dataclass
class ExtractedGuidelines:
    """Structured guidelines extracted from conference submission pages."""

    # Content hashes for integrity
    raw_text_sha256: str

    # Sanitized raw text (PII/PHI redacted)
    raw_text: str

    # Extracted structured fields
    abstract_word_limit: Optional[int] = None
    abstract_char_limit: Optional[int] = None
    poster_size: Optional[str] = None  # e.g., "48x36 inches", "A0"
    slide_limits: Optional[Dict[str, Any]] = None  # e.g., {"max_slides": 15, "duration_min": 10}
    file_types: List[str] = field(default_factory=list)  # e.g., ["PDF", "PPTX", "DOC"]
    blinding_rules: Optional[str] = None  # e.g., "Double-blind", "Single-blind", "None"

    # Submission deadlines
    abstract_deadline: Optional[str] = None
    full_paper_deadline: Optional[str] = None

    # Additional extracted hints
    formatting_hints: List[str] = field(default_factory=list)
    required_sections: List[str] = field(default_factory=list)

    # Metadata
    source_url: str = ""
    conference_name: str = ""
    extraction_timestamp: str = ""
    sanitization_summary: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "raw_text_sha256": self.raw_text_sha256,
            "raw_text": self.raw_text,
            "abstract_word_limit": self.abstract_word_limit,
            "abstract_char_limit": self.abstract_char_limit,
            "poster_size": self.poster_size,
            "slide_limits": self.slide_limits,
            "file_types": self.file_types,
            "blinding_rules": self.blinding_rules,
            "abstract_deadline": self.abstract_deadline,
            "full_paper_deadline": self.full_paper_deadline,
            "formatting_hints": self.formatting_hints,
            "required_sections": self.required_sections,
            "source_url": self.source_url,
            "conference_name": self.conference_name,
            "extraction_timestamp": self.extraction_timestamp,
            "sanitization_summary": self.sanitization_summary,
        }


@dataclass
class GuidelineExtractionInput:
    """Input for guideline extraction."""

    conference_url: str
    formats: List[str] = field(default_factory=list)  # ["poster", "oral", "symposium"]
    conference_name: Optional[str] = None


@dataclass
class GuidelineExtractionResult:
    """Result of guideline extraction operation."""

    status: str  # "success", "partial", "error"
    guidelines: Optional[ExtractedGuidelines] = None
    error_message: Optional[str] = None
    mode: str = "DEMO"  # "DEMO" or "LIVE"

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "status": self.status,
            "guidelines": self.guidelines.to_dict() if self.guidelines else None,
            "error_message": self.error_message,
            "mode": self.mode,
        }


# ============ Sanitization Functions ============

def sanitize_text(
    text: str,
    patterns: List[Tuple[str, re.Pattern]] = ALL_GUIDELINE_PII_PATTERNS,
) -> Tuple[str, Dict[str, int]]:
    """
    Sanitize text by redacting PII/PHI patterns.

    IMPORTANT: This function MUST be called before logging or storing any
    scraped web content. Never log raw scraped content.

    Args:
        text: Raw text that may contain PII/PHI
        patterns: List of (name, pattern) tuples to redact

    Returns:
        Tuple of (sanitized_text, summary_dict)
        summary_dict contains counts of each pattern type redacted
    """
    if not text:
        return "", {}

    sanitized = text
    summary: Dict[str, int] = {}

    for name, pattern in patterns:
        # Count matches first
        matches = pattern.findall(sanitized)
        count = len(matches)

        if count > 0:
            # Redact with category-specific placeholder
            sanitized = pattern.sub(f"[REDACTED:{name}]", sanitized)
            summary[name] = summary.get(name, 0) + count

    return sanitized, summary


def compute_sha256(text: str) -> str:
    """Compute SHA-256 hash of text for integrity verification."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ============ Field Extraction Functions ============

def _extract_word_limit(text: str) -> Optional[int]:
    """Extract abstract word limit from guideline text."""
    # Common patterns for word limits
    patterns = [
        r"(?:abstract|summary)\s+(?:must\s+be|should\s+be|is\s+limited\s+to|limit(?:ed)?\s+to|maximum\s+of?)\s*(\d+)\s*words?",
        r"(\d+)\s*[-–]\s*words?\s+(?:abstract|maximum|limit)",
        r"word\s+limit[:\s]+(\d+)",
        r"maximum\s+(?:of\s+)?(\d+)\s*words?",
        r"(?:up\s+to|not\s+exceed)\s+(\d+)\s*words?",
    ]

    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                continue
    return None


def _extract_char_limit(text: str) -> Optional[int]:
    """Extract abstract character limit from guideline text."""
    patterns = [
        r"(?:abstract|summary)\s+(?:must\s+be|should\s+be|is\s+limited\s+to|limit(?:ed)?\s+to|maximum\s+of?)\s*(\d+)\s*characters?",
        r"(\d+)\s*[-–]\s*characters?\s+(?:abstract|maximum|limit)",
        r"character\s+limit[:\s]+(\d+)",
        r"maximum\s+(?:of\s+)?(\d+)\s*characters?",
    ]

    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                continue
    return None


def _extract_poster_size(text: str) -> Optional[str]:
    """Extract poster size requirements from guideline text."""
    patterns = [
        # Dimension patterns (inches)
        r"(\d+)\s*[x×]\s*(\d+)\s*(?:inches?|in\.?|\")",
        # Dimension patterns (cm)
        r"(\d+)\s*[x×]\s*(\d+)\s*(?:cm|centimeters?)",
        # Standard sizes
        r"\b(A0|A1|A2)\b",
        # Descriptive patterns
        r"poster\s+(?:size|dimensions?)[:\s]+([^\n.]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            groups = match.groups()
            if len(groups) == 2 and groups[0].isdigit():
                return f"{groups[0]}x{groups[1]} inches"
            elif len(groups) == 1:
                return groups[0].strip()
    return None


def _extract_slide_limits(text: str) -> Optional[Dict[str, Any]]:
    """Extract slide/presentation limits from guideline text."""
    result: Dict[str, Any] = {}

    # Max slides
    slide_patterns = [
        r"(?:maximum|max|up\s+to|limit(?:ed)?\s+to)\s*(\d+)\s*slides?",
        r"(\d+)\s*slides?\s*(?:maximum|max|limit)",
    ]
    for pattern in slide_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                result["max_slides"] = int(match.group(1))
                break
            except ValueError:
                pass

    # Duration
    duration_patterns = [
        r"(\d+)\s*[-–]?\s*minutes?\s*(?:presentation|talk|oral)",
        r"(?:presentation|talk|oral)\s*(?:time|duration)[:\s]+(\d+)\s*minutes?",
        r"(\d+)\s*min(?:utes?)?\s+(?:plus|with)\s+(\d+)\s*min(?:utes?)?\s+(?:Q&A|questions?)",
    ]
    for pattern in duration_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            groups = match.groups()
            try:
                result["duration_minutes"] = int(groups[0])
                if len(groups) > 1 and groups[1]:
                    result["qa_minutes"] = int(groups[1])
                break
            except ValueError:
                pass

    return result if result else None


def _extract_file_types(text: str) -> List[str]:
    """Extract accepted file types from guideline text."""
    file_types: List[str] = []

    # Common file type patterns
    type_patterns = [
        r"\b(PDF)\b",
        r"\b(PPTX?|PowerPoint)\b",
        r"\b(DOCX?|Word)\b",
        r"\b(MP4|video)\b",
        r"\b(JPE?G|PNG|TIFF?)\b",
        r"\b(LaTeX|TEX)\b",
    ]

    text_upper = text.upper()
    for pattern in type_patterns:
        if re.search(pattern, text_upper, re.IGNORECASE):
            # Normalize the match
            match = re.search(pattern, text_upper, re.IGNORECASE)
            if match:
                file_type = match.group(1).upper()
                # Normalize common variations
                if file_type in ("PPT", "POWERPOINT"):
                    file_type = "PPTX"
                elif file_type in ("DOC", "WORD"):
                    file_type = "DOCX"
                elif file_type == "VIDEO":
                    file_type = "MP4"
                elif file_type in ("JPG", "JPEG"):
                    file_type = "JPEG"
                elif file_type in ("TIF", "TIFF"):
                    file_type = "TIFF"
                elif file_type == "TEX":
                    file_type = "LaTeX"

                if file_type not in file_types:
                    file_types.append(file_type)

    return file_types


def _extract_blinding_rules(text: str) -> Optional[str]:
    """Extract blinding/anonymization requirements from guideline text."""
    patterns = [
        r"(double[-\s]?blind(?:ed)?)",
        r"(single[-\s]?blind(?:ed)?)",
        r"(triple[-\s]?blind(?:ed)?)",
        r"(anonymous|anonymized|anonymised)\s+review",
        r"(blinded)\s+(?:review|submission)",
        r"(?:no|not)\s+(blind(?:ed|ing)?)",
        r"(open)\s+(?:review|peer)",
    ]

    text_lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, text_lower)
        if match:
            result = match.group(1).replace("-", " ").replace("  ", " ")
            # Normalize
            if "double" in result:
                return "Double-blind"
            elif "single" in result:
                return "Single-blind"
            elif "triple" in result:
                return "Triple-blind"
            elif "anonymous" in result or "blinded" in result:
                return "Blind review required"
            elif "open" in result:
                return "Open review"
            elif "not blind" in result or "no blind" in result:
                return "Not blinded"

    return None


def _extract_formatting_hints(text: str) -> List[str]:
    """Extract formatting hints/requirements from guideline text."""
    hints: List[str] = []

    hint_patterns = [
        (r"(?:use|required|standard)\s+(Times\s+New\s+Roman|Arial|Helvetica)", "Font: {}"),
        (r"(\d+)[-\s]?(?:pt|point)\s+font", "{}-point font required"),
        (r"(single|double|1\.5)[-\s]?spac(?:ed|ing)", "{} spacing"),
        (r"(1|2|3)[\"\']?\s+margins?", "{}-inch margins"),
        (r"(APA|MLA|Chicago|Vancouver|AMA)\s+(?:style|format|citation)", "{} citation style"),
    ]

    for pattern, template in hint_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            hint = template.format(match.group(1))
            if hint not in hints:
                hints.append(hint)

    return hints


def _extract_required_sections(text: str) -> List[str]:
    """Extract required sections for abstract/paper from guideline text."""
    sections: List[str] = []

    # Common required sections
    section_keywords = [
        "Background",
        "Objective",
        "Objectives",
        "Methods",
        "Methodology",
        "Results",
        "Conclusions",
        "Conclusion",
        "Introduction",
        "Discussion",
        "Hypothesis",
        "Aims",
        "Purpose",
        "Materials",
        "Design",
        "Setting",
        "Participants",
        "Interventions",
        "Main Outcome",
        "Outcomes",
    ]

    text_lower = text.lower()
    for section in section_keywords:
        # Look for section being mentioned as required
        patterns = [
            rf"\b{section.lower()}\b\s*(?:section|:)",
            rf"(?:include|must\s+have|require)\s+.*\b{section.lower()}\b",
            rf"(?:structured|format).*\b{section.lower()}\b",
        ]
        for pattern in patterns:
            if re.search(pattern, text_lower):
                if section not in sections:
                    sections.append(section)
                break

    return sections


# ============ DEMO Mode Fixture Data ============

DEMO_GUIDELINES: Dict[str, ExtractedGuidelines] = {
    "sages": ExtractedGuidelines(
        raw_text_sha256="demo_sages_sha256_placeholder",
        raw_text="""
SAGES Abstract Submission Guidelines (Sanitized Demo Data)

Abstract Requirements:
- Maximum 350 words (excluding title and authors)
- Structured format required: Background, Methods, Results, Conclusions
- All submissions must be blinded for peer review

Poster Specifications:
- Poster size: 48x36 inches (landscape orientation)
- File format: PDF only
- Resolution: minimum 300 DPI

Video Submissions:
- Maximum length: 10 minutes
- Format: MP4 (H.264 codec)
- Resolution: minimum 720p

Oral Presentations:
- 8 minutes presentation + 2 minutes Q&A
- Maximum 15 slides recommended
- PowerPoint (PPTX) or PDF format

Contact: [REDACTED:EMAIL]
Phone: [REDACTED:PHONE]
        """.strip(),
        abstract_word_limit=350,
        poster_size="48x36 inches",
        slide_limits={"max_slides": 15, "duration_minutes": 8, "qa_minutes": 2},
        file_types=["PDF", "PPTX", "MP4"],
        blinding_rules="Blind review required",
        abstract_deadline="November 15, 2026",
        formatting_hints=["Structured format required"],
        required_sections=["Background", "Methods", "Results", "Conclusions"],
        source_url="https://www.sages.org/meetings/abstract-submission/",
        conference_name="SAGES Annual Meeting",
        extraction_timestamp=datetime.utcnow().isoformat() + "Z",
        sanitization_summary={"EMAIL": 1, "PHONE": 1},
    ),
    "acs": ExtractedGuidelines(
        raw_text_sha256="demo_acs_sha256_placeholder",
        raw_text="""
ACS Clinical Congress Abstract Guidelines (Sanitized Demo Data)

Abstract Submission Requirements:
- Word limit: 400 words maximum
- Character limit: 2500 characters with spaces
- Structured abstract required
- Single-blind peer review process

Poster Guidelines:
- Dimensions: 4 feet wide x 3 feet tall (48x36 inches)
- Landscape orientation required
- Must include: Title, Authors, Institution, Background, Methods, Results, Conclusions

Oral Presentation:
- Duration: 10 minutes presentation + 5 minutes discussion
- Slides: Maximum 20 slides
- Format: PowerPoint or PDF

File Submissions:
- Accepted formats: PDF, DOCX, PPTX
- Maximum file size: 10MB

Important Dates:
- Abstract deadline: May 1, 2026
- Notification: July 15, 2026

For questions contact: [REDACTED:EMAIL]
        """.strip(),
        abstract_word_limit=400,
        abstract_char_limit=2500,
        poster_size="48x36 inches",
        slide_limits={"max_slides": 20, "duration_minutes": 10, "qa_minutes": 5},
        file_types=["PDF", "DOCX", "PPTX"],
        blinding_rules="Single-blind",
        abstract_deadline="May 1, 2026",
        formatting_hints=["Structured abstract required", "Landscape orientation required"],
        required_sections=["Background", "Methods", "Results", "Conclusions"],
        source_url="https://www.facs.org/clincon/abstract-submission/",
        conference_name="ACS Clinical Congress",
        extraction_timestamp=datetime.utcnow().isoformat() + "Z",
        sanitization_summary={"EMAIL": 1},
    ),
    "ascrs": ExtractedGuidelines(
        raw_text_sha256="demo_ascrs_sha256_placeholder",
        raw_text="""
ASCRS Annual Scientific Meeting - Submission Guidelines (Sanitized Demo Data)

Abstract Requirements:
- Maximum 300 words
- Must follow structured format: Objective, Methods, Results, Conclusion
- Double-blind review process
- No identifying information in abstract body

Poster Presentation:
- Size: A0 (841 x 1189 mm) or equivalent 33x47 inches
- Portrait orientation
- PDF format required

Oral Presentation Guidelines:
- Quickshot: 3 minutes, 3 slides maximum
- Standard: 7 minutes + 3 minutes Q&A, 12 slides maximum

Video Requirements:
- Maximum 8 minutes
- MP4 format, minimum 1080p resolution

Accepted File Types: PDF, PPTX, MP4

Submission Portal Contact: [REDACTED:EMAIL]
Technical Support: [REDACTED:PHONE]
        """.strip(),
        abstract_word_limit=300,
        poster_size="A0 (33x47 inches)",
        slide_limits={"max_slides": 12, "duration_minutes": 7, "qa_minutes": 3},
        file_types=["PDF", "PPTX", "MP4"],
        blinding_rules="Double-blind",
        abstract_deadline="January 15, 2026",
        formatting_hints=["Portrait orientation for posters"],
        required_sections=["Objective", "Methods", "Results", "Conclusion"],
        source_url="https://www.fascrs.org/meeting/abstract-submission/",
        conference_name="ASCRS Annual Scientific Meeting",
        extraction_timestamp=datetime.utcnow().isoformat() + "Z",
        sanitization_summary={"EMAIL": 1, "PHONE": 1},
    ),
    "asmbs": ExtractedGuidelines(
        raw_text_sha256="demo_asmbs_sha256_placeholder",
        raw_text="""
ASMBS Annual Meeting Abstract Submission (Sanitized Demo Data)

Abstract Guidelines:
- 350 word maximum (excluding title)
- Structured format: Background/Introduction, Methods, Results, Conclusion
- Single-blind peer review
- All patient data must be de-identified

Poster Specifications:
- Dimensions: 4x4 feet (48x48 inches) square format
- Electronic poster display
- PDF submission required

Oral Presentation:
- Duration: 8 minutes + 2 minutes Q&A
- Maximum 12 slides
- PPTX or PDF format accepted

Video Submission Guidelines:
- Maximum 10 minutes
- MP4 format required
- Narration required

File Formats Accepted: PDF, PPTX, DOCX, MP4

Key Dates:
- Abstract submission deadline: June 1, 2026
- Video submission deadline: July 1, 2026

Questions: [REDACTED:EMAIL]
        """.strip(),
        abstract_word_limit=350,
        poster_size="48x48 inches",
        slide_limits={"max_slides": 12, "duration_minutes": 8, "qa_minutes": 2},
        file_types=["PDF", "PPTX", "DOCX", "MP4"],
        blinding_rules="Single-blind",
        abstract_deadline="June 1, 2026",
        formatting_hints=["Square format poster", "Electronic poster display"],
        required_sections=["Background", "Methods", "Results", "Conclusion"],
        source_url="https://asmbs.org/professional-education/abstract-submission/",
        conference_name="ASMBS Annual Meeting",
        extraction_timestamp=datetime.utcnow().isoformat() + "Z",
        sanitization_summary={"EMAIL": 1},
    ),
    "default": ExtractedGuidelines(
        raw_text_sha256="demo_default_sha256_placeholder",
        raw_text="""
Conference Submission Guidelines (Generic Demo Data)

Standard Abstract Requirements:
- Word limit: 250-500 words (varies by conference)
- Structured format recommended
- Peer review process applies

General Poster Guidelines:
- Common sizes: 48x36 inches or A0
- PDF format typically required

Presentation Guidelines:
- Typical duration: 8-15 minutes
- Slide recommendations: 10-20 slides
- Common formats: PPTX, PDF

Contact conference organizers for specific requirements.
Email: [REDACTED:EMAIL]
        """.strip(),
        abstract_word_limit=500,
        poster_size="48x36 inches",
        slide_limits={"max_slides": 20, "duration_minutes": 10},
        file_types=["PDF", "PPTX"],
        blinding_rules=None,
        abstract_deadline=None,
        formatting_hints=["Structured format recommended"],
        required_sections=[],
        source_url="",
        conference_name="Generic Conference",
        extraction_timestamp=datetime.utcnow().isoformat() + "Z",
        sanitization_summary={"EMAIL": 1},
    ),
}


# ============ Main Extraction Functions ============

def extract_guidelines_from_text(
    raw_text: str,
    source_url: str = "",
    conference_name: str = "",
) -> ExtractedGuidelines:
    """
    Extract guidelines from raw text content.

    IMPORTANT: This function sanitizes PII/PHI before storing or returning
    any content. The raw_text in the result is always sanitized.

    Args:
        raw_text: Raw text content (may contain PII/PHI)
        source_url: URL where content was fetched from
        conference_name: Name of the conference

    Returns:
        ExtractedGuidelines with sanitized content and extracted fields
    """
    # CRITICAL: Sanitize text first - never store/log unsanitized scraped content
    sanitized_text, sanitization_summary = sanitize_text(raw_text)

    # Compute hash of sanitized text for integrity
    text_hash = compute_sha256(sanitized_text)

    # Extract structured fields from sanitized text
    return ExtractedGuidelines(
        raw_text_sha256=text_hash,
        raw_text=sanitized_text,
        abstract_word_limit=_extract_word_limit(sanitized_text),
        abstract_char_limit=_extract_char_limit(sanitized_text),
        poster_size=_extract_poster_size(sanitized_text),
        slide_limits=_extract_slide_limits(sanitized_text),
        file_types=_extract_file_types(sanitized_text),
        blinding_rules=_extract_blinding_rules(sanitized_text),
        abstract_deadline=None,  # Dates are complex; use fixtures for now
        full_paper_deadline=None,
        formatting_hints=_extract_formatting_hints(sanitized_text),
        required_sections=_extract_required_sections(sanitized_text),
        source_url=source_url,
        conference_name=conference_name,
        extraction_timestamp=datetime.utcnow().isoformat() + "Z",
        sanitization_summary=sanitization_summary,
    )


def extract_guidelines(
    input_params: GuidelineExtractionInput,
    demo_mode: bool = True,
) -> GuidelineExtractionResult:
    """
    Extract conference guidelines from URL.

    In DEMO mode, returns fixture data for known conferences.
    In LIVE mode, would fetch and parse actual web content (not implemented).

    Args:
        input_params: Extraction parameters including URL and formats
        demo_mode: If True, use fixture data instead of fetching

    Returns:
        GuidelineExtractionResult with extracted guidelines or error
    """
    if demo_mode:
        return _extract_guidelines_demo(input_params)
    else:
        # LIVE mode would implement actual web fetching here
        # For now, return error indicating not implemented
        return GuidelineExtractionResult(
            status="error",
            error_message="LIVE mode guideline extraction not yet implemented. Use DEMO mode.",
            mode="LIVE",
        )


def _extract_guidelines_demo(
    input_params: GuidelineExtractionInput,
) -> GuidelineExtractionResult:
    """
    DEMO mode guideline extraction using fixture data.

    Maps conference URLs to predefined fixture guidelines.
    """
    url_lower = input_params.conference_url.lower()
    conference_name = (input_params.conference_name or "").lower()

    # Match URL or conference name to fixtures
    guidelines: Optional[ExtractedGuidelines] = None

    if "sages" in url_lower or "sages" in conference_name:
        guidelines = DEMO_GUIDELINES["sages"]
    elif "facs" in url_lower or "acs" in conference_name or "clinical congress" in conference_name:
        guidelines = DEMO_GUIDELINES["acs"]
    elif "ascrs" in url_lower or "fascrs" in url_lower or "colorectal" in conference_name:
        guidelines = DEMO_GUIDELINES["ascrs"]
    elif "asmbs" in url_lower or "bariatric" in conference_name or "metabolic" in conference_name:
        guidelines = DEMO_GUIDELINES["asmbs"]
    else:
        # Use default/generic guidelines
        guidelines = DEMO_GUIDELINES["default"]

    # Update source URL if provided
    if input_params.conference_url:
        # Create a copy with updated URL
        guidelines = ExtractedGuidelines(
            raw_text_sha256=guidelines.raw_text_sha256,
            raw_text=guidelines.raw_text,
            abstract_word_limit=guidelines.abstract_word_limit,
            abstract_char_limit=guidelines.abstract_char_limit,
            poster_size=guidelines.poster_size,
            slide_limits=guidelines.slide_limits,
            file_types=guidelines.file_types,
            blinding_rules=guidelines.blinding_rules,
            abstract_deadline=guidelines.abstract_deadline,
            full_paper_deadline=guidelines.full_paper_deadline,
            formatting_hints=guidelines.formatting_hints,
            required_sections=guidelines.required_sections,
            source_url=input_params.conference_url,
            conference_name=input_params.conference_name or guidelines.conference_name,
            extraction_timestamp=datetime.utcnow().isoformat() + "Z",
            sanitization_summary=guidelines.sanitization_summary,
        )

    return GuidelineExtractionResult(
        status="success",
        guidelines=guidelines,
        mode="DEMO",
    )


def get_demo_guidelines(conference_key: str) -> Optional[ExtractedGuidelines]:
    """
    Get demo guidelines by conference key.

    Available keys: "sages", "acs", "ascrs", "asmbs", "default"
    """
    return DEMO_GUIDELINES.get(conference_key.lower())


def list_demo_conferences() -> List[str]:
    """List available demo conference keys."""
    return list(DEMO_GUIDELINES.keys())

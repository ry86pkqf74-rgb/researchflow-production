"""Data models for conference preparation"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class ConferenceCandidate:
    """Discovered conference"""
    conference_id: str
    name: str
    acronym: Optional[str]
    organizer: str
    url: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    location: Optional[str]
    submission_deadlines: Dict[str, Optional[str]]
    formats_supported: List[str]
    relevance_score: float
    matched_keywords: List[str]
    sources: List[Dict[str, str]]
    notes: str = ""


@dataclass
class GuidelineConstraints:
    """Structured submission constraints"""
    abstract_word_limit: Optional[int] = None
    title_char_limit: Optional[int] = None
    author_limit: Optional[int] = None
    blinding_required: bool = False
    poster_dimensions: Optional[Dict[str, Any]] = None
    file_types_allowed: List[str] = field(default_factory=list)
    max_file_size_mb: Optional[float] = None
    required_sections: List[str] = field(default_factory=list)
    slide_limit: Optional[int] = None
    talk_duration_minutes: Optional[int] = None
    video_duration_minutes: Optional[int] = None
    font_size_min: Optional[int] = None
    copyright_transfer_required: bool = False


@dataclass
class ValidationCheck:
    """Single validation check result"""
    id: str
    description: str
    status: str  # PASS, WARN, FAIL
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationReport:
    """Complete validation report"""
    conference_id: str
    format_type: str
    validated_at: str
    checks: List[ValidationCheck]
    overall_status: str
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

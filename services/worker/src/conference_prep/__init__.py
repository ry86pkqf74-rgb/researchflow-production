"""
Conference Preparation Module

Provides conference discovery, ranking, and guideline extraction for
surgical research conferences. Supports DEMO mode with offline-only
curated registry and fixture guideline data.
"""

from .registry import (
    CONFERENCE_REGISTRY,
    Conference,
    ConferenceFormat,
    get_conference_by_name,
    get_conferences_by_tag,
    get_all_conferences,
)

from .discovery import (
    discover_conferences,
    ConferenceDiscoveryInput,
    ConferenceDiscoveryResult,
    RankedConference,
)

from .guidelines import (
    extract_guidelines,
    extract_guidelines_from_text,
    sanitize_text,
    ExtractedGuidelines,
    GuidelineExtractionInput,
    GuidelineExtractionResult,
    get_demo_guidelines,
    list_demo_conferences,
    DEMO_GUIDELINES,
)

__all__ = [
    # Registry
    "CONFERENCE_REGISTRY",
    "Conference",
    "ConferenceFormat",
    "get_conference_by_name",
    "get_conferences_by_tag",
    "get_all_conferences",
    # Discovery
    "discover_conferences",
    "ConferenceDiscoveryInput",
    "ConferenceDiscoveryResult",
    "RankedConference",
    # Guidelines
    "extract_guidelines",
    "extract_guidelines_from_text",
    "sanitize_text",
    "ExtractedGuidelines",
    "GuidelineExtractionInput",
    "GuidelineExtractionResult",
    "get_demo_guidelines",
    "list_demo_conferences",
    "DEMO_GUIDELINES",
]

"""
Conference Preparation Module

Provides conference discovery and ranking for surgical research conferences.
Supports DEMO mode with offline-only curated registry.
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
]

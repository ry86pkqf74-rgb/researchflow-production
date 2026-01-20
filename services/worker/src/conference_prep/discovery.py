"""
Conference Discovery Module

Implements deterministic ranking algorithm for conference recommendations
based on keyword overlap, format match, timing, and location preferences.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Set, Tuple
from datetime import datetime
from enum import Enum

from .registry import (
    Conference,
    ConferenceFormat,
    CONFERENCE_REGISTRY,
    get_all_conferences,
)


@dataclass
class ConferenceDiscoveryInput:
    """Input parameters for conference discovery."""

    keywords: List[str] = field(default_factory=list)
    year_range: Optional[Tuple[int, int]] = None  # (start_year, end_year)
    location_pref: Optional[str] = None  # e.g., "United States", "international"
    formats: List[str] = field(default_factory=list)  # ["poster", "oral", etc.]
    max_results: int = 10
    target_month: Optional[int] = None  # 1-12, for timing relevance
    min_score: float = 0.0  # Minimum score threshold (0-1)

    def get_format_enums(self) -> List[ConferenceFormat]:
        """Convert format strings to ConferenceFormat enums."""
        result = []
        for fmt_str in self.formats:
            try:
                result.append(ConferenceFormat(fmt_str.lower()))
            except ValueError:
                continue
        return result


@dataclass
class RankedConference:
    """A conference with its computed relevance score and explanation."""

    conference: Conference
    score: float  # 0-1 overall relevance score
    why: str  # Human-readable explanation
    score_breakdown: dict = field(default_factory=dict)  # Detailed scoring

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "conference": self.conference.to_dict(),
            "score": round(self.score, 3),
            "why": self.why,
            "score_breakdown": self.score_breakdown,
        }


@dataclass
class ConferenceDiscoveryResult:
    """Result of conference discovery operation."""

    ranked_conferences: List[RankedConference]
    total_matched: int
    query_info: dict
    generated_at: str

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "ranked_conferences": [rc.to_dict() for rc in self.ranked_conferences],
            "total_matched": self.total_matched,
            "query_info": self.query_info,
            "generated_at": self.generated_at,
        }


# ============ Scoring Weights ============

# These weights are tuned for surgical research conference discovery
SCORING_WEIGHTS = {
    "keyword_overlap": 0.40,  # Most important: topic relevance
    "format_match": 0.25,     # Format availability
    "timing_relevance": 0.20, # Abstract deadline timing
    "location_pref": 0.10,    # Location preference
    "impact_score": 0.05,     # Conference prestige/impact
}


def _compute_keyword_score(conference: Conference, keywords: List[str]) -> Tuple[float, List[str]]:
    """
    Compute keyword overlap score (0-1).
    Returns (score, matched_keywords).
    """
    if not keywords:
        return 1.0, []  # No keywords = match all equally

    matched = []
    for keyword in keywords:
        keyword_lower = keyword.lower()

        # Check name and abbreviation
        if keyword_lower in conference.name.lower():
            matched.append(keyword)
            continue
        if keyword_lower in conference.abbreviation.lower():
            matched.append(keyword)
            continue

        # Check tags
        if any(keyword_lower in tag.lower() for tag in conference.tags):
            matched.append(keyword)
            continue

        # Check keywords
        if any(keyword_lower in kw.lower() for kw in conference.keywords):
            matched.append(keyword)
            continue

        # Check organization
        if keyword_lower in conference.organization.lower():
            matched.append(keyword)
            continue

    # Score is proportion of keywords matched
    if not keywords:
        return 1.0, matched

    score = len(matched) / len(keywords)
    return score, matched


def _compute_format_score(conference: Conference, formats: List[ConferenceFormat]) -> Tuple[float, List[str]]:
    """
    Compute format match score (0-1).
    Returns (score, matched_formats).
    """
    if not formats:
        return 1.0, []  # No format preference = match all equally

    matched = []
    for fmt in formats:
        if fmt in conference.supported_formats:
            matched.append(fmt.value)

    # Score is proportion of formats available
    score = len(matched) / len(formats)
    return score, matched


def _compute_timing_score(conference: Conference, target_month: Optional[int]) -> Tuple[float, str]:
    """
    Compute timing relevance score (0-1).
    Higher scores for conferences with upcoming abstract deadlines.
    Returns (score, timing_note).
    """
    if target_month is None:
        # Use current month if not specified
        target_month = datetime.now().month

    # Calculate months until conference
    conf_month = conference.typical_month
    months_diff = (conf_month - target_month) % 12

    # Ideal: conference is 4-8 months away (time to prepare and submit)
    if 4 <= months_diff <= 8:
        score = 1.0
        note = f"Optimal timing: ~{months_diff} months away"
    elif 2 <= months_diff <= 10:
        score = 0.7
        note = f"Good timing: ~{months_diff} months away"
    elif months_diff <= 2:
        score = 0.3
        note = f"May be too soon: ~{months_diff} months away"
    else:
        score = 0.5
        note = f"Distant: ~{months_diff} months away"

    return score, note


def _compute_location_score(conference: Conference, location_pref: Optional[str]) -> Tuple[float, str]:
    """
    Compute location preference score (0-1).
    Returns (score, location_note).
    """
    if not location_pref:
        return 1.0, ""  # No preference

    pref_lower = location_pref.lower()
    conf_location = conference.location.lower()
    conf_scope = conference.scope.lower()

    # Check for direct match
    if pref_lower in conf_location:
        return 1.0, f"Location match: {conference.location}"

    # Check scope preference
    if pref_lower == "international" and conf_scope == "international":
        return 1.0, "International conference"
    if pref_lower == "national" and conf_scope == "national":
        return 0.8, "National conference"
    if pref_lower == "united states" and "united states" in conf_location:
        return 1.0, "US-based conference"

    # Partial match
    return 0.5, f"Location: {conference.location}"


def _generate_why_explanation(
    conference: Conference,
    keyword_matches: List[str],
    format_matches: List[str],
    timing_note: str,
    location_note: str,
    score: float,
) -> str:
    """Generate human-readable explanation for ranking."""
    parts = []

    # Score category
    if score >= 0.8:
        parts.append("Excellent match")
    elif score >= 0.6:
        parts.append("Good match")
    elif score >= 0.4:
        parts.append("Moderate match")
    else:
        parts.append("Partial match")

    # Keyword matches
    if keyword_matches:
        if len(keyword_matches) <= 3:
            parts.append(f"matches: {', '.join(keyword_matches)}")
        else:
            parts.append(f"matches {len(keyword_matches)} keywords")

    # Format matches
    if format_matches:
        parts.append(f"supports: {', '.join(format_matches)}")

    # Timing
    if timing_note:
        parts.append(timing_note.lower())

    return "; ".join(parts)


def rank_conference(
    conference: Conference,
    input_params: ConferenceDiscoveryInput,
) -> RankedConference:
    """
    Compute relevance score and ranking for a single conference.
    All scoring is deterministic based on input parameters.
    """
    # Compute individual scores
    keyword_score, keyword_matches = _compute_keyword_score(
        conference, input_params.keywords
    )
    format_score, format_matches = _compute_format_score(
        conference, input_params.get_format_enums()
    )
    timing_score, timing_note = _compute_timing_score(
        conference, input_params.target_month
    )
    location_score, location_note = _compute_location_score(
        conference, input_params.location_pref
    )
    impact_score = conference.impact_score

    # Compute weighted overall score
    overall_score = (
        SCORING_WEIGHTS["keyword_overlap"] * keyword_score +
        SCORING_WEIGHTS["format_match"] * format_score +
        SCORING_WEIGHTS["timing_relevance"] * timing_score +
        SCORING_WEIGHTS["location_pref"] * location_score +
        SCORING_WEIGHTS["impact_score"] * impact_score
    )

    # Build score breakdown
    score_breakdown = {
        "keyword_overlap": {
            "score": round(keyword_score, 3),
            "weight": SCORING_WEIGHTS["keyword_overlap"],
            "matched": keyword_matches,
        },
        "format_match": {
            "score": round(format_score, 3),
            "weight": SCORING_WEIGHTS["format_match"],
            "matched": format_matches,
        },
        "timing_relevance": {
            "score": round(timing_score, 3),
            "weight": SCORING_WEIGHTS["timing_relevance"],
            "note": timing_note,
        },
        "location_pref": {
            "score": round(location_score, 3),
            "weight": SCORING_WEIGHTS["location_pref"],
            "note": location_note,
        },
        "impact_score": {
            "score": round(impact_score, 3),
            "weight": SCORING_WEIGHTS["impact_score"],
        },
    }

    # Generate explanation
    why = _generate_why_explanation(
        conference,
        keyword_matches,
        format_matches,
        timing_note,
        location_note,
        overall_score,
    )

    return RankedConference(
        conference=conference,
        score=overall_score,
        why=why,
        score_breakdown=score_breakdown,
    )


def discover_conferences(
    input_params: ConferenceDiscoveryInput,
) -> ConferenceDiscoveryResult:
    """
    Discover and rank conferences based on input criteria.

    This is the main entry point for conference discovery.
    All operations are deterministic and work offline (DEMO mode compatible).

    Args:
        input_params: Discovery parameters including keywords, formats, etc.

    Returns:
        ConferenceDiscoveryResult with ranked conferences and metadata.
    """
    # Get all conferences from registry
    all_conferences = get_all_conferences()

    # Score and rank all conferences
    ranked = []
    for conf in all_conferences:
        ranked_conf = rank_conference(conf, input_params)

        # Apply minimum score filter
        if ranked_conf.score >= input_params.min_score:
            ranked.append(ranked_conf)

    # Sort by score (descending), then by name (ascending) for deterministic ordering
    ranked.sort(key=lambda x: (-x.score, x.conference.name))

    # Apply max_results limit
    total_matched = len(ranked)
    ranked = ranked[: input_params.max_results]

    # Build result
    return ConferenceDiscoveryResult(
        ranked_conferences=ranked,
        total_matched=total_matched,
        query_info={
            "keywords": input_params.keywords,
            "formats": input_params.formats,
            "location_pref": input_params.location_pref,
            "target_month": input_params.target_month,
            "max_results": input_params.max_results,
            "min_score": input_params.min_score,
            "registry_size": len(all_conferences),
        },
        generated_at=datetime.utcnow().isoformat() + "Z",
    )


def quick_discover(
    keywords: List[str],
    max_results: int = 5,
) -> List[RankedConference]:
    """
    Simplified discovery with just keywords.
    Convenience function for quick lookups.
    """
    input_params = ConferenceDiscoveryInput(
        keywords=keywords,
        max_results=max_results,
    )
    result = discover_conferences(input_params)
    return result.ranked_conferences

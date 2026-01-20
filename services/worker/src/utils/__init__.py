"""Shared utility modules used across Research Operating System Template."""

from .template_loader import (
    load_draft_outline_config,
    get_draft_types,
    get_sections_for_type,
    get_required_elements,
    generate_section_prompt,
    RUO_DRAFT_DISCLAIMER,
)

from .keyword_extraction import (
    extract_keywords_tfidf,
    extract_keywords_rake,
    extract_keywords_from_abstracts,
    KeywordResult,
)

__all__ = [
    "load_draft_outline_config",
    "get_draft_types",
    "get_sections_for_type",
    "get_required_elements",
    "generate_section_prompt",
    "RUO_DRAFT_DISCLAIMER",
    # Keyword extraction
    "extract_keywords_tfidf",
    "extract_keywords_rake",
    "extract_keywords_from_abstracts",
    "KeywordResult",
]

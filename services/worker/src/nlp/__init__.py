"""
NLP Module

Provides natural language processing capabilities including:
- Entity extraction using scispaCy
- Text preprocessing
- Biomedical NER
"""

from .entity_extraction import (
    EntityExtractor,
    EntityResult,
    extract_entities,
    is_scispacy_available,
)

__all__ = [
    "EntityExtractor",
    "EntityResult",
    "extract_entities",
    "is_scispacy_available",
]

"""
spaCy NLP Pipeline for Entity Extraction
Phase A - Task 2: spaCy NLP Pipeline

Extracts and normalizes named entities from text.
"""

import spacy
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

# spaCy model name
SPACY_MODEL = "en_core_web_sm"


@dataclass(frozen=True)
class Entity:
    """Individual named entity"""
    text: str
    label: str  # PERSON, ORG, GPE, DATE, etc.
    start: int
    end: int


@dataclass(frozen=True)
class NLPResult:
    """Result of NLP entity extraction"""
    entities: List[Entity]
    normalized: Dict[str, List[str]]
    entity_count: int
    success: bool


class NLPProcessingError(RuntimeError):
    """Raised when NLP processing fails"""
    pass


class NLPPipeline:
    """
    spaCy-based NLP pipeline for entity extraction

    Following ResearchFlow patterns:
    - Lazy model loading (singleton pattern)
    - Fail-closed on model load failure
    - Structured result dataclasses
    """

    def __init__(self, model_name: str = SPACY_MODEL):
        self.model_name = model_name
        self._nlp = None

    @property
    def nlp(self):
        """Lazy load spaCy model"""
        if self._nlp is None:
            try:
                logger.info(f"Loading spaCy model: {self.model_name}")
                self._nlp = spacy.load(self.model_name)
                logger.info("spaCy model loaded successfully")
            except Exception as e:
                error_msg = f"Failed to load spaCy model {self.model_name}: {e}"
                logger.error(error_msg)
                raise NLPProcessingError(error_msg)

        return self._nlp

    def extract_entities(self, text: str) -> NLPResult:
        """
        Extract named entities from text

        Args:
            text: Input text to process

        Returns:
            NLPResult with entities and normalized entities

        Raises:
            NLPProcessingError: If extraction fails
        """
        if not text or len(text.strip()) == 0:
            return NLPResult(
                entities=[],
                normalized={},
                entity_count=0,
                success=True
            )

        try:
            logger.info(f"Extracting entities from {len(text)} characters")

            # Process text with spaCy
            doc = self.nlp(text)

            # Extract entities
            entities = []
            for ent in doc.ents:
                entities.append(Entity(
                    text=ent.text,
                    label=ent.label_,
                    start=ent.start_char,
                    end=ent.end_char
                ))

            logger.info(f"Extracted {len(entities)} entities")

            # Normalize entities
            normalized = self.normalize_entities(entities)

            return NLPResult(
                entities=entities,
                normalized=normalized,
                entity_count=len(entities),
                success=True
            )

        except Exception as e:
            error_msg = f"NLP entity extraction failed: {e}"
            logger.error(error_msg)
            raise NLPProcessingError(error_msg)

    def normalize_entities(self, entities: List[Entity]) -> Dict[str, List[str]]:
        """
        Group and normalize entities by type

        Normalization:
        - Lowercase
        - Strip whitespace
        - Deduplicate within each entity type

        Args:
            entities: List of extracted entities

        Returns:
            Dictionary mapping entity labels to normalized entity texts
        """
        normalized: Dict[str, List[str]] = {}

        for entity in entities:
            label = entity.label
            text = entity.text

            # Initialize list for this label if needed
            if label not in normalized:
                normalized[label] = []

            # Normalize text
            normalized_text = text.strip().lower()

            # Add if not already present (deduplicate)
            if normalized_text and normalized_text not in normalized[label]:
                normalized[label].append(normalized_text)

        # Sort entities within each label for deterministic output
        for label in normalized:
            normalized[label].sort()

        return normalized

    def extract_entities_by_type(
        self,
        text: str,
        entity_types: List[str]
    ) -> Dict[str, List[Entity]]:
        """
        Extract entities filtered by specific types

        Args:
            text: Input text to process
            entity_types: List of entity types to extract (e.g., ["PERSON", "ORG"])

        Returns:
            Dictionary mapping entity types to lists of entities
        """
        result = self.extract_entities(text)

        filtered: Dict[str, List[Entity]] = {et: [] for et in entity_types}

        for entity in result.entities:
            if entity.label in entity_types:
                filtered[entity.label].append(entity)

        return filtered


# Singleton instance (lazy loading)
_nlp_pipeline: Optional[NLPPipeline] = None


def get_nlp_pipeline() -> NLPPipeline:
    """Get global NLP pipeline instance"""
    global _nlp_pipeline
    if _nlp_pipeline is None:
        _nlp_pipeline = NLPPipeline()
    return _nlp_pipeline


def extract_entities(text: str) -> NLPResult:
    """
    Convenience function for entity extraction

    Args:
        text: Input text to process

    Returns:
        NLPResult with entities
    """
    pipeline = get_nlp_pipeline()
    return pipeline.extract_entities(text)

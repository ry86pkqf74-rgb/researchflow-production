"""
NLP Entity Extraction

Extracts named entities from text using spaCy.
Includes confidence scoring and PHI filtering.
"""

from __future__ import annotations

import os
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)

ENABLE_NLP = os.getenv("ENABLE_NLP", "true").lower() == "true"

# PHI-related entity types that should be redacted
PHI_ENTITY_TYPES = {'PERSON', 'DATE', 'GPE', 'LOC', 'FAC'}


@dataclass
class Entity:
    """Extracted entity"""
    text: str
    label: str
    start: int
    end: int
    confidence: float
    method: str = "spacy"
    redacted: bool = False


@dataclass
class EntityResult:
    """Complete entity extraction result"""
    entities: List[Entity]
    entity_counts: Dict[str, int]
    success: bool
    text_length: int
    phi_entities_redacted: int = 0
    error: Optional[str] = None


def _load_spacy_model(model_name: str = "en_core_web_sm"):
    """Load spaCy model with fallback"""
    try:
        import spacy
        return spacy.load(model_name)
    except OSError:
        # Try to download model
        logger.info(f"Downloading spaCy model: {model_name}")
        import subprocess
        subprocess.run(["python", "-m", "spacy", "download", model_name], check=True)
        import spacy
        return spacy.load(model_name)


def _estimate_confidence(ent, doc) -> float:
    """
    Estimate confidence score for an entity.

    Uses heuristics based on:
    - Entity label type
    - Context
    - Token characteristics
    """
    # Base confidence by entity type
    type_confidence = {
        'PERSON': 0.85,
        'ORG': 0.80,
        'GPE': 0.90,
        'DATE': 0.95,
        'MONEY': 0.95,
        'PERCENT': 0.95,
        'TIME': 0.90,
        'PRODUCT': 0.70,
        'EVENT': 0.75,
        'WORK_OF_ART': 0.70,
        'LAW': 0.80,
        'LANGUAGE': 0.85,
        'NORP': 0.80,
        'FAC': 0.75,
        'LOC': 0.85,
        'QUANTITY': 0.90,
        'ORDINAL': 0.95,
        'CARDINAL': 0.95,
    }

    base = type_confidence.get(ent.label_, 0.75)

    # Adjust based on entity length
    if len(ent.text) < 2:
        base *= 0.8
    elif len(ent.text) > 50:
        base *= 0.9

    # Adjust based on capitalization
    if ent.label_ in {'PERSON', 'ORG', 'GPE'} and not ent.text[0].isupper():
        base *= 0.7

    return min(base, 1.0)


def extract_entities(
    text: str,
    model_name: str = "en_core_web_sm",
    fail_closed: bool = True,
    include_phi_types: bool = False
) -> EntityResult:
    """
    Extract named entities from text.

    Args:
        text: Text to analyze
        model_name: spaCy model to use
        fail_closed: If True, redact PHI entity values
        include_phi_types: If True, include PHI types (redacted if fail_closed)

    Returns:
        EntityResult with extracted entities
    """
    if not ENABLE_NLP:
        return EntityResult(
            entities=[],
            entity_counts={},
            success=False,
            text_length=len(text),
            error="NLP is disabled (ENABLE_NLP=false)"
        )

    try:
        nlp = _load_spacy_model(model_name)
        doc = nlp(text)

        entities: List[Entity] = []
        entity_counts: Dict[str, int] = {}
        phi_redacted = 0

        for ent in doc.ents:
            is_phi = ent.label_ in PHI_ENTITY_TYPES

            # Skip PHI types if not included
            if is_phi and not include_phi_types:
                phi_redacted += 1
                continue

            # Redact PHI values if fail_closed
            entity_text = ent.text
            redacted = False

            if is_phi and fail_closed:
                entity_text = f"[{ent.label_}]"
                redacted = True
                phi_redacted += 1

            # Additional PHI check on entity text
            if not is_phi and fail_closed:
                _, findings = guard_text(ent.text, fail_closed=True)
                if findings:
                    entity_text = f"[REDACTED:{ent.label_}]"
                    redacted = True
                    phi_redacted += 1

            confidence = _estimate_confidence(ent, doc)

            entities.append(Entity(
                text=entity_text,
                label=ent.label_,
                start=ent.start_char,
                end=ent.end_char,
                confidence=confidence,
                method="spacy",
                redacted=redacted
            ))

            # Count by label
            entity_counts[ent.label_] = entity_counts.get(ent.label_, 0) + 1

        return EntityResult(
            entities=entities,
            entity_counts=entity_counts,
            success=True,
            text_length=len(text),
            phi_entities_redacted=phi_redacted
        )

    except ImportError as e:
        return EntityResult(
            entities=[],
            entity_counts={},
            success=False,
            text_length=len(text),
            error=f"spaCy not installed: {e}"
        )
    except Exception as e:
        logger.exception(f"Entity extraction failed: {e}")
        return EntityResult(
            entities=[],
            entity_counts={},
            success=False,
            text_length=len(text),
            error=str(e)
        )


def extract_medical_entities(
    text: str,
    fail_closed: bool = True
) -> EntityResult:
    """
    Extract medical/clinical entities using scispaCy (if available).

    Falls back to standard spaCy if scispaCy not installed.

    Args:
        text: Text to analyze
        fail_closed: If True, redact PHI

    Returns:
        EntityResult with medical entities
    """
    # Try scispaCy models in order of preference
    models_to_try = [
        "en_ner_bc5cdr_md",  # Diseases and chemicals
        "en_ner_bionlp13cg_md",  # Cancer genetics
        "en_core_sci_sm",  # General scientific
        "en_core_web_sm",  # Fallback
    ]

    for model in models_to_try:
        try:
            return extract_entities(text, model_name=model, fail_closed=fail_closed)
        except Exception:
            continue

    # All models failed
    return EntityResult(
        entities=[],
        entity_counts={},
        success=False,
        text_length=len(text),
        error="No suitable NLP model available"
    )

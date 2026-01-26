"""
Entity Extraction using scispaCy

Extracts biomedical and scientific entities from text using scispaCy models.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

# Feature flag for scispaCy
SCISPACY_ENABLED = os.getenv("SCISPACY_ENABLED", "false").lower() == "true"
SCISPACY_MODEL = os.getenv("SCISPACY_MODEL", "en_core_sci_sm")


@dataclass
class Entity:
    """A single extracted entity."""
    text: str
    label: str
    start: int
    end: int
    confidence: Optional[float] = None
    cui: Optional[str] = None  # Concept Unique Identifier (for UMLS linking)
    definition: Optional[str] = None


@dataclass
class EntityResult:
    """Result of entity extraction."""
    success: bool
    entities: List[Entity] = field(default_factory=list)
    entity_types: Dict[str, int] = field(default_factory=dict)
    unique_entities: int = 0
    total_entities: int = 0
    text_length: int = 0
    model: str = ""
    errors: List[str] = field(default_factory=list)


class EntityExtractor:
    """
    Entity extractor using scispaCy.

    Supports multiple scispaCy models:
    - en_core_sci_sm: Small model for general scientific text
    - en_core_sci_md: Medium model with word vectors
    - en_core_sci_lg: Large model with word vectors
    - en_ner_craft_md: CRAFT corpus NER
    - en_ner_jnlpba_md: JNLPBA corpus NER
    - en_ner_bc5cdr_md: BC5CDR corpus NER (chemicals, diseases)
    - en_ner_bionlp13cg_md: BioNLP13CG NER

    Can also link entities to UMLS with scispacy-linking.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        enable_umls_linking: bool = False,
    ):
        self.model_name = model or SCISPACY_MODEL
        self.enable_umls_linking = enable_umls_linking
        self._nlp = None
        self._available = None

    def is_available(self) -> bool:
        """Check if scispaCy is available."""
        if self._available is not None:
            return self._available

        if not SCISPACY_ENABLED:
            self._available = False
            return False

        try:
            import spacy
            self._available = True
        except ImportError:
            self._available = False

        return self._available

    def _load_model(self):
        """Lazy load the spaCy model."""
        if self._nlp is not None:
            return self._nlp

        if not self.is_available():
            raise RuntimeError("scispaCy is not available")

        import spacy

        try:
            self._nlp = spacy.load(self.model_name)
            logger.info(f"Loaded scispaCy model: {self.model_name}")
        except OSError:
            # Try to download the model
            logger.info(f"Model {self.model_name} not found, attempting download...")
            try:
                import subprocess
                subprocess.run(
                    ["pip", "install", self.model_name],
                    check=True,
                    capture_output=True,
                )
                self._nlp = spacy.load(self.model_name)
            except Exception as e:
                raise RuntimeError(
                    f"Could not load or download model {self.model_name}: {e}"
                )

        # Add UMLS linker if requested
        if self.enable_umls_linking:
            try:
                from scispacy.linking import EntityLinker
                if "scispacy_linker" not in self._nlp.pipe_names:
                    self._nlp.add_pipe("scispacy_linker", config={
                        "resolve_abbreviations": True,
                        "linker_name": "umls"
                    })
            except ImportError:
                logger.warning("scispacy-linking not available for UMLS linking")
            except Exception as e:
                logger.warning(f"Could not add UMLS linker: {e}")

        return self._nlp

    def extract(
        self,
        text: str,
        entity_types: Optional[Set[str]] = None,
        max_length: int = 1000000,
    ) -> EntityResult:
        """
        Extract entities from text.

        Args:
            text: Text to process
            entity_types: Filter to specific entity types (None for all)
            max_length: Maximum text length to process

        Returns:
            EntityResult with extracted entities
        """
        if not self.is_available():
            return EntityResult(
                success=False,
                model=self.model_name,
                errors=["scispaCy is not available. Set SCISPACY_ENABLED=true and install scispacy."],
            )

        if not text or not text.strip():
            return EntityResult(
                success=True,
                model=self.model_name,
                text_length=0,
            )

        # Truncate if too long
        if len(text) > max_length:
            text = text[:max_length]
            logger.warning(f"Text truncated to {max_length} characters")

        try:
            nlp = self._load_model()
            doc = nlp(text)

            entities = []
            type_counts: Dict[str, int] = {}
            seen_entities: Set[str] = set()

            for ent in doc.ents:
                # Filter by entity type if specified
                if entity_types and ent.label_ not in entity_types:
                    continue

                entity = Entity(
                    text=ent.text,
                    label=ent.label_,
                    start=ent.start_char,
                    end=ent.end_char,
                )

                # Add UMLS info if available
                if hasattr(ent, "_.kb_ents") and ent._.kb_ents:
                    top_match = ent._.kb_ents[0]
                    entity.cui = top_match[0]
                    entity.confidence = top_match[1]

                entities.append(entity)

                # Track statistics
                type_counts[ent.label_] = type_counts.get(ent.label_, 0) + 1
                seen_entities.add(ent.text.lower())

            return EntityResult(
                success=True,
                entities=entities,
                entity_types=type_counts,
                unique_entities=len(seen_entities),
                total_entities=len(entities),
                text_length=len(text),
                model=self.model_name,
            )

        except Exception as e:
            logger.exception(f"Entity extraction error: {e}")
            return EntityResult(
                success=False,
                model=self.model_name,
                errors=[str(e)],
            )

    def extract_batch(
        self,
        texts: List[str],
        entity_types: Optional[Set[str]] = None,
        batch_size: int = 100,
    ) -> List[EntityResult]:
        """
        Extract entities from multiple texts.

        Args:
            texts: List of texts to process
            entity_types: Filter to specific entity types
            batch_size: Batch size for processing

        Returns:
            List of EntityResult objects
        """
        if not self.is_available():
            return [
                EntityResult(
                    success=False,
                    model=self.model_name,
                    errors=["scispaCy is not available"],
                )
                for _ in texts
            ]

        results = []
        for text in texts:
            result = self.extract(text, entity_types)
            results.append(result)

        return results

    def get_entity_types(self) -> List[str]:
        """Get available entity types for the loaded model."""
        if not self.is_available():
            return []

        try:
            nlp = self._load_model()
            if hasattr(nlp, "get_pipe") and "ner" in nlp.pipe_names:
                ner = nlp.get_pipe("ner")
                return list(ner.labels)
            return []
        except Exception:
            return []


def extract_entities(
    text: str,
    model: Optional[str] = None,
    entity_types: Optional[Set[str]] = None,
) -> EntityResult:
    """
    Extract entities from text using scispaCy.

    Args:
        text: Text to process
        model: scispaCy model name (uses default if not specified)
        entity_types: Filter to specific entity types

    Returns:
        EntityResult with extracted entities
    """
    extractor = EntityExtractor(model=model)
    return extractor.extract(text, entity_types)


def is_scispacy_available() -> bool:
    """Check if scispaCy is available."""
    extractor = EntityExtractor()
    return extractor.is_available()


# Common entity type sets for convenience
BIOMEDICAL_ENTITIES = {"DISEASE", "CHEMICAL", "GENE", "PROTEIN", "SPECIES"}
CLINICAL_ENTITIES = {"DISEASE", "DRUG", "SYMPTOM", "PROCEDURE", "ANATOMY"}
GENE_PROTEIN_ENTITIES = {"GENE", "PROTEIN", "GENE_OR_GENE_PRODUCT"}

"""
NLP Module

Provides entity extraction and text analysis.
Gated by ENABLE_NLP environment variable.
"""

import os

ENABLE_NLP = os.getenv("ENABLE_NLP", "true").lower() == "true"

if ENABLE_NLP:
    from .entity_extractor import (
        extract_entities,
        EntityResult,
        Entity,
    )

    __all__ = [
        'extract_entities',
        'EntityResult',
        'Entity',
    ]
else:
    __all__ = []

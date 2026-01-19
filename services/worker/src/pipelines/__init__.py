"""
ML/NLP Pipelines Module
Phase A - Tasks 1 & 2: OCR and NLP Pipelines
"""

from .ocr_pipeline import (
    OCRPipeline,
    OCRResult,
    OCRProcessingError,
    PHIScrubError,
    get_ocr_pipeline
)

from .nlp_pipeline import (
    NLPPipeline,
    NLPResult,
    Entity,
    NLPProcessingError,
    get_nlp_pipeline,
    extract_entities
)

__all__ = [
    # OCR
    "OCRPipeline",
    "OCRResult",
    "OCRProcessingError",
    "PHIScrubError",
    "get_ocr_pipeline",
    # NLP
    "NLPPipeline",
    "NLPResult",
    "Entity",
    "NLPProcessingError",
    "get_nlp_pipeline",
    "extract_entities"
]

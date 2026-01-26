"""
Data Extraction Module - LLM-powered clinical data extraction.

This module provides tools for extracting structured clinical data from
unstructured text using LLMs routed through the governance-compliant AI Router.

Key Components:
- schemas.py: Pydantic models for extraction output
- extract_from_cells.py: Main extraction logic
- nlm_enrichment.py: MeSH term enrichment

Example Usage:
    from data_extraction import extract_clinical_from_cell, ClinicalExtraction
    
    result = await extract_clinical_from_cell(
        cell_text="Patient underwent laparoscopic cholecystectomy...",
        metadata={"file_id": "abc123", "column": "operative_note"}
    )
    print(result.extraction.procedures)
"""

from .schemas import (
    ClinicalExtraction,
    NoteClassification,
    NoteType,
    Evidence,
    CodedTerm,
    MedicationEntry,
    VitalSign,
    LabResult,
    ExtractionRequest,
    ExtractionResponse,
    EnrichmentRequest,
    EnrichmentResponse,
    MeSHMapping,
    get_clinical_extraction_schema,
    get_note_classification_schema,
)

from .extract_from_cells import (
    extract_clinical_from_cell,
    extract_batch,
    extract_sync,
    choose_tier,
    ExtractionError,
)

from .nlm_enrichment import (
    enrich_terms_with_mesh,
    enrich_extraction,
    enrich_terms_sync,
    EnrichmentError,
)

__all__ = [
    # Schemas
    "ClinicalExtraction",
    "NoteClassification", 
    "NoteType",
    "Evidence",
    "CodedTerm",
    "MedicationEntry",
    "VitalSign",
    "LabResult",
    "ExtractionRequest",
    "ExtractionResponse",
    "EnrichmentRequest",
    "EnrichmentResponse",
    "MeSHMapping",
    "get_clinical_extraction_schema",
    "get_note_classification_schema",
    # Extraction
    "extract_clinical_from_cell",
    "extract_batch",
    "extract_sync",
    "choose_tier",
    "ExtractionError",
    # Enrichment
    "enrich_terms_with_mesh",
    "enrich_extraction",
    "enrich_terms_sync",
    "EnrichmentError",
]

__version__ = "1.0.0"

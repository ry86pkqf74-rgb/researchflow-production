"""
Clinical Extraction Schemas - Pydantic models for LLM extraction outputs.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class NoteType(str, Enum):
    OPERATIVE_NOTE = "operative_note"
    DISCHARGE_SUMMARY = "discharge_summary"
    PROGRESS_NOTE = "progress_note"
    RADIOLOGY_REPORT = "radiology_report"
    PATHOLOGY_REPORT = "pathology_report"
    CONSULTATION = "consultation"
    H_AND_P = "history_and_physical"
    PROCEDURE_NOTE = "procedure_note"
    NURSING_NOTE = "nursing_note"
    OTHER = "other"


class Evidence(BaseModel):
    quote: str = Field(..., description="Direct excerpt from input text")
    start: Optional[int] = None
    end: Optional[int] = None


class CodedTerm(BaseModel):
    text: str = Field(..., description="Original extracted text")
    normalized: Optional[str] = None
    mesh_id: Optional[str] = None
    mesh_label: Optional[str] = None
    mesh_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    icd10_code: Optional[str] = None
    snomed_code: Optional[str] = None
    evidence: List[Evidence] = Field(default_factory=list)


class MedicationEntry(BaseModel):
    name: str
    dose: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    indication: Optional[str] = None
    mesh_id: Optional[str] = None
    rxnorm_code: Optional[str] = None
    evidence: List[Evidence] = Field(default_factory=list)


class VitalSign(BaseModel):
    type: str
    value: str
    timestamp: Optional[str] = None
    evidence: List[Evidence] = Field(default_factory=list)


class LabResult(BaseModel):
    test_name: str
    value: str
    reference_range: Optional[str] = None
    flag: Optional[str] = None
    loinc_code: Optional[str] = None
    evidence: List[Evidence] = Field(default_factory=list)


class ClinicalExtraction(BaseModel):
    note_type: Optional[NoteType] = None
    extraction_version: str = Field(default="1.0.0")
    diagnoses: List[CodedTerm] = Field(default_factory=list)
    procedures: List[CodedTerm] = Field(default_factory=list)
    medications: List[MedicationEntry] = Field(default_factory=list)
    outcomes: List[CodedTerm] = Field(default_factory=list)
    complications: List[CodedTerm] = Field(default_factory=list)
    ros_symptoms: List[CodedTerm] = Field(default_factory=list)
    vital_signs: List[VitalSign] = Field(default_factory=list)
    lab_results: List[LabResult] = Field(default_factory=list)
    study_fields: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    warnings: List[str] = Field(default_factory=list)


class NoteClassification(BaseModel):
    note_type: NoteType
    rationale: str
    confidence: float = Field(ge=0.0, le=1.0)


class ExtractionRequest(BaseModel):
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    profile: Optional[str] = None
    force_tier: Optional[str] = None


class ExtractionResponse(BaseModel):
    extraction: ClinicalExtraction
    tier_used: str
    provider: str
    model: str
    tokens: Dict[str, int]
    cost_usd: float
    request_id: str
    processing_time_ms: int


class EnrichmentRequest(BaseModel):
    terms: List[str]
    include_synonyms: bool = False
    max_results_per_term: int = Field(default=3, ge=1, le=10)


class MeSHMapping(BaseModel):
    original_term: str
    mesh_id: str
    mesh_label: str
    confidence: float
    tree_numbers: List[str] = Field(default_factory=list)
    synonyms: List[str] = Field(default_factory=list)


class EnrichmentResponse(BaseModel):
    mappings: List[MeSHMapping]
    unmapped_terms: List[str]
    request_id: str


def get_clinical_extraction_schema() -> dict:
    return ClinicalExtraction.model_json_schema()


def get_note_classification_schema() -> dict:
    return NoteClassification.model_json_schema()

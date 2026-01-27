"""ValidationBlueprint model - AI-generated study plans."""
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

from .common import StudyIntent, BlueprintStatus


class DataDictionaryEntry(BaseModel):
    """Entry in the data dictionary for a validation study."""
    variable: str
    type: str  # numeric, categorical, boolean, date
    source: str  # EHR, lab, registry, etc.
    required: bool = True
    description: Optional[str] = None
    mapping: Optional[str] = None  # How to derive from source data


class OutcomeDefinition(BaseModel):
    """Definition of a study outcome."""
    name: str
    type: str  # binary, continuous, time_to_event, ordinal
    time_horizon: Optional[str] = None  # e.g., "30-day", "1-year"
    definition: Optional[str] = None


class AnalysisMethod(BaseModel):
    """Statistical analysis method with rationale."""
    method: str
    rationale: str
    assumptions: List[str] = Field(default_factory=list)
    alternatives: List[str] = Field(default_factory=list)


class ValidationMetric(BaseModel):
    """Metric for assessing model validation."""
    metric: str  # AUC-ROC, C-index, Brier score, calibration slope
    interpretation: str
    threshold: Optional[str] = None  # Acceptable threshold


class ValidationBlueprint(BaseModel):
    """
    AI-generated validation study plan.

    CRITICAL: LLM generates this grounded on SystemCard inputs/outputs.
    """
    id: Optional[str] = None
    system_card_id: str
    user_id: str
    study_intent: StudyIntent
    research_aims: List[str] = Field(default_factory=list)
    hypotheses: List[str] = Field(default_factory=list)
    data_dictionary: List[DataDictionaryEntry] = Field(default_factory=list)
    outcomes: List[OutcomeDefinition] = Field(default_factory=list)
    inclusion_criteria: List[str] = Field(default_factory=list)
    exclusion_criteria: List[str] = Field(default_factory=list)
    analysis_plan: List[AnalysisMethod] = Field(default_factory=list)
    validation_metrics: List[ValidationMetric] = Field(default_factory=list)
    sensitivity_analyses: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    reporting_checklist: List[str] = Field(default_factory=list)  # TRIPOD, STROBE, etc.
    status: BlueprintStatus = BlueprintStatus.DRAFT
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        use_enum_values = True


class BlueprintRequest(BaseModel):
    """Request model for generating a validation blueprint."""
    system_card_id: str
    study_intent: StudyIntent
    additional_context: Optional[str] = None
    target_population: Optional[str] = None
    available_data: Optional[List[str]] = None

    class Config:
        use_enum_values = True


class BlueprintUpdate(BaseModel):
    """Request model for updating a blueprint."""
    study_intent: Optional[StudyIntent] = None
    research_aims: Optional[List[str]] = None
    hypotheses: Optional[List[str]] = None
    data_dictionary: Optional[List[DataDictionaryEntry]] = None
    outcomes: Optional[List[OutcomeDefinition]] = None
    inclusion_criteria: Optional[List[str]] = None
    exclusion_criteria: Optional[List[str]] = None
    analysis_plan: Optional[List[AnalysisMethod]] = None
    validation_metrics: Optional[List[ValidationMetric]] = None
    sensitivity_analyses: Optional[List[str]] = None
    limitations: Optional[List[str]] = None
    reporting_checklist: Optional[List[str]] = None
    status: Optional[BlueprintStatus] = None

    class Config:
        use_enum_values = True

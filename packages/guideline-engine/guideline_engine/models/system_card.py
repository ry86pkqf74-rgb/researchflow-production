"""SystemCard model - canonical abstraction for scoring systems, staging, and guidelines."""
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import date, datetime

from .common import (
    SystemType, IntendedUse, InputType, OutputType,
    SourceAnchor, ConditionConcept
)


class InputVariable(BaseModel):
    """Definition of an input variable for a clinical system."""
    name: str
    type: InputType
    unit: Optional[str] = None
    required: bool = True
    description: Optional[str] = None
    valid_values: Optional[Union[List[str], Dict[str, float]]] = None

    class Config:
        use_enum_values = True


class OutputDefinition(BaseModel):
    """Definition of an output from a clinical system."""
    name: str
    type: OutputType
    range: Optional[str] = None
    labels: Optional[List[str]] = None
    description: Optional[str] = None

    class Config:
        use_enum_values = True


class InterpretationEntry(BaseModel):
    """Interpretation of a score/stage range."""
    range: str
    meaning: str
    clinical_action: Optional[str] = None


class SystemCard(BaseModel):
    """
    Canonical abstraction for clinical scoring systems, staging criteria, and guidelines.

    CRITICAL: This is a data structure, NOT a calculator. Computation is handled by RuleSpec.
    """
    id: Optional[str] = None
    name: str
    type: SystemType
    specialty: Optional[str] = None
    condition_concepts: List[ConditionConcept] = Field(default_factory=list)
    intended_use: Optional[IntendedUse] = None
    population: Optional[str] = None
    inputs: List[InputVariable] = Field(default_factory=list)
    outputs: List[OutputDefinition] = Field(default_factory=list)
    interpretation: List[InterpretationEntry] = Field(default_factory=list)
    limitations: Optional[List[str]] = None
    source_anchors: List[SourceAnchor] = Field(default_factory=list)
    version: Optional[str] = None
    effective_date: Optional[date] = None
    superseded_by: Optional[str] = None
    status: str = "active"
    extraction_confidence: Optional[float] = None
    verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    non_computable_reason: Optional[str] = None  # If set, system cannot be computed (e.g., STROBE)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        use_enum_values = True

    def is_computable(self) -> bool:
        """Check if this system can be computed (has inputs and no blocking reason)."""
        return len(self.inputs) > 0 and self.non_computable_reason is None

    def get_required_inputs(self) -> List[str]:
        """Get list of required input variable names."""
        return [inp.name for inp in self.inputs if inp.required]


class SystemCardCreate(BaseModel):
    """Request model for creating a new SystemCard."""
    name: str
    type: SystemType
    specialty: Optional[str] = None
    condition_concepts: List[ConditionConcept] = Field(default_factory=list)
    intended_use: Optional[IntendedUse] = None
    population: Optional[str] = None
    inputs: List[InputVariable] = Field(default_factory=list)
    outputs: List[OutputDefinition] = Field(default_factory=list)
    interpretation: List[InterpretationEntry] = Field(default_factory=list)
    limitations: Optional[List[str]] = None
    source_anchors: List[SourceAnchor] = Field(default_factory=list)
    version: Optional[str] = None
    effective_date: Optional[date] = None
    non_computable_reason: Optional[str] = None

    class Config:
        use_enum_values = True


class SystemCardSummary(BaseModel):
    """Lightweight summary of a SystemCard for search results."""
    id: str
    name: str
    type: SystemType
    specialty: Optional[str] = None
    intended_use: Optional[IntendedUse] = None
    verified: bool = False
    input_count: int = 0
    status: str = "active"

    class Config:
        use_enum_values = True

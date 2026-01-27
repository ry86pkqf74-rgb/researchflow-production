"""Common enums and base models for the Guideline Engine."""
from enum import Enum
from typing import Optional
from pydantic import BaseModel


class SystemType(str, Enum):
    """Type of clinical system/guideline."""
    SCORE = "score"
    STAGING = "staging"
    GRADING = "grading"
    GUIDELINE = "guideline"
    CLASSIFICATION = "classification"
    REPORTING_STANDARD = "reporting_standard"
    CRITERIA = "criteria"


class IntendedUse(str, Enum):
    """Intended clinical use of the system."""
    DIAGNOSIS = "diagnosis"
    PROGNOSIS = "prognosis"
    TREATMENT_SELECTION = "treatment_selection"
    SEVERITY = "severity"
    COMPLICATIONS = "complications"
    QUALITY = "quality"


class InputType(str, Enum):
    """Type of input variable."""
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    BOOLEAN = "boolean"
    DATE = "date"
    TEXT = "text"


class OutputType(str, Enum):
    """Type of output value."""
    SCORE = "score"
    STAGE = "stage"
    GRADE = "grade"
    CATEGORY = "category"
    CLASS = "class"
    RISK = "risk"


class RuleType(str, Enum):
    """Type of computation rule."""
    THRESHOLD = "threshold"
    LOOKUP_TABLE = "lookup_table"
    FORMULA = "formula"
    DECISION_TREE = "decision_tree"


class StudyIntent(str, Enum):
    """Intent of a validation study."""
    EXTERNAL_VALIDATION = "external_validation"
    TEMPORAL_VALIDATION = "temporal_validation"
    SUBGROUP_VALIDATION = "subgroup_validation"
    HEAD_TO_HEAD = "head_to_head"
    RECALIBRATION = "recalibration"
    SIMPLIFICATION = "simplification"
    FAIRNESS = "fairness"


class EvidenceStrength(str, Enum):
    """Strength of evidence."""
    STRONG = "strong"
    MODERATE = "moderate"
    WEAK = "weak"
    EXPERT_CONSENSUS = "expert_consensus"


class EvidenceQuality(str, Enum):
    """Quality of evidence (GRADE-like)."""
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"
    VERY_LOW = "very_low"


class EvidenceType(str, Enum):
    """Type of evidence source."""
    RCT = "rct"
    COHORT = "cohort"
    CASE_CONTROL = "case_control"
    CASE_SERIES = "case_series"
    EXPERT_OPINION = "expert_opinion"


class BlueprintStatus(str, Enum):
    """Status of a validation blueprint."""
    DRAFT = "draft"
    FINALIZED = "finalized"
    EXPORTED = "exported"


class CalculationContext(str, Enum):
    """Context in which calculation is performed."""
    RESEARCH = "research"
    EDUCATION = "education"
    DEMO = "demo"


class SourceAnchor(BaseModel):
    """Citation anchor pointing to source material."""
    url: Optional[str] = None
    page: Optional[str] = None
    section: Optional[str] = None
    excerpt: Optional[str] = None


class ConditionConcept(BaseModel):
    """Coded clinical concept (MeSH, SNOMED, ICD)."""
    system: str  # MeSH, SNOMED, ICD10, ICD11
    code: str
    term: str

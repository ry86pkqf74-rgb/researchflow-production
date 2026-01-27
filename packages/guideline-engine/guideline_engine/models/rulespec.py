"""RuleSpec model - deterministic computation definitions."""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from .common import RuleType


class RuleTestCase(BaseModel):
    """Test case for validating a rule specification."""
    inputs: Dict[str, Any]
    expected_output: Dict[str, Any]
    description: Optional[str] = None


class ThresholdCriterion(BaseModel):
    """Single criterion for threshold-based rules."""
    variable: str
    condition: str  # boolean, equals, gte, gt, lte, lt, in
    value: Optional[Any] = None
    threshold: Optional[float] = None
    points: int = 1
    name: Optional[str] = None
    exclude_if: Optional[Dict[str, Any]] = None  # Exclude if another condition is met


class CategoryRange(BaseModel):
    """Category definition for score interpretation."""
    min: float = float("-inf")
    max: float = float("inf")
    label: str


class ThresholdRuleDefinition(BaseModel):
    """Definition for threshold/points-based scoring rules."""
    criteria: List[ThresholdCriterion]
    categories: List[CategoryRange] = Field(default_factory=list)
    interpretations: Dict[str, str] = Field(default_factory=dict)


class LookupRuleDefinition(BaseModel):
    """Definition for lookup table rules (e.g., TNM staging)."""
    keys: List[str]  # Variables to use as lookup keys
    table: Dict[str, Dict[str, Any]]  # key -> output mapping


class FormulaRuleDefinition(BaseModel):
    """Definition for formula-based rules (e.g., MELD score)."""
    formula: str  # Python expression (safe eval)
    variables: List[Dict[str, Any]] = Field(default_factory=list)
    categories: List[CategoryRange] = Field(default_factory=list)


class RuleSpec(BaseModel):
    """
    Deterministic computation rule for a SystemCard.

    CRITICAL: This is where computation logic lives. Calculator uses this, NO LLM INVOLVEMENT.
    """
    id: Optional[str] = None
    system_card_id: str
    name: str
    description: Optional[str] = None
    rule_type: RuleType
    rule_definition: Dict[str, Any]  # ThresholdRuleDefinition, LookupRuleDefinition, or FormulaRuleDefinition
    test_cases: List[RuleTestCase] = Field(default_factory=list)
    validated: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        use_enum_values = True


class RuleSpecCreate(BaseModel):
    """Request model for creating a new RuleSpec."""
    system_card_id: str
    name: str
    description: Optional[str] = None
    rule_type: RuleType
    rule_definition: Dict[str, Any]
    test_cases: List[RuleTestCase] = Field(default_factory=list)

    class Config:
        use_enum_values = True


class RuleValidationResult(BaseModel):
    """Result of validating a rule against its test cases."""
    test_index: int
    passed: bool
    expected: Dict[str, Any]
    actual: Dict[str, Any]
    description: Optional[str] = None
    error: Optional[str] = None

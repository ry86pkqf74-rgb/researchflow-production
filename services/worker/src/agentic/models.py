"""
Pydantic models for agentic planning pipeline.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime


class StageType(str, Enum):
    """Types of pipeline stages."""
    EXTRACTION = "extraction"
    TRANSFORM = "transform"
    ANALYSIS = "analysis"
    VALIDATION = "validation"
    OUTPUT = "output"


class ColumnType(str, Enum):
    """Statistical column types."""
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    DATETIME = "datetime"
    TEXT = "text"
    BOOLEAN = "boolean"


class ColumnProfile(BaseModel):
    """Profile of a single column (no PHI - metadata only)."""
    name: str
    dtype: str
    column_type: ColumnType
    null_count: int
    null_percent: float
    unique_count: int
    mean: Optional[float] = None
    std: Optional[float] = None
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    median: Optional[float] = None
    # For categorical columns
    top_categories: Optional[List[str]] = None
    category_counts: Optional[Dict[str, int]] = None


class DatasetProfile(BaseModel):
    """Profile of a dataset (no PHI - metadata only)."""
    dataset_id: str
    row_count: int
    column_count: int
    columns: List[ColumnProfile]
    memory_usage_mb: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PlanStage(BaseModel):
    """A single stage in an analysis plan."""
    stage_id: str
    stage_type: StageType
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    depends_on: List[str] = Field(default_factory=list)


class StatisticalMethod(BaseModel):
    """A statistical method to apply."""
    method: str
    rationale: str
    assumptions: List[str] = Field(default_factory=list)
    variables: Dict[str, Any] = Field(default_factory=dict)


class ExpectedOutput(BaseModel):
    """Expected output from analysis."""
    name: str
    type: str  # table, figure, report
    description: Optional[str] = None


class PlanSpec(BaseModel):
    """Complete analysis plan specification."""
    version: str = "1.0"
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    stages: List[PlanStage]
    statistical_methods: List[StatisticalMethod] = Field(default_factory=list)
    expected_outputs: List[ExpectedOutput] = Field(default_factory=list)


class ExecutionRequest(BaseModel):
    """Request to execute a plan."""
    plan_id: str
    job_id: str
    plan_spec: PlanSpec
    constraints: Dict[str, Any] = Field(default_factory=dict)
    execution_mode: str = "full"  # full or dry_run
    config_overrides: Dict[str, Any] = Field(default_factory=dict)


class ArtifactOutput(BaseModel):
    """Generated artifact from execution."""
    artifact_type: str  # table, figure, report, manifest, log, data
    name: str
    description: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    inline_data: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class StageResult(BaseModel):
    """Result from executing a single stage."""
    stage_id: str
    success: bool
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    artifacts: List[ArtifactOutput] = Field(default_factory=list)
    error: Optional[str] = None
    duration_ms: int = 0


class ExecutionResult(BaseModel):
    """Complete result from plan execution."""
    plan_id: str
    job_id: str
    success: bool
    message: str
    stages_completed: List[str]
    stages_failed: List[str] = Field(default_factory=list)
    stage_results: List[StageResult] = Field(default_factory=list)
    artifacts: List[ArtifactOutput] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
    execution_time_ms: int = 0


class AssumptionCheck(BaseModel):
    """Result of a statistical assumption check."""
    assumption: str
    test_name: str
    passed: bool
    statistic: Optional[float] = None
    p_value: Optional[float] = None
    details: Optional[str] = None


class AnalysisResult(BaseModel):
    """Result of a statistical analysis."""
    method: str
    success: bool
    statistic: Optional[float] = None
    p_value: Optional[float] = None
    confidence_interval: Optional[List[float]] = None
    effect_size: Optional[float] = None
    interpretation: Optional[str] = None
    assumption_checks: List[AssumptionCheck] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    raw_output: Dict[str, Any] = Field(default_factory=dict)

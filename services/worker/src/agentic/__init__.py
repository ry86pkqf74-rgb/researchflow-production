"""
Agentic Planning Pipeline
=========================

Safe statistical analysis with PHI protection and query safety.

This module provides:
- Schema introspection (metadata-only, no PHI)
- Safe SQL query building (SELECT-only, parameterized, row-limited)
- Statistical method selection based on data types
- Statistical execution with assumption validation
- Artifact generation

Pipeline Flow:
1. Schema Introspect → Column types, stats (no PHI)
2. Safe Query Builder → SELECT-only queries
3. Stats Selector → Choose appropriate methods
4. Stats Executor → Run analysis with validation
5. Artifact Writer → Generate outputs
"""

from .models import (
    StageType,
    ColumnType,
    ColumnProfile,
    DatasetProfile,
    PlanStage,
    StatisticalMethod,
    ExpectedOutput,
    PlanSpec,
    ExecutionRequest,
    ExecutionResult,
    ArtifactOutput,
)

from .safe_query import SafeQueryBuilder, QueryValidationError
from .schema_introspect import SchemaIntrospector
from .stats_selector import StatsSelector
from .stats_executor import StatsExecutor
from .pipeline import AgenticPipeline

# Create singleton instances for easy import
schema_introspector = SchemaIntrospector()
stats_selector = StatsSelector()

__all__ = [
    # Models
    "StageType",
    "ColumnType",
    "ColumnProfile",
    "DatasetProfile",
    "PlanStage",
    "StatisticalMethod",
    "ExpectedOutput",
    "PlanSpec",
    "ExecutionRequest",
    "ExecutionResult",
    "ArtifactOutput",
    # Services
    "SafeQueryBuilder",
    "QueryValidationError",
    "SchemaIntrospector",
    "StatsSelector",
    "StatsExecutor",
    "AgenticPipeline",
    # Singletons
    "schema_introspector",
    "stats_selector",
]

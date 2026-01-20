"""
ResearchFlow Workflow Engine

A stage-based workflow engine for executing the 19-stage research
data processing pipeline with PHI-safe error handling.

Usage:
    from workflow_engine import (
        run_stages,
        StageContext,
        StageResult,
        register_stage,
        get_stage,
        list_stages,
    )

    # Create execution context
    context = StageContext(
        job_id="job-123",
        config={"irb": {"protocol_number": "IRB-2024-001"}},
        governance_mode="DEMO",
    )

    # Run specific stages
    result = await run_stages([3, 5, 8], context)
"""

from .types import StageContext, StageResult, Stage
from .registry import register_stage, get_stage, list_stages
from .runner import run_stages, sanitize_phi

# Import stages to trigger registration
from . import stages

__all__ = [
    # Types
    "StageContext",
    "StageResult",
    "Stage",
    # Registry
    "register_stage",
    "get_stage",
    "list_stages",
    # Runner
    "run_stages",
    "sanitize_phi",
]

__version__ = "0.1.0"

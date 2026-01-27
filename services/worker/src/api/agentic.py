"""
Agentic Pipeline API Endpoints

FastAPI routes for the agentic statistical analysis pipeline.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..agentic import (
    AgenticPipeline,
    ExecutionRequest,
    ExecutionResult,
    PlanSpec,
    PlanStage,
    StageType,
    StatisticalMethod,
    ExpectedOutput,
    schema_introspector,
    stats_selector,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agentic", tags=["agentic"])


# ===== REQUEST/RESPONSE MODELS =====

class ExecuteRequest(BaseModel):
    """Request to execute an analysis plan."""
    plan_id: str
    job_id: str
    plan_spec: Dict[str, Any]
    constraints: Dict[str, Any] = Field(default_factory=dict)
    execution_mode: str = "full"
    config_overrides: Dict[str, Any] = Field(default_factory=dict)


class ProfileRequest(BaseModel):
    """Request to profile a dataset."""
    dataset_id: str
    dataset_path: Optional[str] = None


class SuggestMethodsRequest(BaseModel):
    """Request to suggest statistical methods."""
    dataset_id: str
    dataset_path: Optional[str] = None
    research_goal: str
    dependent_var: Optional[str] = None
    independent_vars: Optional[list] = None


# ===== ROUTES =====

@router.post("/execute")
async def execute_plan(request: ExecuteRequest) -> Dict[str, Any]:
    """
    Execute an analysis plan.

    This is called by the orchestrator to run a plan that was
    generated and approved.
    """
    logger.info(f"Executing plan {request.plan_id}, job {request.job_id}")

    try:
        # Parse plan spec
        stages = []
        for stage_dict in request.plan_spec.get("stages", []):
            stages.append(PlanStage(
                stage_id=stage_dict.get("stageId") or stage_dict.get("stage_id"),
                stage_type=StageType(stage_dict.get("stageType") or stage_dict.get("stage_type")),
                name=stage_dict.get("name"),
                description=stage_dict.get("description"),
                config=stage_dict.get("config", {}),
                depends_on=stage_dict.get("dependsOn") or stage_dict.get("depends_on", [])
            ))

        stat_methods = []
        for method_dict in request.plan_spec.get("statisticalMethods", []):
            stat_methods.append(StatisticalMethod(
                method=method_dict.get("method"),
                rationale=method_dict.get("rationale", ""),
                assumptions=method_dict.get("assumptions", []),
                variables=method_dict.get("variables", {})
            ))

        expected_outputs = []
        for output_dict in request.plan_spec.get("expectedOutputs", []):
            expected_outputs.append(ExpectedOutput(
                name=output_dict.get("name"),
                type=output_dict.get("type"),
                description=output_dict.get("description")
            ))

        plan_spec = PlanSpec(
            version=request.plan_spec.get("version", "1.0"),
            stages=stages,
            statistical_methods=stat_methods,
            expected_outputs=expected_outputs
        )

        # Build execution request
        exec_request = ExecutionRequest(
            plan_id=request.plan_id,
            job_id=request.job_id,
            plan_spec=plan_spec,
            constraints=request.constraints,
            execution_mode=request.execution_mode,
            config_overrides=request.config_overrides
        )

        # Execute pipeline
        pipeline = AgenticPipeline()
        result = pipeline.execute(exec_request)

        # Convert to dict
        return {
            "success": result.success,
            "message": result.message,
            "stages_completed": result.stages_completed,
            "stages_failed": result.stages_failed,
            "artifacts": [
                {
                    "artifact_type": a.artifact_type,
                    "name": a.name,
                    "description": a.description,
                    "file_path": a.file_path,
                    "file_size": a.file_size,
                    "mime_type": a.mime_type,
                    "inline_data": a.inline_data,
                    "metadata": a.metadata
                }
                for a in result.artifacts
            ],
            "summary": result.summary,
            "execution_time_ms": result.execution_time_ms
        }

    except Exception as e:
        logger.error(f"Execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profile")
async def profile_dataset(request: ProfileRequest) -> Dict[str, Any]:
    """
    Profile a dataset (metadata only, no PHI).

    Returns column types, statistics, and cardinality
    suitable for sending to external AI.
    """
    try:
        # Load dataset
        df = schema_introspector.load_dataset(
            request.dataset_id,
            request.dataset_path
        )

        # Profile
        profile = schema_introspector.profile_dataset(df, request.dataset_id)

        # Get AI-safe metadata
        metadata = schema_introspector.get_metadata_for_ai(profile)

        return {
            "success": True,
            "profile": metadata,
            "row_count": profile.row_count,
            "column_count": profile.column_count,
            "memory_usage_mb": profile.memory_usage_mb
        }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Profiling failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggest-methods")
async def suggest_methods(request: SuggestMethodsRequest) -> Dict[str, Any]:
    """
    Suggest statistical methods for a dataset and research goal.
    """
    try:
        # Load and profile dataset
        df = schema_introspector.load_dataset(
            request.dataset_id,
            request.dataset_path
        )
        profile = schema_introspector.profile_dataset(df, request.dataset_id)

        # Suggest methods
        methods = stats_selector.suggest_methods(
            profile=profile,
            research_goal=request.research_goal,
            dependent_var=request.dependent_var,
            independent_vars=request.independent_vars
        )

        return {
            "success": True,
            "methods": [
                {
                    "method": m.method,
                    "rationale": m.rationale,
                    "assumptions": m.assumptions,
                    "variables": m.variables
                }
                for m in methods
            ],
            "count": len(methods)
        }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Method suggestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "agentic-pipeline",
        "version": "1.0.0"
    }

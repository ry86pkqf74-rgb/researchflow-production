"""
Multi-File Ingest API Router

FastAPI router for multi-file data ingestion endpoints:
- POST /api/ingest/detect - Start Phase 1 (detect ID candidates)
- POST /api/ingest/merge - Complete Phase 2 (merge with confirmed ID)
- GET /api/ingest/status/{run_id} - Get job status
- GET /api/ingest/health - Health check

Part of the multi-file ingestion feature.
"""

import os
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Import the merge ingest engine
try:
    from ingest.merge_ingest import (
        MultiFileIngestEngine,
        MergeManifest,
        MergeResult,
    )
    INGEST_AVAILABLE = True
except ImportError as e:
    INGEST_AVAILABLE = False
    logger.warning(f"Multi-file ingest module not available: {e}")

router = APIRouter(prefix="/ingest", tags=["multi-file-ingest"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class DetectRequest(BaseModel):
    """Request model for Phase 1 detection."""
    source: str = Field(..., description="Directory path or Excel file path")
    file_pattern: str = Field("*.csv,*.xlsx", description="Glob pattern for files")
    run_id: Optional[str] = Field(None, description="Unique run identifier")
    governance_mode: str = Field("DEMO", description="DEMO or LIVE mode")


class MergeRequest(BaseModel):
    """Request model for Phase 2 merge."""
    run_id: str = Field(..., description="Run ID from Phase 1")
    source: str = Field(..., description="Directory path or Excel file path")
    id_column: str = Field(..., description="Confirmed ID column name")
    user_response: str = Field(..., description="User confirmation ('yes' or column name)")
    merge_strategy: str = Field("outer", description="Merge strategy: outer, inner, left, right")
    file_pattern: str = Field("*.csv,*.xlsx", description="Glob pattern for files")
    manifest: Optional[Dict[str, Any]] = Field(None, description="Manifest from Phase 1")


class IDCandidateResponse(BaseModel):
    """Response model for ID candidate."""
    column_name: str
    uniqueness_ratio: float
    overlap_ratio: float
    pattern_score: float
    combined_score: float
    source_files: List[str]
    sample_values: List[str]


class ManifestResponse(BaseModel):
    """Response model for merge manifest."""
    run_id: str
    started_at: str
    completed_at: Optional[str] = None
    governance_mode: str
    source_directory: Optional[str] = None
    source_files: List[str]
    rows_before_merge: Dict[str, int]
    rows_after_merge: Optional[int] = None
    columns_merged: List[str]
    id_column: Optional[str] = None
    merge_strategy: Optional[str] = None
    warnings: List[str]
    errors: List[str]


class DetectResponse(BaseModel):
    """Response model for Phase 1 detection."""
    success: bool
    needs_confirmation: bool
    confirmation_prompt: Optional[str] = None
    candidates: List[IDCandidateResponse]
    manifest: ManifestResponse
    row_count: int = 0
    column_count: int = 0


class MergeResponse(BaseModel):
    """Response model for Phase 2 merge."""
    success: bool
    manifest: ManifestResponse
    row_count: int = 0
    column_count: int = 0
    output_path: Optional[str] = None
    error: Optional[str] = None


# =============================================================================
# IN-MEMORY JOB STORE
# =============================================================================

# Store active jobs and their manifests
_active_jobs: Dict[str, Dict[str, Any]] = {}


def _store_job(run_id: str, result: MergeResult, source: str, file_pattern: str):
    """Store job state for later retrieval."""
    _active_jobs[run_id] = {
        "source": source,
        "file_pattern": file_pattern,
        "manifest": result.manifest,
        "candidates": result.candidates,
        "created_at": datetime.utcnow().isoformat(),
    }


def _get_job(run_id: str) -> Optional[Dict[str, Any]]:
    """Get stored job by run_id."""
    return _active_jobs.get(run_id)


def _convert_manifest_to_response(manifest: MergeManifest) -> ManifestResponse:
    """Convert MergeManifest to response model."""
    return ManifestResponse(
        run_id=manifest.run_id,
        started_at=manifest.started_at,
        completed_at=manifest.completed_at,
        governance_mode=manifest.governance_mode,
        source_directory=manifest.source_directory,
        source_files=manifest.source_files,
        rows_before_merge=manifest.rows_before_merge,
        rows_after_merge=manifest.rows_after_merge,
        columns_merged=manifest.columns_merged,
        id_column=manifest.id_column,
        merge_strategy=manifest.merge_strategy,
        warnings=manifest.warnings,
        errors=manifest.errors,
    )


def _convert_candidates_to_response(candidates: List) -> List[IDCandidateResponse]:
    """Convert IDCandidate list to response models."""
    return [
        IDCandidateResponse(
            column_name=c.column_name,
            uniqueness_ratio=c.uniqueness_ratio,
            overlap_ratio=c.overlap_ratio,
            pattern_score=c.pattern_score,
            combined_score=c.combined_score,
            source_files=c.source_files,
            sample_values=c.sample_values,
        )
        for c in candidates
    ]


# =============================================================================
# API ENDPOINTS
# =============================================================================

@router.get("/health")
async def health_check():
    """Health check for ingest service."""
    return {
        "status": "healthy" if INGEST_AVAILABLE else "degraded",
        "service": "multi-file-ingest",
        "ingest_available": INGEST_AVAILABLE,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/detect", response_model=DetectResponse)
async def start_detection(request: DetectRequest):
    """
    Phase 1: Detect ID candidates from source files.

    Reads all files from the source directory or Excel workbook and
    automatically detects candidate ID columns for linking/merging.

    Returns:
        DetectResponse with candidates and confirmation prompt if multi-file
    """
    if not INGEST_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Multi-file ingest module not available"
        )

    try:
        # Validate source path exists
        source_path = Path(request.source)
        if not source_path.exists():
            raise HTTPException(
                status_code=400,
                detail=f"Source path not found: {request.source}"
            )

        # Initialize engine with governance mode
        engine = MultiFileIngestEngine(
            governance_mode=request.governance_mode,
        )

        # Run Phase 1 detection
        result = engine.ingest_and_detect(
            source=request.source,
            file_pattern=request.file_pattern,
            run_id=request.run_id,
        )

        # Store job for Phase 2
        _store_job(
            result.manifest.run_id,
            result,
            request.source,
            request.file_pattern,
        )

        # Build response
        return DetectResponse(
            success=result.success,
            needs_confirmation=result.needs_confirmation,
            confirmation_prompt=result.confirmation_prompt,
            candidates=_convert_candidates_to_response(result.candidates),
            manifest=_convert_manifest_to_response(result.manifest),
            row_count=len(result.dataframe) if result.dataframe is not None else 0,
            column_count=len(result.dataframe.columns) if result.dataframe is not None else 0,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/merge", response_model=MergeResponse)
async def complete_merge(request: MergeRequest):
    """
    Phase 2: Complete merge after user confirmation.

    After the user confirms the ID column, this endpoint performs the
    actual merge operation across all files.

    Returns:
        MergeResponse with merged data info if successful
    """
    if not INGEST_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Multi-file ingest module not available"
        )

    try:
        # Get stored job
        job = _get_job(request.run_id)
        if not job:
            raise HTTPException(
                status_code=404,
                detail=f"Job not found: {request.run_id}"
            )

        # Reconstruct manifest from stored job or request
        if request.manifest:
            manifest = MergeManifest(**request.manifest)
        else:
            manifest = job["manifest"]

        # Initialize engine
        engine = MultiFileIngestEngine(
            governance_mode=manifest.governance_mode,
        )

        # Run Phase 2 merge
        result = engine.complete_merge(
            source=request.source,
            id_column=request.id_column,
            user_response=request.user_response,
            manifest=manifest,
            file_pattern=request.file_pattern,
            merge_strategy=request.merge_strategy,
        )

        # Clean up job if successful
        if result.success and request.run_id in _active_jobs:
            del _active_jobs[request.run_id]

        return MergeResponse(
            success=result.success,
            manifest=_convert_manifest_to_response(result.manifest),
            row_count=len(result.dataframe) if result.dataframe is not None else 0,
            column_count=len(result.dataframe.columns) if result.dataframe is not None else 0,
            error=result.manifest.errors[0] if result.manifest.errors else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Merge failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{run_id}")
async def get_job_status(run_id: str):
    """
    Get status of an ingest job.

    Returns:
        Job status and manifest if found
    """
    job = _get_job(run_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job not found: {run_id}"
        )

    return {
        "run_id": run_id,
        "source": job["source"],
        "file_pattern": job["file_pattern"],
        "created_at": job["created_at"],
        "manifest": job["manifest"].to_dict() if hasattr(job["manifest"], "to_dict") else job["manifest"],
        "candidates": [c.to_dict() for c in job["candidates"]] if job["candidates"] else [],
    }


@router.get("/jobs")
async def list_jobs():
    """
    List all active ingest jobs.

    Returns:
        List of job summaries
    """
    jobs = []
    for run_id, job in _active_jobs.items():
        manifest = job["manifest"]
        jobs.append({
            "run_id": run_id,
            "source": job["source"],
            "created_at": job["created_at"],
            "source_files": manifest.source_files if hasattr(manifest, "source_files") else [],
            "candidate_count": len(job["candidates"]) if job["candidates"] else 0,
        })

    return {
        "total": len(jobs),
        "jobs": jobs,
    }


@router.delete("/jobs/{run_id}")
async def cancel_job(run_id: str):
    """
    Cancel/remove an active job.

    Returns:
        Success message if cancelled
    """
    if run_id not in _active_jobs:
        raise HTTPException(
            status_code=404,
            detail=f"Job not found: {run_id}"
        )

    del _active_jobs[run_id]
    return {
        "success": True,
        "message": f"Job {run_id} cancelled",
    }

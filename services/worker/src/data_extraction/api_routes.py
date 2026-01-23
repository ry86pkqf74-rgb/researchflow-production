"""
Data Extraction API Routes - FastAPI endpoints for clinical data extraction.

This module exposes the extraction functionality as a FastAPI router that can
be mounted in the main api_server.py.

Extended with SPREADSHEET_CELL_PARSE endpoints for large sheet processing.
"""

from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
import tempfile
import os
import asyncio
from datetime import datetime
from pathlib import Path

from .schemas import (
    ExtractionRequest,
    ExtractionResponse,
    EnrichmentRequest,
    EnrichmentResponse,
)
from .extract_from_cells import (
    extract_clinical_from_cell,
    extract_batch,
    ExtractionError,
)
from .nlm_enrichment import (
    enrich_terms_with_mesh,
    EnrichmentError,
)

# Cell parser imports (optional)
try:
    from .cell_parser import (
        parse_block_text,
        detect_narrative_columns,
        identify_extraction_targets,
        BatchExtractionManifest,
    )
    import pandas as pd
    DATAFRAME_EXTRACTION_AVAILABLE = True
except ImportError:
    DATAFRAME_EXTRACTION_AVAILABLE = False

# Large sheet pipeline imports
try:
    from .large_sheet_pipeline import (
        LargeSheetPipeline,
        PipelineProgress,
        PipelineResult,
    )
    from .config import get_config, BlockTextConfig, LargeSheetConfig
    LARGE_SHEET_AVAILABLE = True
except ImportError:
    LARGE_SHEET_AVAILABLE = False

logger = logging.getLogger(__name__)

# Create router with prefix
router = APIRouter(prefix="/extraction", tags=["extraction"])

# ============================================================================
# Pydantic Models for Spreadsheet Parsing
# ============================================================================

class BlockTextConfigRequest(BaseModel):
    """Configuration for block text detection."""
    min_chars: int = Field(default=120, ge=1)
    min_newlines: int = Field(default=2, ge=0)
    min_clinical_markers: int = Field(default=1, ge=0)
    deny_columns: List[str] = Field(default_factory=lambda: ["mrn", "patient_id", "dob", "ssn", "id"])
    allow_columns: List[str] = Field(default_factory=lambda: ["ros", "clinical_notes", "op_note"])

class LargeSheetConfigRequest(BaseModel):
    """Configuration for large sheet processing."""
    chunk_rows: int = Field(default=50000, ge=1000, le=100000)
    llm_concurrency: int = Field(default=24, ge=1, le=100)
    llm_batch_size: int = Field(default=20, ge=1, le=100)
    join_back_to_sheet: bool = False
    enable_dask: bool = False

class PromptPackRequest(BaseModel):
    """Prompt template selection."""
    cell_extract: str = "cell_extract_v1"
    ros_extract: str = "ros_extract_v1"
    outcome_extract: str = "outcome_extract_v1"

class SpreadsheetParseRequest(BaseModel):
    """Request to parse a spreadsheet for clinical extraction."""
    job_id: str = Field(..., description="Unique job identifier")
    artifact_path: str = Field(..., description="Path to the spreadsheet file")
    file_type: str = Field(default="csv", pattern="^(csv|xlsx|xls|tsv)$")
    sheet_name: Optional[str] = None
    block_text_config: Optional[BlockTextConfigRequest] = None
    large_sheet_config: Optional[LargeSheetConfigRequest] = None
    prompt_pack: Optional[PromptPackRequest] = None

class SpreadsheetParseProgress(BaseModel):
    """Progress information for a spreadsheet parsing job."""
    phase: str
    total_rows: int
    processed_rows: int
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    progress_pct: float

class SpreadsheetParseStatus(BaseModel):
    """Status response for a spreadsheet parsing job."""
    job_id: str
    status: str  # pending, scanning, extracting, merging, complete, failed, cancelled
    progress: SpreadsheetParseProgress
    started_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None

class SpreadsheetParseResult(BaseModel):
    """Result of a completed spreadsheet parsing job."""
    job_id: str
    success: bool
    total_rows: int
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    deduped_tasks: int
    total_cost_usd: float
    artifact_paths: Dict[str, str]
    manifest_path: str
    processing_time_ms: int
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


# ============================================================================
# In-memory Job Tracking (use Redis/DB in production)
# ============================================================================

class JobState:
    """Tracks the state of a spreadsheet parsing job."""
    def __init__(self, job_id: str, config: SpreadsheetParseRequest):
        self.job_id = job_id
        self.config = config
        self.status = "pending"
        self.progress = SpreadsheetParseProgress(
            phase="init",
            total_rows=0,
            processed_rows=0,
            total_tasks=0,
            completed_tasks=0,
            failed_tasks=0,
            progress_pct=0.0,
        )
        self.started_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.completed_at: Optional[datetime] = None
        self.error: Optional[str] = None
        self.result: Optional[PipelineResult] = None
        self.cancelled = False

# Global job registry
_jobs: Dict[str, JobState] = {}


# ============================================================================
# Original Extraction Endpoints
# ============================================================================

@router.post("/extract", response_model=ExtractionResponse)
async def extract_clinical_data(
    request: ExtractionRequest,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> ExtractionResponse:
    """
    Extract structured clinical data from text.
    
    Accepts clinical text and returns structured extraction following
    the ClinicalExtraction schema. Uses AI Router for governance compliance.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if len(request.text) > 100000:
        raise HTTPException(status_code=400, detail="Text exceeds maximum length (100KB)")
    
    try:
        result = await extract_clinical_from_cell(
            cell_text=request.text,
            metadata=request.metadata,
            force_tier=request.force_tier,
        )
        
        logger.info(
            f"Extraction complete: request_id={result.request_id}, "
            f"tier={result.tier_used}, confidence={result.extraction.confidence}"
        )
        
        return result
        
    except ExtractionError as e:
        logger.error(f"Extraction failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}",
            headers={"X-Request-ID": e.request_id} if e.request_id else None,
        )


@router.post("/extract/batch", response_model=List[ExtractionResponse])
async def extract_batch_clinical_data(
    requests: List[ExtractionRequest],
    concurrency: int = 5,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> List[ExtractionResponse]:
    """
    Batch extract clinical data from multiple texts.
    
    Processes multiple extraction requests with controlled concurrency.
    Results returned in same order as input.
    """
    if not requests:
        raise HTTPException(status_code=400, detail="No requests provided")
    
    if len(requests) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 requests per batch")
    
    concurrency = min(max(1, concurrency), 20)
    
    try:
        results = await extract_batch(
            requests=requests,
            concurrency=concurrency,
        )
        
        logger.info(f"Batch extraction complete: {len(results)} results")
        return results
        
    except ExtractionError as e:
        logger.error(f"Batch extraction failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Batch extraction failed: {str(e)}",
        )


@router.post("/enrich", response_model=EnrichmentResponse)
async def enrich_with_mesh(
    request: EnrichmentRequest,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> EnrichmentResponse:
    """
    Enrich extracted terms with MeSH ontology.
    
    Looks up terms in NLM's MeSH database and returns enriched entities
    with standardized codes and hierarchies.
    """
    if not request.terms:
        raise HTTPException(status_code=400, detail="No terms provided")
    
    if len(request.terms) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 terms per request")
    
    try:
        result = await enrich_terms_with_mesh(
            terms=request.terms,
            include_hierarchy=request.include_hierarchy,
        )
        
        logger.info(f"MeSH enrichment complete: {len(result.enriched)} terms enriched")
        return result
        
    except EnrichmentError as e:
        logger.error(f"Enrichment failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Enrichment failed: {str(e)}",
        )


# ============================================================================
# Spreadsheet Parsing Endpoints (NEW)
# ============================================================================

@router.post("/spreadsheet/parse", response_model=SpreadsheetParseStatus)
async def parse_spreadsheet(
    request: SpreadsheetParseRequest,
    background_tasks: BackgroundTasks,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> SpreadsheetParseStatus:
    """
    Start parsing a spreadsheet for clinical extraction.
    
    This endpoint initiates a background job to process the spreadsheet
    using the LargeSheetPipeline. Use the status endpoint to monitor progress.
    """
    if not LARGE_SHEET_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Large sheet processing not available. Missing dependencies.",
        )
    
    # Validate artifact path exists
    if not os.path.exists(request.artifact_path):
        raise HTTPException(
            status_code=400,
            detail=f"Artifact not found: {request.artifact_path}",
        )
    
    # Check for existing job
    if request.job_id in _jobs:
        existing = _jobs[request.job_id]
        if existing.status not in ("complete", "failed", "cancelled"):
            raise HTTPException(
                status_code=409,
                detail=f"Job {request.job_id} already exists and is {existing.status}",
            )
    
    # Create job state
    job = JobState(request.job_id, request)
    _jobs[request.job_id] = job
    
    # Start background processing
    background_tasks.add_task(_run_pipeline, job)
    
    logger.info(f"Spreadsheet parse job started: {request.job_id}")
    
    return SpreadsheetParseStatus(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        started_at=job.started_at.isoformat() if job.started_at else None,
        updated_at=job.updated_at.isoformat() if job.updated_at else None,
    )


@router.get("/spreadsheet/status/{job_id}", response_model=SpreadsheetParseStatus)
async def get_spreadsheet_status(
    job_id: str,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> SpreadsheetParseStatus:
    """
    Get the status of a spreadsheet parsing job.
    """
    if job_id not in _jobs:
        raise HTTPException(
            status_code=404,
            detail=f"Job not found: {job_id}",
        )
    
    job = _jobs[job_id]
    
    return SpreadsheetParseStatus(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        started_at=job.started_at.isoformat() if job.started_at else None,
        updated_at=job.updated_at.isoformat() if job.updated_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error=job.error,
    )


@router.get("/spreadsheet/results/{job_id}", response_model=SpreadsheetParseResult)
async def get_spreadsheet_results(
    job_id: str,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> SpreadsheetParseResult:
    """
    Get the results of a completed spreadsheet parsing job.
    """
    if job_id not in _jobs:
        raise HTTPException(
            status_code=404,
            detail=f"Job not found: {job_id}",
        )
    
    job = _jobs[job_id]
    
    if job.status != "complete":
        raise HTTPException(
            status_code=400,
            detail=f"Job not complete. Current status: {job.status}",
        )
    
    if not job.result:
        raise HTTPException(
            status_code=500,
            detail="Job marked complete but no result available",
        )
    
    return SpreadsheetParseResult(
        job_id=job.job_id,
        success=job.result.success,
        total_rows=job.result.total_rows,
        total_tasks=job.result.total_tasks,
        completed_tasks=job.result.completed_tasks,
        failed_tasks=job.result.failed_tasks,
        deduped_tasks=job.result.deduped_tasks,
        total_cost_usd=job.result.total_cost_usd,
        artifact_paths=job.result.artifact_paths,
        manifest_path=job.result.manifest_path,
        processing_time_ms=job.result.processing_time_ms,
        errors=job.result.errors,
        warnings=job.result.warnings,
    )


@router.post("/spreadsheet/cancel/{job_id}")
async def cancel_spreadsheet_job(
    job_id: str,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> Dict[str, Any]:
    """
    Cancel a running spreadsheet parsing job.
    """
    if job_id not in _jobs:
        raise HTTPException(
            status_code=404,
            detail=f"Job not found: {job_id}",
        )
    
    job = _jobs[job_id]
    
    if job.status in ("complete", "failed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job in status: {job.status}",
        )
    
    job.cancelled = True
    job.status = "cancelled"
    job.updated_at = datetime.utcnow()
    
    logger.info(f"Spreadsheet parse job cancelled: {job_id}")
    
    return {
        "job_id": job_id,
        "status": "cancelled",
        "message": "Job cancellation requested",
    }


@router.get("/spreadsheet/jobs")
async def list_spreadsheet_jobs(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """
    List spreadsheet parsing jobs with optional status filter.
    """
    jobs_list = list(_jobs.values())
    
    # Filter by status
    if status:
        jobs_list = [j for j in jobs_list if j.status == status]
    
    # Sort by started_at desc
    jobs_list.sort(key=lambda j: j.started_at or datetime.min, reverse=True)
    
    # Paginate
    limit = min(max(1, limit), 100)
    offset = max(0, offset)
    paged = jobs_list[offset:offset + limit]
    
    return {
        "total": len(jobs_list),
        "limit": limit,
        "offset": offset,
        "jobs": [
            {
                "job_id": j.job_id,
                "status": j.status,
                "progress": j.progress.dict() if j.progress else None,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "updated_at": j.updated_at.isoformat() if j.updated_at else None,
            }
            for j in paged
        ],
    }


# ============================================================================
# Background Pipeline Execution
# ============================================================================

async def _run_pipeline(job: JobState) -> None:
    """
    Run the LargeSheetPipeline in the background.
    """
    config = job.config
    
    try:
        job.status = "scanning"
        job.updated_at = datetime.utcnow()
        
        # Build output directory
        output_dir = Path(os.environ.get("ARTIFACT_BASE", "/data/artifacts")) / job.job_id
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Progress callback
        def update_progress(progress: PipelineProgress):
            job.progress = SpreadsheetParseProgress(
                phase=progress.phase,
                total_rows=progress.total_rows,
                processed_rows=progress.processed_rows,
                total_tasks=progress.total_tasks,
                completed_tasks=progress.completed_tasks,
                failed_tasks=progress.failed_tasks,
                progress_pct=(progress.processed_rows / max(progress.total_rows, 1)) * 100,
            )
            job.updated_at = datetime.utcnow()
            
            # Update status based on phase
            if progress.phase == "scan":
                job.status = "scanning"
            elif progress.phase == "extract":
                job.status = "extracting"
            elif progress.phase == "merge":
                job.status = "merging"
        
        # Build extraction function
        async def extract_fn(text: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
            """Extraction function for the pipeline."""
            if job.cancelled:
                raise asyncio.CancelledError("Job cancelled")
            
            result = await extract_clinical_from_cell(
                cell_text=text,
                metadata=metadata,
            )
            return result.extraction.dict()
        
        # Create and run pipeline
        pipeline = LargeSheetPipeline(
            job_id=job.job_id,
            output_dir=output_dir,
            progress_callback=update_progress,
        )
        
        result = await pipeline.run(
            input_path=Path(config.artifact_path),
            extract_fn=extract_fn,
        )
        
        job.result = result
        job.status = "complete" if result.success else "failed"
        job.completed_at = datetime.utcnow()
        job.updated_at = datetime.utcnow()
        
        if not result.success:
            job.error = "; ".join(result.errors[:3]) if result.errors else "Unknown error"
        
        logger.info(f"Pipeline completed for {job.job_id}: success={result.success}")
        
    except asyncio.CancelledError:
        job.status = "cancelled"
        job.error = "Job was cancelled"
        job.updated_at = datetime.utcnow()
        logger.info(f"Pipeline cancelled for {job.job_id}")
        
    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        job.updated_at = datetime.utcnow()
        logger.error(f"Pipeline failed for {job.job_id}: {e}", exc_info=True)


# ============================================================================
# DataFrame Extraction Endpoints (Original)
# ============================================================================

if DATAFRAME_EXTRACTION_AVAILABLE:
    
    @router.post("/dataframe/detect-columns")
    async def detect_columns(
        file: UploadFile = File(...),
        min_text_length: int = Form(default=50),
        min_narrative_ratio: float = Form(default=0.3),
        x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
    ) -> Dict[str, Any]:
        """
        Detect narrative text columns in uploaded DataFrame.
        
        Returns list of columns containing narrative text suitable for extraction.
        """
        # Validate file type
        allowed_extensions = {'.csv', '.parquet', '.xlsx', '.xls', '.tsv'}
        file_ext = os.path.splitext(file.filename or '')[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}",
            )
        
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=file_ext,
            ) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_path = temp_file.name
            
            # Load DataFrame
            if file_ext == '.csv':
                df = pd.read_csv(temp_path)
            elif file_ext == '.parquet':
                df = pd.read_parquet(temp_path)
            elif file_ext in {'.xlsx', '.xls'}:
                df = pd.read_excel(temp_path)
            elif file_ext == '.tsv':
                df = pd.read_csv(temp_path, sep='\t')
            else:
                df = pd.read_csv(temp_path)
            
            # Detect narrative columns
            narrative_cols = detect_narrative_columns(
                df,
                min_text_length=min_text_length,
                min_narrative_ratio=min_narrative_ratio,
            )
            
            # Get extraction targets for analysis
            targets = identify_extraction_targets(df, columns=narrative_cols)
            
            return {
                "file_name": file.filename,
                "row_count": len(df),
                "column_count": len(df.columns),
                "all_columns": list(df.columns),
                "narrative_columns": narrative_cols,
                "extraction_target_count": len(targets),
                "parameters_used": {
                    "min_text_length": min_text_length,
                    "min_narrative_ratio": min_narrative_ratio,
                },
            }
            
        except Exception as e:
            logger.error(f"Column detection failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))
        
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass


# ============================================================================
# Health Check
# ============================================================================

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint for the extraction service.
    """
    return {
        "status": "healthy",
        "service": "data-extraction",
        "features": {
            "extraction": True,
            "batch_extraction": True,
            "mesh_enrichment": True,
            "dataframe_extraction": DATAFRAME_EXTRACTION_AVAILABLE,
            "large_sheet_pipeline": LARGE_SHEET_AVAILABLE,
        },
        "active_jobs": len([j for j in _jobs.values() if j.status not in ("complete", "failed", "cancelled")]),
    }

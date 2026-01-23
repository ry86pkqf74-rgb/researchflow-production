"""
Data Extraction API Routes - FastAPI endpoints for clinical data extraction.

This module exposes the extraction functionality as a FastAPI router that can
be mounted in the main api_server.py.
"""

from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
import tempfile
import os

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

logger = logging.getLogger(__name__)

# Create router with prefix
router = APIRouter(prefix="/extraction", tags=["extraction"])


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
        raise HTTPException(status_code=400, detail="Batch cannot be empty")
    
    if len(requests) > 100:
        raise HTTPException(status_code=400, detail="Batch size exceeds maximum (100)")
    
    if concurrency < 1 or concurrency > 20:
        concurrency = 5
    
    cells = [
        {"text": req.text, "metadata": req.metadata}
        for req in requests
    ]
    
    try:
        results = await extract_batch(cells, concurrency=concurrency)
        logger.info(f"Batch extraction complete: {len(results)} items processed")
        return results
        
    except Exception as e:
        logger.error(f"Batch extraction failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch extraction failed: {str(e)}")


@router.post("/enrich", response_model=EnrichmentResponse)
async def enrich_with_mesh(
    request: EnrichmentRequest,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> EnrichmentResponse:
    """
    Enrich clinical terms with MeSH metadata.
    
    Accepts clinical terms and returns MeSH mappings through
    the orchestrator's NLM integration.
    """
    if not request.terms:
        raise HTTPException(status_code=400, detail="Terms list cannot be empty")
    
    if len(request.terms) > 500:
        raise HTTPException(status_code=400, detail="Too many terms (max 500)")
    
    try:
        result = await enrich_terms_with_mesh(
            terms=request.terms,
            include_synonyms=request.include_synonyms,
            max_results_per_term=request.max_results_per_term,
            request_id=x_request_id,
        )
        
        logger.info(
            f"Enrichment complete: {len(result.mappings)} mapped, "
            f"{len(result.unmapped_terms)} unmapped"
        )
        
        return result
        
    except EnrichmentError as e:
        logger.error(f"Enrichment failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint for the extraction service."""
    return {
        "status": "healthy",
        "service": "extraction",
        "version": "1.0.0",
        "dataframe_extraction_available": DATAFRAME_EXTRACTION_AVAILABLE,
    }


# DataFrame extraction schemas
class DataFrameExtractionRequest(BaseModel):
    """Request schema for DataFrame extraction."""
    columns: Optional[List[str]] = Field(
        None,
        description="Columns to extract from (auto-detect if None)",
    )
    min_text_length: int = Field(
        100,
        description="Minimum text length to trigger extraction",
        ge=10,
        le=10000,
    )
    enable_phi_scanning: bool = Field(
        True,
        description="Enable PHI pre/post scanning",
    )
    block_on_phi: bool = Field(
        True,
        description="Block extraction when PHI detected",
    )
    enable_nlm_enrichment: bool = Field(
        True,
        description="Enable MeSH term enrichment",
    )
    force_tier: Optional[str] = Field(
        None,
        description="Force model tier (NANO, MINI, FRONTIER)",
    )
    max_concurrent: int = Field(
        5,
        description="Maximum concurrent API calls",
        ge=1,
        le=20,
    )


class DataFrameExtractionResponse(BaseModel):
    """Response schema for DataFrame extraction."""
    status: str
    file_path: Optional[str] = None
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    columns_detected: List[str] = []
    columns_processed: List[str] = []
    total_cells: int = 0
    successful: int = 0
    failed: int = 0
    phi_blocked: int = 0
    total_cost_usd: float = 0.0
    total_tokens: Dict[str, int] = {}
    manifest: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    message: Optional[str] = None


@router.post("/extract/dataframe", response_model=DataFrameExtractionResponse)
async def extract_from_dataframe(
    file: UploadFile = File(..., description="CSV, Parquet, or Excel file"),
    columns: Optional[str] = Form(None, description="Comma-separated column names"),
    min_text_length: int = Form(100),
    enable_phi_scanning: bool = Form(True),
    block_on_phi: bool = Form(True),
    enable_nlm_enrichment: bool = Form(True),
    force_tier: Optional[str] = Form(None),
    max_concurrent: int = Form(5),
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> DataFrameExtractionResponse:
    """
    Extract clinical data from uploaded DataFrame with PHI scanning.
    
    Accepts CSV, Parquet, or Excel files and performs:
    - Automatic narrative column detection (or use specified columns)
    - PHI pre-scanning before AI extraction
    - LLM-powered clinical data extraction
    - PHI post-scanning of results
    - Optional MeSH term enrichment
    
    Returns extraction results and manifest.
    """
    if not DATAFRAME_EXTRACTION_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="DataFrame extraction not available (pandas or cell_parser not installed)",
        )
    
    # Validate file type
    allowed_extensions = {'.csv', '.parquet', '.xlsx', '.xls', '.tsv'}
    file_ext = os.path.splitext(file.filename or '')[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file_ext}. Allowed: {allowed_extensions}",
        )
    
    # Parse columns parameter
    column_list = None
    if columns:
        column_list = [c.strip() for c in columns.split(',') if c.strip()]
    
    # Save uploaded file to temp location
    temp_file = None
    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=file_ext,
            prefix="extraction_",
        ) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        logger.info(f"Saved uploaded file to {temp_path} ({len(content)} bytes)")
        
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
        
        logger.info(f"Loaded DataFrame: {len(df)} rows, {len(df.columns)} columns")
        
        # Auto-detect columns if not specified
        if column_list is None:
            column_list = detect_narrative_columns(df, min_text_length=min_text_length)
            logger.info(f"Auto-detected narrative columns: {column_list}")
        
        if not column_list:
            return DataFrameExtractionResponse(
                status="completed",
                file_path=file.filename,
                row_count=len(df),
                column_count=len(df.columns),
                columns_detected=[],
                message="No narrative columns detected for extraction",
            )
        
        # Build metadata for extraction
        metadata = {
            "source_file": file.filename,
            "request_id": x_request_id,
        }
        
        # Perform extraction
        df_result, manifest = await parse_block_text(
            df=df,
            columns=column_list,
            min_text_length=min_text_length,
            max_concurrent=max_concurrent,
            enable_phi_scanning=enable_phi_scanning,
            block_on_phi=block_on_phi,
            enable_nlm_enrichment=enable_nlm_enrichment,
            force_tier=force_tier,
            metadata=metadata,
        )
        
        logger.info(
            f"DataFrame extraction complete: {manifest.successful} successful, "
            f"{manifest.failed} failed, {manifest.phi_blocked} PHI-blocked"
        )
        
        return DataFrameExtractionResponse(
            status="completed",
            file_path=file.filename,
            row_count=len(df),
            column_count=len(df.columns),
            columns_detected=column_list,
            columns_processed=manifest.columns_processed,
            total_cells=manifest.total_cells,
            successful=manifest.successful,
            failed=manifest.failed,
            phi_blocked=manifest.phi_blocked,
            total_cost_usd=manifest.total_cost_usd,
            total_tokens=manifest.total_tokens,
            manifest=manifest.to_dict(),
        )
        
    except Exception as e:
        logger.error(f"DataFrame extraction failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"DataFrame extraction failed: {str(e)}",
        )
    
    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass


@router.post("/detect-columns")
async def detect_narrative_columns_endpoint(
    file: UploadFile = File(..., description="CSV, Parquet, or Excel file"),
    min_text_length: int = Form(100),
    min_narrative_ratio: float = Form(0.3),
) -> Dict[str, Any]:
    """
    Detect narrative text columns in uploaded DataFrame.
    
    Returns list of columns containing narrative text suitable for extraction.
    """
    if not DATAFRAME_EXTRACTION_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Column detection not available",
        )
    
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

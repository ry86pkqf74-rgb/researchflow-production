"""
Extraction API Routes - FastAPI endpoints for clinical data extraction.

These endpoints expose the extraction functionality to the rest of the system.
All extraction requests are logged and can be traced via request_id.
"""

from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from typing import Optional, List
import logging

from ..data_extraction import (
    extract_clinical_from_cell,
    extract_batch,
    enrich_terms_with_mesh,
    enrich_extraction,
    ExtractionRequest,
    ExtractionResponse,
    EnrichmentRequest,
    EnrichmentResponse,
    ExtractionError,
    EnrichmentError,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/extraction", tags=["extraction"])


@router.post("/extract", response_model=ExtractionResponse)
async def extract_clinical_data(
    request: ExtractionRequest,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> ExtractionResponse:
    """
    Extract structured clinical data from text.
    
    This endpoint accepts clinical text and returns structured extraction
    following the ClinicalExtraction schema. The extraction is performed
    through the AI Router for governance compliance.
    
    Args:
        request: ExtractionRequest with text and metadata
        x_request_id: Optional correlation ID for tracing
        
    Returns:
        ExtractionResponse with extraction results and metadata
        
    Raises:
        HTTPException 500: If extraction fails
        HTTPException 400: If input is invalid
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if len(request.text) > 100000:  # 100KB limit
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
    
    This endpoint accepts a list of extraction requests and processes them
    with controlled concurrency. Results are returned in the same order
    as input.
    
    Args:
        requests: List of ExtractionRequest objects
        concurrency: Maximum concurrent extractions (default 5)
        x_request_id: Optional correlation ID for tracing
        
    Returns:
        List of ExtractionResponse in same order as input
        
    Raises:
        HTTPException 400: If batch is too large or invalid
    """
    if not requests:
        raise HTTPException(status_code=400, detail="Batch cannot be empty")
    
    if len(requests) > 100:
        raise HTTPException(status_code=400, detail="Batch size exceeds maximum (100)")
    
    if concurrency < 1 or concurrency > 20:
        concurrency = 5  # Default to safe value
    
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
    
    This endpoint accepts a list of clinical terms and returns
    MeSH mappings through the orchestrator's NLM integration.
    
    Args:
        request: EnrichmentRequest with terms to enrich
        x_request_id: Optional correlation ID for tracing
        
    Returns:
        EnrichmentResponse with MeSH mappings
        
    Raises:
        HTTPException 500: If enrichment fails
        HTTPException 400: If input is invalid
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
    }

"""
Data Extraction API Routes - FastAPI endpoints for clinical data extraction.

This module exposes the extraction functionality as a FastAPI router that can
be mounted in the main api_server.py.
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional, List
import logging

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
    }

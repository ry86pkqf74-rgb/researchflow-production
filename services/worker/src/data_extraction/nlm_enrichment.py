"""
NLM Enrichment Module - MeSH term lookup through orchestrator with direct NCBI fallback.

This module provides MeSH term enrichment for clinical extractions:
- Primary: Route through orchestrator's literature API
- Fallback: Direct NCBI E-utilities API when orchestrator unavailable

The fallback ensures enrichment continues even during orchestrator downtime.
"""

import os
import asyncio
import logging
from typing import List, Optional, Dict, Any

import httpx

from .schemas import MeSHMapping, EnrichmentResponse

logger = logging.getLogger(__name__)

ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:3001")
MESH_LOOKUP_ENDPOINT = f"{ORCHESTRATOR_URL}/api/literature/mesh/lookup"
REQUEST_TIMEOUT = int(os.getenv("ENRICHMENT_TIMEOUT_SECONDS", "30"))
USE_DIRECT_NLM_FALLBACK = os.getenv("NLM_ENABLE_DIRECT_FALLBACK", "true").lower() == "true"


class EnrichmentError(Exception):
    """Exception for enrichment failures."""
    def __init__(self, message: str, source: str = "unknown", retryable: bool = False):
        super().__init__(message)
        self.source = source
        self.retryable = retryable


async def _enrich_via_orchestrator(
    terms: List[str],
    include_synonyms: bool = False,
    max_results_per_term: int = 3,
    request_id: Optional[str] = None,
) -> EnrichmentResponse:
    """Enrich terms via orchestrator's literature API."""
    unique_terms = list(set(t.strip() for t in terms if t.strip()))
    payload = {
        "terms": unique_terms,
        "include_synonyms": include_synonyms,
        "max_results_per_term": max_results_per_term,
    }
    headers = {"Content-Type": "application/json"}
    if request_id:
        headers["X-Request-ID"] = request_id
    
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(MESH_LOOKUP_ENDPOINT, json=payload, headers=headers)
        response.raise_for_status()
        result = response.json()
        
        mappings, unmapped = [], []
        for term, matches in result.get("results", {}).items():
            if matches and matches[0].get("mesh_id"):
                for match in matches[:max_results_per_term]:
                    if match.get("mesh_id"):
                        mappings.append(MeSHMapping(
                            original_term=term,
                            mesh_id=match.get("mesh_id", ""),
                            mesh_label=match.get("mesh_name", ""),
                            confidence=match.get("confidence", 0.5),
                            tree_numbers=match.get("tree_numbers", []),
                            synonyms=match.get("synonyms", []) if include_synonyms else [],
                        ))
            else:
                unmapped.append(term)
        
        return EnrichmentResponse(
            mappings=mappings,
            unmapped_terms=unmapped,
            request_id=request_id or result.get("request_id", "orchestrator"),
        )


async def _enrich_via_direct_nlm(
    terms: List[str],
    include_synonyms: bool = False,
    max_results_per_term: int = 3,
    request_id: Optional[str] = None,
) -> EnrichmentResponse:
    """Enrich terms via direct NCBI E-utilities API (fallback)."""
    try:
        from .nlm_client import get_nlm_client
    except ImportError:
        raise EnrichmentError("NLM client not available", source="nlm_client", retryable=False)
    
    client = get_nlm_client()
    unique_terms = list(set(t.strip() for t in terms if t.strip()))
    
    results = await client.lookup_mesh_terms(unique_terms)
    
    mappings = []
    unmapped = []
    
    for result in results:
        if result.matched and result.mesh_id:
            mappings.append(MeSHMapping(
                original_term=result.original_term,
                mesh_id=result.mesh_id,
                mesh_label=result.mesh_label or "",
                confidence=result.confidence,
                tree_numbers=result.tree_numbers,
                synonyms=result.synonyms if include_synonyms else [],
            ))
        else:
            unmapped.append(result.original_term)
    
    return EnrichmentResponse(
        mappings=mappings,
        unmapped_terms=unmapped,
        request_id=request_id or "direct_nlm",
    )


async def enrich_terms_with_mesh(
    terms: List[str],
    include_synonyms: bool = False,
    max_results_per_term: int = 3,
    request_id: Optional[str] = None,
    use_fallback: bool = True,
) -> EnrichmentResponse:
    """
    Enrich clinical terms with MeSH metadata.
    
    Attempts enrichment via orchestrator first, falls back to direct NCBI
    API if orchestrator is unavailable and fallback is enabled.
    
    Args:
        terms: List of clinical terms to enrich
        include_synonyms: Include MeSH synonyms in results
        max_results_per_term: Maximum matches per term
        request_id: Optional request ID for tracing
        use_fallback: Enable direct NLM fallback on orchestrator failure
    
    Returns:
        EnrichmentResponse with MeSH mappings
    
    Raises:
        EnrichmentError: If both orchestrator and fallback fail
    """
    if not terms:
        return EnrichmentResponse(
            mappings=[],
            unmapped_terms=[],
            request_id=request_id or "empty",
        )
    
    # Try orchestrator first
    orchestrator_error = None
    try:
        return await _enrich_via_orchestrator(
            terms, include_synonyms, max_results_per_term, request_id
        )
    except httpx.HTTPStatusError as e:
        logger.warning(f"Orchestrator enrichment failed: {e.response.status_code}")
        orchestrator_error = EnrichmentError(
            f"Orchestrator error: {e.response.status_code}",
            source="orchestrator",
            retryable=e.response.status_code >= 500,
        )
    except httpx.RequestError as e:
        logger.warning(f"Orchestrator connection failed: {e}")
        orchestrator_error = EnrichmentError(
            f"Connection error: {str(e)}",
            source="orchestrator",
            retryable=True,
        )
    
    # Try direct NLM fallback
    if use_fallback and USE_DIRECT_NLM_FALLBACK:
        try:
            logger.info("Falling back to direct NLM API")
            return await _enrich_via_direct_nlm(
                terms, include_synonyms, max_results_per_term, request_id
            )
        except Exception as e:
            logger.error(f"Direct NLM fallback failed: {e}")
            # Raise original orchestrator error if fallback also fails
            raise orchestrator_error
    
    raise orchestrator_error


async def enrich_extraction(
    extraction_dict: Dict[str, Any],
    request_id: Optional[str] = None,
    use_fallback: bool = True,
) -> Dict[str, Any]:
    """
    Enrich a clinical extraction result with MeSH terms.
    
    Automatically identifies terms needing enrichment from diagnoses,
    procedures, outcomes, complications, and medications fields.
    
    Args:
        extraction_dict: Dictionary from ClinicalExtraction.model_dump()
        request_id: Optional request ID for tracing
        use_fallback: Enable direct NLM fallback
    
    Returns:
        Enriched extraction dictionary with MeSH IDs added
    """
    terms_to_enrich = []
    term_sources: Dict[str, tuple] = {}
    
    # Collect terms from clinical fields
    for field in ["diagnoses", "procedures", "outcomes", "complications"]:
        for i, item in enumerate(extraction_dict.get(field, [])):
            text = item.get("text", "")
            if text and not item.get("mesh_id"):
                terms_to_enrich.append(text)
                term_sources[text] = (field, i)
    
    # Collect medication names
    for i, med in enumerate(extraction_dict.get("medications", [])):
        name = med.get("name", "")
        if name and not med.get("mesh_id"):
            terms_to_enrich.append(name)
            term_sources[name] = ("medications", i)
    
    if not terms_to_enrich:
        return extraction_dict
    
    try:
        enrichment = await enrich_terms_with_mesh(
            terms_to_enrich,
            include_synonyms=False,
            max_results_per_term=1,
            request_id=request_id,
            use_fallback=use_fallback,
        )
        
        # Apply mappings to extraction
        for mapping in enrichment.mappings:
            source = term_sources.get(mapping.original_term)
            if source:
                field_name, index = source
                if field_name in extraction_dict and index < len(extraction_dict[field_name]):
                    extraction_dict[field_name][index]["mesh_id"] = mapping.mesh_id
                    if field_name != "medications":
                        extraction_dict[field_name][index]["mesh_label"] = mapping.mesh_label
                        extraction_dict[field_name][index]["mesh_confidence"] = mapping.confidence
        
        # Track enrichment source in extraction
        extraction_dict.setdefault("_enrichment_meta", {})
        extraction_dict["_enrichment_meta"]["source"] = (
            "orchestrator" if enrichment.request_id != "direct_nlm" else "direct_nlm"
        )
        extraction_dict["_enrichment_meta"]["mapped_count"] = len(enrichment.mappings)
        extraction_dict["_enrichment_meta"]["unmapped_count"] = len(enrichment.unmapped_terms)
        
    except EnrichmentError as e:
        extraction_dict.setdefault("warnings", []).append(
            f"MeSH enrichment failed ({e.source}): {str(e)}"
        )
    
    return extraction_dict


def enrich_terms_sync(terms: List[str], use_fallback: bool = True) -> EnrichmentResponse:
    """Synchronous wrapper for enrich_terms_with_mesh."""
    return asyncio.run(enrich_terms_with_mesh(terms, use_fallback=use_fallback))

"""
NLM Enrichment Module - MeSH term lookup through orchestrator.
"""

import os
import asyncio
from typing import List, Optional, Dict, Any
import httpx

from .schemas import MeSHMapping, EnrichmentResponse

ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:3001")
MESH_LOOKUP_ENDPOINT = f"{ORCHESTRATOR_URL}/api/literature/mesh/lookup"
REQUEST_TIMEOUT = int(os.getenv("ENRICHMENT_TIMEOUT_SECONDS", "30"))


class EnrichmentError(Exception):
    pass


async def enrich_terms_with_mesh(
    terms: List[str], include_synonyms: bool = False,
    max_results_per_term: int = 3, request_id: Optional[str] = None,
) -> EnrichmentResponse:
    if not terms:
        return EnrichmentResponse(mappings=[], unmapped_terms=[], request_id=request_id or "empty")
    
    unique_terms = list(set(t.strip() for t in terms if t.strip()))
    payload = {"terms": unique_terms, "include_synonyms": include_synonyms, "max_results_per_term": max_results_per_term}
    headers = {"Content-Type": "application/json"}
    if request_id:
        headers["X-Request-ID"] = request_id
    
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            response = await client.post(MESH_LOOKUP_ENDPOINT, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            
            mappings, unmapped = [], []
            for term_result in result.get("results", []):
                term = term_result.get("term", "")
                matches = term_result.get("matches", [])
                if matches:
                    for match in matches[:max_results_per_term]:
                        mappings.append(MeSHMapping(
                            original_term=term, mesh_id=match.get("mesh_id", ""),
                            mesh_label=match.get("label", ""), confidence=match.get("confidence", 0.5),
                            tree_numbers=match.get("tree_numbers", []),
                            synonyms=match.get("synonyms", []) if include_synonyms else [],
                        ))
                else:
                    unmapped.append(term)
            
            return EnrichmentResponse(mappings=mappings, unmapped_terms=unmapped, request_id=request_id or result.get("request_id", "unknown"))
        except httpx.HTTPStatusError as e:
            raise EnrichmentError(f"Orchestrator error: {e.response.status_code}")
        except httpx.RequestError as e:
            raise EnrichmentError(f"Connection error: {str(e)}")


async def enrich_extraction(extraction_dict: Dict[str, Any], request_id: Optional[str] = None) -> Dict[str, Any]:
    terms_to_enrich = []
    term_sources = {}
    
    for field in ["diagnoses", "procedures", "outcomes", "complications"]:
        for i, item in enumerate(extraction_dict.get(field, [])):
            text = item.get("text", "")
            if text and not item.get("mesh_id"):
                terms_to_enrich.append(text)
                term_sources[text] = (field, i)
    
    for i, med in enumerate(extraction_dict.get("medications", [])):
        name = med.get("name", "")
        if name and not med.get("mesh_id"):
            terms_to_enrich.append(name)
            term_sources[name] = ("medications", i)
    
    if not terms_to_enrich:
        return extraction_dict
    
    try:
        enrichment = await enrich_terms_with_mesh(terms_to_enrich, False, 1, request_id)
        for mapping in enrichment.mappings:
            source = term_sources.get(mapping.original_term)
            if source:
                field_name, index = source
                if field_name in extraction_dict:
                    extraction_dict[field_name][index]["mesh_id"] = mapping.mesh_id
                    if field_name != "medications":
                        extraction_dict[field_name][index]["mesh_label"] = mapping.mesh_label
                        extraction_dict[field_name][index]["mesh_confidence"] = mapping.confidence
    except EnrichmentError as e:
        extraction_dict.setdefault("warnings", []).append(f"MeSH enrichment failed: {str(e)}")
    
    return extraction_dict


def enrich_terms_sync(terms: List[str]) -> EnrichmentResponse:
    return asyncio.run(enrich_terms_with_mesh(terms))

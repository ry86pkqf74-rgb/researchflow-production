"""
Guideline Processing API Routes - Stage 20 Integration

This module exposes the guideline engine functionality as FastAPI endpoints
for fetching, parsing, and generating AI-powered study suggestions from
medical guidelines.

Endpoints:
- GET /guidelines/process - Process a guideline query
- GET /guidelines/sources - List available guideline sources
- GET /guidelines/fields - List medical fields
- GET /guidelines/categories - List guideline categories
- GET /guidelines/cache/health - Check cache health
- POST /guidelines/cache/invalidate - Invalidate cache
"""
import sys
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

# Add packages to path for guideline-engine
packages_path = Path(__file__).parent.parent.parent.parent.parent / "packages" / "guideline-engine"
if str(packages_path) not in sys.path:
    sys.path.insert(0, str(packages_path))

# Import guideline engine
try:
    from guideline_engine import (
        process_query,
        discover_url,
        list_sources,
        list_fields,
        list_categories,
        GUIDELINE_SOURCES,
        cache,
    )
    GUIDELINE_ENGINE_AVAILABLE = True
except ImportError as e:
    GUIDELINE_ENGINE_AVAILABLE = False
    IMPORT_ERROR = str(e)

router = APIRouter(prefix="/guidelines", tags=["guidelines"])


# =============================================================================
# Response Models
# =============================================================================

class GuidelineSection(BaseModel):
    """A section extracted from the guideline."""
    heading: str
    level: int
    content: str


class ParsedGuideline(BaseModel):
    """Parsed guideline structure."""
    title: str
    url: Optional[str] = None
    field: Optional[str] = None
    category: Optional[str] = None
    sections: list = []
    tables: list = []
    lists: list = []
    stages: list = []
    parsed: bool = True


class ValidationStudy(BaseModel):
    """A suggested validation study."""
    type: str
    metrics: list[str]


class Suggestions(BaseModel):
    """AI-powered study suggestions."""
    title: str
    field: str
    category: str
    manuscript_ideas: list[str] = []
    validation_studies: list[ValidationStudy] = []
    questions_to_consider: list[str] = []
    reporting_checklist: list[str] = []
    statistical_methods: list[str] = []


class GuidelineProcessResponse(BaseModel):
    """Response from processing a guideline query."""
    query: str
    parsed: ParsedGuideline
    suggestions: Suggestions
    from_cache: bool


class GuidelineSource(BaseModel):
    """A guideline source."""
    query: str
    field: Optional[str] = None
    category: Optional[str] = None
    url: str
    description: str = ""


class SourcesResponse(BaseModel):
    """Response listing guideline sources."""
    sources: list[GuidelineSource]
    total: int


class FieldsResponse(BaseModel):
    """Response listing medical fields."""
    fields: list[str]


class CategoriesResponse(BaseModel):
    """Response listing guideline categories."""
    categories: list[str]


class CacheHealthResponse(BaseModel):
    """Cache health check response."""
    status: str
    backend: str
    used_memory: Optional[str] = None
    connected_clients: Optional[int] = None
    error: Optional[str] = None


class CacheInvalidateRequest(BaseModel):
    """Request to invalidate cache."""
    prefix: Optional[str] = Field(None, description="Cache prefix to invalidate (fetch, parse, suggest)")
    query: Optional[str] = Field(None, description="Specific query to invalidate")


class CacheInvalidateResponse(BaseModel):
    """Response from cache invalidation."""
    success: bool
    keys_invalidated: int


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/process", response_model=GuidelineProcessResponse)
async def process_guideline_query(
    query: str = Query(..., min_length=3, description="Guideline query (e.g., 'tnm colorectal', 'clavien-dindo')"),
    use_cache: bool = Query(True, description="Use Redis cache for faster subsequent requests"),
):
    """Process a guideline query: fetch content, parse structure, and generate suggestions.

    This endpoint:
    1. Discovers the URL for the query from known sources
    2. Fetches the guideline content (HTML or PDF)
    3. Parses the content into structured JSON
    4. Generates manuscript ideas and validation study suggestions

    **Examples:**
    - `query=tnm colorectal` - TNM staging for colorectal cancer
    - `query=clavien-dindo` - Surgical complications grading
    - `query=asa physical status` - ASA classification
    - `query=ecog performance` - Performance status scale
    """
    if not GUIDELINE_ENGINE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=f"Guideline engine not available: {IMPORT_ERROR}"
        )

    result = await process_query(query, use_cache=use_cache)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.get("/sources", response_model=SourcesResponse)
async def get_guideline_sources(
    field: Optional[str] = Query(None, description="Filter by field (oncology, surgery, etc.)"),
    category: Optional[str] = Query(None, description="Filter by category (staging, grading, etc.)"),
):
    """List available guideline sources with optional filtering.

    **Available fields:** oncology, surgery, anesthesia, hepatology, cardiology, trauma, neurology, nephrology

    **Available categories:** staging, grading, classification, score
    """
    if not GUIDELINE_ENGINE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=f"Guideline engine not available: {IMPORT_ERROR}"
        )

    sources = list_sources(field=field, category=category)
    return {"sources": sources, "total": len(sources)}


@router.get("/fields", response_model=FieldsResponse)
async def get_medical_fields():
    """List all available medical fields in the guideline database."""
    if not GUIDELINE_ENGINE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=f"Guideline engine not available: {IMPORT_ERROR}"
        )

    fields = list_fields()
    return {"fields": fields}


@router.get("/categories", response_model=CategoriesResponse)
async def get_guideline_categories():
    """List all available guideline categories (staging, grading, etc.)."""
    if not GUIDELINE_ENGINE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=f"Guideline engine not available: {IMPORT_ERROR}"
        )

    categories = list_categories()
    return {"categories": categories}


@router.get("/cache/health", response_model=CacheHealthResponse)
async def check_cache_health():
    """Check the health status of the guideline cache (Redis or memory)."""
    if not GUIDELINE_ENGINE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=f"Guideline engine not available: {IMPORT_ERROR}"
        )

    return cache.health_check()


@router.post("/cache/invalidate", response_model=CacheInvalidateResponse)
async def invalidate_cache(request: CacheInvalidateRequest):
    """Invalidate cached guideline data.

    You can either:
    - Invalidate all cache entries (no parameters)
    - Invalidate by prefix (fetch, parse, or suggest)
    - Invalidate a specific query
    """
    if not GUIDELINE_ENGINE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=f"Guideline engine not available: {IMPORT_ERROR}"
        )

    if request.query and request.prefix:
        # Invalidate specific query for specific prefix
        cache.invalidate(request.prefix, request.query)
        return {"success": True, "keys_invalidated": 1}
    elif request.query:
        # Invalidate specific query for all prefixes
        count = 0
        for prefix in ["fetch", "parse", "suggest"]:
            cache.invalidate(prefix, request.query)
            count += 1
        return {"success": True, "keys_invalidated": count}
    else:
        # Invalidate all (or by prefix)
        count = cache.invalidate_all(prefix=request.prefix)
        return {"success": True, "keys_invalidated": count}


@router.get("/discover")
async def discover_guideline_url(
    query: str = Query(..., min_length=2, description="Guideline query to look up"),
):
    """Discover the URL and metadata for a guideline query without fetching content.

    This is useful for checking if a query has a known source before processing.
    """
    if not GUIDELINE_ENGINE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=f"Guideline engine not available: {IMPORT_ERROR}"
        )

    source = discover_url(query)
    if not source:
        raise HTTPException(
            status_code=404,
            detail=f"No source found for query: {query}"
        )

    return {
        "query": query,
        "source": source,
    }

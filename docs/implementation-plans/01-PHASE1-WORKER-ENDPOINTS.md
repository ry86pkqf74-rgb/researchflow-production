# Phase 1: Worker FastAPI Endpoints

**Target:** `services/worker/`
**Language:** Python
**Estimated LOC:** ~250 lines

---

## Overview

The conference_prep Python modules are complete but not exposed via API. This phase adds FastAPI routes to make them accessible from the orchestrator.

---

## File 1: Create `services/worker/src/api/conference_routes.py`

```python
"""
Conference Preparation API Routes

Exposes conference discovery, guideline extraction, material generation,
and bundle export functionality via FastAPI endpoints.

All endpoints support DEMO mode (no external network calls).
PHI sanitization is enforced on all text outputs.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
import logging

# Import existing conference_prep modules
from src.conference_prep.discovery import (
    discover_conferences,
    ConferenceDiscoveryInput,
    ConferenceDiscoveryResult,
)
from src.conference_prep.guidelines import (
    extract_guidelines,
    GuidelineExtractionInput,
    GuidelineExtractionResult,
)
from src.conference_prep.generate_materials import (
    generate_material,
    MaterialGenerationInput,
    MaterialGenerationResult,
    check_dependencies,
)
from src.conference_prep.export_bundle import (
    create_conference_bundle,
    orchestrate_full_export,
    ExportBundleInput,
    ExportBundleResult,
)
from src.conference_prep.provenance import (
    create_provenance_record,
    validate_provenance_chain,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/conference", tags=["conference"])

# Base artifact directory
ARTIFACTS_BASE = os.getenv("ARTIFACTS_PATH", "/data/artifacts/conference")


# ============================================================================
# Request/Response Models (Pydantic)
# ============================================================================

class DiscoverRequest(BaseModel):
    """Request for conference discovery."""
    keywords: List[str] = Field(..., min_items=1, description="Search keywords")
    year_range: Optional[List[int]] = Field(None, description="[start_year, end_year]")
    formats: Optional[List[str]] = Field(None, description="Desired formats: poster, oral, symposium")
    location_pref: Optional[str] = Field(None, description="Geographic preference: US, Europe, Asia")
    max_results: int = Field(10, ge=1, le=50, description="Maximum results to return")
    mode: str = Field("DEMO", description="DEMO or LIVE mode")


class DiscoverResponse(BaseModel):
    """Response from conference discovery."""
    success: bool
    conferences: List[Dict[str, Any]]
    total_found: int
    query_metadata: Dict[str, Any]


class ExtractGuidelinesRequest(BaseModel):
    """Request for guideline extraction."""
    conference_name: str = Field(..., description="Conference name")
    conference_url: Optional[str] = Field(None, description="Conference URL for live mode")
    formats: List[str] = Field(["poster", "oral"], description="Formats to extract")
    mode: str = Field("DEMO", description="DEMO or LIVE mode")


class ExtractGuidelinesResponse(BaseModel):
    """Response from guideline extraction."""
    success: bool
    conference_name: str
    raw_text_hash: str
    extracted_fields: Dict[str, Any]
    sanitization_applied: bool
    mode: str


class GenerateMaterialsRequest(BaseModel):
    """Request for material generation."""
    run_id: str = Field(..., description="Unique run identifier")
    format: str = Field(..., description="poster, oral, or symposium")
    conference_name: str
    title: str
    authors: Optional[List[str]] = Field(None, description="Author names (optional for blinding)")
    abstract: str
    sections: Dict[str, str] = Field(..., description="Content sections: background, methods, results, conclusions")
    blinding_mode: bool = Field(False, description="Redact author/institution info")
    requirements: Optional[Dict[str, Any]] = Field(None, description="Conference requirements override")


class GenerateMaterialsResponse(BaseModel):
    """Response from material generation."""
    success: bool
    run_id: str
    files_generated: List[Dict[str, Any]]
    manifest: Dict[str, Any]
    output_directory: str


class CreateBundleRequest(BaseModel):
    """Request for bundle creation."""
    run_id: str
    formats: List[str] = Field(["poster", "oral"], description="Formats to include")
    include_checklist: bool = Field(True)
    include_manifest: bool = Field(True)


class CreateBundleResponse(BaseModel):
    """Response from bundle creation."""
    success: bool
    run_id: str
    bundle_path: str
    bundle_hash: str
    bundle_size: int
    manifest: Dict[str, Any]
    download_url: str


class FullExportRequest(BaseModel):
    """Request for full orchestrated export."""
    research_id: str
    conference_name: str
    conference_url: Optional[str] = None
    formats: List[str] = Field(["poster"])
    title: str
    authors: Optional[List[str]] = None
    abstract: str
    sections: Dict[str, str]
    blinding_mode: bool = False
    mode: str = Field("DEMO")


class FullExportResponse(BaseModel):
    """Response from full export."""
    success: bool
    run_id: str
    discovery_results: Optional[Dict[str, Any]]
    guidelines_extracted: Dict[str, Any]
    materials_generated: List[Dict[str, Any]]
    bundle_path: str
    bundle_hash: str
    download_url: str
    checklist: List[Dict[str, Any]]


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check for conference API."""
    deps_ok = check_dependencies()
    return {
        "status": "healthy" if deps_ok else "degraded",
        "dependencies": {
            "reportlab": deps_ok,
            "python_pptx": deps_ok,
        },
        "artifacts_path": ARTIFACTS_BASE,
        "artifacts_writable": os.access(ARTIFACTS_BASE, os.W_OK) if os.path.exists(ARTIFACTS_BASE) else False,
    }


@router.post("/discover", response_model=DiscoverResponse)
async def discover_conferences_endpoint(request: DiscoverRequest):
    """
    Discover and rank conferences based on search criteria.

    DEMO mode: Uses curated registry only (no network calls)
    LIVE mode: May augment with external sources (PHI-gated)
    """
    try:
        logger.info(f"Conference discovery: keywords={request.keywords}, mode={request.mode}")

        # Build discovery input
        discovery_input = ConferenceDiscoveryInput(
            keywords=request.keywords,
            year_range=tuple(request.year_range) if request.year_range else None,
            formats=request.formats,
            location_pref=request.location_pref,
            max_results=request.max_results,
        )

        # Run discovery
        result: ConferenceDiscoveryResult = discover_conferences(discovery_input)

        return DiscoverResponse(
            success=True,
            conferences=[conf.to_dict() for conf in result.ranked_conferences],
            total_found=len(result.ranked_conferences),
            query_metadata={
                "keywords": request.keywords,
                "mode": request.mode,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    except Exception as e:
        logger.error(f"Discovery failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-guidelines", response_model=ExtractGuidelinesResponse)
async def extract_guidelines_endpoint(request: ExtractGuidelinesRequest):
    """
    Extract and sanitize conference submission guidelines.

    DEMO mode: Returns fixture data for known conferences
    LIVE mode: Fetches and parses actual guideline pages (sanitized)
    """
    try:
        logger.info(f"Guideline extraction: conference={request.conference_name}, mode={request.mode}")

        extraction_input = GuidelineExtractionInput(
            conference_name=request.conference_name,
            conference_url=request.conference_url,
            formats=request.formats,
            mode=request.mode,
        )

        result: GuidelineExtractionResult = extract_guidelines(extraction_input)

        return ExtractGuidelinesResponse(
            success=True,
            conference_name=request.conference_name,
            raw_text_hash=result.raw_text_hash,
            extracted_fields=result.extracted_fields,
            sanitization_applied=result.sanitization_applied,
            mode=request.mode,
        )

    except Exception as e:
        logger.error(f"Guideline extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-materials", response_model=GenerateMaterialsResponse)
async def generate_materials_endpoint(request: GenerateMaterialsRequest):
    """
    Generate conference submission materials (PDF poster, PPTX slides).

    Outputs are written to /data/artifacts/conference/{run_id}/
    All files include SHA256 hashes in the manifest.
    """
    try:
        logger.info(f"Material generation: run_id={request.run_id}, format={request.format}")

        # Ensure output directory exists
        output_dir = os.path.join(ARTIFACTS_BASE, request.run_id)
        os.makedirs(output_dir, exist_ok=True)

        generation_input = MaterialGenerationInput(
            run_id=request.run_id,
            format=request.format,
            conference_name=request.conference_name,
            title=request.title,
            authors=request.authors,
            abstract=request.abstract,
            sections=request.sections,
            blinding_mode=request.blinding_mode,
            requirements=request.requirements,
            output_directory=output_dir,
        )

        result: MaterialGenerationResult = generate_material(generation_input)

        return GenerateMaterialsResponse(
            success=True,
            run_id=request.run_id,
            files_generated=result.files,
            manifest=result.manifest,
            output_directory=output_dir,
        )

    except Exception as e:
        logger.error(f"Material generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-bundle", response_model=CreateBundleResponse)
async def create_bundle_endpoint(request: CreateBundleRequest):
    """
    Create a ZIP bundle of generated conference materials.

    Bundle includes:
    - Generated PDFs and PPTXs
    - manifest.json with file hashes
    - checklist.json with compliance status
    """
    try:
        logger.info(f"Bundle creation: run_id={request.run_id}")

        bundle_input = ExportBundleInput(
            run_id=request.run_id,
            formats=request.formats,
            include_checklist=request.include_checklist,
            include_manifest=request.include_manifest,
            source_directory=os.path.join(ARTIFACTS_BASE, request.run_id),
        )

        result: ExportBundleResult = create_conference_bundle(bundle_input)

        download_url = f"/api/conference/bundle/{request.run_id}/download"

        return CreateBundleResponse(
            success=True,
            run_id=request.run_id,
            bundle_path=result.bundle_path,
            bundle_hash=result.bundle_hash,
            bundle_size=result.bundle_size,
            manifest=result.manifest,
            download_url=download_url,
        )

    except Exception as e:
        logger.error(f"Bundle creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export", response_model=FullExportResponse)
async def full_export_endpoint(request: FullExportRequest):
    """
    Orchestrate full conference export workflow:

    1. Extract guidelines (DEMO fixtures or live)
    2. Generate materials for each format
    3. Create ZIP bundle with manifest
    4. Return download URL

    This is the main entry point for the conference prep workflow.
    """
    try:
        logger.info(f"Full export: research_id={request.research_id}, conference={request.conference_name}")

        result = orchestrate_full_export(
            research_id=request.research_id,
            conference_name=request.conference_name,
            conference_url=request.conference_url,
            formats=request.formats,
            title=request.title,
            authors=request.authors,
            abstract=request.abstract,
            sections=request.sections,
            blinding_mode=request.blinding_mode,
            mode=request.mode,
            output_base=ARTIFACTS_BASE,
        )

        download_url = f"/api/conference/bundle/{result['run_id']}/download"

        return FullExportResponse(
            success=True,
            run_id=result["run_id"],
            discovery_results=result.get("discovery"),
            guidelines_extracted=result["guidelines"],
            materials_generated=result["materials"],
            bundle_path=result["bundle_path"],
            bundle_hash=result["bundle_hash"],
            download_url=download_url,
            checklist=result.get("checklist", []),
        )

    except Exception as e:
        logger.error(f"Full export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bundle/{run_id}/download")
async def download_bundle(run_id: str):
    """
    Download the generated conference bundle ZIP.

    Security:
    - Path traversal prevention (run_id validated)
    - Only serves files from artifacts directory
    """
    # Validate run_id (prevent path traversal)
    if ".." in run_id or "/" in run_id or "\\" in run_id:
        raise HTTPException(status_code=400, detail="Invalid run_id")

    bundle_path = os.path.join(ARTIFACTS_BASE, run_id, f"conference_bundle_{run_id}.zip")

    if not os.path.exists(bundle_path):
        raise HTTPException(status_code=404, detail="Bundle not found")

    return FileResponse(
        path=bundle_path,
        filename=f"conference_bundle_{run_id}.zip",
        media_type="application/zip",
    )


@router.get("/bundle/{run_id}/file/{filename}")
async def download_file(run_id: str, filename: str):
    """
    Download a specific file from the conference bundle.

    Supported file types:
    - .pdf → application/pdf
    - .pptx → application/vnd.openxmlformats-officedocument.presentationml.presentation
    - .json → application/json
    """
    # Validate inputs (prevent path traversal)
    if ".." in run_id or "/" in run_id or "\\" in run_id:
        raise HTTPException(status_code=400, detail="Invalid run_id")
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_path = os.path.join(ARTIFACTS_BASE, run_id, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # Determine media type
    ext = os.path.splitext(filename)[1].lower()
    media_types = {
        ".pdf": "application/pdf",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".json": "application/json",
        ".zip": "application/zip",
        ".md": "text/markdown",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
    )
```

---

## File 2: Modify `services/worker/api_server.py`

Add the conference router import and mount:

```python
# Add to imports section (around line 15)
from src.api.conference_routes import router as conference_router

# Add to router mounting section (around line 50)
app.include_router(conference_router)
```

---

## File 3: Create `services/worker/src/api/__init__.py`

```python
"""
API module initialization.

Exposes FastAPI routers for various worker services.
"""

from .conference_routes import router as conference_router

__all__ = ["conference_router"]
```

---

## Verification Commands

After implementation, verify with:

```bash
# Start worker service
cd services/worker
uvicorn api_server:app --reload --port 8001

# Test health endpoint
curl http://localhost:8001/api/conference/health

# Test discovery (DEMO mode)
curl -X POST http://localhost:8001/api/conference/discover \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["robotic", "surgery"], "max_results": 5, "mode": "DEMO"}'

# Test guideline extraction (DEMO mode)
curl -X POST http://localhost:8001/api/conference/extract-guidelines \
  -H "Content-Type: application/json" \
  -d '{"conference_name": "SAGES", "formats": ["poster"], "mode": "DEMO"}'
```

---

## Dependencies Check

Ensure these are in `services/worker/requirements.txt`:

```
fastapi>=0.100.0
uvicorn>=0.22.0
pydantic>=2.0.0
reportlab==4.2.0
python-pptx==1.0.2
```

---

## Next Phase

Once worker endpoints are verified, proceed to [Phase 2: Orchestrator Proxy Routes](./02-PHASE2-ORCHESTRATOR-ROUTES.md).

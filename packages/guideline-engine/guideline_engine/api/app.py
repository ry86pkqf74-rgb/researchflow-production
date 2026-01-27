"""
FastAPI Application for Guideline Engine

REST API endpoints for searching, calculating, and managing clinical guidelines.
"""
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
import os
import logging

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncpg

from ..models import (
    SystemCardCreate, RuleSpecCreate, BlueprintRequest, BlueprintUpdate,
    ValidationBlueprint, SystemCard, RuleSpec,
)
from ..store.postgres import GuidelineStore
from ..calculator import RuleCalculator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global database pool
db_pool: Optional[asyncpg.Pool] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - manages database connection pool."""
    global db_pool

    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://ros:ros@postgres:5432/ros"
    )

    logger.info(f"Connecting to database...")
    db_pool = await asyncpg.create_pool(
        database_url,
        min_size=2,
        max_size=10,
    )
    logger.info("Database pool created")

    yield

    if db_pool:
        await db_pool.close()
        logger.info("Database pool closed")


# Create FastAPI app
app = FastAPI(
    title="Guideline Engine",
    description="Clinical guideline scoring, staging, and validation planning API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_store() -> GuidelineStore:
    """Dependency to get database store."""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return GuidelineStore(db_pool)


# =============================================================================
# Request/Response Models
# =============================================================================

class CalculateRequest(BaseModel):
    """Request model for score calculation."""
    system_card_id: str
    inputs: Dict[str, Any]
    context: str = "research"
    user_id: Optional[str] = None


class CalculateResponse(BaseModel):
    """Response model for score calculation."""
    outputs: Dict[str, Any]
    interpretation: Optional[str]
    matched_criteria: List[str]
    warnings: List[str]
    rule_type: Optional[str]


class SearchResponse(BaseModel):
    """Response model for search results."""
    systems: List[Dict[str, Any]]
    total: int
    limit: int
    offset: int


class SystemCardWithRules(BaseModel):
    """SystemCard with associated RuleSpecs."""
    system_card: Dict[str, Any]
    rule_specs: List[Dict[str, Any]]


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "guideline-engine",
        "version": "1.0.0",
    }


# =============================================================================
# SystemCard Endpoints
# =============================================================================

@app.get("/guidelines/search", response_model=SearchResponse)
async def search_system_cards(
    query: Optional[str] = Query(None, description="Search text"),
    type: Optional[str] = Query(None, description="System type filter"),
    specialty: Optional[str] = Query(None, description="Specialty filter"),
    intended_use: Optional[str] = Query(None, description="Intended use filter"),
    verified: Optional[bool] = Query(None, description="Verified status filter"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    store: GuidelineStore = Depends(get_store),
):
    """Search for system cards with optional filters."""
    result = await store.search_system_cards(
        query=query,
        type=type,
        specialty=specialty,
        intended_use=intended_use,
        verified=verified,
        limit=limit,
        offset=offset,
    )
    return {
        "systems": [s.model_dump() for s in result["systems"]],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
    }


@app.get("/guidelines/{id}", response_model=SystemCardWithRules)
async def get_system_card(
    id: str,
    store: GuidelineStore = Depends(get_store),
):
    """Get a system card with its rule specifications."""
    system = await store.get_system_card(id)
    if not system:
        raise HTTPException(status_code=404, detail="System card not found")

    rules = await store.get_rule_specs_for_system(id)

    return {
        "system_card": system.model_dump(),
        "rule_specs": [r.model_dump() for r in rules],
    }


@app.post("/guidelines", response_model=Dict[str, Any])
async def create_system_card(
    card: SystemCardCreate,
    store: GuidelineStore = Depends(get_store),
):
    """Create a new system card."""
    created = await store.create_system_card(card)
    return created.model_dump()


# =============================================================================
# Calculator Endpoints
# =============================================================================

@app.post("/guidelines/calculate", response_model=CalculateResponse)
async def calculate_score(
    request: CalculateRequest,
    store: GuidelineStore = Depends(get_store),
):
    """
    Execute a deterministic calculation for a system card.

    CRITICAL: This uses the RuleSpec, NO LLM INVOLVEMENT.
    """
    # Get system card
    system = await store.get_system_card(request.system_card_id)
    if not system:
        raise HTTPException(status_code=404, detail="System card not found")

    if not system.is_computable():
        raise HTTPException(
            status_code=400,
            detail=f"System is not computable: {system.non_computable_reason or 'No inputs defined'}"
        )

    # Get rule specs
    rules = await store.get_rule_specs_for_system(request.system_card_id)
    if not rules:
        raise HTTPException(status_code=400, detail="No computable rules defined for this system")

    # Use the first (primary) rule spec
    rule_spec = rules[0]
    calculator = RuleCalculator(rule_spec)
    result = calculator.calculate(request.inputs)

    # Save calculation for audit
    await store.save_calculation(
        system_card_id=request.system_card_id,
        inputs=request.inputs,
        outputs=result.outputs,
        interpretation=result.interpretation,
        rule_spec_id=rule_spec.id,
        user_id=request.user_id,
        context=request.context,
    )

    return CalculateResponse(
        outputs=result.outputs,
        interpretation=result.interpretation,
        matched_criteria=result.matched_criteria,
        warnings=result.warnings,
        rule_type=result.rule_type,
    )


# =============================================================================
# RuleSpec Endpoints
# =============================================================================

@app.post("/guidelines/{system_id}/rules", response_model=Dict[str, Any])
async def create_rule_spec(
    system_id: str,
    spec: RuleSpecCreate,
    store: GuidelineStore = Depends(get_store),
):
    """Create a new rule specification for a system card."""
    # Verify system exists
    system = await store.get_system_card(system_id)
    if not system:
        raise HTTPException(status_code=404, detail="System card not found")

    # Override system_card_id to ensure consistency
    spec.system_card_id = system_id
    created = await store.create_rule_spec(spec)
    return created.model_dump()


@app.post("/guidelines/rules/{rule_id}/validate")
async def validate_rule(
    rule_id: str,
    store: GuidelineStore = Depends(get_store),
):
    """Run test cases against a rule specification."""
    rule_spec = await store.get_rule_spec(rule_id)
    if not rule_spec:
        raise HTTPException(status_code=404, detail="Rule spec not found")

    calculator = RuleCalculator(rule_spec)
    results = calculator.validate()

    all_passed = all(r["passed"] for r in results)

    # Update validation status
    if all_passed:
        await store.validate_rule_spec(rule_id, True)

    return {
        "rule_id": rule_id,
        "valid": all_passed,
        "results": results,
        "total_tests": len(results),
        "passed": sum(1 for r in results if r["passed"]),
    }


# =============================================================================
# Blueprint Endpoints
# =============================================================================

@app.get("/guidelines/blueprints/mine")
async def get_my_blueprints(
    user_id: str = Query(..., description="User ID"),
    store: GuidelineStore = Depends(get_store),
):
    """Get all blueprints for the current user."""
    blueprints = await store.get_blueprints_for_user(user_id)
    return {
        "blueprints": [b.model_dump() for b in blueprints],
        "count": len(blueprints),
    }


@app.get("/guidelines/{system_id}/blueprints")
async def get_system_blueprints(
    system_id: str,
    store: GuidelineStore = Depends(get_store),
):
    """Get all blueprints for a system card."""
    blueprints = await store.get_blueprints_for_system(system_id)
    return {
        "blueprints": [b.model_dump() for b in blueprints],
        "count": len(blueprints),
    }


@app.get("/guidelines/blueprints/{id}")
async def get_blueprint(
    id: str,
    store: GuidelineStore = Depends(get_store),
):
    """Get a specific blueprint."""
    blueprint = await store.get_blueprint(id)
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    return blueprint.model_dump()


@app.post("/guidelines/ideate")
async def generate_blueprint(
    request: BlueprintRequest,
    user_id: str = Query(..., description="User ID"),
    store: GuidelineStore = Depends(get_store),
):
    """
    Generate a validation study blueprint.

    NOTE: This endpoint calls the AI router for generation.
    The generated blueprint is grounded on the SystemCard's inputs/outputs.
    """
    # Get system card for context
    system = await store.get_system_card(request.system_card_id)
    if not system:
        raise HTTPException(status_code=404, detail="System card not found")

    # TODO: Call AI router for generation
    # For now, create a skeleton blueprint based on system card
    blueprint = ValidationBlueprint(
        system_card_id=request.system_card_id,
        user_id=user_id,
        study_intent=request.study_intent,
        research_aims=[
            f"To externally validate the {system.name} in {request.target_population or 'a new population'}",
        ],
        hypotheses=[
            f"H1: The {system.name} will demonstrate acceptable discrimination (C-statistic ≥0.70)",
            "H2: The model will show adequate calibration (calibration slope 0.8-1.2)",
        ],
        data_dictionary=[
            {"variable": inp.name, "type": str(inp.type.value) if hasattr(inp.type, 'value') else str(inp.type), "source": "TBD", "required": inp.required}
            for inp in system.inputs
        ],
        outcomes=[
            {"name": out.name, "type": "binary" if out.type in ("score", "category") else "continuous"}
            for out in system.outputs
        ],
        inclusion_criteria=[
            f"Adults meeting criteria for {system.name} assessment",
            f"Population: {system.population or 'As defined in original derivation study'}",
        ],
        exclusion_criteria=[
            "Missing key predictor variables",
            "Loss to follow-up before outcome assessment",
        ],
        analysis_plan=[
            {"method": "C-statistic", "rationale": "Assess discrimination", "assumptions": ["Binary outcome"]},
            {"method": "Calibration plot", "rationale": "Assess calibration", "assumptions": ["Sufficient sample size"]},
        ],
        validation_metrics=[
            {"metric": "AUC-ROC", "interpretation": ">0.70 acceptable, >0.80 good", "threshold": "0.70"},
            {"metric": "Calibration slope", "interpretation": "Ideal = 1.0", "threshold": "0.8-1.2"},
        ],
        sensitivity_analyses=["Complete case analysis", "Multiple imputation for missing data"],
        limitations=[
            "Single-center validation",
            "Potential selection bias",
        ],
        reporting_checklist=["TRIPOD"],
    )

    created = await store.create_blueprint(blueprint)
    return created.model_dump()


@app.patch("/guidelines/blueprints/{id}")
async def update_blueprint(
    id: str,
    updates: BlueprintUpdate,
    store: GuidelineStore = Depends(get_store),
):
    """Update a validation blueprint."""
    # Convert Pydantic model to dict, excluding None values
    update_dict = {k: v for k, v in updates.model_dump().items() if v is not None}

    if not update_dict:
        blueprint = await store.get_blueprint(id)
        if not blueprint:
            raise HTTPException(status_code=404, detail="Blueprint not found")
        return blueprint.model_dump()

    updated = await store.update_blueprint(id, update_dict)
    if not updated:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    return updated.model_dump()


@app.post("/guidelines/blueprints/{id}/export")
async def export_blueprint(
    id: str,
    format: str = Query("markdown", description="Export format: markdown, docx"),
    store: GuidelineStore = Depends(get_store),
):
    """Export blueprint to manuscript format."""
    blueprint = await store.get_blueprint(id)
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    # TODO: Generate actual export using manuscript engine
    # For now, return markdown skeleton

    system = await store.get_system_card(blueprint.system_card_id)
    system_name = system.name if system else "Unknown System"

    markdown = f"""# Validation Study Protocol: {system_name}

## Study Intent
{blueprint.study_intent}

## Research Aims
{chr(10).join(f'- {aim}' for aim in blueprint.research_aims)}

## Hypotheses
{chr(10).join(f'- {h}' for h in blueprint.hypotheses)}

## Methods

### Inclusion Criteria
{chr(10).join(f'- {c}' for c in blueprint.inclusion_criteria)}

### Exclusion Criteria
{chr(10).join(f'- {c}' for c in blueprint.exclusion_criteria)}

### Data Dictionary
| Variable | Type | Required |
|----------|------|----------|
{chr(10).join(f'| {d.variable} | {d.type} | {"Yes" if d.required else "No"} |' for d in blueprint.data_dictionary)}

### Analysis Plan
{chr(10).join(f'- **{a.method}**: {a.rationale}' for a in blueprint.analysis_plan)}

### Validation Metrics
{chr(10).join(f'- {m.metric}: {m.interpretation}' for m in blueprint.validation_metrics)}

## Limitations
{chr(10).join(f'- {l}' for l in blueprint.limitations)}

## Reporting Checklist
{', '.join(blueprint.reporting_checklist)}
"""

    return {
        "format": format,
        "content": markdown,
        "blueprint_id": id,
    }


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

"""
Enhanced IRB API endpoints supporting institution-specific templates.

Provides endpoints for:
- Institution template management
- Enhanced IRB draft creation/validation
- Lay summary validation
- Vulnerable populations handling
- AI/ML usage disclosure
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
import json

# Import IRB modules
from ros_irb.models import (
    Institution,
    ReviewType,
    ExemptionCategory,
    IRBRequestInputEnhanced,
    IRBDraftEnhanced,
    LaySummary,
    VulnerablePopulationInfo,
    AIMLUsage,
)
from ros_irb.templates import get_template, get_available_institutions, TemplateConfig
from ros_irb.emory_questions import get_emory_questions, validate_emory_submission
from ros_irb.lay_summary_validator import validate_emory_lay_summary, StudyType, ValidationResult
from ros_irb.vulnerable_populations import (
    get_requirements_for_population,
    get_required_subparts,
    get_additional_questions,
    validate_vulnerable_population_responses,
    POPULATION_REQUIREMENTS,
)
from ros_irb.ai_ml_compliance import get_ai_ml_questions, validate_ai_ml_responses, AIMLCategory
from ros_irb.phi_scanner_enhanced import scan_for_phi, redact_phi_from_draft, contains_phi
from ros_irb.generate_irb_request import assemble_irb_draft
from ros_irb.export import export_docx, export_pdf
from ros_irb.storage import save_irb_draft, load_irb_draft, list_irb_drafts

router = APIRouter(prefix="/irb", tags=["IRB Enhanced"])


# ============================================
# Request/Response Models
# ============================================

class InstitutionInfo(BaseModel):
    """Institution information for frontend selection."""
    id: str
    name: str
    display_name: str
    description: str
    supports_exemption: bool = True
    requires_lay_summary: bool = True
    requires_ai_ml_disclosure: bool = False


class QuestionResponse(BaseModel):
    """IRB question for frontend display."""
    id: str
    category: str
    title: str
    prompt: str
    guidance: str
    required: bool = True
    options: Optional[List[str]] = None
    max_length: Optional[int] = None


class LaySummaryValidationRequest(BaseModel):
    """Request to validate a lay summary."""
    summary_text: str
    study_type: str = "prospective"
    min_words: int = 100
    max_words: int = 500


class LaySummaryValidationResponse(BaseModel):
    """Lay summary validation result."""
    is_valid: bool
    score: float
    word_count: int
    missing_elements: List[str]
    present_elements: List[str]
    suggestions: List[str]
    reading_level: Optional[str]


class VulnerablePopulationRequest(BaseModel):
    """Request for vulnerable population requirements."""
    population_id: str


class VulnerablePopulationResponse(BaseModel):
    """Vulnerable population requirements."""
    population_id: str
    display_name: str
    regulation: Optional[str]
    description: str
    required_protections: List[str]
    additional_questions: List[Dict[str, str]]
    consent_requirements: List[str]
    irb_requirements: List[str]


class CreateDraftRequest(BaseModel):
    """Request to create an enhanced IRB draft."""
    study_title: str
    short_title: Optional[str] = None
    research_question: Optional[str] = None
    institution: str = "generic"
    answers: Dict[str, str] = Field(default_factory=dict)
    review_type: str = "full_board"
    exemption_categories: List[str] = Field(default_factory=list)
    is_repository_registry: bool = False
    is_multi_site: bool = False
    participating_sites: List[str] = Field(default_factory=list)
    lay_summary: Optional[Dict[str, Any]] = None
    vulnerable_populations: Optional[Dict[str, Any]] = None
    ai_ml_usage: Optional[Dict[str, Any]] = None
    principal_investigator: Optional[str] = None
    department: Optional[str] = None
    funding_source: Optional[str] = None


class CreateDraftResponse(BaseModel):
    """Response from draft creation."""
    id: str
    study_title: str
    status: str
    created_at: str
    phi_detected: bool
    phi_categories: List[str]
    validation_errors: List[str]


class ValidateDraftRequest(BaseModel):
    """Request to validate a draft."""
    draft_id: str
    institution: str = "generic"


class ValidateDraftResponse(BaseModel):
    """Draft validation result."""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    phi_detected: bool
    phi_fields: List[str]
    completeness_score: float


class ExportDraftRequest(BaseModel):
    """Request to export a draft."""
    draft_id: str
    format: str = "docx"  # docx or pdf


class PHIScanRequest(BaseModel):
    """Request to scan text for PHI."""
    text: str
    field_name: Optional[str] = "unknown"


class PHIScanResponse(BaseModel):
    """PHI scan result."""
    has_phi: bool
    categories_found: List[str]
    findings_count: int


# ============================================
# Institution Endpoints
# ============================================

@router.get("/institutions", response_model=List[InstitutionInfo])
async def list_institutions():
    """Get all available institution templates."""
    institutions = get_available_institutions()
    return [
        InstitutionInfo(
            id=inst_id,
            name=config.institution_name,
            display_name=config.display_name,
            description=config.description,
            supports_exemption=config.supports_exemption,
            requires_lay_summary=config.requires_lay_summary,
            requires_ai_ml_disclosure=config.requires_ai_ml_disclosure,
        )
        for inst_id, config in institutions.items()
    ]


@router.get("/institutions/{institution_id}/questions", response_model=List[QuestionResponse])
async def get_institution_questions(institution_id: str):
    """Get all questions for a specific institution template."""
    template = get_template(institution_id)
    questions = template.get_institution_questions()

    # Import base questions to combine
    from ros_irb.irb_questions import IRB_QUESTIONS
    all_questions = template.get_all_questions(IRB_QUESTIONS)

    return [
        QuestionResponse(
            id=q.id if hasattr(q, 'id') else q.category,
            category=q.category,
            title=q.title,
            prompt=q.prompt,
            guidance=q.guidance if isinstance(q.guidance, str) else "\n".join(q.guidance),
            required=getattr(q, 'required', True),
            options=getattr(q, 'options', None),
            max_length=getattr(q, 'max_length', None),
        )
        for q in all_questions
    ]


@router.get("/institutions/{institution_id}/config")
async def get_institution_config(institution_id: str):
    """Get configuration for a specific institution."""
    template = get_template(institution_id)
    config = template.config
    return {
        "institution_id": config.institution_id,
        "institution_name": config.institution_name,
        "display_name": config.display_name,
        "description": config.description,
        "version": config.version,
        "required_categories": config.required_categories,
        "supports_exemption": config.supports_exemption,
        "supports_expedited": config.supports_expedited,
        "requires_lay_summary": config.requires_lay_summary,
        "requires_vulnerable_populations": config.requires_vulnerable_populations,
        "requires_ai_ml_disclosure": config.requires_ai_ml_disclosure,
        "supports_multi_site": config.supports_multi_site,
        "export_formats": config.export_formats,
        "max_title_length": config.max_title_length,
        "max_short_title_length": config.max_short_title_length,
        "lay_summary_min_words": config.lay_summary_min_words,
        "lay_summary_max_words": config.lay_summary_max_words,
    }


# ============================================
# Lay Summary Endpoints
# ============================================

@router.post("/lay-summary/validate", response_model=LaySummaryValidationResponse)
async def validate_lay_summary(request: LaySummaryValidationRequest):
    """Validate a lay summary against institutional requirements."""
    result = validate_emory_lay_summary(
        request.summary_text,
        request.study_type,
    )

    return LaySummaryValidationResponse(
        is_valid=result.is_valid,
        score=result.score,
        word_count=result.word_count,
        missing_elements=result.missing_elements,
        present_elements=result.present_elements,
        suggestions=result.suggestions,
        reading_level=result.reading_level,
    )


@router.get("/lay-summary/requirements/{institution_id}")
async def get_lay_summary_requirements(institution_id: str):
    """Get lay summary requirements for an institution."""
    if institution_id.lower() == "emory":
        from ros_irb.emory_questions import EMORY_LAY_SUMMARY_REQUIREMENTS
        return {
            "institution_id": institution_id,
            "requirements": EMORY_LAY_SUMMARY_REQUIREMENTS,
            "min_words": 100,
            "max_words": 500,
            "required": True,
        }

    return {
        "institution_id": institution_id,
        "requirements": "Standard lay summary describing study objectives, population, and procedures.",
        "min_words": 50,
        "max_words": 300,
        "required": False,
    }


# ============================================
# Vulnerable Populations Endpoints
# ============================================

@router.get("/vulnerable-populations")
async def list_vulnerable_populations():
    """Get all vulnerable population categories."""
    return [
        {
            "id": pop_id,
            "display_name": req.display_name,
            "regulation": req.regulation.value if req.regulation else None,
            "description": req.description,
        }
        for pop_id, req in POPULATION_REQUIREMENTS.items()
    ]


@router.get("/vulnerable-populations/{population_id}", response_model=VulnerablePopulationResponse)
async def get_vulnerable_population_requirements(population_id: str):
    """Get requirements for a specific vulnerable population."""
    req = get_requirements_for_population(population_id)

    if not req:
        raise HTTPException(status_code=404, detail=f"Population '{population_id}' not found")

    return VulnerablePopulationResponse(
        population_id=req.population_id,
        display_name=req.display_name,
        regulation=req.regulation.value if req.regulation else None,
        description=req.description,
        required_protections=req.required_protections,
        additional_questions=req.additional_questions,
        consent_requirements=req.consent_requirements,
        irb_requirements=req.irb_requirements,
    )


@router.post("/vulnerable-populations/validate")
async def validate_vulnerable_populations(
    populations: List[str],
    responses: Dict[str, str]
):
    """Validate responses for selected vulnerable populations."""
    errors = validate_vulnerable_population_responses(populations, responses)
    subparts = get_required_subparts(populations)
    additional_questions = get_additional_questions(populations)

    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
        "required_subparts": [s.value for s in subparts],
        "additional_questions": additional_questions,
    }


# ============================================
# AI/ML Compliance Endpoints
# ============================================

@router.get("/ai-ml/questions")
async def get_ai_ml_questions_endpoint():
    """Get all AI/ML compliance questions."""
    questions = get_ai_ml_questions()
    return [
        {
            "id": q.id,
            "prompt": q.prompt,
            "guidance": q.guidance,
            "required": q.required,
        }
        for q in questions
    ]


@router.post("/ai-ml/validate")
async def validate_ai_ml_usage(
    responses: Dict[str, str],
    categories: List[str] = []
):
    """Validate AI/ML usage responses."""
    cat_enums = [AIMLCategory(c) for c in categories if c in [e.value for e in AIMLCategory]]
    errors = validate_ai_ml_responses(responses, cat_enums)

    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
    }


class AIMLComplianceCheckRequest(BaseModel):
    """Request for AI/ML compliance check."""
    disclosure: Dict[str, Any]
    institution_id: str = "generic"


class AIMLComplianceCheckResponse(BaseModel):
    """AI/ML compliance check result."""
    compliant: bool
    score: float
    missing_disclosures: List[str]
    recommendations: List[str]
    required_consent_language: List[str]


@router.post("/ai-ml/compliance-check", response_model=AIMLComplianceCheckResponse)
async def check_ai_ml_compliance(request: AIMLComplianceCheckRequest):
    """Check AI/ML usage disclosure for compliance with institutional requirements."""
    disclosure = request.disclosure
    missing = []
    recommendations = []
    consent_language = []

    # Check required fields
    if disclosure.get("uses_ai_ml"):
        if not disclosure.get("ai_ml_purposes") or len(disclosure.get("ai_ml_purposes", [])) == 0:
            missing.append("AI/ML purposes not specified")

        if not disclosure.get("model_types") or len(disclosure.get("model_types", [])) == 0:
            missing.append("Model types not specified")

        if not disclosure.get("human_oversight") or len(disclosure.get("human_oversight", "")) < 20:
            missing.append("Human oversight procedures not adequately described")
            recommendations.append("Describe how human researchers will review and validate AI outputs")

        if not disclosure.get("bias_mitigation") or len(disclosure.get("bias_mitigation", "")) < 20:
            missing.append("Bias mitigation measures not described")
            recommendations.append("Explain steps taken to identify and address potential AI biases")

        if not disclosure.get("transparency_measures") or len(disclosure.get("transparency_measures", "")) < 10:
            recommendations.append("Consider adding transparency measures for participants")

        if not disclosure.get("data_retention") or len(disclosure.get("data_retention", "")) < 10:
            recommendations.append("Describe data retention policies for AI inputs/outputs")

        if not disclosure.get("consent_language_included"):
            missing.append("Consent forms do not include AI/ML disclosure")
            consent_language.append("This study uses artificial intelligence/machine learning technology for [purposes].")
            consent_language.append("AI-generated outputs are reviewed by human researchers before being used.")

        # Institution-specific requirements
        if request.institution_id.lower() == "emory":
            if "llm" in disclosure.get("model_types", []) or "generation" in disclosure.get("ai_ml_purposes", []):
                if not disclosure.get("training_data_description") or len(disclosure.get("training_data_description", "")) < 20:
                    missing.append("Training data description required for generative AI models")

    # Calculate score
    total_checks = 7
    passed_checks = total_checks - len(missing)
    score = (passed_checks / total_checks) * 100

    return AIMLComplianceCheckResponse(
        compliant=len(missing) == 0,
        score=round(score, 1),
        missing_disclosures=missing,
        recommendations=recommendations,
        required_consent_language=consent_language,
    )


# ============================================
# PHI Scanning Endpoints
# ============================================

@router.post("/phi/scan", response_model=PHIScanResponse)
async def scan_for_phi_endpoint(request: PHIScanRequest):
    """Scan text for PHI."""
    has_phi = contains_phi(request.text)

    # Get detailed scan if PHI detected
    findings_count = 0
    categories = []

    if has_phi:
        from ros_irb.phi_scanner_enhanced import EnhancedPHIScanner
        scanner = EnhancedPHIScanner()
        findings = scanner.scan_text(request.text, request.field_name)
        findings_count = len(findings)
        categories = list(set(f.category.value for f in findings))

    return PHIScanResponse(
        has_phi=has_phi,
        categories_found=categories,
        findings_count=findings_count,
    )


@router.post("/phi/redact")
async def redact_phi_endpoint(text: str):
    """Redact PHI from text."""
    from ros_irb.phi_scanner_enhanced import EnhancedPHIScanner
    scanner = EnhancedPHIScanner()
    redacted = scanner.redact_text(text)

    return {
        "original_length": len(text),
        "redacted_text": redacted,
        "redacted_length": len(redacted),
    }


# ============================================
# Draft Management Endpoints
# ============================================

@router.post("/drafts", response_model=CreateDraftResponse)
async def create_enhanced_draft(request: CreateDraftRequest):
    """Create an enhanced IRB draft with institution-specific fields."""
    # Create enhanced input
    enhanced_input = IRBRequestInputEnhanced(
        study_title=request.study_title,
        short_title=request.short_title,
        research_question=request.research_question,
        institution=Institution(request.institution) if request.institution in [e.value for e in Institution] else Institution.GENERIC,
        answers=request.answers,
        review_type=ReviewType(request.review_type) if request.review_type in [e.value for e in ReviewType] else ReviewType.FULL_BOARD,
        exemption_categories=[ExemptionCategory(e) for e in request.exemption_categories if e in [c.value for c in ExemptionCategory]],
        is_repository_registry=request.is_repository_registry,
        is_multi_site=request.is_multi_site,
        participating_sites=request.participating_sites,
        principal_investigator=request.principal_investigator,
        department=request.department,
        funding_source=request.funding_source,
    )

    # Handle nested objects
    if request.lay_summary:
        enhanced_input.lay_summary = LaySummary(**request.lay_summary)
    if request.vulnerable_populations:
        enhanced_input.vulnerable_populations = VulnerablePopulationInfo(**request.vulnerable_populations)
    if request.ai_ml_usage:
        enhanced_input.ai_ml_usage = AIMLUsage(**request.ai_ml_usage)

    # Create draft
    draft = IRBDraftEnhanced(
        study_title=enhanced_input.study_title,
        short_title=enhanced_input.short_title,
        answers=enhanced_input.answers,
        institution=enhanced_input.institution,
        review_type=enhanced_input.review_type,
        exemption_categories=enhanced_input.exemption_categories,
        lay_summary=enhanced_input.lay_summary,
        vulnerable_populations=enhanced_input.vulnerable_populations,
        ai_ml_usage=enhanced_input.ai_ml_usage,
        is_repository_registry=enhanced_input.is_repository_registry,
        is_multi_site=enhanced_input.is_multi_site,
        participating_sites=enhanced_input.participating_sites,
    )

    # Scan for PHI
    phi_result = scan_for_phi(draft.to_dict())
    draft.phi_detected = phi_result.has_phi
    draft.phi_categories_found = [c.value for c in phi_result.categories_found]

    # Validate with institution template
    template = get_template(request.institution)
    validation_errors = template.validate_submission(draft.to_dict())

    # Save draft
    draft_dict = draft.to_dict()
    # Note: save_irb_draft expects a different format, adapt as needed

    return CreateDraftResponse(
        id=draft.id,
        study_title=draft.study_title,
        status=draft.status,
        created_at=draft.created_at.isoformat(),
        phi_detected=draft.phi_detected,
        phi_categories=draft.phi_categories_found,
        validation_errors=validation_errors,
    )


@router.post("/drafts/{draft_id}/validate", response_model=ValidateDraftResponse)
async def validate_draft(draft_id: str, institution: str = "generic"):
    """Validate an existing draft."""
    # Load draft (implementation depends on storage)
    # For now, return a sample response
    template = get_template(institution)

    # This would load the actual draft in production
    return ValidateDraftResponse(
        is_valid=True,
        errors=[],
        warnings=["Draft loaded from mock - implement storage integration"],
        phi_detected=False,
        phi_fields=[],
        completeness_score=0.85,
    )


@router.post("/drafts/{draft_id}/export/{format}")
async def export_draft(draft_id: str, format: str = "docx"):
    """Export a draft to DOCX or PDF."""
    if format not in ["docx", "pdf"]:
        raise HTTPException(status_code=400, detail="Format must be 'docx' or 'pdf'")

    # Load draft and export
    # Implementation depends on storage and export modules

    return {
        "draft_id": draft_id,
        "format": format,
        "status": "export_queued",
        "message": "Export functionality requires storage integration",
    }


# ============================================
# Exemption Categories
# ============================================

@router.get("/exemption-categories")
async def list_exemption_categories():
    """Get all federal exemption categories."""
    return [
        {
            "id": "D1",
            "name": "Educational Settings",
            "description": "Research conducted in established educational settings involving normal educational practices",
            "regulation": "45 CFR 46.104(d)(1)",
        },
        {
            "id": "D2",
            "name": "Tests, Surveys, Interviews, Observation",
            "description": "Research involving educational tests, surveys, interviews, or observation of public behavior",
            "regulation": "45 CFR 46.104(d)(2)",
        },
        {
            "id": "D3",
            "name": "Benign Behavioral Interventions",
            "description": "Research involving benign behavioral interventions in conjunction with surveys/interviews",
            "regulation": "45 CFR 46.104(d)(3)",
        },
        {
            "id": "D4",
            "name": "Secondary Research",
            "description": "Secondary research with identifiable private information or biospecimens",
            "regulation": "45 CFR 46.104(d)(4)",
        },
    ]

"""
ros_irb

IRB drafting helpers for Sourcelit.

This package is designed to:
1) standardize IRB question prompts; and
2) generate/export/store IRB draft responses with PHI-guarding.
3) support institution-specific templates (Emory, Generic, etc.)
4) provide Emory-specific IRB requirements and validation
5) handle vulnerable populations with regulatory compliance
6) support AI/ML usage disclosure
"""

from .irb_questions import IRB_QUESTIONS, REQUIRED_IRB_CATEGORIES, questions_by_category
from .generate_irb_request import (
    IRBRequestInput,
    IRBDraft,
    LiteratureSearcher,
    LLMProvider,
    assemble_irb_draft,
    render_irb_markdown,
    summarize_literature,
    auto_generate_answers,
)
from .phi_guard import contains_phi, redact_phi
from .storage import is_irb_submitted, mark_irb_submitted
from .gate import require_irb_submission, IRBGateError
from .export import export_docx, export_pdf

# Enhanced data models for institution-specific IRB support
from .models import (
    ExemptionCategory,
    VulnerablePopulation,
    ReviewType,
    Institution,
    EmoryMetadata,
    VulnerablePopulationInfo,
    AIMLUsage,
    LaySummary,
    IRBRequestInputEnhanced,
    IRBDraftEnhanced,
)

# Emory-specific questions and validation
from .emory_questions import (
    EMORY_IRB_QUESTIONS,
    EMORY_LAY_SUMMARY_REQUIREMENTS,
    EMORY_REQUIRED_CATEGORIES,
    get_emory_questions,
    get_emory_question_by_category,
    validate_emory_submission,
    emory_questions_by_category,
)

# Institution templates
from .templates import (
    InstitutionTemplate,
    TemplateConfig,
    GenericTemplate,
    EmoryTemplate,
    get_template,
    get_available_institutions,
    get_institution_ids,
    is_institution_supported,
    TEMPLATE_REGISTRY,
)

# Lay summary validation
from .lay_summary_validator import (
    StudyType,
    ValidationResult,
    LaySummaryValidator,
    validate_emory_lay_summary,
    get_lay_summary_template,
)

# Vulnerable populations
from .vulnerable_populations import (
    SubpartRegulation,
    VulnerablePopulationRequirement,
    POPULATION_REQUIREMENTS,
    get_requirements_for_population,
    get_required_subparts,
    get_additional_questions,
    validate_vulnerable_population_responses,
    get_consent_summary,
    get_irb_requirements,
    get_all_population_ids,
    get_population_display_names,
)

# AI/ML compliance
from .ai_ml_compliance import (
    AIMLCategory,
    FDAStatus,
    AIMLQuestion,
    AI_ML_QUESTIONS,
    get_ai_ml_questions,
    get_required_questions,
    validate_ai_ml_responses,
    get_ai_ml_guidance,
    get_fda_status_guidance,
)

# Enhanced PHI scanning
from .phi_scanner_enhanced import (
    PHICategory,
    PHIFinding,
    PHIScanResult,
    EnhancedPHIScanner,
    scan_for_phi,
    redact_phi_from_draft,
    get_phi_categories_found,
)

__all__ = [
    # Original exports
    "IRB_QUESTIONS",
    "REQUIRED_IRB_CATEGORIES",
    "questions_by_category",
    "IRBRequestInput",
    "IRBDraft",
    "LiteratureSearcher",
    "LLMProvider",
    "assemble_irb_draft",
    "render_irb_markdown",
    "summarize_literature",
    "auto_generate_answers",
    "contains_phi",
    "redact_phi",
    "is_irb_submitted",
    "mark_irb_submitted",
    "require_irb_submission",
    "IRBGateError",
    "export_docx",
    "export_pdf",
    # Enhanced models
    "ExemptionCategory",
    "VulnerablePopulation",
    "ReviewType",
    "Institution",
    "EmoryMetadata",
    "VulnerablePopulationInfo",
    "AIMLUsage",
    "LaySummary",
    "IRBRequestInputEnhanced",
    "IRBDraftEnhanced",
    # Emory questions
    "EMORY_IRB_QUESTIONS",
    "EMORY_LAY_SUMMARY_REQUIREMENTS",
    "EMORY_REQUIRED_CATEGORIES",
    "get_emory_questions",
    "get_emory_question_by_category",
    "validate_emory_submission",
    "emory_questions_by_category",
    # Templates
    "InstitutionTemplate",
    "TemplateConfig",
    "GenericTemplate",
    "EmoryTemplate",
    "get_template",
    "get_available_institutions",
    "get_institution_ids",
    "is_institution_supported",
    "TEMPLATE_REGISTRY",
    # Lay summary
    "StudyType",
    "ValidationResult",
    "LaySummaryValidator",
    "validate_emory_lay_summary",
    "get_lay_summary_template",
    # Vulnerable populations
    "SubpartRegulation",
    "VulnerablePopulationRequirement",
    "POPULATION_REQUIREMENTS",
    "get_requirements_for_population",
    "get_required_subparts",
    "get_additional_questions",
    "validate_vulnerable_population_responses",
    "get_consent_summary",
    "get_irb_requirements",
    "get_all_population_ids",
    "get_population_display_names",
    # AI/ML
    "AIMLCategory",
    "FDAStatus",
    "AIMLQuestion",
    "AI_ML_QUESTIONS",
    "get_ai_ml_questions",
    "get_required_questions",
    "validate_ai_ml_responses",
    "get_ai_ml_guidance",
    "get_fda_status_guidance",
    # Enhanced PHI
    "PHICategory",
    "PHIFinding",
    "PHIScanResult",
    "EnhancedPHIScanner",
    "scan_for_phi",
    "redact_phi_from_draft",
    "get_phi_categories_found",
]

"""
AI Feedback Module (Phase 7-8)

Quality checks and feedback collection for AI self-improvement loop.

Modules:
- quality_checks: Enhanced quality validation for AI-generated content
- feedback_types: Data models for feedback records
- refinement_engine: Prompt refinement based on failed checks (Phase 8)

Last Updated: 2026-01-23
"""

from .quality_checks import (
    QualityCheck,
    check_citations_present,
    check_key_points_covered,
    check_no_question_marks,
    check_length_within_bounds,
    check_no_placeholders,
    validate_narrative_content,
)
from .feedback_types import (
    CheckCategory,
    CheckSeverity,
    FeedbackRecord,
    RefinementInstruction,
    get_refinement_instruction,
)
from .refinement_engine import (
    RefinementEngine,
    RefinementContext,
    RefinementResult,
    RefinementSummary,
    RefinementRule,
    get_refinement_engine,
    refine_prompt,
    get_applicable_rules,
    format_instruction,
)

__all__ = [
    # Quality Checks
    "QualityCheck",
    "check_citations_present",
    "check_key_points_covered",
    "check_no_question_marks",
    "check_length_within_bounds",
    "check_no_placeholders",
    "validate_narrative_content",
    # Types
    "CheckCategory",
    "CheckSeverity",
    "FeedbackRecord",
    "RefinementInstruction",
    "get_refinement_instruction",
    # Refinement Engine (Phase 8)
    "RefinementEngine",
    "RefinementContext",
    "RefinementResult",
    "RefinementSummary",
    "RefinementRule",
    "get_refinement_engine",
    "refine_prompt",
    "get_applicable_rules",
    "format_instruction",
]

__version__ = "1.1.0"

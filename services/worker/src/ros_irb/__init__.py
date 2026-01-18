"""
ros_irb

IRB drafting helpers for Sourcelit.

This package is designed to:
1) standardize IRB question prompts; and
2) generate/export/store IRB draft responses with PHI-guarding.
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
from .phi_guard import PHIPattern, contains_phi, redact_phi
from .storage import is_irb_submitted, mark_irb_submitted
from .gate import require_irb_submission, IRBGateError
from .export import export_docx, export_pdf

__all__ = [
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
    "PHIPattern",
    "contains_phi",
    "redact_phi",
    "is_irb_submitted",
    "mark_irb_submitted",
    "require_irb_submission",
    "IRBGateError",
    "export_docx",
    "export_pdf",
]

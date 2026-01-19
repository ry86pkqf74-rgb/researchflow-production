"""Manuscript generation and processing tasks."""

from .generate_section import run_generate_section, SECTION_TO_PROMPT
from .claim_verifier import verify_claims_for_manuscript
from .peer_review import simulate_peer_review
from .export_pipeline import (
    md_to_docx,
    md_to_latex,
    md_to_pdf,
    latex_bundle,
    run_export,
)

__all__ = [
    "run_generate_section",
    "SECTION_TO_PROMPT",
    "verify_claims_for_manuscript",
    "simulate_peer_review",
    "md_to_docx",
    "md_to_latex",
    "md_to_pdf",
    "latex_bundle",
    "run_export",
]

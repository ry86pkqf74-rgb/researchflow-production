"""src.validation.phi_patterns

Central PHI regex patterns with explicit *tiers*.

IMPORTANT: This module re-exports from the canonical generated file.
Do NOT add patterns here - update shared/phi/phi_patterns.v1.json and regenerate.

Why tiers exist
--------------
Different surfaces in ROS have different false-positive tolerance:

* Upload / egress gating must be **high-confidence** to avoid blocking safe
    synthetic fixtures and routine text.
* Output/export guards may be **stricter** (fail-closed) because a false
    positive is less harmful than leaking PHI.

Public contract (important)
---------------------------
* ``PHI_PATTERNS`` is the repository-wide **HIGH-confidence** set and is
    intentionally limited to patterns like: SSN, EMAIL, PHONE, MRN

* ``PHI_PATTERNS_OUTPUT_GUARD`` is a stricter set used by output/export guards
    that also includes DATE, ZIP+4, and IPv4 address patterns.

Canonical Source
----------------
All patterns are now defined in: shared/phi/phi_patterns.v1.json
Regenerate with: python scripts/governance/generate_phi_patterns.py

Used by (non-exhaustive)
------------------------
* src.governance.egress_guard (uses PHI_PATTERNS)
* web_frontend.phi_scan (uses PHI_PATTERNS)
* src.governance.output_phi_guard (uses PHI_PATTERNS_OUTPUT_GUARD)
* src.simulated_real.scrubber (uses PHI_PATTERNS)
* src.workflow_engine stages (uses PHI_PATTERNS_OUTPUT_GUARD)

Last Updated: 2026-01-20
"""

# Re-export from generated file - single source of truth
from .phi_patterns_generated import (
    PHI_PATTERNS,
    PHI_PATTERNS_HIGH_CONFIDENCE,
    PHI_PATTERNS_EXTENDED,
    PHI_PATTERNS_OUTPUT_GUARD,
)

__all__ = [
    "PHI_PATTERNS",
    "PHI_PATTERNS_HIGH_CONFIDENCE",
    "PHI_PATTERNS_EXTENDED",
    "PHI_PATTERNS_OUTPUT_GUARD",
]

"""
Simulated-Real Mode Infrastructure (PR46)

This module provides sentinel verification and support for test upload workflows
that simulate real PHI-like data without committing any PHI to the repository.

Governance Reference: docs/plans/PR46_SIMULATED_REAL_MODE.md
"""

from .sentinel import (
    detect_format_from_bytes,
    verify_csv_sentinel,
    verify_xlsx_sentinel,
    verify_synthetic_sentinel,
)

from .scrubber import (
    scrub_text_high_confidence,
    scrub_dataframe_high_confidence,
)

from .pipeline import (
    run_simulated_real_from_bytes,
    SimulatedRealError,
    SentinelMissingError,
)

__all__ = [
    "detect_format_from_bytes",
    "verify_csv_sentinel",
    "verify_xlsx_sentinel",
    "verify_synthetic_sentinel",
    "scrub_text_high_confidence",
    "scrub_dataframe_high_confidence",
    "run_simulated_real_from_bytes",
    "SimulatedRealError",
    "SentinelMissingError",
]

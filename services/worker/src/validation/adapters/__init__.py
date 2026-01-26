"""
Validation adapters package.

Adapter modules for optional tier-2 validation tools (e.g., Great Expectations).
These are NEVER used in CI or runtime validation - manuscript-stage only.

See: docs/validation/TIER2_GREAT_EXPECTATIONS.md
"""

# NOTE: Do not import gx_adapter here - it has import quarantine guard

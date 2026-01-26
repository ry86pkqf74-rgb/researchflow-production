"""
PHI Scrubber for Simulated-Real Mode (PR46)

This module provides deterministic PHI scrubbing for test upload workflows.
Redacts high-confidence PHI patterns with type-specific placeholders.

Governance Reference: docs/plans/PR46_SIMULATED_REAL_MODE.md
Pattern Reference: src/validation/phi_patterns.py (centralized HIGH-confidence patterns)

Design Principles:
- Deterministic: Same pattern type always gets same placeholder (no counters)
- Fail-closed: Raise errors on invalid input rather than silent failures
- No PHI leakage: Summary contains only counts/types, never values
- Offline-first: No network calls
"""

from typing import Any, Dict, List, Tuple

from src.validation.phi_patterns import PHI_PATTERNS


# =============================================================================
# HIGH-CONFIDENCE PHI PATTERNS (canonical: src/validation/phi_patterns.py)
# =============================================================================

# Deterministic placeholder mapping for canonical pattern names
_PLACEHOLDERS = {
    "SSN": "<SCRUBBED_SSN>",
    "EMAIL": "<SCRUBBED_EMAIL>",
    "PHONE": "<SCRUBBED_PHONE>",
    "MRN": "<SCRUBBED_MRN>",
}

# (rule_id, compiled_pattern, deterministic_placeholder)
PHI_REDACTION_RULES = [
    (name, pattern, _PLACEHOLDERS.get(name, f"<SCRUBBED_{name}>"))
    for name, pattern in PHI_PATTERNS
]


class ScrubberError(ValueError):
    """Raised when scrubber encounters an error (no PHI in message)."""

    pass


# =============================================================================
# TEXT SCRUBBING
# =============================================================================


def scrub_text_high_confidence(text: str) -> Tuple[str, Dict[str, Any]]:
    """
    Scrub HIGH-confidence PHI patterns from text with deterministic placeholders.

    Args:
        text: Input text containing potential PHI

    Returns:
        Tuple of (scrubbed_text, summary_dict)

        scrubbed_text: Text with PHI replaced by placeholders
        summary_dict: Metadata-only summary (no values/examples):
            {
                "redactions": [
                    {
                        "rule_id": "SSN",
                        "phi_type": "SSN",
                        "count": 3,
                        "action": "redact",
                        "status": "success"
                    },
                    ...
                ]
            }

    Raises:
        ScrubberError: If text is not a string (no PHI in error message)
    """
    if not isinstance(text, str):
        raise ScrubberError("Input must be a string")

    scrubbed = text
    redactions = []

    for rule_id, pattern, placeholder in PHI_REDACTION_RULES:
        # Find all matches
        matches = pattern.findall(scrubbed)
        count = len(matches)

        if count > 0:
            # Replace all occurrences with deterministic placeholder
            scrubbed = pattern.sub(placeholder, scrubbed)

            redactions.append(
                {
                    "rule_id": rule_id,
                    "phi_type": rule_id,
                    "count": count,
                    "action": "redact",
                    "status": "success",
                }
            )

    summary = {
        "redactions": redactions,
    }

    return scrubbed, summary


# =============================================================================
# DATAFRAME SCRUBBING
# =============================================================================


def scrub_dataframe_high_confidence(df) -> Tuple[Any, Dict[str, Any]]:
    """
    Scrub HIGH-confidence PHI patterns from DataFrame string columns.

    Only string/object columns are processed. Numeric columns are untouched.
    Each cell is scrubbed independently with deterministic placeholders.

    Args:
        df: pandas DataFrame containing potential PHI in string columns

    Returns:
        Tuple of (scrubbed_df, summary_dict)

        scrubbed_df: DataFrame with PHI in string columns replaced
        summary_dict: Per-column metadata (no values/examples):
            {
                "columns_scrubbed": ["col1", "col2"],
                "redactions": [
                    {
                        "rule_id": "SSN",
                        "phi_type": "SSN",
                        "column": "patient_info",
                        "count": 5,
                        "action": "redact",
                        "status": "success"
                    },
                    ...
                ]
            }

    Raises:
        ScrubberError: If df is not a DataFrame (no PHI in error message)
    """
    # Import pandas only when needed
    try:
        import pandas as pd
    except ImportError:
        raise ScrubberError("pandas required for DataFrame scrubbing")

    if not isinstance(df, pd.DataFrame):
        raise ScrubberError("Input must be a pandas DataFrame")

    # Create a copy to avoid mutating input
    scrubbed_df = df.copy()

    # Track columns scrubbed
    columns_scrubbed = []
    redactions = []

    # Process only string/object columns
    for col in scrubbed_df.columns:
        if (
            scrubbed_df[col].dtype == "object"
            or scrubbed_df[col].dtype.name == "string"
        ):
            # Track if this column was modified
            col_modified = False

            # Apply each redaction rule
            for rule_id, pattern, placeholder in PHI_REDACTION_RULES:
                # Count matches before scrubbing
                matches_count = 0
                for val in scrubbed_df[col]:
                    if pd.notna(val):  # Skip NaN values
                        matches = pattern.findall(str(val))
                        matches_count += len(matches)

                if matches_count > 0:
                    # Apply redaction to entire column, preserving NaN
                    scrubbed_df[col] = scrubbed_df[col].apply(
                        lambda x: pattern.sub(placeholder, str(x)) if pd.notna(x) else x
                    )

                    col_modified = True

                    redactions.append(
                        {
                            "rule_id": rule_id,
                            "phi_type": rule_id,
                            "column": col,
                            "count": matches_count,
                            "action": "redact",
                            "status": "success",
                        }
                    )

            if col_modified and col not in columns_scrubbed:
                columns_scrubbed.append(col)

    summary = {
        "columns_scrubbed": columns_scrubbed,
        "redactions": redactions,
    }

    return scrubbed_df, summary

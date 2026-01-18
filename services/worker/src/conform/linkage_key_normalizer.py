"""
Linkage Key Normalizer.

Normalizes variant research identifier columns to the canonical `research_id` key
across all data sources. This ensures consistent linkage across multi-modal datasets.

Design Principles:
- Single canonical key: `research_id`
- Explicit mapping: All known variants documented in config
- Deterministic: Priority-ordered resolution when multiple candidates exist
- Auditable: Clear logging of all normalization decisions
- Fail-safe: Ambiguous cases raise errors rather than silent data loss

Known Variants (from THYROID_DATA_INVENTORY.md):
- research_id          → canonical (no change)
- research_id_number   → rename to research_id
- Research_ID          → rename to research_id (case normalization)
- ResearchID           → rename to research_id (case + underscore normalization)

Usage:
    from src.conform.linkage_key_normalizer import normalize_linkage_key

    df_normalized = normalize_linkage_key(df)
    # df_normalized now has 'research_id' as the linkage key
"""

import logging
import pandas as pd
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Constants: Canonical Key and Known Variants
# -----------------------------------------------------------------------------

CANONICAL_KEY = "research_id"

# Priority-ordered list of known variants (highest priority first)
# When multiple candidates exist, the first match wins
KNOWN_VARIANTS = [
    "research_id",  # Canonical - already correct
    "research_id_number",  # Common variant in lab data
    "Research_ID",  # CamelCase variant
    "ResearchID",  # No underscore variant
    "RESEARCH_ID",  # All caps variant
]

# Case-insensitive mapping for flexibility
VARIANT_MAP = {v.lower(): v for v in KNOWN_VARIANTS}


# -----------------------------------------------------------------------------
# Data Classes
# -----------------------------------------------------------------------------


@dataclass
class NormalizationResult:
    """Result of linkage key normalization operation."""

    success: bool
    original_column: Optional[str] = None
    canonical_column: str = CANONICAL_KEY
    rows_affected: int = 0
    original_column_dropped: bool = False
    message: str = ""

    def summary(self) -> str:
        """Generate human-readable summary."""
        if self.success:
            if self.original_column == self.canonical_column:
                return (
                    f"✓ Column '{self.original_column}' already canonical (no change)"
                )
            else:
                drop_note = (
                    " (original dropped)"
                    if self.original_column_dropped
                    else " (original preserved)"
                )
                return f"✓ Normalized '{self.original_column}' → '{self.canonical_column}'{drop_note}, {self.rows_affected} rows"
        else:
            return f"✗ Normalization failed: {self.message}"


# -----------------------------------------------------------------------------
# Core Functions
# -----------------------------------------------------------------------------


def find_linkage_key_column(
    df: pd.DataFrame,
    known_variants: Optional[List[str]] = None,
    case_sensitive: bool = False,
) -> Tuple[Optional[str], List[str]]:
    """
    Find linkage key column(s) in DataFrame.

    Args:
        df: Input DataFrame
        known_variants: List of known variant names (priority-ordered)
        case_sensitive: If False, match case-insensitively

    Returns:
        Tuple of (best_match, all_matches) where:
        - best_match: Highest-priority matching column name, or None
        - all_matches: All columns that match any variant
    """
    if known_variants is None:
        known_variants = KNOWN_VARIANTS

    all_matches = []
    df_columns = list(df.columns)

    if case_sensitive:
        # Exact match
        for variant in known_variants:
            if variant in df_columns:
                all_matches.append(variant)
    else:
        # Case-insensitive match
        df_columns_lower = {c.lower(): c for c in df_columns}
        for variant in known_variants:
            variant_lower = variant.lower()
            if variant_lower in df_columns_lower:
                actual_col = df_columns_lower[variant_lower]
                if actual_col not in all_matches:
                    all_matches.append(actual_col)

    best_match = all_matches[0] if all_matches else None
    return best_match, all_matches


def normalize_linkage_key(
    df: pd.DataFrame,
    known_variants: Optional[List[str]] = None,
    drop_original: bool = True,
    fail_on_ambiguous: bool = True,
    fail_on_missing: bool = False,
) -> Tuple[pd.DataFrame, NormalizationResult]:
    """
    Normalize linkage key column to canonical `research_id`.

    Args:
        df: Input DataFrame
        known_variants: List of known variant names (priority-ordered)
        drop_original: If True, drop original column after renaming
        fail_on_ambiguous: If True, raise error when multiple candidates exist
        fail_on_missing: If True, raise error when no linkage key found

    Returns:
        Tuple of (normalized_df, result) where:
        - normalized_df: DataFrame with canonical `research_id` column
        - result: NormalizationResult with operation details

    Raises:
        ValueError: If fail_on_ambiguous=True and multiple candidates found
        ValueError: If fail_on_missing=True and no linkage key found
    """
    if known_variants is None:
        known_variants = KNOWN_VARIANTS

    # Find matching columns
    best_match, all_matches = find_linkage_key_column(
        df, known_variants, case_sensitive=False
    )

    # Handle no match
    if best_match is None:
        if fail_on_missing:
            raise ValueError(
                f"No linkage key column found. Expected one of: {known_variants}"
            )
        return df.copy(), NormalizationResult(
            success=False,
            message=f"No linkage key column found. Expected one of: {known_variants}",
        )

    # Handle ambiguous (multiple matches)
    if len(all_matches) > 1:
        if fail_on_ambiguous:
            raise ValueError(
                f"Multiple linkage key candidates found: {all_matches}. "
                f"Resolve ambiguity before normalization or set fail_on_ambiguous=False."
            )
        logger.warning(
            f"Multiple linkage key candidates found: {all_matches}. "
            f"Using highest-priority match: '{best_match}'"
        )

    # Perform normalization
    df_out = df.copy()
    original_column = best_match

    if original_column.lower() == CANONICAL_KEY.lower():
        # Already canonical (or case variant of canonical)
        if original_column != CANONICAL_KEY:
            # Case normalization needed
            df_out = df_out.rename(columns={original_column: CANONICAL_KEY})
            logger.info(
                f"Normalized column case: '{original_column}' → '{CANONICAL_KEY}'"
            )
        else:
            logger.info(f"Column '{original_column}' already canonical")

        return df_out, NormalizationResult(
            success=True,
            original_column=original_column,
            canonical_column=CANONICAL_KEY,
            rows_affected=len(df_out),
            original_column_dropped=False,
            message=(
                "Already canonical"
                if original_column == CANONICAL_KEY
                else "Case normalized"
            ),
        )

    # Rename variant to canonical
    df_out[CANONICAL_KEY] = df_out[original_column]
    logger.info(f"Created canonical column '{CANONICAL_KEY}' from '{original_column}'")

    # Optionally drop original
    dropped = False
    if drop_original:
        df_out = df_out.drop(columns=[original_column])
        dropped = True
        logger.info(f"Dropped original column '{original_column}'")

    return df_out, NormalizationResult(
        success=True,
        original_column=original_column,
        canonical_column=CANONICAL_KEY,
        rows_affected=len(df_out),
        original_column_dropped=dropped,
        message=f"Normalized '{original_column}' to '{CANONICAL_KEY}'",
    )


def validate_linkage_key(
    df: pd.DataFrame,
    expected_column: str = CANONICAL_KEY,
    check_not_null: bool = True,
    check_unique: bool = False,
) -> Tuple[bool, List[str]]:
    """
    Validate that DataFrame has proper linkage key.

    Args:
        df: DataFrame to validate
        expected_column: Expected linkage key column name
        check_not_null: Verify no null values in key column
        check_unique: Verify all values are unique (for entity tables)

    Returns:
        Tuple of (is_valid, issues) where:
        - is_valid: True if all checks pass
        - issues: List of validation issue descriptions
    """
    issues = []

    # Check column exists
    if expected_column not in df.columns:
        issues.append(f"Missing expected linkage key column: '{expected_column}'")
        return False, issues

    # Check not null
    if check_not_null:
        null_count = df[expected_column].isna().sum()
        if null_count > 0:
            issues.append(
                f"Linkage key has {null_count} null values ({null_count/len(df)*100:.1f}%)"
            )

    # Check unique
    if check_unique:
        dup_count = df[expected_column].duplicated().sum()
        if dup_count > 0:
            issues.append(f"Linkage key has {dup_count} duplicate values")

    is_valid = len(issues) == 0
    return is_valid, issues


# -----------------------------------------------------------------------------
# Batch Processing Functions
# -----------------------------------------------------------------------------


def normalize_linkage_keys_batch(
    dataframes: Dict[str, pd.DataFrame],
    known_variants: Optional[List[str]] = None,
    drop_original: bool = True,
    fail_on_ambiguous: bool = True,
    fail_on_missing: bool = False,
) -> Tuple[Dict[str, pd.DataFrame], Dict[str, NormalizationResult]]:
    """
    Normalize linkage keys across multiple DataFrames.

    Args:
        dataframes: Dict mapping dataset name → DataFrame
        known_variants: List of known variant names (priority-ordered)
        drop_original: If True, drop original column after renaming
        fail_on_ambiguous: If True, raise error when multiple candidates exist
        fail_on_missing: If True, raise error when no linkage key found

    Returns:
        Tuple of (normalized_dataframes, results) where:
        - normalized_dataframes: Dict mapping dataset name → normalized DataFrame
        - results: Dict mapping dataset name → NormalizationResult
    """
    normalized = {}
    results = {}

    for name, df in dataframes.items():
        logger.info(f"Processing dataset: {name}")
        try:
            df_norm, result = normalize_linkage_key(
                df,
                known_variants=known_variants,
                drop_original=drop_original,
                fail_on_ambiguous=fail_on_ambiguous,
                fail_on_missing=fail_on_missing,
            )
            normalized[name] = df_norm
            results[name] = result
        except ValueError as e:
            logger.error(f"Failed to normalize {name}: {e}")
            results[name] = NormalizationResult(success=False, message=str(e))
            # Keep original if normalization failed
            normalized[name] = df.copy()

    return normalized, results


# -----------------------------------------------------------------------------
# Config Integration
# -----------------------------------------------------------------------------


def load_linkage_config(config_path: str = "config/source_mappings.yaml") -> Dict:
    """
    Load linkage configuration from source mappings.

    Args:
        config_path: Path to YAML config file

    Returns:
        Dict with linkage configuration
    """
    path = Path(config_path)
    if not path.exists():
        logger.warning(f"Config file not found: {config_path}")
        return {}

    with open(path, "r") as f:
        config = yaml.safe_load(f)

    return config.get("linkage", {})


def get_variant_mappings_from_config(
    config_path: str = "config/source_mappings.yaml",
) -> List[str]:
    """
    Get priority-ordered variant list from config.

    Falls back to KNOWN_VARIANTS if config doesn't specify.

    Args:
        config_path: Path to YAML config file

    Returns:
        List of variant names in priority order
    """
    linkage_config = load_linkage_config(config_path)

    if "key_variants" in linkage_config:
        return linkage_config["key_variants"]

    return KNOWN_VARIANTS


# -----------------------------------------------------------------------------
# CLI Entry Point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Normalize linkage keys in Parquet files"
    )
    parser.add_argument("input_path", help="Input Parquet file path")
    parser.add_argument("output_path", help="Output Parquet file path")
    parser.add_argument(
        "--keep-original",
        action="store_true",
        help="Keep original column alongside canonical key",
    )

    args = parser.parse_args()

    # Load data
    df = pd.read_parquet(args.input_path)
    print(f"Loaded {len(df)} rows from {args.input_path}")

    # Normalize
    df_norm, result = normalize_linkage_key(df, drop_original=not args.keep_original)

    # Save
    df_norm.to_parquet(args.output_path, index=False)
    print(result.summary())
    print(f"Saved to {args.output_path}")

"""
Wide-to-Long Transformation Utilities for Lab Datasets.

Converts wide-format lab data (lab1_*, lab2_*, ...) into normalized
long-format tables suitable for downstream analysis.

GOVERNANCE NOTICE:
- This module performs STRUCTURAL transformations only
- NO statistical analysis, aggregation, or modeling performed
- NO PHI columns emitted (enforced by denylist check)
- Dates are converted to measurement indices (no raw dates in output)

Example Wide Format:
    research_id, tg_lab1_value, tg_lab1_unit, tg_lab2_value, tg_lab2_unit, ...

Example Long Format:
    research_id, analyte, measurement_index, value, unit, source_block
"""

import re
import warnings
from typing import Any, Dict, List, Optional, Set, Tuple

import pandas as pd
import numpy as np

__version__ = "v1.0.0"


# -----------------------------------------------------------------------------
# PHI Safety: Output Denylist
# -----------------------------------------------------------------------------

PHI_OUTPUT_DENYLIST: Set[str] = {
    # Direct identifiers
    "dob",
    "date_of_birth",
    "birth_date",
    "birthdate",
    "ssn",
    "social_security",
    "social_security_number",
    "mrn",
    "medical_record_number",
    "patient_mrn",
    "patient_name",
    "name",
    "first_name",
    "last_name",
    "full_name",
    "address",
    "street_address",
    "city",
    "zip",
    "zipcode",
    "postal_code",
    "phone",
    "telephone",
    "phone_number",
    "fax",
    "email",
    "email_address",
    # ID variants that could be PHI
    "patient_id",
    "subject_id",
    "encounter_id",
    "visit_id",
    "account_number",
    "insurance_id",
    "policy_number",
    # Date fields that could be identifying
    "collection_date",
    "lab_date",
    "draw_date",
    "specimen_date",
    "service_date",
    "visit_date",
    "encounter_date",
    # Other potentially identifying
    "ip_address",
    "device_id",
    "certificate_number",
}


def _check_output_for_phi(df: pd.DataFrame) -> None:
    """
    Raise ValueError if output DataFrame contains forbidden PHI columns.

    This is a safety check to ensure no PHI leaks into transformed output.

    Parameters
    ----------
    df : pd.DataFrame
        Output DataFrame to check

    Raises
    ------
    ValueError
        If any column name matches the PHI denylist
    """
    output_cols_lower = {col.lower().strip() for col in df.columns}

    violations = []
    for col in df.columns:
        col_lower = col.lower().strip()
        # Check exact match
        if col_lower in PHI_OUTPUT_DENYLIST:
            violations.append(col)
        # Check partial match for common PHI patterns
        for phi_pattern in ["dob", "ssn", "mrn", "_name", "patient_"]:
            if phi_pattern in col_lower and col not in ["analyte", "source_block"]:
                if col_lower not in ["measurement_index", "analyte_name"]:
                    violations.append(col)
                    break

    if violations:
        raise ValueError(
            f"PHI SAFETY VIOLATION: Output contains forbidden columns: {violations}. "
            f"These columns must be stripped before transformation."
        )


def _normalize_column_name(col: str) -> str:
    """Normalize column name for pattern matching."""
    return col.lower().strip().replace(" ", "_").replace("-", "_")


# -----------------------------------------------------------------------------
# Block Detection
# -----------------------------------------------------------------------------


def detect_wide_lab_blocks(
    columns: List[str],
    analyte_prefix: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Detect wide-format lab blocks from column names.

    Identifies patterns like:
    - {prefix}_lab1_value, {prefix}_lab1_unit, {prefix}_lab2_value, ...
    - {prefix}1_value, {prefix}1_unit, {prefix}2_value, ...
    - lab1_{suffix}, lab2_{suffix}, ...

    Parameters
    ----------
    columns : List[str]
        List of column names from the DataFrame
    analyte_prefix : str, optional
        If provided, only detect blocks matching this analyte prefix
        (e.g., "tg" for thyroglobulin, "anti_tg" for anti-Tg antibody)

    Returns
    -------
    List[Dict[str, Any]]
        List of block descriptors, each containing:
        - block_id: str (e.g., "lab1", "lab2")
        - index: int (1, 2, 3, ...)
        - columns: Dict[str, str] mapping field type to column name
          (e.g., {"value": "tg_lab1_value", "unit": "tg_lab1_unit"})
        - analyte: str (detected analyte prefix if identifiable)

    Examples
    --------
    >>> cols = ["research_id", "tg_lab1_value", "tg_lab1_unit", "tg_lab2_value"]
    >>> blocks = detect_wide_lab_blocks(cols, analyte_prefix="tg")
    >>> len(blocks)
    2
    >>> blocks[0]["index"]
    1
    """
    blocks: Dict[int, Dict[str, Any]] = {}

    # Pattern variants for lab blocks
    # Pattern 1: {analyte}_lab{N}_{field} (e.g., tg_lab1_value)
    # Pattern 2: {analyte}{N}_{field} (e.g., tg1_value)
    # Pattern 3: lab{N}_{field} (e.g., lab1_value)
    # Pattern 4: {field}_{N} or {field}{N} (e.g., value_1, value1)

    patterns = [
        # {prefix}_lab{N}_{field}
        re.compile(
            r"^(?P<analyte>\w+?)_lab(?P<index>\d+)_(?P<field>\w+)$", re.IGNORECASE
        ),
        # {prefix}{N}_{field}
        re.compile(
            r"^(?P<analyte>[a-zA-Z_]+)(?P<index>\d+)_(?P<field>\w+)$", re.IGNORECASE
        ),
        # lab{N}_{field}
        re.compile(r"^lab(?P<index>\d+)_(?P<field>\w+)$", re.IGNORECASE),
        # {prefix}_lab{N} (single field, index at end)
        re.compile(r"^(?P<analyte>\w+?)_lab(?P<index>\d+)$", re.IGNORECASE),
    ]

    for col in columns:
        col_norm = _normalize_column_name(col)

        for pattern in patterns:
            match = pattern.match(col_norm)
            if match:
                groups = match.groupdict()
                idx = int(groups.get("index", 0))
                analyte = groups.get("analyte", "unknown")
                field = groups.get("field", "value")

                # Filter by analyte prefix if specified
                if analyte_prefix:
                    prefix_norm = _normalize_column_name(analyte_prefix)
                    if not analyte.lower().startswith(prefix_norm.lower()):
                        continue

                if idx not in blocks:
                    blocks[idx] = {
                        "block_id": f"lab{idx}",
                        "index": idx,
                        "columns": {},
                        "analyte": analyte,
                    }

                # Map field type to original column name
                blocks[idx]["columns"][field] = col
                break

    # Sort by index and return as list
    return [blocks[idx] for idx in sorted(blocks.keys())]


# -----------------------------------------------------------------------------
# Wide-to-Long Transformation
# -----------------------------------------------------------------------------


def wide_labs_to_long(
    df: pd.DataFrame,
    analyte: str,
    config: Optional[Dict[str, Any]] = None,
) -> pd.DataFrame:
    """
    Transform wide-format lab data to long format.

    Converts columns like tg_lab1_value, tg_lab1_unit, tg_lab2_value, ...
    into rows with: research_id, analyte, measurement_index, value, unit, source_block

    PHI SAFETY:
    - Dates are converted to measurement indices (relative ordering)
    - Raw dates are NOT included in output
    - Output is checked against PHI denylist before return

    Parameters
    ----------
    df : pd.DataFrame
        Wide-format DataFrame with lab measurement columns
    analyte : str
        Analyte identifier (e.g., "thyroglobulin", "anti_tg_antibody")
        Used for detecting column patterns and labeling output
    config : dict, optional
        Configuration options:
        - linkage_key: str (default "research_id") - patient identifier column
        - value_fields: List[str] - field names to treat as values
          (default ["value", "result", "level", "concentration"])
        - unit_fields: List[str] - field names to treat as units
          (default ["unit", "units"])
        - keep_raw_value: bool (default True) - keep original value if coercion fails
        - drop_all_null_rows: bool (default True) - drop rows where value is null

    Returns
    -------
    pd.DataFrame
        Long-format DataFrame with columns:
        - research_id: str/int (patient identifier)
        - analyte: str (analyte name)
        - measurement_index: int (1-based index, represents temporal order)
        - value: float (numeric value, or NaN if not parseable)
        - raw_value: str (original value string, if coercion failed and keep_raw_value=True)
        - unit: str (unit of measurement, if available)
        - source_block: str (e.g., "lab1", "lab2" - origin block identifier)

    Raises
    ------
    ValueError
        If research_id column is missing
        If output contains PHI columns (safety check)

    Examples
    --------
    >>> df = pd.DataFrame({
    ...     "research_id": [1001, 1002],
    ...     "tg_lab1_value": [0.5, 15.0],
    ...     "tg_lab1_unit": ["ng/mL", "ng/mL"],
    ...     "tg_lab2_value": [0.8, None],
    ...     "tg_lab2_unit": ["ng/mL", None],
    ... })
    >>> long_df = wide_labs_to_long(df, analyte="thyroglobulin")
    >>> long_df.columns.tolist()
    ['research_id', 'analyte', 'measurement_index', 'value', 'unit', 'source_block']
    """
    # Default configuration
    cfg = {
        "linkage_key": "research_id",
        "value_fields": ["value", "result", "level", "concentration", "measurement"],
        "unit_fields": ["unit", "units", "uom"],
        "keep_raw_value": True,
        "drop_all_null_rows": True,
    }
    if config:
        cfg.update(config)

    linkage_key = cfg["linkage_key"]

    # Validate linkage key exists
    if linkage_key not in df.columns:
        raise ValueError(
            f"Required linkage key '{linkage_key}' not found in DataFrame. "
            f"Available columns: {df.columns.tolist()}"
        )

    # Detect lab blocks for this analyte
    blocks = detect_wide_lab_blocks(df.columns.tolist(), analyte_prefix=analyte)

    if not blocks:
        # Try without prefix filter (maybe columns don't have analyte prefix)
        blocks = detect_wide_lab_blocks(df.columns.tolist())
        if not blocks:
            warnings.warn(
                f"No wide-format lab blocks detected for analyte '{analyte}'. "
                f"Returning empty long-format DataFrame."
            )
            return pd.DataFrame(
                columns=[
                    linkage_key,
                    "analyte",
                    "measurement_index",
                    "value",
                    "unit",
                    "source_block",
                ]
            )

    # Build long-format rows
    long_rows: List[Dict[str, Any]] = []

    for _, row in df.iterrows():
        patient_id = row[linkage_key]

        for block in blocks:
            block_cols = block["columns"]
            measurement_idx = block["index"]
            source_block = block["block_id"]

            # Find value column
            value_col = None
            raw_value = None
            numeric_value = None

            for vf in cfg["value_fields"]:
                if vf in block_cols:
                    value_col = block_cols[vf]
                    break

            # If no explicit value field, check if there's a single field
            if value_col is None and len(block_cols) == 1:
                value_col = list(block_cols.values())[0]

            if value_col:
                raw_value = row.get(value_col)
                # Try numeric coercion
                try:
                    if pd.notna(raw_value):
                        numeric_value = float(raw_value)
                    else:
                        numeric_value = np.nan
                except (ValueError, TypeError):
                    numeric_value = np.nan

            # Find unit column
            unit_val = None
            for uf in cfg["unit_fields"]:
                if uf in block_cols:
                    unit_col = block_cols[uf]
                    unit_val = row.get(unit_col)
                    break

            # Build row
            long_row = {
                linkage_key: patient_id,
                "analyte": analyte,
                "measurement_index": measurement_idx,
                "value": numeric_value,
                "unit": unit_val if pd.notna(unit_val) else None,
                "source_block": source_block,
            }

            # Keep raw value if coercion failed
            if cfg["keep_raw_value"] and pd.isna(numeric_value) and pd.notna(raw_value):
                long_row["raw_value"] = str(raw_value)

            long_rows.append(long_row)

    # Create DataFrame
    result = pd.DataFrame(long_rows)

    # Drop rows where value is null (if configured)
    if cfg["drop_all_null_rows"] and "value" in result.columns:
        # Keep rows that have either numeric value or raw_value
        if "raw_value" in result.columns:
            mask = result["value"].notna() | result["raw_value"].notna()
        else:
            mask = result["value"].notna()
        result = result[mask].reset_index(drop=True)

    # Ensure required columns exist
    required_cols = [
        linkage_key,
        "analyte",
        "measurement_index",
        "value",
        "unit",
        "source_block",
    ]
    for col in required_cols:
        if col not in result.columns:
            result[col] = None

    # Reorder columns
    col_order = [c for c in required_cols if c in result.columns]
    if "raw_value" in result.columns:
        col_order.append("raw_value")
    result = result[col_order]

    # PHI safety check on output
    _check_output_for_phi(result)

    return result


def transform_multiple_analytes(
    df: pd.DataFrame,
    analytes: List[str],
    config: Optional[Dict[str, Any]] = None,
) -> pd.DataFrame:
    """
    Transform wide-format data for multiple analytes into unified long format.

    Parameters
    ----------
    df : pd.DataFrame
        Wide-format DataFrame
    analytes : List[str]
        List of analyte identifiers to transform
    config : dict, optional
        Configuration passed to wide_labs_to_long

    Returns
    -------
    pd.DataFrame
        Combined long-format DataFrame for all analytes

    Examples
    --------
    >>> analytes = ["thyroglobulin", "anti_tg_antibody"]
    >>> long_df = transform_multiple_analytes(df, analytes)
    """
    results = []

    for analyte in analytes:
        try:
            long_df = wide_labs_to_long(df, analyte=analyte, config=config)
            if len(long_df) > 0:
                results.append(long_df)
        except Exception as e:
            warnings.warn(f"Failed to transform analyte '{analyte}': {e}")

    if not results:
        return pd.DataFrame()

    combined = pd.concat(results, ignore_index=True)

    # Final PHI check on combined output
    _check_output_for_phi(combined)

    return combined

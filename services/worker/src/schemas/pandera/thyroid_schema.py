"""
Pandera schema for Thyroid Function Panel dataset.

This schema validates de-identified thyroid hormone panel data for classification
of thyroid disease states. It enforces strict data types, plausible clinical ranges,
and REJECTS any columns that could contain PHI/PII.

Schema designed for real clinical datasets following HIPAA de-identification standards.

PHI Protection:
- Runtime PHI value detection using phi_detector.py
- Column name scanning for PHI keywords
- Strict mode rejects unexpected columns
- Automatic quarantine of PHI-flagged data
"""

import pandera as pa
from pandera.typing import DataFrame, Series
from contextvars import ContextVar

__version__ = "v1.0.0"
import logging

# Thread-safe context variable for PHI detection bypass (default: enabled)
# This allows validate(enable_phi_detection=False) to communicate with schema checks
_phi_detection_enabled: ContextVar[bool] = ContextVar(
    "_phi_detection_enabled", default=True
)

from src.validation.phi_detector import (
    PHIDetector,
    scan_dataframe,
    quarantine_flagged_data,
    PHIScanResult,
)

logger = logging.getLogger(__name__)


class ThyroidDataSchema(pa.DataFrameModel):
    """
    Pandera schema for validating thyroid function panel dataset.

    Enforces:
    - Data quality: types, ranges, nullable constraints
    - PHI protection: strict=True rejects any unexpected columns
    - Clinical plausibility: lab values within physiological ranges
    """

    # Demographics (anonymized - no dates, names, IDs)
    age: Series[int] = pa.Field(
        ge=1, le=120, nullable=False, description="Patient age in years (1-120)"
    )
    sex: Series[str] = pa.Field(
        isin=["M", "F", "male", "female"],
        nullable=False,
        description="Biological sex (M/F)",
    )

    # Thyroid hormone panel (clinical lab values)
    TSH: Series[float] = pa.Field(
        ge=0.0,
        le=100.0,
        nullable=True,
        description="Thyroid Stimulating Hormone (mIU/L)",
    )
    T3: Series[float] = pa.Field(
        ge=0.0, le=20.0, nullable=True, description="Triiodothyronine (nmol/L)"
    )
    TT4: Series[float] = pa.Field(
        ge=0.0, le=500.0, nullable=True, description="Total Thyroxine (nmol/L)"
    )
    T4U: Series[float] = pa.Field(
        ge=0.0, le=5.0, nullable=True, description="T4 Uptake (ratio)"
    )
    FTI: Series[float] = pa.Field(
        ge=0.0,
        le=1000.0,
        nullable=True,
        description="Free Thyroxine Index (calculated)",
    )

    # Optional lab values (may not be present in all datasets)
    TBG: Series[float] = pa.Field(
        ge=0.0,
        le=200.0,
        nullable=True,
        description="Thyroxine-Binding Globulin (µg/mL)",
    )

    # Clinical metadata (anonymized)
    referral_source: Series[str] = pa.Field(
        nullable=True, description="Anonymized referral source code"
    )

    # Target variable (diagnosis category)
    target_class: Series[str] = pa.Field(
        nullable=False, description="Thyroid disease classification"
    )

    class Config:
        """
        Strict validation mode - REJECTS any unexpected columns.

        This protects against accidental PHI columns (names, IDs, dates, addresses).
        Any column not explicitly defined above will cause validation failure.

        PHI Protection Layers:
        1. strict=True: Rejects unexpected columns
        2. Column name scanning: Flags suspicious column names
        3. Value-level detection: Scans all values for PHI patterns
        """

        strict = True  # Reject unexpected columns (PHI protection)
        coerce = True  # Coerce types where possible

    @pa.dataframe_check
    def no_phi_in_column_names(cls, df: DataFrame) -> bool:
        """
        Check column names for PHI keywords (defense-in-depth Layer 2).

        This runs before value-level checks to catch obvious PHI columns early.
        Respects _phi_detection_enabled context variable for test bypass.
        """
        # Check if PHI detection is disabled (test-only bypass)
        if not _phi_detection_enabled.get():
            return True

        from src.validation.phi_detector import check_for_phi_in_column_names

        suspicious = check_for_phi_in_column_names(df)
        if suspicious:
            raise pa.errors.SchemaError(
                cls,
                df,
                message=f"Suspicious column names detected (potential PHI): {suspicious}\n"
                f"Remove or rename these columns before validation.\n"
                f"See docs/governance/PHI_BOUNDARIES.md for allowed column patterns.",
                check="no_phi_in_column_names",
            )
        return True

    @pa.dataframe_check
    def no_phi_in_values(cls, df: DataFrame) -> bool:
        """
        Scan all DataFrame values for PHI/PII patterns (defense-in-depth Layer 3).

        This is the strictest check - scans every cell value for:
        - SSN, MRN, phone, email, dates, ZIP+4, IP addresses, URLs, etc.

        If PHI detected:
        1. Raise SchemaError immediately (blocks processing)
        2. Log detection details for audit trail
        3. Recommend quarantine workflow

        Respects _phi_detection_enabled context variable for test bypass.

        Raises:
            pandera.errors.SchemaError: If any PHI/PII detected in values
        """
        # Check if PHI detection is disabled (test-only bypass)
        if not _phi_detection_enabled.get():
            return True

        detector = PHIDetector()
        result = scan_dataframe(df, detector)

        if result.phi_detected:
            # Log detection for audit trail
            logger.error(
                f"PHI DETECTED during schema validation:\n{result.summary()}\n"
                f"Flagged columns: {result.flagged_columns}\n"
                f"Flagged rows: {result.flagged_rows[:10]}... (showing first 10)"
            )

            # Raise error with detailed message
            raise pa.errors.SchemaError(
                cls,
                df,
                message=(
                    f"PHI/PII DETECTED in data values - VALIDATION BLOCKED\n\n"
                    f"{result.summary()}\n\n"
                    f"Detected PHI types by column:\n"
                    f"{_format_detection_details(result)}\n\n"
                    f"Action Required:\n"
                    f"1. Review flagged rows (see logs for details)\n"
                    f"2. Apply redaction procedures (docs/governance/PHI_BOUNDARIES.md)\n"
                    f"3. Use quarantine_flagged_data() to separate PHI rows\n"
                    f"4. Re-run validation after PHI removal\n\n"
                    f"Audit Log: This detection has been logged for compliance tracking."
                ),
                check="no_phi_in_values",
            )

        # No PHI detected - validation passes
        logger.info(
            f"PHI scan passed: {result.total_rows_scanned} rows, {result.total_columns_scanned} columns scanned"
        )
        return True


def _format_detection_details(result: PHIScanResult) -> str:
    """Format PHI detection details for error message."""
    lines = []
    for col, detections in result.detection_details.items():
        phi_types = set([phi_type.value for phi_type, _ in detections])
        lines.append(f"  - {col}: {', '.join(phi_types)}")
    return "\n".join(lines) if lines else "  (No details available)"


def validate(df: DataFrame, enable_phi_detection: bool = True) -> DataFrame:
    """
    Validate a DataFrame against the ThyroidDataSchema with integrated PHI detection.

    This function enforces:
    1. Schema compliance (types, ranges, nullable constraints)
    2. Strict mode (no unexpected columns)
    3. PHI column name scanning
    4. PHI value detection (if enabled)

    Args:
        df: Input DataFrame to validate (thyroid function panel data)
        enable_phi_detection: If True, scan all values for PHI/PII (default: True)
                             Set to False only for testing with synthetic PHI data

    Returns:
        Validated DataFrame with coerced types

    Raises:
        pandera.errors.SchemaError: If validation fails
        - Missing required columns
        - Unexpected columns (potential PHI)
        - Values out of range
        - Type mismatches
        - PHI/PII detected in column names or values (if enabled)

    Example:
        >>> import pandas as pd
        >>> from src.schemas.pandera.thyroid_schema import validate
        >>>
        >>> # Standard validation with PHI detection
        >>> df = pd.read_csv('data/processed/thyroid_clean.csv')
        >>> validated_df = validate(df)  # Raises SchemaError if PHI found
        >>> print(f"Validated {len(validated_df)} rows - PHI-free")
        >>>
        >>> # Disable PHI detection for testing (use with caution)
        >>> test_df = pd.read_csv('tests/fixtures/thyroid_with_synthetic_phi.csv')
        >>> validated_df = validate(test_df, enable_phi_detection=False)

    Security Note:
        enable_phi_detection=False should ONLY be used in controlled testing
        environments with synthetic data. Never disable PHI detection for
        production data ingestion.
    """
    if not enable_phi_detection:
        logger.warning(
            "PHI detection DISABLED for this validation. "
            "This should only be used for testing with synthetic data."
        )

    # Set context variable to communicate with schema checks
    token = _phi_detection_enabled.set(enable_phi_detection)
    try:
        return ThyroidDataSchema.validate(df, lazy=True)
    finally:
        # Reset context variable to default (fail-closed)
        _phi_detection_enabled.reset(token)


def validate_and_quarantine(
    df: DataFrame, quarantine_dir: str = "data/interim/phi_quarantine"
) -> tuple[DataFrame, PHIScanResult, str | None]:
    """
    Validate DataFrame and automatically quarantine any PHI-flagged rows.

    This is a convenience wrapper that:
    1. Scans for PHI before validation
    2. Separates clean and PHI-flagged data
    3. Validates only the clean data
    4. Returns both clean data and quarantine details

    Use this when you want to process clean data while safely isolating PHI.

    Args:
        df: Input DataFrame to validate
        quarantine_dir: Directory for quarantined PHI data (default: data/interim/phi_quarantine)

    Returns:
        Tuple of:
        - clean_df: Validated DataFrame with PHI rows removed
        - scan_result: PHIScanResult with detection details
        - quarantine_file: Path to quarantine file (None if no PHI detected)

    Example:
        >>> import pandas as pd
        >>> from src.schemas.pandera.thyroid_schema import validate_and_quarantine
        >>>
        >>> df = pd.read_csv('data/raw/thyroid_pilot.csv')
        >>> clean_df, scan_result, quarantine_file = validate_and_quarantine(df)
        >>>
        >>> if scan_result.phi_detected:
        >>>     print(f"Quarantined {len(scan_result.flagged_rows)} rows to {quarantine_file}")
        >>>     print(f"Processing {len(clean_df)} clean rows")
        >>> else:
        >>>     print(f"No PHI detected - processing all {len(clean_df)} rows")
    """
    # First scan for PHI
    detector = PHIDetector()
    scan_result = scan_dataframe(df, detector)

    # Quarantine any flagged data
    clean_df, quarantine_file = quarantine_flagged_data(df, scan_result, quarantine_dir)

    # Validate the clean data (PHI detection will pass since we pre-scanned)
    validated_df = validate(clean_df, enable_phi_detection=True)

    return validated_df, scan_result, quarantine_file


def check_for_phi(df: DataFrame) -> list[str]:
    """
    Scan for potential PHI/PII column names (defense-in-depth).

    DEPRECATED: Use check_for_phi_in_column_names from phi_detector.py instead.
    This function is kept for backward compatibility.

    This function provides an additional safety check beyond Pandera's strict mode.
    It scans column names for common PHI identifiers and flags suspicious columns.

    Args:
        df: DataFrame to scan for PHI column names

    Returns:
        List of suspicious column names (empty if clean)

    Example:
        >>> import pandas as pd
        >>> df = pd.read_csv('data/restricted/thyroid_pilot/thyroid_dataset.csv')
        >>> phi_columns = check_for_phi(df)
        >>> if phi_columns:
        >>>     raise ValueError(f"Potential PHI columns detected: {phi_columns}")
    """
    from src.validation.phi_detector import check_for_phi_in_column_names

    logger.warning(
        "check_for_phi() is deprecated. "
        "Use check_for_phi_in_column_names() from phi_detector.py instead."
    )

    return check_for_phi_in_column_names(df)

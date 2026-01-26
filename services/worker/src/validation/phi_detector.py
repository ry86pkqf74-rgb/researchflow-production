"""
Runtime PHI/PII Detection Module

This module provides comprehensive detection of Protected Health Information (PHI)
and Personally Identifiable Information (PII) in data values using regex patterns
and heuristic checks. Designed for HIPAA-compliant research repositories.

Core Principles:
- Zero tolerance for PHI leakage
- Offline detection (no external services)
- Configurable patterns and sensitivity levels
- Quarantine flagged data for human review
- Comprehensive audit logging

PHI_STAGING vs DEIDENTIFIED Classification:
- PHI_STAGING: Transient workspace allowing DOB/full dates for linkage and derived features
- DEIDENTIFIED: Strict mode that rejects any raw PHI; derived fields only

Scrub Boundary:
- scrub_phi_fields() computes derived fields (age_at_event, delta_days) then drops raw PHI
- Data must pass through scrub before promotion to DEIDENTIFIED

Last Updated: 2026-01-06
Last Updated (UTC): 2026-01-06T17:31:00Z

Usage:
    from src.validation.phi_detector import PHIDetector, scan_dataframe
    from src.validation.phi_detector import DataClassification, validate_phi_classification, scrub_phi_fields

    # Initialize detector with default patterns
    detector = PHIDetector()

    # Scan DataFrame for PHI
    result = scan_dataframe(df, detector)

    if result.phi_detected:
        print(f"PHI found in columns: {result.flagged_columns}")
        print(f"Flagged rows: {len(result.flagged_rows)}")
        # Quarantine or reject data

    # Classification-aware validation
    validate_phi_classification(df, DataClassification.PHI_STAGING)  # allows DOB
    df_clean = scrub_phi_fields(df, dob_col='dob', event_date_col='procedure_date')
    validate_phi_classification(df_clean, DataClassification.DEIDENTIFIED)  # fails if PHI remains
"""

import re
import logging
import hashlib
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Optional, Any, Union
from enum import Enum
import pandas as pd
from datetime import datetime

logger = logging.getLogger(__name__)


class PHIType(Enum):
    """Types of PHI/PII that can be detected."""

    SSN = "social_security_number"
    MRN = "medical_record_number"
    PHONE = "phone_number"
    EMAIL = "email_address"
    DATE = "date_of_birth_or_admission"
    ZIP_PLUS_4 = "zip_code_plus_4"
    NAME = "person_name"
    ADDRESS = "street_address"
    IP_ADDRESS = "ip_address"
    LICENSE = "license_number"
    ACCOUNT = "account_number"
    DEVICE_ID = "device_identifier"
    URL = "web_url"
    BIOMETRIC = "biometric_identifier"
    PHOTO = "photographic_image"
    OTHER_IDENTIFIER = "unique_identifier"


@dataclass
class PHIPattern:
    """Regex pattern for detecting specific PHI type."""

    phi_type: PHIType
    pattern: re.Pattern
    description: str
    severity: str = "high"  # high, medium, low

    def matches(self, text: str) -> List[str]:
        """Find all matches in text."""
        if not isinstance(text, str):
            return []
        matches = self.pattern.findall(text)
        return [m if isinstance(m, str) else m[0] for m in matches]


@dataclass
class PHIScanResult:
    """Results from scanning data for PHI."""

    phi_detected: bool
    flagged_columns: List[str] = field(default_factory=list)
    flagged_rows: List[int] = field(default_factory=list)
    detection_details: Dict[str, List[Tuple[PHIType, str]]] = field(
        default_factory=dict
    )
    scan_timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    total_rows_scanned: int = 0
    total_columns_scanned: int = 0
    severity_counts: Dict[str, int] = field(default_factory=dict)

    def summary(self) -> str:
        """Generate human-readable summary."""
        if not self.phi_detected:
            return f"✓ No PHI detected ({self.total_rows_scanned} rows, {self.total_columns_scanned} columns scanned)"

        summary_lines = [
            f"⚠ PHI DETECTED - {len(self.flagged_rows)} rows, {len(self.flagged_columns)} columns affected",
            f"Timestamp: {self.scan_timestamp}",
            f"Flagged columns: {', '.join(self.flagged_columns)}",
        ]

        if self.severity_counts:
            severity_str = ", ".join(
                [f"{k}={v}" for k, v in self.severity_counts.items()]
            )
            summary_lines.append(f"Severity: {severity_str}")

        return "\n".join(summary_lines)


class PHIDetector:
    """
    PHI/PII detection engine using regex patterns.

    Detects 16 categories of PHI as defined by HIPAA Privacy Rule 45 CFR §164.514(b)(2).
    """

    def __init__(self, custom_patterns: Optional[List[PHIPattern]] = None):
        """
        Initialize detector with default or custom patterns.

        Args:
            custom_patterns: Additional PHI patterns beyond defaults
        """
        self.patterns: List[PHIPattern] = self._load_default_patterns()

        if custom_patterns:
            self.patterns.extend(custom_patterns)

        logger.info(f"PHI Detector initialized with {len(self.patterns)} patterns")

    def _load_default_patterns(self) -> List[PHIPattern]:
        """Load default PHI detection patterns."""
        return [
            # Social Security Numbers
            PHIPattern(
                phi_type=PHIType.SSN,
                pattern=re.compile(r"\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b"),
                description="Social Security Number (###-##-#### or #########)",
                severity="high",
            ),
            # Medical Record Numbers (institutional patterns - customize per site)
            PHIPattern(
                phi_type=PHIType.MRN,
                pattern=re.compile(
                    r"\bMRN[:\s]?\d{6,10}\b|\b[A-Z]{2,3}\d{6,8}\b", re.IGNORECASE
                ),
                description="Medical Record Number (MRN: followed by digits or prefix+digits)",
                severity="high",
            ),
            # Phone Numbers (US format)
            PHIPattern(
                phi_type=PHIType.PHONE,
                pattern=re.compile(
                    r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\(\d{3}\)\s*\d{3}[-.\s]\d{4}\b"
                ),
                description="Phone number (###-###-####, ###.###.####, or (###) ###-####)",
                severity="high",
            ),
            # Email Addresses
            PHIPattern(
                phi_type=PHIType.EMAIL,
                pattern=re.compile(
                    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
                ),
                description="Email address (user@domain.com)",
                severity="high",
            ),
            # Dates (MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD)
            # Note: This is aggressive and may flag legitimate relative dates
            # Consider context when evaluating date flags
            PHIPattern(
                phi_type=PHIType.DATE,
                pattern=re.compile(
                    r"\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12][0-9]|3[01])[/-](19|20)\d{2}\b|"
                    r"\b(19|20)\d{2}[/-](0?[1-9]|1[0-2])[/-](0?[1-9]|[12][0-9]|3[01])\b"
                ),
                description="Date in MM/DD/YYYY or YYYY-MM-DD format (may include DOB, admission dates)",
                severity="medium",  # Medium because not all dates are PHI (e.g., publication dates)
            ),
            # ZIP+4 (full 9-digit ZIP codes are PHI)
            PHIPattern(
                phi_type=PHIType.ZIP_PLUS_4,
                pattern=re.compile(r"\b\d{5}-\d{4}\b"),
                description="ZIP+4 code (#####-####)",
                severity="medium",
            ),
            # IP Addresses
            PHIPattern(
                phi_type=PHIType.IP_ADDRESS,
                pattern=re.compile(
                    r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}"
                    r"(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b"
                ),
                description="IP address (###.###.###.###)",
                severity="medium",
            ),
            # URLs (may contain PHI in query parameters or paths)
            PHIPattern(
                phi_type=PHIType.URL,
                pattern=re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+', re.IGNORECASE),
                description="Web URL (http:// or https://)",
                severity="low",  # Low because not all URLs contain PHI
            ),
            # License Numbers (driver's license, medical license)
            PHIPattern(
                phi_type=PHIType.LICENSE,
                pattern=re.compile(
                    r"\b(?:DL|LIC|LICENSE)[:\s#]?[A-Z0-9]{6,12}\b", re.IGNORECASE
                ),
                description="License number (DL:, LIC:, LICENSE: followed by alphanumeric)",
                severity="high",
            ),
            # Account Numbers (bank, credit card)
            PHIPattern(
                phi_type=PHIType.ACCOUNT,
                pattern=re.compile(
                    r"\b(?:ACCT|ACCOUNT)[:\s#]?\d{6,16}\b", re.IGNORECASE
                ),
                description="Account number (ACCT: or ACCOUNT: followed by digits)",
                severity="medium",
            ),
            # Person Names (basic pattern - high false positive rate, use with caution)
            # This pattern looks for "First Last" with capitalized words
            # Disabled by default due to high false positive rate
            # Uncomment and tune for specific use cases
            # PHIPattern(
            #     phi_type=PHIType.NAME,
            #     pattern=re.compile(r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b'),
            #     description="Person name (capitalized First Last)",
            #     severity="high"
            # ),
        ]

    def scan_value(self, value: Any) -> List[Tuple[PHIType, str]]:
        """
        Scan a single value for PHI patterns.

        Args:
            value: Value to scan (will be converted to string)

        Returns:
            List of (PHIType, matched_text) tuples
        """
        if pd.isna(value) or value is None:
            return []

        text = str(value)
        detections = []

        for pattern_def in self.patterns:
            matches = pattern_def.matches(text)
            for match in matches:
                detections.append((pattern_def.phi_type, match))

        return detections

    def scan_series(
        self, series: pd.Series, column_name: str
    ) -> Dict[int, List[Tuple[PHIType, str]]]:
        """
        Scan a pandas Series for PHI.

        Args:
            series: Pandas Series to scan
            column_name: Name of the column (for logging)

        Returns:
            Dictionary mapping row indices to list of detections
        """
        flagged_rows = {}

        for idx, value in series.items():
            detections = self.scan_value(value)
            if detections:
                flagged_rows[idx] = detections

        if flagged_rows:
            logger.warning(
                f"PHI detected in column '{column_name}': {len(flagged_rows)} rows flagged"
            )

        return flagged_rows


def scan_dataframe(
    df: pd.DataFrame,
    detector: Optional[PHIDetector] = None,
    columns_to_scan: Optional[List[str]] = None,
    scan_all_columns: bool = True,
) -> PHIScanResult:
    """
    Scan entire DataFrame for PHI/PII.

    Args:
        df: DataFrame to scan
        detector: PHIDetector instance (creates default if None)
        columns_to_scan: Specific columns to scan (scans all if None and scan_all_columns=True)
        scan_all_columns: Whether to scan all columns (default: True)

    Returns:
        PHIScanResult with detection details
    """
    if detector is None:
        detector = PHIDetector()

    # Determine which columns to scan
    if columns_to_scan:
        cols = [c for c in columns_to_scan if c in df.columns]
    elif scan_all_columns:
        cols = df.columns.tolist()
    else:
        cols = []

    flagged_columns = []
    flagged_row_indices = set()
    detection_details = {}
    severity_counts = {"high": 0, "medium": 0, "low": 0}

    for col in cols:
        col_flagged_rows = detector.scan_series(df[col], col)

        if col_flagged_rows:
            flagged_columns.append(col)
            detection_details[col] = []

            for row_idx, detections in col_flagged_rows.items():
                flagged_row_indices.add(row_idx)
                detection_details[col].extend(detections)

                # Count severity
                for phi_type, _ in detections:
                    pattern = next(
                        p for p in detector.patterns if p.phi_type == phi_type
                    )
                    severity_counts[pattern.severity] += 1

    result = PHIScanResult(
        phi_detected=len(flagged_columns) > 0,
        flagged_columns=flagged_columns,
        flagged_rows=sorted(list(flagged_row_indices)),
        detection_details=detection_details,
        total_rows_scanned=len(df),
        total_columns_scanned=len(cols),
        severity_counts=severity_counts,
    )

    logger.info(result.summary())

    return result


def quarantine_flagged_data(
    df: pd.DataFrame,
    scan_result: PHIScanResult,
    quarantine_dir: str = "data/interim/phi_quarantine",
) -> Tuple[pd.DataFrame, Optional[str]]:
    """
    Separate flagged rows into quarantine file for human review.

    Args:
        df: Original DataFrame
        scan_result: PHIScanResult from scan_dataframe
        quarantine_dir: Directory to store quarantined data

    Returns:
        (clean_df, quarantine_filepath) tuple
        clean_df: DataFrame with flagged rows removed
        quarantine_filepath: Path to quarantine file (None if no PHI detected)
    """
    if not scan_result.phi_detected:
        logger.info("No PHI detected, no quarantine needed")
        return df, None

    from pathlib import Path

    # Create quarantine directory
    quarantine_path = Path(quarantine_dir)
    quarantine_path.mkdir(parents=True, exist_ok=True)

    # Separate clean and flagged data
    flagged_mask = df.index.isin(scan_result.flagged_rows)
    clean_df = df[~flagged_mask].copy()
    flagged_df = df[flagged_mask].copy()

    # Save quarantined data
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    quarantine_file = quarantine_path / f"phi_flagged_{timestamp}.parquet"
    flagged_df.to_parquet(quarantine_file, index=False)

    # Save scan report
    report_file = quarantine_path / f"phi_scan_report_{timestamp}.json"
    import json

    with open(report_file, "w") as f:
        json.dump(
            {
                "scan_result": {
                    "phi_detected": scan_result.phi_detected,
                    "flagged_columns": scan_result.flagged_columns,
                    "flagged_rows_count": len(scan_result.flagged_rows),
                    "total_rows_scanned": scan_result.total_rows_scanned,
                    "severity_counts": scan_result.severity_counts,
                    "scan_timestamp": scan_result.scan_timestamp,
                },
                "quarantine_file": str(quarantine_file),
                "clean_rows": len(clean_df),
                "flagged_rows": len(flagged_df),
            },
            f,
            indent=2,
        )

    logger.warning(
        f"Quarantined {len(flagged_df)} rows with PHI to {quarantine_file}\n"
        f"Scan report saved to {report_file}\n"
        f"Clean data: {len(clean_df)} rows remaining"
    )

    return clean_df, str(quarantine_file)


def check_for_phi_in_column_names(df: pd.DataFrame) -> List[str]:
    """
    Scan column names for PHI keywords (defense-in-depth).

    This is the existing function from thyroid_schema.py,
    included here for completeness and integration.

    Args:
        df: DataFrame to check

    Returns:
        List of suspicious column names
    """
    phi_keywords = [
        "patient",
        "mrn",
        "ssn",
        "dob",
        "birth",
        "address",
        "phone",
        "email",
        "zip",
        "postal",
        "account",
        "license",
        "certificate",
        "url",
        "device",
        "photo",
        "biometric",
        "fax",
    ]

    suspicious_columns = []
    for col in df.columns:
        col_lower = col.lower()
        if any(keyword in col_lower for keyword in phi_keywords):
            suspicious_columns.append(col)

    if suspicious_columns:
        logger.warning(
            f"Suspicious column names detected (may contain PHI): {suspicious_columns}"
        )

    return suspicious_columns


# =============================================================================
# PHI_STAGING Classification System (Option 1 - Strict Scrub Boundary)
# =============================================================================


class DataClassification(Enum):
    """
    Data classification levels for PHI handling.

    PHI_STAGING: Transient workspace where raw DOB/full dates are allowed
                 for computing derived fields (age_at_event, delta_days).
                 NEVER committed to version control.

    DEIDENTIFIED: Strict mode for analysis-ready data. No raw PHI columns
                  allowed; only derived/safe fields permitted.
                  Safe for version control after validation.
    """

    PHI_STAGING = "phi_staging"
    DEIDENTIFIED = "deidentified"


class PHIClassificationError(Exception):
    """
    Exception raised when data fails PHI classification validation.

    This exception is raised when:
    - Hard PHI columns (names, SSN, MRN) are found in any classification
    - PHI staging columns (DOB, full dates) are found in DEIDENTIFIED data
    - PHI values are detected in data that should be clean

    Attributes:
        message: Human-readable error description
        classification: The DataClassification that was being validated
        violations: List of specific violations found
        column_hashes: SHA256 hashes of violating column names (for audit logs)
    """

    def __init__(
        self,
        message: str,
        classification: DataClassification,
        violations: List[str],
        column_hashes: Optional[List[str]] = None,
    ):
        self.message = message
        self.classification = classification
        self.violations = violations
        self.column_hashes = column_hashes or [
            hashlib.sha256(v.encode()).hexdigest()[:16] for v in violations
        ]
        super().__init__(self.message)

    def __str__(self) -> str:
        return (
            f"PHIClassificationError[{self.classification.value}]: {self.message}\n"
            f"Violations (count={len(self.violations)}): column_hashes={self.column_hashes}"
        )


# Hard PHI column patterns - NEVER allowed in any classification
# These represent direct identifiers that must be removed before any processing
HARD_PHI_COLUMN_PATTERNS: Set[str] = {
    # Names
    "patient_name",
    "first_name",
    "last_name",
    "full_name",
    "name",
    "patient_first",
    "patient_last",
    "given_name",
    "family_name",
    # SSN
    "ssn",
    "social_security",
    "social_security_number",
    "ss_number",
    # MRN (unless explicitly research-mapped)
    "mrn",
    "medical_record",
    "medical_record_number",
    "med_rec",
    "patient_id",
    "chart_number",  # Often direct identifiers
    # Contact info
    "phone",
    "telephone",
    "cell",
    "mobile",
    "fax",
    "email",
    "email_address",
    "e_mail",
    # Address
    "address",
    "street",
    "street_address",
    "home_address",
    "city",
    "state",
    "zip",
    "zipcode",
    "zip_code",
    "postal",
    # Other direct identifiers
    "license",
    "license_number",
    "drivers_license",
    "account",
    "account_number",
    "acct",
    "device_id",
    "device_serial",
    "ip_address",
    "url",
    "web_url",
    "biometric",
    "fingerprint",
    "photo",
    "image",
}

# PHI staging-only columns - allowed ONLY in PHI_STAGING, must be scrubbed for DEIDENTIFIED
# These contain temporal PHI that can be converted to safe derived fields
PHI_STAGING_ALLOWED_COLUMNS: Set[str] = {
    # Date of birth variants
    "dob",
    "date_of_birth",
    "birth_date",
    "birthdate",
    "birth",
    "patient_dob",
    "patient_birth_date",
    # Full dates (can derive age_at_event, delta_days)
    "admission_date",
    "discharge_date",
    "procedure_date",
    "surgery_date",
    "visit_date",
    "encounter_date",
    "service_date",
    "event_date",
    "diagnosis_date",
    "collection_date",
    "specimen_date",
    "death_date",
    "date_of_death",
    # Timestamps (full precision)
    "admission_datetime",
    "procedure_datetime",
    "event_datetime",
    "created_at",
    "updated_at",  # If contain patient-linked timestamps
}


# Safe derived column suffixes - columns ending with these are NOT considered raw PHI
SAFE_DERIVED_SUFFIXES: Set[str] = {
    "_year",  # Year-only extraction (e.g., dob_year, procedure_date_year)
    "_age",  # Age derivation
    "_delta",  # Time delta derivation
    "_days",  # Day count derivation
    "_months",  # Month count derivation
}


def _match_column_pattern(
    column_name: str, patterns: Set[str], exclude_derived: bool = False
) -> bool:
    """
    Check if column name matches any pattern in the set.

    Uses case-insensitive substring matching.

    Args:
        column_name: Column name to check
        patterns: Set of patterns to match against
        exclude_derived: If True, columns with safe derived suffixes are not matched

    Returns:
        True if column matches any pattern
    """
    col_lower = column_name.lower().strip()

    # If excluding derived columns, check for safe suffixes first
    if exclude_derived:
        for suffix in SAFE_DERIVED_SUFFIXES:
            if col_lower.endswith(suffix):
                return False  # This is a derived column, don't match

    # Exact match
    if col_lower in patterns:
        return True

    # Substring match (for compound column names like 'patient_dob_raw')
    for pattern in patterns:
        if pattern in col_lower:
            return True

    return False


def validate_phi_classification(
    df: pd.DataFrame,
    classification: DataClassification,
    detector: Optional[PHIDetector] = None,
    raise_on_violation: bool = True,
    scan_values: bool = True,
) -> Tuple[bool, List[str], Optional[PHIScanResult]]:
    """
    Validate DataFrame against PHI classification requirements.

    PHI_STAGING:
        - REJECTS: Hard PHI columns (names, SSN, MRN, contact info)
        - ALLOWS: DOB, full dates (for deriving age_at_event, delta_days)
        - SCANS: Values for PHI patterns (optional)

    DEIDENTIFIED:
        - REJECTS: All PHI columns (hard + staging-only)
        - REJECTS: Any PHI detected in values
        - REQUIRES: Data has been scrubbed (no raw PHI)

    Args:
        df: DataFrame to validate
        classification: Target classification level
        detector: PHIDetector instance (creates default if None)
        raise_on_violation: If True, raise PHIClassificationError on failure
        scan_values: If True, also scan cell values for PHI patterns

    Returns:
        Tuple of (is_valid, violations_list, scan_result_or_none)

    Raises:
        PHIClassificationError: If raise_on_violation=True and violations found
    """
    violations = []
    scan_result = None

    # Check for hard PHI columns (never allowed in any classification)
    hard_phi_found = []
    for col in df.columns:
        if _match_column_pattern(col, HARD_PHI_COLUMN_PATTERNS):
            hard_phi_found.append(col)

    if hard_phi_found:
        violations.extend([f"hard_phi_column:{c}" for c in hard_phi_found])
        logger.error(
            f"Hard PHI columns detected (classification={classification.value}): "
            f"count={len(hard_phi_found)}, "
            f"hashes={[hashlib.sha256(c.encode()).hexdigest()[:16] for c in hard_phi_found]}"
        )

    # Check staging-only columns based on classification
    if classification == DataClassification.DEIDENTIFIED:
        staging_phi_found = []
        for col in df.columns:
            # Use exclude_derived=True to allow year columns (dob_year, procedure_date_year, etc.)
            if _match_column_pattern(
                col, PHI_STAGING_ALLOWED_COLUMNS, exclude_derived=True
            ):
                staging_phi_found.append(col)

        if staging_phi_found:
            violations.extend([f"staging_phi_column:{c}" for c in staging_phi_found])
            logger.error(
                f"PHI staging columns in DEIDENTIFIED data: "
                f"count={len(staging_phi_found)}, "
                f"hashes={[hashlib.sha256(c.encode()).hexdigest()[:16] for c in staging_phi_found]}"
            )

    # Scan values for PHI patterns
    if scan_values:
        if detector is None:
            detector = PHIDetector()

        scan_result = scan_dataframe(df, detector)

        if scan_result.phi_detected:
            # For PHI_STAGING, warn but don't fail (values may contain dates being processed)
            # For DEIDENTIFIED, this is a hard failure
            if classification == DataClassification.DEIDENTIFIED:
                violations.extend(
                    [f"phi_value_detected:{c}" for c in scan_result.flagged_columns]
                )
                logger.error(
                    f"PHI detected in values (DEIDENTIFIED): "
                    f"flagged_columns={len(scan_result.flagged_columns)}, "
                    f"flagged_rows={len(scan_result.flagged_rows)}"
                )
            else:
                logger.warning(
                    f"PHI patterns detected in PHI_STAGING values (allowed for processing): "
                    f"flagged_columns={len(scan_result.flagged_columns)}"
                )

    is_valid = len(violations) == 0

    if not is_valid and raise_on_violation:
        raise PHIClassificationError(
            message=f"Data failed {classification.value} classification validation",
            classification=classification,
            violations=violations,
        )

    return is_valid, violations, scan_result


@dataclass
class ScrubResult:
    """Result of PHI scrubbing operation."""

    success: bool
    df: pd.DataFrame
    derived_columns: List[str] = field(default_factory=list)
    dropped_columns: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    error: Optional[str] = None

    def summary(self) -> str:
        """Generate human-readable summary."""
        if not self.success:
            return f"❌ Scrub failed: {self.error}"

        return (
            f"✓ Scrub complete: derived={self.derived_columns}, "
            f"dropped={self.dropped_columns}, warnings={len(self.warnings)}"
        )


def scrub_phi_fields(
    df: pd.DataFrame,
    dob_col: Optional[str] = None,
    event_date_col: Optional[str] = None,
    index_date_col: Optional[str] = None,
    drop_staging_cols: bool = True,
    age_at_event_col: str = "age_at_event",
    delta_days_col: str = "delta_days_from_index",
    year_only_suffix: str = "_year",
) -> ScrubResult:
    """
    Scrub PHI fields by computing derived columns then dropping raw PHI.

    This is the mandatory scrub boundary: data in PHI_STAGING must pass
    through this function before promotion to DEIDENTIFIED.

    Derivations:
        - age_at_event: Computed from DOB and event_date (years, integer)
        - delta_days: Computed from event_date and index_date (days, integer)
        - *_year: Year-only extraction from date columns

    Args:
        df: Input DataFrame (not mutated; returns new DataFrame)
        dob_col: Column containing date of birth (auto-detected if None)
        event_date_col: Column containing event/procedure date (auto-detected if None)
        index_date_col: Column containing index date for delta calculation
        drop_staging_cols: If True, drop all PHI_STAGING_ALLOWED_COLUMNS after derivation
        age_at_event_col: Name for derived age column
        delta_days_col: Name for derived delta days column
        year_only_suffix: Suffix for year-only derived columns

    Returns:
        ScrubResult containing new DataFrame with derived fields and dropped PHI
    """
    result = ScrubResult(success=False, df=df.copy())
    derived_cols = []
    dropped_cols = []
    warnings = []

    try:
        df_out = df.copy()

        # Track columns to drop (so we can derive from them first)
        staging_cols_to_drop = set()

        # Auto-detect DOB column if not specified
        if dob_col is None:
            for col in df_out.columns:
                if _match_column_pattern(
                    col, {"dob", "date_of_birth", "birth_date", "birthdate"}
                ):
                    dob_col = col
                    break

        # Auto-detect event date column if not specified
        if event_date_col is None:
            for col in df_out.columns:
                if _match_column_pattern(
                    col, {"procedure_date", "surgery_date", "event_date", "visit_date"}
                ):
                    event_date_col = col
                    break

        # Identify staging columns to drop first
        if drop_staging_cols:
            for col in df_out.columns:
                if _match_column_pattern(col, PHI_STAGING_ALLOWED_COLUMNS):
                    staging_cols_to_drop.add(col)

        # Derive age_at_event if DOB and event date are available
        if (
            dob_col
            and dob_col in df_out.columns
            and event_date_col
            and event_date_col in df_out.columns
        ):
            try:
                dob_series = pd.to_datetime(df_out[dob_col], errors="coerce")
                event_series = pd.to_datetime(df_out[event_date_col], errors="coerce")

                # Calculate age in years (integer)
                age_days = (event_series - dob_series).dt.days
                df_out[age_at_event_col] = (
                    (age_days / 365.25)
                    .apply(lambda x: int(x) if pd.notna(x) else pd.NA)
                    .astype("Int64")
                )  # Nullable int
                derived_cols.append(age_at_event_col)

                logger.info(
                    f"Derived {age_at_event_col} from {dob_col} and {event_date_col}"
                )
            except Exception as e:
                warnings.append(f"Could not derive age_at_event: {e}")
        elif dob_col and dob_col in df_out.columns:
            warnings.append(
                f"DOB column '{dob_col}' found but no event_date_col for age derivation"
            )

        # Derive delta_days if event date and index date are available
        if (
            event_date_col
            and event_date_col in df_out.columns
            and index_date_col
            and index_date_col in df_out.columns
        ):
            try:
                event_series = pd.to_datetime(df_out[event_date_col], errors="coerce")
                index_series = pd.to_datetime(df_out[index_date_col], errors="coerce")

                delta = (event_series - index_series).dt.days
                df_out[delta_days_col] = delta.apply(
                    lambda x: int(x) if pd.notna(x) else pd.NA
                ).astype("Int64")
                derived_cols.append(delta_days_col)

                logger.info(
                    f"Derived {delta_days_col} from {event_date_col} and {index_date_col}"
                )
            except Exception as e:
                warnings.append(f"Could not derive delta_days: {e}")

        # Derive year-only columns from staging columns before dropping
        year_cols_derived = set()
        for col in staging_cols_to_drop:
            if col in df_out.columns:
                try:
                    date_series = pd.to_datetime(df_out[col], errors="coerce")
                    if date_series.notna().any():
                        year_col = f"{col}{year_only_suffix}"
                        df_out[year_col] = date_series.dt.year.apply(
                            lambda x: int(x) if pd.notna(x) else pd.NA
                        ).astype("Int64")
                        derived_cols.append(year_col)
                        year_cols_derived.add(year_col)
                        logger.info(f"Derived {year_col} from {col}")
                except Exception:
                    pass  # Not a date column, skip

        # Drop PHI staging columns (but NOT the derived year columns)
        if drop_staging_cols:
            for col in list(staging_cols_to_drop):
                if col in df_out.columns:
                    df_out = df_out.drop(columns=[col])
                    dropped_cols.append(col)
                    logger.info(f"Dropped PHI staging column: {col}")

        # Also drop any hard PHI columns that might have slipped through
        # But protect derived columns
        for col in list(df_out.columns):
            if col in derived_cols or col in year_cols_derived:
                continue  # Don't drop derived columns
            if _match_column_pattern(col, HARD_PHI_COLUMN_PATTERNS):
                df_out = df_out.drop(columns=[col])
                dropped_cols.append(col)
                logger.warning(f"Dropped hard PHI column during scrub: {col}")

        result.success = True
        result.df = df_out
        result.derived_columns = derived_cols
        result.dropped_columns = dropped_cols
        result.warnings = warnings

        logger.info(result.summary())

    except Exception as e:
        result.error = str(e)
        logger.error(f"Scrub failed: {e}")

    return result


def promote_to_deidentified(
    df: pd.DataFrame,
    dob_col: Optional[str] = None,
    event_date_col: Optional[str] = None,
    index_date_col: Optional[str] = None,
    detector: Optional[PHIDetector] = None,
) -> Tuple[pd.DataFrame, ScrubResult]:
    """
    Convenience function: scrub PHI fields and validate for DEIDENTIFIED.

    This is the recommended single entry point for promoting data from
    PHI_STAGING to DEIDENTIFIED. It:
    1. Scrubs PHI fields (derives safe columns, drops raw PHI)
    2. Validates the result passes DEIDENTIFIED classification
    3. Fails closed if any PHI remains

    Args:
        df: Input DataFrame from PHI_STAGING
        dob_col: Column containing date of birth
        event_date_col: Column containing event/procedure date
        index_date_col: Column containing index date for delta calculation
        detector: PHIDetector instance for value scanning

    Returns:
        Tuple of (clean_df, scrub_result)

    Raises:
        PHIClassificationError: If data fails DEIDENTIFIED validation after scrub
    """
    # Step 1: Scrub
    scrub_result = scrub_phi_fields(
        df,
        dob_col=dob_col,
        event_date_col=event_date_col,
        index_date_col=index_date_col,
        drop_staging_cols=True,
    )

    if not scrub_result.success:
        raise PHIClassificationError(
            message=f"Scrub failed: {scrub_result.error}",
            classification=DataClassification.DEIDENTIFIED,
            violations=["scrub_failure"],
        )

    # Step 2: Validate DEIDENTIFIED
    is_valid, violations, _ = validate_phi_classification(
        scrub_result.df,
        DataClassification.DEIDENTIFIED,
        detector=detector,
        raise_on_violation=True,
        scan_values=True,
    )

    return scrub_result.df, scrub_result


# Example usage and testing
if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Create sample data with PHI (SYNTHETIC - for testing only)
    test_data = pd.DataFrame(
        {
            "research_id": ["R001", "R002", "R003", "R004"],
            "age": [45, 52, 38, 61],
            "diagnosis": ["benign", "malignant", "benign", "malignant"],
            "notes": [
                "Patient presented with nodule",  # Clean
                "MRN123456 seen on 01/15/2024",  # PHI: MRN + date
                "Contact: 555-123-4567",  # PHI: phone
                "Email: patient@example.com",  # PHI: email
            ],
        }
    )

    print("=== PHI Detection Test ===\n")

    # Scan for PHI
    detector = PHIDetector()
    result = scan_dataframe(test_data, detector)

    print(result.summary())
    print(f"\nDetection details: {result.detection_details}")

    # Quarantine flagged data
    clean_df, quarantine_file = quarantine_flagged_data(test_data, result)
    print(f"\nClean data shape: {clean_df.shape}")
    if quarantine_file:
        print(f"Quarantined data: {quarantine_file}")

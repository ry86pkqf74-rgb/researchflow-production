"""
PHI-Stripping Ingestion Wrapper for Restricted Excel Sources.

This module provides a governance-safe ingestion layer that:
1. Reads Excel files ONLY from restricted locations (data/restricted/)
2. Scans for PHI using phi_detector (columns + values)
3. Drops or transforms PHI fields per explicit denylist/allowlist
4. Writes PHI-safe derivatives to non-restricted locations (data/interim/)
5. Quarantines failures with clear logs (no partial silent outputs)

PHI_STAGING Classification Support:
- Ingestion outputs to PHI_STAGING by default (allows DOB/full dates transiently)
- Use validate_phi_classification() to enforce boundaries
- Use scrub_phi_fields() or promote_to_deidentified() before committing data

Design Principles:
- Defense-in-depth: Multiple PHI protection layers
- Fail-safe: Errors halt processing; no partial outputs
- Audit trail: All decisions logged with timestamps
- Configurable: Explicit denylist/allowlist for column handling

Last Updated: 2026-01-06
Last Updated (UTC): 2026-01-06T17:33:00Z

Usage:
    from src.ingest.phi_strip_ingestion import PHISafeIngester

    ingester = PHISafeIngester()
    result = ingester.ingest_excel(
        source_path="data/restricted/thyroid_pilot/my_file.xlsx",
        output_path="data/interim/my_file.parquet"
    )

    # For classification-aware workflow:
    from src.validation.phi_detector import (
        DataClassification, validate_phi_classification,
        scrub_phi_fields, promote_to_deidentified
    )

    # Validate as PHI_STAGING (allows DOB/dates for derivation)
    validate_phi_classification(df, DataClassification.PHI_STAGING)

    # Scrub and promote to DEIDENTIFIED (derives age, drops raw PHI)
    clean_df, scrub_result = promote_to_deidentified(df)
"""

import logging
import pandas as pd
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Set, Union
from datetime import datetime

from src.validation.phi_detector import (
    PHIDetector,
    PHIScanResult,
    scan_dataframe,
    quarantine_flagged_data,
    check_for_phi_in_column_names,
)

logger = logging.getLogger(__name__)


# Default PHI column denylist - columns that MUST be dropped
# These are column name patterns (case-insensitive substring match)
DEFAULT_PHI_COLUMN_DENYLIST = {
    "dob",  # Date of birth
    "date_of_birth",
    "birth_date",
    "birthdate",
    "ssn",  # Social security number
    "social_security",
    "mrn",  # Medical record number (unless de-identified)
    "medical_record",
    "patient_name",
    "first_name",
    "last_name",
    "full_name",
    "address",
    "street",
    "city",  # Be careful - may be needed for geographic analysis
    "phone",
    "telephone",
    "email",
    "fax",
}

# Default allowlist - columns that are safe to keep even if flagged
# These override denylist and value-level PHI detection
DEFAULT_PHI_COLUMN_ALLOWLIST = {
    "research_id",
    "research_id_number",
    "age",  # Age is generally safe (unless extreme values)
    "sex",
    "gender",
    "race",  # Demographics typically allowed after de-identification
    "ethnicity",
}


@dataclass
class IngestionResult:
    """Results from PHI-safe ingestion operation."""

    success: bool
    source_path: str
    output_path: Optional[str] = None
    rows_ingested: int = 0
    columns_original: int = 0
    columns_dropped: int = 0
    columns_final: int = 0
    phi_columns_detected: List[str] = field(default_factory=list)
    phi_columns_dropped: List[str] = field(default_factory=list)
    phi_rows_quarantined: int = 0
    quarantine_path: Optional[str] = None
    error_message: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def summary(self) -> str:
        """Generate human-readable summary."""
        if not self.success:
            return f"❌ FAILED: {self.error_message}"

        lines = [
            f"✓ SUCCESS: {self.source_path} → {self.output_path}",
            f"  Rows: {self.rows_ingested:,}",
            f"  Columns: {self.columns_original} → {self.columns_final} ({self.columns_dropped} dropped)",
        ]

        if self.phi_columns_dropped:
            lines.append(
                f"  PHI columns dropped: {', '.join(self.phi_columns_dropped)}"
            )

        if self.phi_rows_quarantined > 0:
            lines.append(f"  ⚠ PHI rows quarantined: {self.phi_rows_quarantined}")
            lines.append(f"    Quarantine: {self.quarantine_path}")

        return "\n".join(lines)


class PHISafeIngester:
    """
    PHI-safe ingestion wrapper for restricted Excel sources.

    Ensures no PHI escapes the restricted data boundary.
    """

    def __init__(
        self,
        restricted_base: str = "data/restricted",
        output_base: str = "data/interim",
        quarantine_base: str = "data/interim/phi_quarantine",
        phi_column_denylist: Optional[Set[str]] = None,
        phi_column_allowlist: Optional[Set[str]] = None,
        fail_on_phi_values: bool = False,  # If True, fail instead of quarantine
        detector: Optional[PHIDetector] = None,
    ):
        """
        Initialize PHI-safe ingester.

        Args:
            restricted_base: Base path for restricted source data
            output_base: Base path for PHI-safe output data
            quarantine_base: Base path for quarantined data with PHI
            phi_column_denylist: Column name patterns to always drop
            phi_column_allowlist: Column name patterns to always keep
            fail_on_phi_values: If True, fail on PHI in values; if False, quarantine
            detector: Custom PHIDetector instance
        """
        self.restricted_base = Path(restricted_base)
        self.output_base = Path(output_base)
        self.quarantine_base = Path(quarantine_base)

        self.phi_column_denylist = (
            phi_column_denylist or DEFAULT_PHI_COLUMN_DENYLIST.copy()
        )
        self.phi_column_allowlist = (
            phi_column_allowlist or DEFAULT_PHI_COLUMN_ALLOWLIST.copy()
        )

        self.fail_on_phi_values = fail_on_phi_values
        self.detector = detector or PHIDetector()

        logger.info(
            f"PHISafeIngester initialized: restricted={self.restricted_base}, "
            f"output={self.output_base}, denylist={len(self.phi_column_denylist)} patterns"
        )

    def _validate_source_path(self, source_path: Path) -> bool:
        """
        Validate source path is within restricted boundary.

        Args:
            source_path: Path to validate

        Returns:
            True if valid, raises ValueError otherwise
        """
        try:
            # Resolve to absolute paths for comparison
            source_resolved = source_path.resolve()
            restricted_resolved = self.restricted_base.resolve()

            # Check if source is within restricted boundary
            source_resolved.relative_to(restricted_resolved)
            return True
        except ValueError:
            raise ValueError(
                f"Source path {source_path} is NOT within restricted boundary "
                f"{self.restricted_base}. PHI-safe ingestion BLOCKED."
            )

    def _identify_phi_columns(self, df: pd.DataFrame) -> Tuple[List[str], List[str]]:
        """
        Identify PHI columns based on denylist and value scanning.

        Args:
            df: DataFrame to analyze

        Returns:
            (columns_to_drop, columns_flagged_by_name) tuple
        """
        columns_to_drop = []
        columns_flagged_by_name = []

        for col in df.columns:
            col_lower = col.lower()

            # Check allowlist first (takes precedence)
            if any(allowed in col_lower for allowed in self.phi_column_allowlist):
                logger.debug(f"Column '{col}' in allowlist - keeping")
                continue

            # Check denylist
            if any(denied in col_lower for denied in self.phi_column_denylist):
                columns_to_drop.append(col)
                columns_flagged_by_name.append(col)
                logger.warning(f"Column '{col}' matches PHI denylist - will be dropped")
                continue

            # Check for datetime columns that might contain PHI dates
            if df[col].dtype == "datetime64[ns]":
                # Datetime columns are high-risk for PHI (DOB, admission dates, etc.)
                # Unless explicitly allowlisted, flag for review
                columns_to_drop.append(col)
                columns_flagged_by_name.append(col)
                logger.warning(
                    f"Column '{col}' is datetime type - will be dropped (PHI risk)"
                )

        # Also check using phi_detector's column name scanner
        suspicious_cols = check_for_phi_in_column_names(df)
        for col in suspicious_cols:
            col_lower = col.lower()
            # Don't double-add, and respect allowlist
            if col not in columns_to_drop and not any(
                allowed in col_lower for allowed in self.phi_column_allowlist
            ):
                columns_to_drop.append(col)
                columns_flagged_by_name.append(col)

        return columns_to_drop, columns_flagged_by_name

    def _drop_phi_columns(
        self, df: pd.DataFrame, columns_to_drop: List[str]
    ) -> pd.DataFrame:
        """
        Drop identified PHI columns from DataFrame.

        Args:
            df: Original DataFrame
            columns_to_drop: List of column names to drop

        Returns:
            DataFrame with PHI columns removed
        """
        if not columns_to_drop:
            return df

        # Filter to only columns that exist
        existing_to_drop = [c for c in columns_to_drop if c in df.columns]

        if existing_to_drop:
            logger.info(
                f"Dropping {len(existing_to_drop)} PHI columns: {existing_to_drop}"
            )
            df = df.drop(columns=existing_to_drop)

        return df

    def ingest_excel(
        self,
        source_path: str,
        output_path: str,
        sheet_name: Union[int, str] = 0,
        additional_columns_to_drop: Optional[List[str]] = None,
    ) -> IngestionResult:
        """
        Ingest Excel file with PHI stripping.

        Args:
            source_path: Path to source Excel file (must be in restricted area)
            output_path: Path for PHI-safe output (Parquet)
            sheet_name: Excel sheet to read (index or name)
            additional_columns_to_drop: Extra columns to drop beyond denylist

        Returns:
            IngestionResult with details of operation
        """
        source = Path(source_path)
        output = Path(output_path)

        result = IngestionResult(success=False, source_path=str(source))

        try:
            # GATE 1: Validate source is in restricted area
            self._validate_source_path(source)

            # GATE 2: Check source exists
            if not source.exists():
                raise FileNotFoundError(f"Source file not found: {source}")

            # Read Excel file
            logger.info(f"Reading Excel: {source} (sheet={sheet_name})")
            df = pd.read_excel(source, sheet_name=sheet_name)
            result.rows_ingested = len(df)
            result.columns_original = len(df.columns)

            logger.info(f"Loaded: {len(df):,} rows × {len(df.columns)} columns")

            # GATE 3: Identify PHI columns (denylist + datetime + suspicious names)
            columns_to_drop, phi_columns_detected = self._identify_phi_columns(df)
            result.phi_columns_detected = phi_columns_detected

            # Add any additional columns specified
            if additional_columns_to_drop:
                for col in additional_columns_to_drop:
                    if col not in columns_to_drop and col in df.columns:
                        columns_to_drop.append(col)

            # GATE 4: Drop PHI columns
            df = self._drop_phi_columns(df, columns_to_drop)
            result.phi_columns_dropped = [
                c
                for c in columns_to_drop
                if c not in df.columns or c in columns_to_drop
            ]
            result.columns_dropped = result.columns_original - len(df.columns)
            result.columns_final = len(df.columns)

            # GATE 5: Scan remaining values for PHI
            scan_result = scan_dataframe(df, self.detector)

            if scan_result.phi_detected:
                logger.warning(
                    f"PHI detected in values: {len(scan_result.flagged_rows)} rows, "
                    f"columns: {scan_result.flagged_columns}"
                )

                if self.fail_on_phi_values:
                    raise ValueError(
                        f"PHI detected in values (fail_on_phi_values=True). "
                        f"Flagged columns: {scan_result.flagged_columns}"
                    )

                # Quarantine flagged rows
                df, quarantine_path = quarantine_flagged_data(
                    df, scan_result, str(self.quarantine_base)
                )
                result.phi_rows_quarantined = len(scan_result.flagged_rows)
                result.quarantine_path = quarantine_path
                result.rows_ingested = len(df)

            # GATE 6: Ensure output directory exists
            output.parent.mkdir(parents=True, exist_ok=True)

            # GATE 7: Convert object columns to string for Parquet compatibility
            for col in df.select_dtypes(include=["object"]).columns:
                df[col] = df[col].astype(str)

            # GATE 8: Write PHI-safe output
            df.to_parquet(output, index=False, engine="pyarrow")
            result.output_path = str(output)
            result.success = True

            logger.info(result.summary())

        except Exception as e:
            result.error_message = str(e)
            logger.error(f"PHI-safe ingestion FAILED: {e}")

        return result

    def ingest_from_config(
        self, config: Dict, source_dir: Optional[str] = None
    ) -> List[IngestionResult]:
        """
        Ingest multiple files based on source_mappings.yaml config.

        Args:
            config: Parsed source_mappings.yaml configuration
            source_dir: Override source directory (default from config)

        Returns:
            List of IngestionResult for each file
        """
        results = []

        input_dir = source_dir or config.get("settings", {}).get(
            "input_dir", "data/restricted/thyroid_pilot"
        )
        output_dir = config.get("settings", {}).get("output_dir", "data/interim")

        for dataset in config.get("datasets", []):
            file_name = dataset.get("file_name")
            output_name = dataset.get("output_name")
            sheet_name = dataset.get("sheet_name", 0)

            if not file_name or not output_name:
                logger.warning(
                    f"Skipping dataset with missing file_name or output_name: {dataset}"
                )
                continue

            source_path = Path(input_dir) / file_name
            output_path = Path(output_dir) / f"{output_name}.parquet"

            result = self.ingest_excel(
                source_path=str(source_path),
                output_path=str(output_path),
                sheet_name=sheet_name,
            )
            results.append(result)

        return results


def ingest_restricted_excel(
    source_path: str,
    output_path: str,
    sheet_name: Union[int, str] = 0,
    fail_on_phi_values: bool = False,
) -> IngestionResult:
    """
    Convenience function for single-file PHI-safe ingestion.

    Args:
        source_path: Path to source Excel file (must be in restricted area)
        output_path: Path for PHI-safe output (Parquet)
        sheet_name: Excel sheet to read (index or name)
        fail_on_phi_values: If True, fail on PHI in values; if False, quarantine

    Returns:
        IngestionResult with details of operation
    """
    ingester = PHISafeIngester(fail_on_phi_values=fail_on_phi_values)
    return ingester.ingest_excel(source_path, output_path, sheet_name)


# Command-line interface
if __name__ == "__main__":
    import sys
    import yaml

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    print("=== PHI-Safe Excel Ingestion ===\n")

    # Load config
    config_path = Path("config/source_mappings.yaml")
    if not config_path.exists():
        print(f"Config not found: {config_path}")
        sys.exit(1)

    with open(config_path) as f:
        config = yaml.safe_load(f)

    # Run ingestion
    ingester = PHISafeIngester()
    results = ingester.ingest_from_config(config)

    # Summary
    print("\n" + "=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)

    success_count = sum(1 for r in results if r.success)
    print(f"\nSuccessful: {success_count}/{len(results)}")

    for r in results:
        print(f"\n{r.summary()}")

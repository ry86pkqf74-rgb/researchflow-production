"""
PHI validator wrapper.

Wraps existing PHI denylist checks from schemas/pandera/base_schema.py.
Ensures DataFrames do not contain columns from the PHI denylist.

This validator is always offline-safe (local column name check).
"""

import pandas as pd
from typing import Set

from .base import BaseValidator, ValidatorResult

# Import PHI denylist from existing base schema
from schemas.pandera.base_schema import PHI_DENYLIST


class PHIValidator(BaseValidator):
    """
    Validator that checks DataFrames for PHI columns.

    Uses the PHI_DENYLIST from schemas/pandera/base_schema.py to detect
    columns that may contain protected health information.

    Default denylist includes: dob, ssn, mrn, patient_name, address, phone, email, etc.
    """

    def __init__(self, denylist: Set[str] = None):
        """
        Initialize PHI validator.

        Args:
            denylist: Set of column names to deny (defaults to PHI_DENYLIST)
        """
        self.denylist = denylist if denylist is not None else PHI_DENYLIST

    def is_offline_safe(self) -> bool:
        """PHI check is offline-safe (local column name scan)."""
        return True

    def _validate_impl(self, artifact: pd.DataFrame) -> ValidatorResult:
        """
        Check DataFrame for PHI columns.

        Args:
            artifact: pandas DataFrame to check

        Returns:
            ValidatorResult with:
            - status: "pass" if no PHI columns, "fail" if PHI detected
            - message: Summary message
            - details: List of detected PHI columns
        """
        # Get DataFrame columns (case-insensitive check)
        df_columns_lower = {col.lower() for col in artifact.columns}
        denylist_lower = {col.lower() for col in self.denylist}

        # Find intersection (PHI columns present in DataFrame)
        phi_columns_detected = df_columns_lower.intersection(denylist_lower)

        if phi_columns_detected:
            # Map back to original column names from DataFrame
            original_phi_cols = [
                col for col in artifact.columns
                if col.lower() in phi_columns_detected
            ]

            return ValidatorResult(
                validator_name="PHIValidator",
                status="fail",
                message=f"PHI columns detected: {', '.join(sorted(original_phi_cols))}",
                details={
                    "phi_columns_detected": sorted(original_phi_cols),
                    "total_phi_columns": len(original_phi_cols),
                    "total_columns": len(artifact.columns),
                    "denylist_size": len(self.denylist),
                }
            )
        else:
            return ValidatorResult(
                validator_name="PHIValidator",
                status="pass",
                message=f"No PHI columns detected ({len(artifact.columns)} columns checked)",
                details={
                    "columns_checked": list(artifact.columns),
                    "total_columns": len(artifact.columns),
                    "denylist_size": len(self.denylist),
                }
            )

    def __repr__(self) -> str:
        """Return string representation."""
        return f"PHIValidator(denylist_size={len(self.denylist)}, offline_safe=True)"

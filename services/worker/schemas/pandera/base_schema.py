"""
Base Schema Module for Thyroid Pilot Datasets.

Provides common validation patterns and PHI checking integration
for all thyroid dataset schemas.

Design Principles:
- All schemas require canonical `research_id` linkage key
- PHI columns are explicitly blocked via denylist
- Schemas are non-strict (allow extra columns) during discovery
- Version tracking for schema evolution
"""

import pandera as pa
from pandera.typing import Series
from typing import Set

__version__ = "v1.0.0"


# -----------------------------------------------------------------------------
# PHI Column Denylist (blocked by all schemas)
# -----------------------------------------------------------------------------

PHI_DENYLIST: Set[str] = {
    # Direct identifiers
    "dob",
    "date_of_birth",
    "DOB",
    "DateOfBirth",
    "birth_date",
    "ssn",
    "social_security",
    "SSN",
    "mrn",
    "medical_record_number",
    "MRN",
    "Patient_MRN",
    "patient_name",
    "PatientName",
    "name",
    "full_name",
    "first_name",
    "last_name",
    "middle_name",
    "address",
    "street",
    "city",
    "zip",
    "zipcode",
    "postal_code",
    "phone",
    "telephone",
    "mobile",
    "fax",
    "email",
    "email_address",
    # Indirect identifiers that may appear
    "Patient_DOB",
    "Patient_SSN",
    "Patient_SSN_Last4",
    "Other_Identifiers",
}


def contains_phi_columns(columns: list) -> list:
    """
    Check if column list contains any PHI columns.

    Args:
        columns: List of column names

    Returns:
        List of PHI columns found (empty if none)
    """
    found = []
    columns_lower = {c.lower(): c for c in columns}

    for phi_col in PHI_DENYLIST:
        if phi_col.lower() in columns_lower:
            found.append(columns_lower[phi_col.lower()])

    return found


# -----------------------------------------------------------------------------
# Custom Pandera Checks
# -----------------------------------------------------------------------------


def check_no_phi_columns(df) -> bool:
    """
    Check that DataFrame contains no PHI columns.

    For use in pandera @pa.check decorators.
    """
    phi_found = contains_phi_columns(list(df.columns))
    if phi_found:
        raise pa.errors.SchemaError(
            schema=None,
            data=df,
            message=f"PHI columns detected and blocked: {phi_found}",
        )
    return True


# -----------------------------------------------------------------------------
# Base Schema Configuration
# -----------------------------------------------------------------------------


class BaseThyroidSchemaConfig:
    """
    Base configuration for all thyroid dataset schemas.

    - strict=False: Allow additional columns (discovery phase)
    - coerce=True: Attempt type coercion
    """

    strict = False
    coerce = True


# -----------------------------------------------------------------------------
# Linkage Key Validators
# -----------------------------------------------------------------------------

# These are reusable field definitions for the canonical linkage key
# Note: research_id can be int or str depending on source
RESEARCH_ID_INT = pa.Field(
    nullable=False, description="De-identified patient research ID (integer)"
)

RESEARCH_ID_STR = pa.Field(
    nullable=False, description="De-identified patient research ID (string)"
)

"""
PHI Pattern Definitions - AUTO-GENERATED

Source: shared/phi/phi_patterns.v1.json
Generated: 2026-01-20T17:59:45.395619+00:00
Version: 1.0.0

DO NOT EDIT MANUALLY - regenerate with:
    python scripts/governance/generate_phi_patterns.py
"""

import re
from typing import List, Tuple


# ---------------------------------------------------------------------------
# Tier 1: HIGH_CONFIDENCE patterns (upload + egress safe)
# ---------------------------------------------------------------------------

PHI_PATTERNS_HIGH_CONFIDENCE: List[Tuple[str, re.Pattern]] = [
    # Social Security Number (with or without separators)
    ("SSN", re.compile(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b")),
    # Email Address
    ("EMAIL", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", re.IGNORECASE)),
    # US Phone Number
    ("PHONE", re.compile(r"\b(?:\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b")),
    # Medical Record Number
    ("MRN", re.compile(r"\b(?:MRN|MR#|Medical Record|Patient ID)[:\s#]*[A-Z0-9]{6,12}\b", re.IGNORECASE)),
]


# ---------------------------------------------------------------------------
# Tier 2: Extended patterns (output/export guarding; may false-positive)
# ---------------------------------------------------------------------------

PHI_PATTERNS_EXTENDED: List[Tuple[str, re.Pattern]] = [
    # Name with Title (Dr., Mr., Mrs., Ms.)
    ("NAME", re.compile(r"\b(?:Dr\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b")),
    # Patient/Subject Name
    ("NAME", re.compile(r"\b(?:Patient|Subject)[:\s]+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b")),
    # ZIP Code (5 or 9 digit)
    ("ZIP_CODE", re.compile(r"\b\d{5}(?:-\d{4})?\b")),
    # Street Address
    ("ADDRESS", re.compile(r"\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b", re.IGNORECASE)),
    # Date (MM/DD/YYYY or MM-DD-YYYY)
    ("DOB", re.compile(r"\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b")),
    # Date (Month Day, Year)
    ("DOB", re.compile(r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b", re.IGNORECASE)),
    # Date (YYYY-MM-DD ISO format)
    ("DOB", re.compile(r"\b(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])\b")),
    # Health Plan Beneficiary Number
    ("HEALTH_PLAN", re.compile(r"\b(?:Member|Policy|Plan)[\s#:]*[A-Z0-9]{6,15}\b", re.IGNORECASE)),
    # Account Number
    ("ACCOUNT", re.compile(r"\b(?:Account|Acct)[:\s#]*\d{8,16}\b", re.IGNORECASE)),
    # License Number
    ("LICENSE", re.compile(r"\b(?:License|DL|Driver's License)[:\s#]*[A-Z0-9]{6,12}\b", re.IGNORECASE)),
    # Device Identifier
    ("DEVICE_ID", re.compile(r"\b(?:Device|Serial|IMEI)[:\s#]*[A-Z0-9]{10,20}\b", re.IGNORECASE)),
    # Web URL
    ("URL", re.compile(r"https?://(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)", re.IGNORECASE)),
    # IPv4 Address
    ("IP_ADDRESS", re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b")),
    # Age over 89 years
    ("AGE_OVER_89", re.compile(r"\b(?:age|aged?)[:\s]+(?:9\d|[1-9]\d{2,})\b", re.IGNORECASE)),
]


# Backwards-compatible alias used across the repo for upload/egress gating.
PHI_PATTERNS: List[Tuple[str, re.Pattern]] = PHI_PATTERNS_HIGH_CONFIDENCE

# Stricter set for output/export contexts.
PHI_PATTERNS_OUTPUT_GUARD: List[Tuple[str, re.Pattern]] = (
    PHI_PATTERNS_HIGH_CONFIDENCE + PHI_PATTERNS_EXTENDED
)


# Runtime validation
for patterns in (PHI_PATTERNS_HIGH_CONFIDENCE, PHI_PATTERNS_EXTENDED):
    for pattern_name, pattern_regex in patterns:
        if not isinstance(pattern_regex, re.Pattern):
            raise TypeError(
                f"PHI pattern {pattern_name} must be a compiled regex Pattern"
            )

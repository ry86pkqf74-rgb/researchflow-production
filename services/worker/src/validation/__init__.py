"""
Validation Module
Phase A - Task 11: Unzip + Virus Scan with ClamAV
"""

from .archive_validator import (
    ArchiveValidator,
    ArchiveValidationError,
    ArchiveValidationResult,
    validate_and_extract_archive
)

from .virus_scanner import (
    VirusScanner,
    VirusScanError,
    VirusScanResult,
    scan_file,
    quarantine_file
)

__all__ = [
    # Archive validation
    "ArchiveValidator",
    "ArchiveValidationError",
    "ArchiveValidationResult",
    "validate_and_extract_archive",
    # Virus scanning
    "VirusScanner",
    "VirusScanError",
    "VirusScanResult",
    "scan_file",
    "quarantine_file"
]

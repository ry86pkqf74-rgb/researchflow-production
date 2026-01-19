"""
Secure Archive Extraction with Safety Checks
Phase A - Task 11: Unzip + Virus Scan with ClamAV

Provides secure extraction of zip archives with protection against:
- Zip slip attacks (path traversal)
- Zip bombs (excessive extraction size)
- Deeply nested archives
"""

import zipfile
import os
from pathlib import Path
from typing import List
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

# Security limits
MAX_ARCHIVE_SIZE = 500 * 1024 * 1024  # 500 MB
MAX_EXTRACTED_SIZE = 1024 * 1024 * 1024  # 1 GB
MAX_NESTING_LEVEL = 3


@dataclass(frozen=True)
class ArchiveValidationResult:
    """Result of archive validation and extraction"""
    extracted_files: List[str]
    total_size: int
    nesting_level: int
    success: bool


class ArchiveValidationError(ValueError):
    """Raised when archive validation fails (fail-closed)"""
    pass


class ArchiveValidator:
    """
    Secure archive extraction with safety validations

    Following ResearchFlow patterns:
    - Fail-closed: Raises exceptions on validation failure
    - Prevents zip slip attacks
    - Enforces size and nesting limits
    - Recursive extraction with depth tracking
    """

    def __init__(
        self,
        max_archive_size: int = MAX_ARCHIVE_SIZE,
        max_extracted_size: int = MAX_EXTRACTED_SIZE,
        max_nesting_level: int = MAX_NESTING_LEVEL
    ):
        self.max_archive_size = max_archive_size
        self.max_extracted_size = max_extracted_size
        self.max_nesting_level = max_nesting_level

    def validate_and_extract(
        self,
        archive_path: str,
        extract_to: str,
        nesting_level: int = 0
    ) -> ArchiveValidationResult:
        """
        Securely validate and extract archive

        Args:
            archive_path: Path to archive file
            extract_to: Directory to extract files to
            nesting_level: Current nesting depth (internal)

        Returns:
            ArchiveValidationResult with extracted file paths

        Raises:
            ArchiveValidationError: If validation fails (fail-closed)
        """
        # Validate nesting level
        if nesting_level > self.max_nesting_level:
            raise ArchiveValidationError(
                f"Nested archives exceed limit: {nesting_level} > {self.max_nesting_level}"
            )

        # Validate archive exists
        if not os.path.exists(archive_path):
            raise ArchiveValidationError(f"Archive not found: {archive_path}")

        # Validate archive size
        archive_size = os.path.getsize(archive_path)
        if archive_size > self.max_archive_size:
            raise ArchiveValidationError(
                f"Archive too large: {archive_size} > {self.max_archive_size}"
            )

        logger.info(
            f"Validating archive {archive_path} "
            f"(size={archive_size}, nesting={nesting_level})"
        )

        extracted_files = []

        try:
            with zipfile.ZipFile(archive_path, 'r') as zf:
                # Validate archive integrity
                if zf.testzip() is not None:
                    raise ArchiveValidationError("Archive integrity check failed")

                # Check for zip slip vulnerability
                self._check_zip_slip(zf, extract_to)

                # Check total extracted size (zip bomb protection)
                total_size = self._check_extracted_size(zf)

                # Create extraction directory
                os.makedirs(extract_to, exist_ok=True)

                # Extract all files
                zf.extractall(extract_to)

                logger.info(f"Extracted {len(zf.namelist())} files to {extract_to}")

                # Process extracted files (check for nested archives)
                for root, dirs, files in os.walk(extract_to):
                    for file in files:
                        file_path = os.path.join(root, file)

                        # Recursively extract nested archives
                        if file.lower().endswith('.zip'):
                            logger.info(f"Found nested archive: {file}")

                            nested_extract = f"{file_path}_extracted"
                            os.makedirs(nested_extract, exist_ok=True)

                            nested_result = self.validate_and_extract(
                                file_path,
                                nested_extract,
                                nesting_level + 1
                            )

                            extracted_files.extend(nested_result.extracted_files)
                        else:
                            extracted_files.append(file_path)

            return ArchiveValidationResult(
                extracted_files=extracted_files,
                total_size=total_size,
                nesting_level=nesting_level,
                success=True
            )

        except zipfile.BadZipFile as e:
            raise ArchiveValidationError(f"Invalid zip archive: {e}")

        except Exception as e:
            raise ArchiveValidationError(f"Archive extraction failed: {e}")

    def _check_zip_slip(self, zf: zipfile.ZipFile, extract_to: str) -> None:
        """
        Check for zip slip vulnerability (path traversal)

        Raises:
            ArchiveValidationError: If zip slip detected
        """
        extract_to_path = Path(extract_to).resolve()

        for member in zf.namelist():
            # Resolve member path
            member_path = (extract_to_path / member).resolve()

            # Check if member path is within extraction directory
            try:
                member_path.relative_to(extract_to_path)
            except ValueError:
                raise ArchiveValidationError(
                    f"Zip slip detected: {member} attempts path traversal"
                )

    def _check_extracted_size(self, zf: zipfile.ZipFile) -> int:
        """
        Check total extracted size (zip bomb protection)

        Returns:
            Total extracted size in bytes

        Raises:
            ArchiveValidationError: If extracted size exceeds limit
        """
        total_size = sum(info.file_size for info in zf.infolist())

        if total_size > self.max_extracted_size:
            raise ArchiveValidationError(
                f"Extracted size too large: {total_size} > {self.max_extracted_size}"
            )

        return total_size


def validate_and_extract_archive(
    archive_path: str,
    extract_to: str
) -> List[str]:
    """
    Convenience function for archive extraction

    Args:
        archive_path: Path to archive file
        extract_to: Directory to extract files to

    Returns:
        List of extracted file paths

    Raises:
        ArchiveValidationError: If validation fails
    """
    validator = ArchiveValidator()
    result = validator.validate_and_extract(archive_path, extract_to)
    return result.extracted_files

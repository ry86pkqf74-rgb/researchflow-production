"""Plagiarism Provider Interface and Data Types.

This module defines the abstract interface for plagiarism check providers
and the data types used for results.

Design Principles:
- PHI-safe: matched text is stored as SHA256 hash, never raw text
- Fail-closed: providers should raise on any error
- Metadata-only: results contain no PHI
"""

from __future__ import annotations

import hashlib
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Protocol

logger = logging.getLogger(__name__)


class ProviderStatus(Enum):
    """Status of a plagiarism check provider.

    Attributes:
        AVAILABLE: Provider is configured and ready
        UNAVAILABLE: Provider is not configured (missing API keys)
        ERROR: Provider encountered an error
        RATE_LIMITED: Provider is temporarily rate limited
        SANDBOX: Provider is running in sandbox/test mode
    """
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    ERROR = "ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    SANDBOX = "SANDBOX"


class PlagiarismCheckError(Exception):
    """Exception raised when plagiarism check fails.

    This exception is raised for:
    - API errors from plagiarism providers
    - Configuration errors (missing API keys)
    - Rate limiting
    - Network errors

    Attributes:
        message: Human-readable error description
        reason_code: Machine-readable reason code
        safe_message: PHI-free message safe for logging
        is_retriable: Whether the error may resolve on retry
    """

    def __init__(
        self,
        message: str,
        reason_code: str,
        is_retriable: bool = False,
    ):
        self.message = message
        self.reason_code = reason_code
        self.is_retriable = is_retriable
        # Generate safe message without any potentially sensitive content
        self.safe_message = f"Plagiarism check failed: {reason_code}"
        super().__init__(self.safe_message)

    def __str__(self) -> str:
        return self.safe_message


@dataclass(frozen=True)
class PlagiarismMatch:
    """A single plagiarism match from a source.

    PHI Safety: The matched_text_hash contains only a SHA256 hash of the
    matched text, never the raw text itself. This ensures no PHI can leak
    through plagiarism match results.

    Attributes:
        source_url: URL of the matching source
        source_title: Title of the matching source document
        matched_text_hash: SHA256 hash of the matched text (never raw text)
        similarity: Similarity score for this match (0-1)
        start_position: Start position in the checked document
        end_position: End position in the checked document
    """
    source_url: str
    source_title: str
    matched_text_hash: str  # SHA256 of matched text - NEVER store raw text for PHI
    similarity: float
    start_position: int
    end_position: int

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "sourceUrl": self.source_url,
            "sourceTitle": self.source_title,
            "matchedTextHash": self.matched_text_hash,
            "similarity": self.similarity,
            "startPosition": self.start_position,
            "endPosition": self.end_position,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PlagiarismMatch":
        """Create from dictionary (handles both camelCase and snake_case)."""
        return cls(
            source_url=data.get("sourceUrl") or data.get("source_url", ""),
            source_title=data.get("sourceTitle") or data.get("source_title", ""),
            matched_text_hash=data.get("matchedTextHash") or data.get("matched_text_hash", ""),
            similarity=float(data.get("similarity", 0.0)),
            start_position=int(data.get("startPosition") or data.get("start_position", 0)),
            end_position=int(data.get("endPosition") or data.get("end_position", 0)),
        )


@dataclass(frozen=True)
class PlagiarismResult:
    """Result of a plagiarism check.

    Attributes:
        similarity_score: Overall similarity score (0-1, where 0 = no plagiarism)
        matches: List of individual plagiarism matches
        provider: Name of the provider that performed the check
        checked_at: Timestamp when the check was performed
        document_id: ID of the document that was checked
        scan_id: Provider-specific scan/check ID for reference
        is_mock: Whether this result is from a mock provider
    """
    similarity_score: float  # 0-1 where 0 = no plagiarism, 1 = 100% plagiarized
    matches: List[PlagiarismMatch]
    provider: str
    checked_at: datetime
    document_id: str = ""
    scan_id: str = ""
    is_mock: bool = False

    def __post_init__(self):
        """Validate similarity score is in valid range."""
        if not 0 <= self.similarity_score <= 1:
            raise ValueError(
                f"similarity_score must be between 0 and 1, got {self.similarity_score}"
            )

    @property
    def passed(self) -> bool:
        """Check if the document passed plagiarism check (low similarity)."""
        # Threshold for passing: less than 10% similarity
        return self.similarity_score < 0.10

    @property
    def match_count(self) -> int:
        """Get the number of matches found."""
        return len(self.matches)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "similarityScore": self.similarity_score,
            "matches": [m.to_dict() for m in self.matches],
            "provider": self.provider,
            "checkedAt": self.checked_at.isoformat(),
            "documentId": self.document_id,
            "scanId": self.scan_id,
            "isMock": self.is_mock,
            "passed": self.passed,
            "matchCount": self.match_count,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PlagiarismResult":
        """Create from dictionary (handles both camelCase and snake_case)."""
        matches_data = data.get("matches", [])
        matches = [PlagiarismMatch.from_dict(m) for m in matches_data]

        checked_at_str = data.get("checkedAt") or data.get("checked_at")
        if isinstance(checked_at_str, str):
            checked_at = datetime.fromisoformat(checked_at_str)
        elif isinstance(checked_at_str, datetime):
            checked_at = checked_at_str
        else:
            checked_at = datetime.now(timezone.utc)

        return cls(
            similarity_score=float(data.get("similarityScore") or data.get("similarity_score", 0.0)),
            matches=matches,
            provider=data.get("provider", "unknown"),
            checked_at=checked_at,
            document_id=data.get("documentId") or data.get("document_id", ""),
            scan_id=data.get("scanId") or data.get("scan_id", ""),
            is_mock=bool(data.get("isMock") or data.get("is_mock", False)),
        )


def hash_matched_text(text: str) -> str:
    """Generate SHA256 hash of matched text for PHI-safe storage.

    This function should ALWAYS be used instead of storing raw matched text.
    The hash ensures we can identify duplicate matches without exposing any
    potentially sensitive content.

    Args:
        text: The matched text to hash

    Returns:
        Lowercase hexadecimal SHA256 hash
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class PlagiarismProvider(ABC):
    """Abstract base class for plagiarism check providers.

    All plagiarism providers must implement this interface.
    Providers should:
    - Return PlagiarismResult on success
    - Raise PlagiarismCheckError on failure
    - Never expose raw matched text (use hash_matched_text)
    - Be aware of rate limiting
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Get the provider name."""
        ...

    @abstractmethod
    def check(self, text: str, document_id: str) -> PlagiarismResult:
        """Perform a plagiarism check on the given text.

        Args:
            text: The text to check for plagiarism
            document_id: Unique identifier for the document

        Returns:
            PlagiarismResult with similarity score and matches

        Raises:
            PlagiarismCheckError: If the check fails
        """
        ...

    @abstractmethod
    def get_status(self) -> ProviderStatus:
        """Get the current status of the provider.

        Returns:
            ProviderStatus indicating availability
        """
        ...


class PlagiarismProviderProtocol(Protocol):
    """Protocol for plagiarism providers (for type checking).

    This protocol allows duck-typing of providers without requiring
    inheritance from the abstract base class.
    """

    @property
    def name(self) -> str:
        """Get the provider name."""
        ...

    def check(self, text: str, document_id: str) -> PlagiarismResult:
        """Perform a plagiarism check on the given text."""
        ...

    def get_status(self) -> ProviderStatus:
        """Get the current status of the provider."""
        ...

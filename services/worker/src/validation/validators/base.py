"""
Base validator classes and result types for the validation suite registry.

This module defines the core abstractions for validation:
- ValidatorResult: Individual validator result
- ValidationResult: Aggregated suite result
- BaseValidator: Abstract base class with offline enforcement

All validators must implement:
1. is_offline_safe() → bool
2. _validate_impl(artifact) → ValidatorResult

The validate() method enforces offline constraints and should not be overridden.
"""

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional


@dataclass
class ValidatorResult:
    """
    Individual validator result.

    Attributes:
        validator_name: Name of the validator class
        status: Validation status (pass, fail, warn)
        message: Human-readable validation message
        details: Optional dict with additional validation details
    """
    validator_name: str
    status: Literal["pass", "fail", "warn"]
    message: str
    details: Optional[Dict[str, Any]] = None


@dataclass
class ValidationResult:
    """
    Aggregated suite result from multiple validators.

    Attributes:
        suite_id: Unique identifier for the validation suite
        overall_status: Aggregated status (fail > warn > pass)
        validator_results: List of individual validator results
        timestamp: ISO 8601 timestamp of validation
        artifact_path: Path to validated artifact (or description)
    """
    suite_id: str
    overall_status: Literal["pass", "fail", "warn"]
    validator_results: List[ValidatorResult] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    artifact_path: str = ""

    @staticmethod
    def merge_status(statuses: List[str]) -> str:
        """
        Merge multiple statuses using fail > warn > pass precedence.

        Args:
            statuses: List of status strings ("pass", "fail", "warn")

        Returns:
            Merged status using precedence rules:
            - If any status is "fail", return "fail"
            - If any status is "warn" (and no fails), return "warn"
            - Otherwise return "pass"
        """
        if not statuses:
            return "pass"

        if "fail" in statuses:
            return "fail"
        elif "warn" in statuses:
            return "warn"
        else:
            return "pass"

    def aggregate_from_results(self, results: List[ValidatorResult]) -> None:
        """
        Aggregate validator results and set overall status.

        Args:
            results: List of ValidatorResult objects
        """
        self.validator_results = results
        statuses = [r.status for r in results]
        self.overall_status = self.merge_status(statuses)


class BaseValidator(ABC):
    """
    Abstract base class for all validators.

    All validators must implement:
    - is_offline_safe(): Return True if validator makes no network calls
    - _validate_impl(artifact): Implement validation logic

    The public validate() method enforces offline constraints and should NOT be overridden.
    """

    @abstractmethod
    def is_offline_safe(self) -> bool:
        """
        Return True if this validator is safe to run in offline mode.

        A validator is offline-safe if it:
        - Makes no network calls
        - Reads only local files
        - Does not depend on external services

        Returns:
            True if offline-safe, False otherwise
        """
        pass

    @abstractmethod
    def _validate_impl(self, artifact: Any) -> ValidatorResult:
        """
        Implement validator-specific validation logic.

        This method should contain the actual validation logic.
        It will only be called if offline constraints are satisfied.

        Args:
            artifact: The artifact to validate (DataFrame, Path, dict, etc.)

        Returns:
            ValidatorResult with status, message, and optional details
        """
        pass

    def validate(self, artifact: Any) -> ValidatorResult:
        """
        Public validation method with offline guard.

        This method enforces offline constraints before delegating to _validate_impl().
        DO NOT override this method in subclasses.

        Args:
            artifact: The artifact to validate

        Returns:
            ValidatorResult from _validate_impl()

        Raises:
            RuntimeError: If validator requires network but NO_NETWORK=1
        """
        # CRITICAL: Enforce offline constraint at runtime
        if not self.is_offline_safe() and os.getenv("NO_NETWORK") == "1":
            raise RuntimeError(
                f"{self.__class__.__name__} requires network but NO_NETWORK=1. "
                f"This validator cannot run in offline CI mode."
            )

        return self._validate_impl(artifact)

    def __repr__(self) -> str:
        """Return string representation of validator."""
        return f"{self.__class__.__name__}(offline_safe={self.is_offline_safe()})"

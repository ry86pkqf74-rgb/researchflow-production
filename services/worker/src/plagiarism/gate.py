"""Plagiarism Approval Gate for Research Operating System.

This module implements governance controls for plagiarism checking,
enforcing approval requirements before calling external APIs in LIVE mode.

Design Principles:
- LIVE mode: requires approval before external API calls
- DEMO mode: uses mock provider, no approval required
- Fail-closed: block export if plagiarism check required but cannot run
- Full audit trail for all plagiarism check decisions

See: docs/governance/CAPABILITIES.md
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .provider import (
    PlagiarismCheckError,
    PlagiarismProvider,
    PlagiarismResult,
    ProviderStatus,
)
from .mock_provider import MockPlagiarismProvider
from .copyleaks_provider import CopyleaksProvider, get_copyleaks_provider

logger = logging.getLogger(__name__)


class PlagiarismAuditAction(Enum):
    """Actions tracked in the plagiarism audit log.

    PLAGIARISM_CHECK_REQUESTED: User/system requested a plagiarism check
    PLAGIARISM_CHECK_APPROVED: Approval granted for external API call
    PLAGIARISM_CHECK_BLOCKED: Check blocked due to missing approval
    PLAGIARISM_CHECK_COMPLETED: Check finished with results
    PLAGIARISM_CHECK_FAILED: Check failed with error
    PLAGIARISM_EXPORT_BLOCKED: Export blocked due to failed/missing check
    """
    PLAGIARISM_CHECK_REQUESTED = "PLAGIARISM_CHECK_REQUESTED"
    PLAGIARISM_CHECK_APPROVED = "PLAGIARISM_CHECK_APPROVED"
    PLAGIARISM_CHECK_BLOCKED = "PLAGIARISM_CHECK_BLOCKED"
    PLAGIARISM_CHECK_COMPLETED = "PLAGIARISM_CHECK_COMPLETED"
    PLAGIARISM_CHECK_FAILED = "PLAGIARISM_CHECK_FAILED"
    PLAGIARISM_EXPORT_BLOCKED = "PLAGIARISM_EXPORT_BLOCKED"


@dataclass
class PlagiarismAuditEntry:
    """Audit log entry for plagiarism check decisions."""
    audit_id: str
    timestamp: datetime
    action: PlagiarismAuditAction
    document_id: Optional[str] = None
    provider: Optional[str] = None
    mode: Optional[str] = None
    similarity_score: Optional[float] = None
    passed: Optional[bool] = None
    approved_by: Optional[str] = None
    reason: Optional[str] = None
    metadata: Dict = field(default_factory=dict)
    log_hash: str = ""
    prev_log_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization (camelCase for frontend)."""
        return {
            "auditId": self.audit_id,
            "timestamp": self.timestamp.isoformat(),
            "action": self.action.value,
            "documentId": self.document_id,
            "provider": self.provider,
            "mode": self.mode,
            "similarityScore": self.similarity_score,
            "passed": self.passed,
            "approvedBy": self.approved_by,
            "reason": self.reason,
            "metadata": self.metadata,
            "logHash": self.log_hash,
            "prevLogHash": self.prev_log_hash,
        }

    def to_storage_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for file storage (snake_case)."""
        return {
            "audit_id": self.audit_id,
            "timestamp": self.timestamp.isoformat(),
            "action": self.action.value,
            "document_id": self.document_id,
            "provider": self.provider,
            "mode": self.mode,
            "similarity_score": self.similarity_score,
            "passed": self.passed,
            "approved_by": self.approved_by,
            "reason": self.reason,
            "metadata": self.metadata,
            "log_hash": self.log_hash,
            "prev_log_hash": self.prev_log_hash,
        }


class PlagiarismAuditLogger:
    """Immutable audit logger for plagiarism check decisions.

    Maintains a tamper-evident hash chain of all plagiarism check decisions.
    """

    def __init__(
        self,
        log_file: Path = Path("data/governance/plagiarism_audit.json"),
    ):
        """Initialize the plagiarism audit logger.

        Args:
            log_file: Path to the audit log file
        """
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        self._entries: List[PlagiarismAuditEntry] = []
        self._load_log()

    def _load_log(self) -> None:
        """Load existing audit log if present."""
        if self.log_file.exists():
            try:
                with open(self.log_file, "r") as f:
                    data = json.load(f)
                    for entry_data in data.get("entries", []):
                        entry = PlagiarismAuditEntry(
                            audit_id=entry_data["audit_id"],
                            timestamp=datetime.fromisoformat(entry_data["timestamp"]),
                            action=PlagiarismAuditAction(entry_data["action"]),
                            document_id=entry_data.get("document_id"),
                            provider=entry_data.get("provider"),
                            mode=entry_data.get("mode"),
                            similarity_score=entry_data.get("similarity_score"),
                            passed=entry_data.get("passed"),
                            approved_by=entry_data.get("approved_by"),
                            reason=entry_data.get("reason"),
                            metadata=entry_data.get("metadata", {}),
                            log_hash=entry_data.get("log_hash", ""),
                            prev_log_hash=entry_data.get("prev_log_hash", ""),
                        )
                        self._entries.append(entry)
                logger.info(f"Loaded plagiarism audit log: {len(self._entries)} entries")
            except Exception as e:
                logger.warning(f"Failed to load plagiarism audit log: {e}. Starting fresh.")
                self._entries = []
        else:
            logger.info("Initialized new plagiarism audit log")

    def _get_last_hash(self) -> str:
        """Get hash of most recent log entry."""
        if not self._entries:
            return hashlib.sha256(b"PLAGIARISM_AUDIT_GENESIS").hexdigest()[:16]
        return self._entries[-1].log_hash

    def _compute_hash(self, entry_dict: Dict, prev_hash: str) -> str:
        """Compute cryptographic hash of log entry."""
        hash_input = json.dumps(entry_dict, sort_keys=True, default=str) + prev_hash
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

    def _generate_audit_id(self) -> str:
        """Generate unique audit ID."""
        return f"PLAG_AUDIT_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{len(self._entries):06d}"

    def log_action(
        self,
        action: PlagiarismAuditAction,
        document_id: Optional[str] = None,
        provider: Optional[str] = None,
        mode: Optional[str] = None,
        similarity_score: Optional[float] = None,
        passed: Optional[bool] = None,
        approved_by: Optional[str] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> str:
        """Log a plagiarism check action.

        Args:
            action: Type of audit action
            document_id: Document being checked
            provider: Plagiarism provider used
            mode: Operating mode (DEMO, LIVE, etc.)
            similarity_score: Result similarity score
            passed: Whether the check passed
            approved_by: User who approved (if applicable)
            reason: Reason for blocking/failure
            metadata: Additional metadata

        Returns:
            Audit ID for the logged entry
        """
        audit_id = self._generate_audit_id()
        timestamp = datetime.now(timezone.utc)
        prev_hash = self._get_last_hash()

        entry_dict = {
            "audit_id": audit_id,
            "timestamp": timestamp.isoformat(),
            "action": action.value,
            "document_id": document_id,
            "provider": provider,
            "mode": mode,
            "similarity_score": similarity_score,
            "passed": passed,
            "approved_by": approved_by,
            "reason": reason,
            "metadata": metadata or {},
            "prev_log_hash": prev_hash,
        }

        log_hash = self._compute_hash(entry_dict, prev_hash)

        entry = PlagiarismAuditEntry(
            audit_id=audit_id,
            timestamp=timestamp,
            action=action,
            document_id=document_id,
            provider=provider,
            mode=mode,
            similarity_score=similarity_score,
            passed=passed,
            approved_by=approved_by,
            reason=reason,
            metadata=metadata or {},
            log_hash=log_hash,
            prev_log_hash=prev_hash,
        )

        self._entries.append(entry)
        logger.debug(f"Logged plagiarism action: {audit_id} ({action.value})")

        return audit_id

    def save(self) -> None:
        """Save audit log to file."""
        data = {
            "version": "1.0",
            "created": datetime.now(timezone.utc).isoformat(),
            "entry_count": len(self._entries),
            "entries": [entry.to_storage_dict() for entry in self._entries],
        }
        with open(self.log_file, "w") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Saved plagiarism audit log: {len(self._entries)} entries")

    def get_entries(
        self,
        document_id: Optional[str] = None,
        action: Optional[PlagiarismAuditAction] = None,
    ) -> List[Dict]:
        """Query audit log with filters."""
        filtered = self._entries

        if document_id:
            filtered = [e for e in filtered if e.document_id == document_id]

        if action:
            filtered = [e for e in filtered if e.action == action]

        return [e.to_dict() for e in filtered]


class PlagiarismGate:
    """Manages plagiarism check approval and provider selection.

    In LIVE mode, external plagiarism APIs require explicit approval.
    In DEMO mode, mock provider is used without approval.
    """

    def __init__(
        self,
        mode: Optional[str] = None,
        persist_audit: bool = True,
    ):
        """Initialize the plagiarism gate.

        Args:
            mode: Operating mode (DEMO, LIVE, etc.). If None, reads from ROS_MODE env.
            persist_audit: Whether to persist audit entries to file
        """
        self._mode = mode or os.getenv("ROS_MODE", "DEMO").upper()
        self._approved_documents: Dict[str, str] = {}  # document_id -> approved_by
        self._audit_logger = PlagiarismAuditLogger() if persist_audit else None
        self._persist_audit = persist_audit

        logger.info(f"Plagiarism gate initialized: mode={self._mode}")

    @property
    def mode(self) -> str:
        """Get current operating mode."""
        return self._mode

    @property
    def is_live_mode(self) -> bool:
        """Check if operating in LIVE mode."""
        return self._mode == "LIVE"

    def get_provider(self) -> PlagiarismProvider:
        """Get the appropriate plagiarism provider for the current mode.

        In DEMO/STANDBY mode, always returns mock provider.
        In LIVE mode, returns Copyleaks if configured, otherwise mock.

        Returns:
            Configured PlagiarismProvider instance
        """
        if not self.is_live_mode:
            logger.debug(f"Using mock provider for mode={self._mode}")
            return MockPlagiarismProvider(demo_mode=True)

        # LIVE mode: try to get Copyleaks
        copyleaks = get_copyleaks_provider()
        if copyleaks and copyleaks.get_status() != ProviderStatus.UNAVAILABLE:
            logger.debug("Using Copyleaks provider for LIVE mode")
            return copyleaks

        # Fall back to mock if Copyleaks not configured
        logger.warning(
            "Copyleaks not configured in LIVE mode, falling back to mock provider"
        )
        return MockPlagiarismProvider(demo_mode=False)

    def requires_approval(self, document_id: str) -> bool:
        """Check if a plagiarism check requires approval.

        In LIVE mode with external API, approval is required.
        In DEMO mode or with mock provider, no approval needed.

        Args:
            document_id: ID of document to check

        Returns:
            True if approval is required before check
        """
        if not self.is_live_mode:
            return False

        # Check if Copyleaks is configured (external API)
        copyleaks = get_copyleaks_provider()
        if copyleaks and copyleaks.get_status() != ProviderStatus.UNAVAILABLE:
            # LIVE mode with external API requires approval
            return document_id not in self._approved_documents

        return False

    def is_approved(self, document_id: str) -> bool:
        """Check if a document has approval for plagiarism check.

        Args:
            document_id: ID of document to check

        Returns:
            True if document has approval (or approval not required)
        """
        return not self.requires_approval(document_id)

    def approve(self, document_id: str, approved_by: str) -> None:
        """Approve a document for plagiarism check.

        Args:
            document_id: ID of document to approve
            approved_by: User providing approval
        """
        self._approved_documents[document_id] = approved_by

        if self._audit_logger:
            self._audit_logger.log_action(
                action=PlagiarismAuditAction.PLAGIARISM_CHECK_APPROVED,
                document_id=document_id,
                approved_by=approved_by,
                mode=self._mode,
            )
            self._audit_logger.save()

        logger.info(f"Plagiarism check approved: document_id={document_id}, by={approved_by}")

    def check(
        self,
        text: str,
        document_id: str,
    ) -> PlagiarismResult:
        """Perform a plagiarism check with gate enforcement.

        In LIVE mode, raises error if approval is required but not granted.
        Logs all check actions to audit trail.

        Args:
            text: The text to check for plagiarism
            document_id: Unique identifier for the document

        Returns:
            PlagiarismResult with similarity score and matches

        Raises:
            PlagiarismCheckError: If approval required but not granted,
                or if check fails
        """
        # Log check request
        if self._audit_logger:
            self._audit_logger.log_action(
                action=PlagiarismAuditAction.PLAGIARISM_CHECK_REQUESTED,
                document_id=document_id,
                mode=self._mode,
            )

        # Check approval requirement
        if self.requires_approval(document_id):
            if self._audit_logger:
                self._audit_logger.log_action(
                    action=PlagiarismAuditAction.PLAGIARISM_CHECK_BLOCKED,
                    document_id=document_id,
                    mode=self._mode,
                    reason="Approval required for external API call in LIVE mode",
                )
                self._audit_logger.save()

            raise PlagiarismCheckError(
                "Plagiarism check requires approval in LIVE mode",
                reason_code="APPROVAL_REQUIRED",
                is_retriable=False,
            )

        # Get provider and run check
        provider = self.get_provider()

        try:
            result = provider.check(text, document_id)

            # Log completion
            if self._audit_logger:
                self._audit_logger.log_action(
                    action=PlagiarismAuditAction.PLAGIARISM_CHECK_COMPLETED,
                    document_id=document_id,
                    provider=provider.name,
                    mode=self._mode,
                    similarity_score=result.similarity_score,
                    passed=result.passed,
                    approved_by=self._approved_documents.get(document_id),
                    metadata={
                        "matchCount": result.match_count,
                        "scanId": result.scan_id,
                        "isMock": result.is_mock,
                    },
                )
                self._audit_logger.save()

            return result

        except PlagiarismCheckError as e:
            # Log failure
            if self._audit_logger:
                self._audit_logger.log_action(
                    action=PlagiarismAuditAction.PLAGIARISM_CHECK_FAILED,
                    document_id=document_id,
                    provider=provider.name,
                    mode=self._mode,
                    reason=e.reason_code,
                )
                self._audit_logger.save()

            raise

    def block_export_if_required(
        self,
        document_id: str,
        plagiarism_required: bool,
        last_result: Optional[PlagiarismResult] = None,
    ) -> Dict[str, Any]:
        """Check if export should be blocked due to plagiarism requirements.

        Fail-closed behavior: if plagiarism check is required but hasn't
        been run or failed, export is blocked.

        Args:
            document_id: ID of document being exported
            plagiarism_required: Whether plagiarism check is required
            last_result: Last plagiarism check result (if any)

        Returns:
            Dict with 'allowed' boolean and 'reason' if blocked
        """
        if not plagiarism_required:
            return {"allowed": True}

        if last_result is None:
            reason = "Plagiarism check required but not performed"
            if self._audit_logger:
                self._audit_logger.log_action(
                    action=PlagiarismAuditAction.PLAGIARISM_EXPORT_BLOCKED,
                    document_id=document_id,
                    mode=self._mode,
                    reason=reason,
                )
                self._audit_logger.save()

            return {
                "allowed": False,
                "reason": reason,
                "reason_code": "CHECK_NOT_PERFORMED",
            }

        if not last_result.passed:
            reason = f"Plagiarism check failed: {last_result.similarity_score:.1%} similarity"
            if self._audit_logger:
                self._audit_logger.log_action(
                    action=PlagiarismAuditAction.PLAGIARISM_EXPORT_BLOCKED,
                    document_id=document_id,
                    mode=self._mode,
                    similarity_score=last_result.similarity_score,
                    passed=False,
                    reason=reason,
                )
                self._audit_logger.save()

            return {
                "allowed": False,
                "reason": reason,
                "reason_code": "CHECK_FAILED",
                "similarity_score": last_result.similarity_score,
            }

        return {
            "allowed": True,
            "similarity_score": last_result.similarity_score,
        }

    def get_audit_log(self, document_id: Optional[str] = None) -> List[Dict]:
        """Get audit log entries.

        Args:
            document_id: Filter by document ID (optional)

        Returns:
            List of audit entry dictionaries
        """
        if not self._audit_logger:
            return []
        return self._audit_logger.get_entries(document_id=document_id)


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================


def check_plagiarism_with_gate(
    text: str,
    document_id: str,
    approved_by: Optional[str] = None,
) -> PlagiarismResult:
    """Convenience function to check plagiarism with gate enforcement.

    Creates a temporary gate and runs the check. For repeated checks,
    use PlagiarismGate directly to maintain approval state.

    Args:
        text: The text to check
        document_id: Document identifier
        approved_by: User providing approval (for LIVE mode)

    Returns:
        PlagiarismResult with check results

    Raises:
        PlagiarismCheckError: If check fails or approval required but not provided
    """
    gate = PlagiarismGate()

    if gate.requires_approval(document_id) and approved_by:
        gate.approve(document_id, approved_by)

    return gate.check(text, document_id)


def is_plagiarism_check_required(
    template_config: Optional[Dict] = None,
    export_type: Optional[str] = None,
) -> bool:
    """Check if plagiarism check is required based on template/config.

    Looks for 'plagiarism_required' flag in template config.
    Defaults to True for manuscript exports in LIVE mode.

    Args:
        template_config: Template configuration dict (optional)
        export_type: Type of export (manuscript, data, etc.)

    Returns:
        True if plagiarism check is required
    """
    mode = os.getenv("ROS_MODE", "DEMO").upper()

    # Check template config flag
    if template_config:
        flag = template_config.get("plagiarism_required")
        if flag is not None:
            return bool(flag)

    # Default behavior based on mode and export type
    if mode == "LIVE" and export_type in ("manuscript", "publication"):
        return True

    return False

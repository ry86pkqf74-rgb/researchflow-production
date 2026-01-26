"""
Immutable Audit Log for AI Approval Decisions

This module implements an append-only audit trail for all AI approval decisions.
The audit log is immutable (no updates/deletes) to ensure reproducibility and
compliance with data governance requirements for AI oversight.

Key Features:
- Append-only log (no modifications allowed)
- Cryptographic hash chain for tamper detection
- AI approval metadata (mode, model, provider, cost estimate)
- Export to parquet for long-term archival
- Integration with lifecycle governance

Author: Research Operating System
Date: 2026-01-16
"""

import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class AIAuditAction(Enum):
    """Actions tracked in the AI approval audit log.
    
    Stage-level actions with their required fields:
    
    AI_CALL_REQUESTED:
      Required: timestamp, stageId, stageName, approvalMode, aiModel, aiProvider, costEstimate
      Not applicable: approvedBy (no approval yet)
    
    AI_CALL_APPROVED:
      Required: timestamp, stageId, stageName, approvalMode, aiModel, aiProvider, costEstimate, approvedBy
    
    AI_CALL_BLOCKED:
      Required: timestamp, stageId, stageName, approvalMode, aiModel, aiProvider, costEstimate, reason
      Not applicable: approvedBy (was denied)
    
    AI_CALL_EXECUTED:
      Required: timestamp, stageId, stageName, approvalMode, aiModel, aiProvider, costEstimate
      Not applicable: approvedBy (execution, not approval event)
    
    Aggregate actions (stage-level fields not applicable):
    - PHASE_APPROVED: phaseId, approvedBy, metadata.stages_approved
    - SESSION_APPROVED: approvedBy, metadata.stages_approved
    - APPROVAL_MODE_CHANGED: metadata.previous_mode
    - GATE_RESET: Administrative action
    """
    AI_CALL_REQUESTED = "AI_CALL_REQUESTED"
    AI_CALL_APPROVED = "AI_CALL_APPROVED"
    AI_CALL_BLOCKED = "AI_CALL_BLOCKED"
    AI_CALL_EXECUTED = "AI_CALL_EXECUTED"
    PHASE_APPROVED = "PHASE_APPROVED"
    SESSION_APPROVED = "SESSION_APPROVED"
    APPROVAL_MODE_CHANGED = "APPROVAL_MODE_CHANGED"
    GATE_RESET = "GATE_RESET"


@dataclass
class AIAuditEntry:
    """Single entry in the AI approval audit log."""
    audit_id: str
    timestamp: datetime
    action: AIAuditAction
    stage_id: Optional[int] = None
    stage_name: Optional[str] = None
    phase_id: Optional[int] = None
    approval_mode: Optional[str] = None
    approved_by: Optional[str] = None
    ai_model: Optional[str] = None
    ai_provider: Optional[str] = None
    cost_estimate: Optional[str] = None
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
            "stageId": self.stage_id,
            "stageName": self.stage_name,
            "phaseId": self.phase_id,
            "approvalMode": self.approval_mode,
            "approvedBy": self.approved_by,
            "aiModel": self.ai_model,
            "aiProvider": self.ai_provider,
            "costEstimate": self.cost_estimate,
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
            "stage_id": self.stage_id,
            "stage_name": self.stage_name,
            "phase_id": self.phase_id,
            "approval_mode": self.approval_mode,
            "approved_by": self.approved_by,
            "ai_model": self.ai_model,
            "ai_provider": self.ai_provider,
            "cost_estimate": self.cost_estimate,
            "reason": self.reason,
            "metadata": self.metadata,
            "log_hash": self.log_hash,
            "prev_log_hash": self.prev_log_hash,
        }


class AIApprovalAuditLogger:
    """Immutable audit logger for AI approval decisions.
    
    This logger maintains a tamper-evident hash chain of all AI approval
    decisions to ensure compliance and reproducibility.
    """

    def __init__(
        self,
        log_file: Path = Path("data/governance/ai_approval_audit.json"),
    ):
        """Initialize the AI approval audit logger.
        
        Args:
            log_file: Path to the audit log file
        """
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        self._entries: List[AIAuditEntry] = []
        self._load_log()

    def _load_log(self) -> None:
        """Load existing audit log if present."""
        if self.log_file.exists():
            try:
                with open(self.log_file, "r") as f:
                    data = json.load(f)
                    for entry_data in data.get("entries", []):
                        entry = AIAuditEntry(
                            audit_id=entry_data["audit_id"],
                            timestamp=datetime.fromisoformat(entry_data["timestamp"]),
                            action=AIAuditAction(entry_data["action"]),
                            stage_id=entry_data.get("stage_id"),
                            stage_name=entry_data.get("stage_name"),
                            phase_id=entry_data.get("phase_id"),
                            approval_mode=entry_data.get("approval_mode"),
                            approved_by=entry_data.get("approved_by"),
                            ai_model=entry_data.get("ai_model"),
                            ai_provider=entry_data.get("ai_provider"),
                            cost_estimate=entry_data.get("cost_estimate"),
                            reason=entry_data.get("reason"),
                            metadata=entry_data.get("metadata", {}),
                            log_hash=entry_data.get("log_hash", ""),
                            prev_log_hash=entry_data.get("prev_log_hash", ""),
                        )
                        self._entries.append(entry)
                logger.info(f"Loaded AI approval audit log: {len(self._entries)} entries")
            except Exception as e:
                logger.warning(f"Failed to load audit log: {e}. Starting fresh.")
                self._entries = []
        else:
            logger.info("Initialized new AI approval audit log")

    def _get_last_hash(self) -> str:
        """Get hash of most recent log entry."""
        if not self._entries:
            return hashlib.sha256(b"AI_APPROVAL_GENESIS").hexdigest()[:16]
        return self._entries[-1].log_hash

    def _compute_hash(self, entry_dict: Dict, prev_hash: Optional[str] = None) -> str:
        """Compute cryptographic hash of log entry.
        
        Args:
            entry_dict: Entry data to hash
            prev_hash: Previous hash in chain (uses last entry hash if None)
        """
        hash_input = json.dumps(entry_dict, sort_keys=True, default=str)
        hash_input += prev_hash if prev_hash is not None else self._get_last_hash()
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

    def _generate_audit_id(self) -> str:
        """Generate unique audit ID."""
        return f"AI_AUDIT_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{len(self._entries):06d}"

    def log_approval(
        self,
        action: AIAuditAction,
        stage_id: Optional[int] = None,
        stage_name: Optional[str] = None,
        phase_id: Optional[int] = None,
        approval_mode: Optional[str] = None,
        approved_by: Optional[str] = None,
        ai_model: Optional[str] = None,
        ai_provider: Optional[str] = None,
        cost_estimate: Optional[str] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> str:
        """Log an AI approval decision.
        
        Args:
            action: Type of audit action
            stage_id: Stage ID (if applicable)
            stage_name: Human-readable stage name
            phase_id: Phase ID (for phase-level approvals)
            approval_mode: REQUIRE_EACH, APPROVE_PHASE, or APPROVE_SESSION
            approved_by: User who made the decision
            ai_model: AI model being used
            ai_provider: AI provider (OpenAI, etc.)
            cost_estimate: Estimated cost range
            reason: Reason for blocking (if applicable)
            metadata: Additional metadata
            
        Returns:
            Audit ID for the logged entry
        """
        audit_id = self._generate_audit_id()
        timestamp = datetime.utcnow()
        prev_hash = self._get_last_hash()

        entry_dict = {
            "audit_id": audit_id,
            "timestamp": timestamp.isoformat(),
            "action": action.value,
            "stage_id": stage_id,
            "stage_name": stage_name,
            "phase_id": phase_id,
            "approval_mode": approval_mode,
            "approved_by": approved_by,
            "ai_model": ai_model,
            "ai_provider": ai_provider,
            "cost_estimate": cost_estimate,
            "reason": reason,
            "metadata": metadata or {},
            "prev_log_hash": prev_hash,
        }

        log_hash = self._compute_hash(entry_dict)

        entry = AIAuditEntry(
            audit_id=audit_id,
            timestamp=timestamp,
            action=action,
            stage_id=stage_id,
            stage_name=stage_name,
            phase_id=phase_id,
            approval_mode=approval_mode,
            approved_by=approved_by,
            ai_model=ai_model,
            ai_provider=ai_provider,
            cost_estimate=cost_estimate,
            reason=reason,
            metadata=metadata or {},
            log_hash=log_hash,
            prev_log_hash=prev_hash,
        )

        self._entries.append(entry)
        logger.debug(f"Logged AI approval: {audit_id} ({action.value})")

        return audit_id

    def log_stage_approval(
        self,
        stage_id: int,
        stage_name: str,
        approved_by: str,
        approval_mode: str,
        ai_model: Optional[str] = None,
        ai_provider: Optional[str] = None,
        cost_estimate: Optional[str] = None,
    ) -> str:
        """Convenience method to log a stage approval."""
        return self.log_approval(
            action=AIAuditAction.AI_CALL_APPROVED,
            stage_id=stage_id,
            stage_name=stage_name,
            approved_by=approved_by,
            approval_mode=approval_mode,
            ai_model=ai_model,
            ai_provider=ai_provider,
            cost_estimate=cost_estimate,
        )

    def log_stage_blocked(
        self,
        stage_id: int,
        stage_name: str,
        reason: str,
        approval_mode: str,
    ) -> str:
        """Convenience method to log a blocked stage."""
        return self.log_approval(
            action=AIAuditAction.AI_CALL_BLOCKED,
            stage_id=stage_id,
            stage_name=stage_name,
            reason=reason,
            approval_mode=approval_mode,
        )

    def log_execution(
        self,
        stage_id: int,
        stage_name: str,
        approval_mode: str,
        ai_model: Optional[str] = None,
        ai_provider: Optional[str] = None,
        cost_estimate: Optional[str] = None,
    ) -> str:
        """Convenience method to log AI execution after approval."""
        return self.log_approval(
            action=AIAuditAction.AI_CALL_EXECUTED,
            stage_id=stage_id,
            stage_name=stage_name,
            approval_mode=approval_mode,
            ai_model=ai_model,
            ai_provider=ai_provider,
            cost_estimate=cost_estimate,
        )

    def log_phase_approval(
        self,
        phase_id: int,
        approved_by: str,
        stages_approved: List[int],
    ) -> str:
        """Log approval of all AI stages in a phase."""
        return self.log_approval(
            action=AIAuditAction.PHASE_APPROVED,
            phase_id=phase_id,
            approved_by=approved_by,
            approval_mode="APPROVE_PHASE",
            metadata={"stages_approved": stages_approved},
        )

    def log_session_approval(
        self,
        approved_by: str,
        stages_approved: List[int],
    ) -> str:
        """Log approval of all AI stages for the session."""
        return self.log_approval(
            action=AIAuditAction.SESSION_APPROVED,
            approved_by=approved_by,
            approval_mode="APPROVE_SESSION",
            metadata={"stages_approved": stages_approved},
        )

    def save(self) -> None:
        """Save audit log to file (snake_case for storage)."""
        data = {
            "version": "1.0",
            "created": datetime.utcnow().isoformat(),
            "entry_count": len(self._entries),
            "entries": [entry.to_storage_dict() for entry in self._entries],
        }
        with open(self.log_file, "w") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Saved AI approval audit log: {len(self._entries)} entries")

    def verify_hash_chain(self) -> Dict[str, Any]:
        """Verify integrity of audit log hash chain."""
        logger.info("Verifying AI approval audit log integrity...")

        hash_mismatches = []
        chain_breaks = []
        prev_hash = hashlib.sha256(b"AI_APPROVAL_GENESIS").hexdigest()[:16]

        for entry in self._entries:
            if entry.prev_log_hash != prev_hash:
                chain_breaks.append(entry.audit_id)

            entry_dict = entry.to_storage_dict()
            del entry_dict["log_hash"]
            recomputed = self._compute_hash(entry_dict, prev_hash)

            if recomputed != entry.log_hash:
                hash_mismatches.append(entry.audit_id)

            prev_hash = entry.log_hash

        valid = len(hash_mismatches) == 0 and len(chain_breaks) == 0
        
        result = {
            "valid": valid,
            "total_entries": len(self._entries),
            "hash_mismatches": hash_mismatches,
            "chain_breaks": chain_breaks,
        }

        if valid:
            logger.info(f"AI approval audit log integrity: VERIFIED ({len(self._entries)} entries)")
        else:
            logger.error("AI approval audit log integrity: FAILED")

        return result

    def get_entries(
        self,
        action: Optional[AIAuditAction] = None,
        stage_id: Optional[int] = None,
        phase_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Dict]:
        """Query audit log with filters."""
        filtered = self._entries

        if action:
            filtered = [e for e in filtered if e.action == action]

        if stage_id is not None:
            filtered = [e for e in filtered if e.stage_id == stage_id]

        if phase_id is not None:
            filtered = [e for e in filtered if e.phase_id == phase_id]

        if start_date:
            filtered = [e for e in filtered if e.timestamp >= start_date]

        if end_date:
            filtered = [e for e in filtered if e.timestamp <= end_date]

        return [e.to_dict() for e in filtered]

    def get_statistics(self) -> Dict[str, Any]:
        """Get summary statistics from audit log."""
        if not self._entries:
            return {
                "total_entries": 0,
                "approvals": 0,
                "blocks": 0,
                "executions": 0,
            }

        action_counts = {}
        for entry in self._entries:
            action = entry.action.value
            action_counts[action] = action_counts.get(action, 0) + 1

        return {
            "total_entries": len(self._entries),
            "approvals": action_counts.get("AI_CALL_APPROVED", 0),
            "blocks": action_counts.get("AI_CALL_BLOCKED", 0),
            "executions": action_counts.get("AI_CALL_EXECUTED", 0),
            "phase_approvals": action_counts.get("PHASE_APPROVED", 0),
            "session_approvals": action_counts.get("SESSION_APPROVED", 0),
            "action_counts": action_counts,
            "date_range": (
                self._entries[0].timestamp.isoformat() if self._entries else None,
                self._entries[-1].timestamp.isoformat() if self._entries else None,
            ),
        }

    def export_json(self, output_path: Path) -> None:
        """Export audit log to JSON file."""
        data = {
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "statistics": self.get_statistics(),
            "entries": [e.to_dict() for e in self._entries],
        }
        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Exported AI approval audit log to {output_path}")


def log_ai_approval(
    action: AIAuditAction,
    **kwargs,
) -> str:
    """Convenience function to log an AI approval decision."""
    audit_logger = AIApprovalAuditLogger()
    audit_id = audit_logger.log_approval(action=action, **kwargs)
    audit_logger.save()
    return audit_id


def get_ai_approval_trail(
    stage_id: Optional[int] = None,
    phase_id: Optional[int] = None,
) -> List[Dict]:
    """Convenience function to query AI approval trail."""
    audit_logger = AIApprovalAuditLogger()
    return audit_logger.get_entries(stage_id=stage_id, phase_id=phase_id)


def verify_ai_approval_chain() -> Dict[str, Any]:
    """Convenience function to verify audit log integrity."""
    audit_logger = AIApprovalAuditLogger()
    return audit_logger.verify_hash_chain()

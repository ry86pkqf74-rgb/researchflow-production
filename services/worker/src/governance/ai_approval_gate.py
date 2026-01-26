"""AI Approval Gate for Research Operating System.

This module manages AI approval workflows, enforcing human oversight
before AI tool execution in research pipelines.

Design Principles:
- Explicit approval required before any AI execution
- Three approval modes: REQUIRE_EACH, APPROVE_PHASE, APPROVE_SESSION
- Full audit trail for all approval decisions
- Read-only validation (no side effects in validation)

See: docs/governance/AI_APPROVAL_SYSTEM.md
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set, FrozenSet
from enum import Enum

from .lifecycle_states import (
    AIApprovalMode,
    AIApprovalRecord,
    AI_STAGES,
    AI_STAGE_TOOLS,
    PHASE_STAGES,
    is_ai_stage,
    get_ai_tools_for_stage,
    get_phase_for_stage,
    get_ai_stages_in_phase,
)
from .ai_approval_audit import AIApprovalAuditLogger, AIAuditAction


class AIApprovalAction(Enum):
    """Audit trail actions for AI approval system."""
    AI_CALL_REQUESTED = "AI_CALL_REQUESTED"
    AI_CALL_APPROVED = "AI_CALL_APPROVED"
    AI_CALL_BLOCKED = "AI_CALL_BLOCKED"
    AI_CALL_EXECUTED = "AI_CALL_EXECUTED"
    PHASE_APPROVED = "PHASE_APPROVED"
    SESSION_APPROVED = "SESSION_APPROVED"
    APPROVAL_MODE_CHANGED = "APPROVAL_MODE_CHANGED"


@dataclass
class AIApprovalAuditEntry:
    """Audit log entry for AI approval decisions."""
    action: AIApprovalAction
    timestamp: datetime
    stage_id: Optional[int] = None
    stage_name: Optional[str] = None
    phase_id: Optional[int] = None
    approval_mode: Optional[AIApprovalMode] = None
    approved_by: Optional[str] = None
    ai_model: Optional[str] = None
    ai_provider: Optional[str] = None
    cost_estimate: Optional[str] = None
    reason: Optional[str] = None
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "action": self.action.value,
            "timestamp": self.timestamp.isoformat(),
            "stageId": self.stage_id,
            "stageName": self.stage_name,
            "phaseId": self.phase_id,
            "approvalMode": self.approval_mode.value if self.approval_mode else None,
            "approvedBy": self.approved_by,
            "aiModel": self.ai_model,
            "aiProvider": self.ai_provider,
            "costEstimate": self.cost_estimate,
            "reason": self.reason,
            "metadata": self.metadata,
        }


class AIApprovalGate:
    """Manages AI approval state and validation.
    
    This class maintains the approval state for AI stages and provides
    validation methods to check if execution is permitted.
    """

    def __init__(
        self, 
        mode: AIApprovalMode = AIApprovalMode.REQUIRE_EACH,
        persist_audit: bool = True,
    ):
        """Initialize the AI approval gate.
        
        Args:
            mode: Initial approval mode (default: REQUIRE_EACH)
            persist_audit: Whether to persist audit entries to file
        """
        self._mode = mode
        self._approved_stages: Set[int] = set()
        self._approved_phases: Set[int] = set()
        self._session_approved: bool = False
        self._audit_log: List[AIApprovalAuditEntry] = []
        self._persist_audit = persist_audit
        self._audit_logger = AIApprovalAuditLogger() if persist_audit else None

    @property
    def mode(self) -> AIApprovalMode:
        """Get current approval mode."""
        return self._mode

    @mode.setter
    def mode(self, new_mode: AIApprovalMode) -> None:
        """Set approval mode and log the change."""
        if new_mode != self._mode:
            self._log_entry(AIApprovalAuditEntry(
                action=AIApprovalAction.APPROVAL_MODE_CHANGED,
                timestamp=datetime.utcnow(),
                approval_mode=new_mode,
                metadata={"previous_mode": self._mode.value},
            ))
            self._mode = new_mode

    def is_approved(self, stage_id: int) -> bool:
        """Check if a stage has approval to execute AI tools.
        
        Args:
            stage_id: The stage to check
            
        Returns:
            True if stage is approved for AI execution
        """
        if not is_ai_stage(stage_id):
            return True
        
        if self._session_approved:
            return True
        
        phase = get_phase_for_stage(stage_id)
        if phase and phase in self._approved_phases:
            return True
        
        return stage_id in self._approved_stages

    def requires_approval(self, stage_id: int) -> bool:
        """Check if a stage requires approval before execution.
        
        Args:
            stage_id: The stage to check
            
        Returns:
            True if approval is required
        """
        return is_ai_stage(stage_id) and not self.is_approved(stage_id)

    def approve_stage(
        self,
        stage_id: int,
        stage_name: str,
        approved_by: str,
    ) -> AIApprovalRecord:
        """Approve a single stage for AI execution.
        
        Args:
            stage_id: Stage to approve
            stage_name: Human-readable stage name
            approved_by: User who provided approval
            
        Returns:
            AIApprovalRecord of the approval
        """
        tools = get_ai_tools_for_stage(stage_id)
        primary_tool = tools[0] if tools else {}
        
        self._approved_stages.add(stage_id)
        
        record = AIApprovalRecord(
            stage_id=stage_id,
            stage_name=stage_name,
            approval_mode=AIApprovalMode.REQUIRE_EACH,
            approved=True,
            approved_by=approved_by,
            approved_at=datetime.utcnow(),
            ai_model=primary_tool.get("model"),
            ai_provider=primary_tool.get("provider"),
            cost_estimate=primary_tool.get("costEstimate"),
        )
        
        self._log_entry(AIApprovalAuditEntry(
            action=AIApprovalAction.AI_CALL_APPROVED,
            timestamp=record.approved_at,
            stage_id=stage_id,
            stage_name=stage_name,
            approval_mode=AIApprovalMode.REQUIRE_EACH,
            approved_by=approved_by,
            ai_model=record.ai_model,
            ai_provider=record.ai_provider,
            cost_estimate=record.cost_estimate,
        ))
        
        return record

    def approve_phase(
        self,
        phase_id: int,
        approved_by: str,
    ) -> List[AIApprovalRecord]:
        """Approve all AI stages in a phase.
        
        Args:
            phase_id: Phase to approve (1-6)
            approved_by: User who provided approval
            
        Returns:
            List of AIApprovalRecords for each AI stage in the phase
        """
        self._approved_phases.add(phase_id)
        ai_stages = get_ai_stages_in_phase(phase_id)
        records = []
        
        self._log_entry(AIApprovalAuditEntry(
            action=AIApprovalAction.PHASE_APPROVED,
            timestamp=datetime.utcnow(),
            phase_id=phase_id,
            approval_mode=AIApprovalMode.APPROVE_PHASE,
            approved_by=approved_by,
            metadata={"stages_approved": list(ai_stages)},
        ))
        
        for stage_id in ai_stages:
            tools = get_ai_tools_for_stage(stage_id)
            primary_tool = tools[0] if tools else {}
            records.append(AIApprovalRecord(
                stage_id=stage_id,
                stage_name=f"Stage {stage_id}",
                approval_mode=AIApprovalMode.APPROVE_PHASE,
                approved=True,
                approved_by=approved_by,
                approved_at=datetime.utcnow(),
                ai_model=primary_tool.get("model"),
                ai_provider=primary_tool.get("provider"),
                cost_estimate=primary_tool.get("costEstimate"),
            ))
        
        return records

    def approve_session(self, approved_by: str) -> List[AIApprovalRecord]:
        """Approve all AI stages for the entire session.
        
        Args:
            approved_by: User who provided approval
            
        Returns:
            List of AIApprovalRecords for all AI stages
        """
        self._session_approved = True
        records = []
        
        self._log_entry(AIApprovalAuditEntry(
            action=AIApprovalAction.SESSION_APPROVED,
            timestamp=datetime.utcnow(),
            approval_mode=AIApprovalMode.APPROVE_SESSION,
            approved_by=approved_by,
            metadata={"stages_approved": list(AI_STAGES)},
        ))
        
        for stage_id in AI_STAGES:
            tools = get_ai_tools_for_stage(stage_id)
            primary_tool = tools[0] if tools else {}
            records.append(AIApprovalRecord(
                stage_id=stage_id,
                stage_name=f"Stage {stage_id}",
                approval_mode=AIApprovalMode.APPROVE_SESSION,
                approved=True,
                approved_by=approved_by,
                approved_at=datetime.utcnow(),
                ai_model=primary_tool.get("model"),
                ai_provider=primary_tool.get("provider"),
                cost_estimate=primary_tool.get("costEstimate"),
            ))
        
        return records

    def block_stage(
        self,
        stage_id: int,
        stage_name: str,
        reason: str = "User denied AI execution",
    ) -> None:
        """Record a blocked AI execution attempt.
        
        Args:
            stage_id: Stage that was blocked
            stage_name: Human-readable stage name
            reason: Reason for blocking
        """
        tools = get_ai_tools_for_stage(stage_id)
        primary_tool = tools[0] if tools else {}
        
        self._log_entry(AIApprovalAuditEntry(
            action=AIApprovalAction.AI_CALL_BLOCKED,
            timestamp=datetime.utcnow(),
            stage_id=stage_id,
            stage_name=stage_name,
            approval_mode=self._mode,
            ai_model=primary_tool.get("model"),
            ai_provider=primary_tool.get("provider"),
            cost_estimate=primary_tool.get("costEstimate"),
            reason=reason,
        ))

    def record_execution(
        self,
        stage_id: int,
        stage_name: str,
    ) -> None:
        """Record successful AI execution after approval.
        
        Args:
            stage_id: Stage that was executed
            stage_name: Human-readable stage name
        """
        tools = get_ai_tools_for_stage(stage_id)
        primary_tool = tools[0] if tools else {}
        
        self._log_entry(AIApprovalAuditEntry(
            action=AIApprovalAction.AI_CALL_EXECUTED,
            timestamp=datetime.utcnow(),
            stage_id=stage_id,
            stage_name=stage_name,
            approval_mode=self._mode,
            ai_model=primary_tool.get("model"),
            ai_provider=primary_tool.get("provider"),
            cost_estimate=primary_tool.get("costEstimate"),
        ))

    def reset(self) -> None:
        """Reset all approvals (e.g., for a new session)."""
        self._approved_stages.clear()
        self._approved_phases.clear()
        self._session_approved = False

    def get_approval_stats(self) -> Dict:
        """Get statistics about approval state.
        
        Returns:
            Dict with approved/pending counts
        """
        approved_count = 0
        pending_count = 0
        
        for stage_id in AI_STAGES:
            if self.is_approved(stage_id):
                approved_count += 1
            else:
                pending_count += 1
        
        return {
            "approved": approved_count,
            "pending": pending_count,
            "total": len(AI_STAGES),
            "mode": self._mode.value,
            "session_approved": self._session_approved,
        }

    def get_audit_log(self) -> List[Dict]:
        """Get the full audit log as serializable dicts.
        
        Returns:
            List of audit entry dictionaries
        """
        return [entry.to_dict() for entry in self._audit_log]

    def _log_entry(self, entry: AIApprovalAuditEntry) -> None:
        """Add an entry to the audit log and persist if enabled."""
        self._audit_log.append(entry)
        
        if self._persist_audit and self._audit_logger:
            action_map = {
                AIApprovalAction.AI_CALL_REQUESTED: AIAuditAction.AI_CALL_REQUESTED,
                AIApprovalAction.AI_CALL_APPROVED: AIAuditAction.AI_CALL_APPROVED,
                AIApprovalAction.AI_CALL_BLOCKED: AIAuditAction.AI_CALL_BLOCKED,
                AIApprovalAction.AI_CALL_EXECUTED: AIAuditAction.AI_CALL_EXECUTED,
                AIApprovalAction.PHASE_APPROVED: AIAuditAction.PHASE_APPROVED,
                AIApprovalAction.SESSION_APPROVED: AIAuditAction.SESSION_APPROVED,
                AIApprovalAction.APPROVAL_MODE_CHANGED: AIAuditAction.APPROVAL_MODE_CHANGED,
            }
            
            self._audit_logger.log_approval(
                action=action_map.get(entry.action, AIAuditAction.AI_CALL_REQUESTED),
                stage_id=entry.stage_id,
                stage_name=entry.stage_name,
                phase_id=entry.phase_id,
                approval_mode=entry.approval_mode.value if entry.approval_mode else None,
                approved_by=entry.approved_by,
                ai_model=entry.ai_model,
                ai_provider=entry.ai_provider,
                cost_estimate=entry.cost_estimate,
                reason=entry.reason,
                metadata=entry.metadata,
            )
            self._audit_logger.save()


def validate_ai_execution(
    gate: AIApprovalGate,
    stage_id: int,
    stage_name: str,
) -> Dict:
    """Validate if AI execution is permitted for a stage.
    
    Args:
        gate: The AIApprovalGate instance
        stage_id: Stage requesting execution
        stage_name: Human-readable stage name
        
    Returns:
        Dict with validation result and details
    """
    if not is_ai_stage(stage_id):
        return {
            "allowed": True,
            "reason": "Stage does not use AI tools",
            "requires_approval": False,
        }
    
    if gate.is_approved(stage_id):
        return {
            "allowed": True,
            "reason": "Stage has approval",
            "requires_approval": False,
            "approval_mode": gate.mode.value,
        }
    
    tools = get_ai_tools_for_stage(stage_id)
    return {
        "allowed": False,
        "reason": "AI approval required before execution",
        "requires_approval": True,
        "approval_mode": gate.mode.value,
        "stage_id": stage_id,
        "stage_name": stage_name,
        "ai_tools": tools,
    }

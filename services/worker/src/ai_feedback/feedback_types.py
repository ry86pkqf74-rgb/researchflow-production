"""
Feedback Types Module (Phase 7)

Data models for AI feedback records and quality tracking.

SAFETY INVARIANTS:
- No PHI in feedback records
- Prompt content stored as hashes only
- Personal data anonymized

Last Updated: 2026-01-23
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4


# Re-export from quality_checks for convenience
CheckCategory = Literal[
    "citations", "coverage", "length", "confidence", "completeness", "structure", "format"
]
CheckSeverity = Literal["error", "warning", "info"]
ModelTier = Literal["NANO", "MINI", "FRONTIER"]


@dataclass
class CheckResult:
    """Simplified check result for storage.
    
    Attributes:
        check_name: Name of the quality check
        passed: Whether the check passed
        score: Numeric score 0.0-1.0
        category: Check category
    """
    check_name: str
    passed: bool
    score: Optional[float] = None
    category: Optional[CheckCategory] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "checkName": self.check_name,
            "passed": self.passed,
            "score": self.score,
            "category": self.category,
        }


@dataclass
class FeedbackRecord:
    """Record of AI generation feedback for self-improvement loop.
    
    CRITICAL: This record contains NO PHI. Prompt content is hashed.
    
    Attributes:
        feedback_id: Unique identifier for this feedback record
        job_id: Associated job ID
        stage_id: Workflow stage number
        task_type: Type of AI task
        model_tier: Model tier used (NANO, MINI, FRONTIER)
        prompt_version: Version of the prompt template
        prompt_hash: SHA-256 hash of the prompt (no raw content)
        quality_checks: List of check results
        overall_passed: Whether all required checks passed
        overall_score: Aggregate score across all checks
        refinement_applied: Whether refinement was attempted
        refinement_attempts: Number of refinement attempts
        final_model_tier: Tier after any escalations
        latency_ms: Response latency in milliseconds
        timestamp: When this feedback was recorded
        metadata: Additional context (no PHI)
    """
    # Identifiers
    feedback_id: str = field(default_factory=lambda: f"fb_{uuid4().hex[:12]}")
    job_id: Optional[str] = None
    stage_id: Optional[int] = None
    
    # Task info
    task_type: str = "unknown"
    model_tier: ModelTier = "MINI"
    prompt_version: Optional[str] = None
    prompt_hash: Optional[str] = None
    
    # Quality results
    quality_checks: List[CheckResult] = field(default_factory=list)
    overall_passed: bool = False
    overall_score: float = 0.0
    
    # Refinement tracking
    refinement_applied: bool = False
    refinement_attempts: int = 0
    final_model_tier: Optional[ModelTier] = None
    
    # Performance
    latency_ms: Optional[int] = None
    
    # Timing
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    
    # Additional context (no PHI)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @staticmethod
    def hash_prompt(prompt: str) -> str:
        """Create SHA-256 hash of prompt content.
        
        CRITICAL: Never store raw prompt content - only hashes.
        """
        return hashlib.sha256(prompt.encode()).hexdigest()
    
    def compute_overall_score(self) -> float:
        """Compute weighted overall score from quality checks."""
        if not self.quality_checks:
            return 0.0
        
        scores = [c.score for c in self.quality_checks if c.score is not None]
        if not scores:
            return 1.0 if all(c.passed for c in self.quality_checks) else 0.0
        
        return sum(scores) / len(scores)
    
    def add_check(self, check_name: str, passed: bool, score: Optional[float] = None, 
                  category: Optional[CheckCategory] = None) -> None:
        """Add a quality check result."""
        self.quality_checks.append(CheckResult(
            check_name=check_name,
            passed=passed,
            score=score,
            category=category,
        ))
    
    def finalize(self) -> None:
        """Finalize the record by computing aggregate values."""
        self.overall_score = self.compute_overall_score()
        self.overall_passed = all(c.passed for c in self.quality_checks)
        if self.final_model_tier is None:
            self.final_model_tier = self.model_tier
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "feedbackId": self.feedback_id,
            "jobId": self.job_id,
            "stageId": self.stage_id,
            "taskType": self.task_type,
            "modelTier": self.model_tier,
            "promptVersion": self.prompt_version,
            "promptHash": self.prompt_hash,
            "qualityChecks": [c.to_dict() for c in self.quality_checks],
            "overallPassed": self.overall_passed,
            "overallScore": self.overall_score,
            "refinementApplied": self.refinement_applied,
            "refinementAttempts": self.refinement_attempts,
            "finalModelTier": self.final_model_tier,
            "latencyMs": self.latency_ms,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeedbackRecord":
        """Create FeedbackRecord from dictionary."""
        checks = [
            CheckResult(
                check_name=c["checkName"],
                passed=c["passed"],
                score=c.get("score"),
                category=c.get("category"),
            )
            for c in data.get("qualityChecks", [])
        ]
        
        return cls(
            feedback_id=data.get("feedbackId", f"fb_{uuid4().hex[:12]}"),
            job_id=data.get("jobId"),
            stage_id=data.get("stageId"),
            task_type=data.get("taskType", "unknown"),
            model_tier=data.get("modelTier", "MINI"),
            prompt_version=data.get("promptVersion"),
            prompt_hash=data.get("promptHash"),
            quality_checks=checks,
            overall_passed=data.get("overallPassed", False),
            overall_score=data.get("overallScore", 0.0),
            refinement_applied=data.get("refinementApplied", False),
            refinement_attempts=data.get("refinementAttempts", 0),
            final_model_tier=data.get("finalModelTier"),
            latency_ms=data.get("latencyMs"),
            timestamp=data.get("timestamp", datetime.now(timezone.utc).isoformat()),
            metadata=data.get("metadata", {}),
        )


@dataclass
class RefinementInstruction:
    """Instruction for refining AI output based on failed checks.
    
    Maps failed quality checks to specific refinement prompts.
    
    Attributes:
        check_name: Name of the failed check
        instruction: Refinement instruction text
        priority: Priority level (higher = more important)
        parameters: Dynamic parameters for the instruction
    """
    check_name: str
    instruction: str
    priority: int = 1
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    def format_instruction(self) -> str:
        """Format instruction with parameters."""
        try:
            return self.instruction.format(**self.parameters)
        except KeyError:
            return self.instruction


# Default refinement instructions
DEFAULT_REFINEMENT_INSTRUCTIONS: Dict[str, str] = {
    "citations_present": "Include at least {min_count} relevant references from the literature. Use standard citation formats like [1] or (Author, Year).",
    "key_points_covered": "Ensure you discuss the following topics: {missing_points}",
    "no_question_marks": "Remove uncertain language and replace any questions with definitive statements.",
    "length_within_bounds": "Adjust the content length to approximately {target_words} words.",
    "no_placeholders": "Replace all placeholder text (like [TODO], TBD, or XXX) with actual content.",
}


def get_refinement_instruction(
    check_name: str,
    **parameters: Any,
) -> Optional[RefinementInstruction]:
    """Get a refinement instruction for a failed check.
    
    Args:
        check_name: Name of the failed check
        **parameters: Dynamic parameters for the instruction
        
    Returns:
        RefinementInstruction or None if no instruction available
    """
    template = DEFAULT_REFINEMENT_INSTRUCTIONS.get(check_name)
    if not template:
        return None
    
    return RefinementInstruction(
        check_name=check_name,
        instruction=template,
        parameters=parameters,
    )

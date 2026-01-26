"""Dataset lifecycle state definitions and transition rules.

This module defines the authoritative lifecycle states for datasets in the
Research Operating System (ROS) and enforces allowed state transitions.

Design Principles:
- Enum-based states for type safety
- Explicit transition graph (no implicit jumps)
- Human attestation gates clearly marked
- AI approval gates for AI-powered stages
- Read-only validation (no state mutations here)

See: docs/governance/DATASET_LIFECYCLE_ENFORCEMENT.md
"""

from enum import Enum, auto
from typing import Set, Dict, FrozenSet, Optional
from dataclasses import dataclass, field
from datetime import datetime


class AIApprovalMode(Enum):
    """AI approval modes for governing AI tool execution.
    
    REQUIRE_EACH: Require approval for each individual AI call
    APPROVE_PHASE: Approve all AI calls within a phase at once
    APPROVE_SESSION: Approve all AI calls for the entire session
    """
    REQUIRE_EACH = "REQUIRE_EACH"
    APPROVE_PHASE = "APPROVE_PHASE"
    APPROVE_SESSION = "APPROVE_SESSION"


@dataclass
class AIApprovalRecord:
    """Record of an AI approval decision."""
    stage_id: int
    stage_name: str
    approval_mode: AIApprovalMode
    approved: bool
    approved_by: str
    approved_at: datetime
    ai_model: Optional[str] = None
    ai_provider: Optional[str] = None
    cost_estimate: Optional[str] = None
    reason: Optional[str] = None


class LifecycleState(Enum):
    """Dataset lifecycle states.

    States progress from DRAFT through ARCHIVED, with explicit gates
    requiring human attestation at critical points.
    """

    DRAFT = "DRAFT"
    SPEC_DEFINED = "SPEC_DEFINED"
    EXTRACTION_COMPLETE = "EXTRACTION_COMPLETE"
    QA_PASSED = "QA_PASSED"
    QA_FAILED = "QA_FAILED"
    LINKED = "LINKED"
    ANALYSIS_READY = "ANALYSIS_READY"
    IN_ANALYSIS = "IN_ANALYSIS"
    ANALYSIS_COMPLETE = "ANALYSIS_COMPLETE"
    FROZEN = "FROZEN"
    ARCHIVED = "ARCHIVED"

    @classmethod
    def from_string(cls, value: str) -> "LifecycleState":
        """Parse state from string value.

        Args:
            value: State string (case-insensitive)

        Returns:
            Matching LifecycleState

        Raises:
            ValueError: If string does not match any state
        """
        normalized = value.upper().strip()
        for state in cls:
            if state.value == normalized:
                return state
        valid_states = [s.value for s in cls]
        raise ValueError(
            f"Invalid lifecycle state: '{value}'. " f"Valid states: {valid_states}"
        )


# =============================================================================
# TRANSITION RULES
# =============================================================================

# Allowed state transitions (adjacency list)
ALLOWED_TRANSITIONS: Dict[LifecycleState, FrozenSet[LifecycleState]] = {
    LifecycleState.DRAFT: frozenset(
        [
            LifecycleState.SPEC_DEFINED,
        ]
    ),
    LifecycleState.SPEC_DEFINED: frozenset(
        [
            LifecycleState.EXTRACTION_COMPLETE,
        ]
    ),
    LifecycleState.EXTRACTION_COMPLETE: frozenset(
        [
            LifecycleState.QA_PASSED,
            LifecycleState.QA_FAILED,
        ]
    ),
    LifecycleState.QA_PASSED: frozenset(
        [
            LifecycleState.LINKED,
            LifecycleState.ANALYSIS_READY,
        ]
    ),
    LifecycleState.QA_FAILED: frozenset(
        [
            LifecycleState.EXTRACTION_COMPLETE,  # Remediation cycle
        ]
    ),
    LifecycleState.LINKED: frozenset(
        [
            LifecycleState.ANALYSIS_READY,
        ]
    ),
    LifecycleState.ANALYSIS_READY: frozenset(
        [
            LifecycleState.IN_ANALYSIS,
            LifecycleState.FROZEN,  # Can freeze without analysis
        ]
    ),
    LifecycleState.IN_ANALYSIS: frozenset(
        [
            LifecycleState.ANALYSIS_COMPLETE,
            LifecycleState.ANALYSIS_READY,  # Pause/restart
        ]
    ),
    LifecycleState.ANALYSIS_COMPLETE: frozenset(
        [
            LifecycleState.FROZEN,
            LifecycleState.ARCHIVED,
        ]
    ),
    LifecycleState.FROZEN: frozenset(
        [
            LifecycleState.ARCHIVED,
        ]
    ),
    LifecycleState.ARCHIVED: frozenset(),  # Terminal state
}

# States requiring human attestation to enter
HUMAN_ATTESTATION_REQUIRED: FrozenSet[LifecycleState] = frozenset(
    [
        LifecycleState.QA_PASSED,
        LifecycleState.ANALYSIS_READY,
        LifecycleState.FROZEN,
    ]
)

# States that are immutable (no data changes allowed)
IMMUTABLE_STATES: FrozenSet[LifecycleState] = frozenset(
    [
        LifecycleState.FROZEN,
        LifecycleState.ARCHIVED,
    ]
)

# Terminal states (no further transitions)
TERMINAL_STATES: FrozenSet[LifecycleState] = frozenset(
    [
        LifecycleState.ARCHIVED,
    ]
)


def is_valid_transition(from_state: LifecycleState, to_state: LifecycleState) -> bool:
    """Check if a state transition is allowed.

    Args:
        from_state: Current lifecycle state
        to_state: Target lifecycle state

    Returns:
        True if transition is allowed, False otherwise
    """
    allowed = ALLOWED_TRANSITIONS.get(from_state, frozenset())
    return to_state in allowed


def requires_attestation(state: LifecycleState) -> bool:
    """Check if entering a state requires human attestation.

    Args:
        state: Target lifecycle state

    Returns:
        True if human attestation required, False otherwise
    """
    return state in HUMAN_ATTESTATION_REQUIRED


def is_immutable(state: LifecycleState) -> bool:
    """Check if a state prohibits data modifications.

    Args:
        state: Lifecycle state to check

    Returns:
        True if data is immutable in this state, False otherwise
    """
    return state in IMMUTABLE_STATES


def is_terminal(state: LifecycleState) -> bool:
    """Check if a state is terminal (no further transitions).

    Args:
        state: Lifecycle state to check

    Returns:
        True if state is terminal, False otherwise
    """
    return state in TERMINAL_STATES


def get_allowed_next_states(state: LifecycleState) -> FrozenSet[LifecycleState]:
    """Get all states reachable from the given state.

    Args:
        state: Current lifecycle state

    Returns:
        Set of allowed next states (may be empty for terminal states)
    """
    return ALLOWED_TRANSITIONS.get(state, frozenset())


def validate_state_history(history: list) -> list:
    """Validate a sequence of state transitions.

    Args:
        history: List of state strings in chronological order

    Returns:
        List of invalid transition tuples (from_state, to_state, index)
        Empty list if all transitions are valid
    """
    if not history:
        return []

    invalid = []
    for i in range(len(history) - 1):
        try:
            from_state = LifecycleState.from_string(history[i])
            to_state = LifecycleState.from_string(history[i + 1])
            if not is_valid_transition(from_state, to_state):
                invalid.append((history[i], history[i + 1], i))
        except ValueError as e:
            # Invalid state string
            invalid.append((history[i], history[i + 1], i))

    return invalid


# =============================================================================
# AI APPROVAL SYSTEM
# =============================================================================

# Stages that use AI tools and require approval
AI_STAGES: FrozenSet[int] = frozenset([
    2,   # Literature Search - AI-powered paper discovery
    3,   # IRB Proposal - AI-generated protocol
    4,   # Planned Extraction - AI variable selection
    5,   # PHI Scan - AI detection
    9,   # Summary - AI analysis
    10,  # Gap Analysis - AI evidence mapping
    11,  # Manuscript Ideation - AI proposal generation
    13,  # Statistics - AI statistical planning
    14,  # Drafting - AI manuscript drafting
    15,  # Polish Manuscript - AI editing
    16,  # Submission Readiness - AI journal matching
])

# AI tools available for each stage
AI_STAGE_TOOLS: Dict[int, list] = {
    2: [{"name": "Literature Search", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.05-0.15"}],
    3: [{"name": "IRB Proposal Generator", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.08-0.20"}],
    4: [{"name": "Extraction Planner", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.05-0.12"}],
    5: [{"name": "PHI Scanner", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.03-0.08"}],
    9: [{"name": "Summary Generator", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.05-0.15"}],
    10: [{"name": "Evidence Gap Mapper", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.08-0.20"}],
    11: [{"name": "Manuscript Ideator", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.10-0.25"}],
    13: [{"name": "Statistical Analyzer", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.08-0.18"}],
    14: [{"name": "Manuscript Drafter", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.15-0.35"}],
    15: [{"name": "Manuscript Polisher", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.10-0.25"}],
    16: [{"name": "Journal Matcher", "model": "GPT-4o", "provider": "OpenAI", "costEstimate": "$0.08-0.18"}],
}

# Phase mapping for APPROVE_PHASE mode
PHASE_STAGES: Dict[int, FrozenSet[int]] = {
    1: frozenset([1, 2, 3, 4]),      # Data Preparation
    2: frozenset([5, 6, 7, 8]),      # Data Processing & Validation
    3: frozenset([9, 10, 11]),       # Analysis & Ideation
    4: frozenset([12, 13, 14]),      # Manuscript Development
    5: frozenset([15, 16]),          # Finalization
    6: frozenset([17, 18, 19]),      # Conference Readiness
}


def is_ai_stage(stage_id: int) -> bool:
    """Check if a stage uses AI tools.

    Args:
        stage_id: The stage identifier

    Returns:
        True if stage uses AI tools, False otherwise
    """
    return stage_id in AI_STAGES


def get_ai_tools_for_stage(stage_id: int) -> list:
    """Get AI tools used by a specific stage.

    Args:
        stage_id: The stage identifier

    Returns:
        List of AI tool definitions, empty if stage doesn't use AI
    """
    return AI_STAGE_TOOLS.get(stage_id, [])


def get_phase_for_stage(stage_id: int) -> Optional[int]:
    """Get the phase number containing a stage.

    Args:
        stage_id: The stage identifier

    Returns:
        Phase number (1-6) or None if not found
    """
    for phase, stages in PHASE_STAGES.items():
        if stage_id in stages:
            return phase
    return None


def get_ai_stages_in_phase(phase: int) -> FrozenSet[int]:
    """Get all AI stages within a phase.

    Args:
        phase: Phase number (1-6)

    Returns:
        Set of stage IDs that use AI within the phase
    """
    phase_stages = PHASE_STAGES.get(phase, frozenset())
    return phase_stages.intersection(AI_STAGES)


def get_all_ai_stages() -> FrozenSet[int]:
    """Get all stages that use AI tools.

    Returns:
        Set of all AI-enabled stage IDs
    """
    return AI_STAGES

"""Active Sourcelit module - SANDBOX-aware code search with bounded snippets.

This module provides additive functionality alongside Phase 8 Sourcelit (FROZEN).
Design: Fail-closed, mode-aware, PHI-guarded.

Integration: Uses RosMode enum from src/governance/capabilities.py.

Task D additions: Expanded indexing scope with performance hardening.
Task E additions: Sourcelit synthesis orchestration layer.
"""

from .index import build_expanded_index, check_index_staleness, get_current_head_sha
from .orchestrator import (
    SourcelitOrchestrationError,
    SourcelitOrchestrationHandle,
    orchestrate_sourcelit_synthesis,
)
from .policy import SourcelitPolicy, SourcelitPolicyDecision
from .query import execute_query

__all__ = [
    # Policy (Task A)
    "SourcelitPolicy",
    "SourcelitPolicyDecision",
    # Query (Task B)
    "execute_query",
    # Indexing (Task D)
    "build_expanded_index",
    "check_index_staleness",
    "get_current_head_sha",
    # Orchestration (Task E)
    "orchestrate_sourcelit_synthesis",
    "SourcelitOrchestrationHandle",
    "SourcelitOrchestrationError",
]

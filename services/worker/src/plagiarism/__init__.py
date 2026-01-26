"""Plagiarism Check Provider System for Research Operating System.

This module provides a pluggable plagiarism detection system with:
- Abstract provider interface for different plagiarism APIs
- Mock provider for DEMO/testing environments
- Copyleaks integration for production use
- Approval gate for LIVE mode governance

Design Principles:
- Fail-closed: block on errors or misconfiguration
- PHI-safe: never store raw matched text, only hashes
- Audit trail: log all check requests and results
- Mode-aware: different behavior in DEMO vs LIVE

Governance Reference: docs/governance/CAPABILITIES.md
"""

from .provider import (
    PlagiarismProvider,
    PlagiarismResult,
    PlagiarismMatch,
    ProviderStatus,
    PlagiarismCheckError,
)
from .mock_provider import MockPlagiarismProvider
from .copyleaks_provider import CopyleaksProvider, get_copyleaks_provider
from .gate import (
    PlagiarismGate,
    PlagiarismAuditAction,
    check_plagiarism_with_gate,
    is_plagiarism_check_required,
)

__all__ = [
    # Core types
    "PlagiarismProvider",
    "PlagiarismResult",
    "PlagiarismMatch",
    "ProviderStatus",
    "PlagiarismCheckError",
    # Providers
    "MockPlagiarismProvider",
    "CopyleaksProvider",
    "get_copyleaks_provider",
    # Gate
    "PlagiarismGate",
    "PlagiarismAuditAction",
    "check_plagiarism_with_gate",
    "is_plagiarism_check_required",
]

__version__ = "1.0.0"

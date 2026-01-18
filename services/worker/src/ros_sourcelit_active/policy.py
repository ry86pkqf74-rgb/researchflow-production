"""Policy module for Active Sourcelit snippet exposure control.

Implements fail-closed policy decisions based on RosMode and environment.
Follows the CapabilityDecision pattern from src/governance/capabilities.py.
"""

from dataclasses import dataclass
from typing import Optional
import os

from src.governance.capabilities import RosMode


@dataclass(frozen=True)
class SourcelitPolicyDecision:
    """Immutable policy decision for snippet exposure.

    Follows the CapabilityDecision pattern from src/governance/capabilities.py.

    Attributes:
        allow_snippets: Whether snippets are permitted in current context
        max_snippet_chars: Maximum snippet length (0 if snippets blocked)
        reason: Human-readable explanation of the decision
        reason_code: Machine-readable code for logging/auditing
        mode: Current RosMode for provenance tracking
    """

    allow_snippets: bool
    max_snippet_chars: int
    reason: str
    reason_code: str
    mode: RosMode


class SourcelitPolicy:
    """Determines snippet exposure rules based on mode and environment.

    Hard Rules (fail-closed):
    - STANDBY: snippets ALWAYS disabled
    - SANDBOX: snippets allowed ONLY if NO_NETWORK=1
    - ACTIVE: fail-closed (snippets disabled) until Task E implements SANDBOX-only synthesis
    - LIVE: fail-closed (snippets disabled)

    Design: Conservative, auditable, testable, follows existing governance patterns.

    Integration: Uses RosMode enum from src/governance/capabilities.py.

    Example:
        >>> from src.governance.capabilities import RosMode
        >>> policy = SourcelitPolicy(mode=RosMode.SANDBOX, no_network=True)
        >>> decision = policy.evaluate()
        >>> assert decision.allow_snippets is True
        >>> assert decision.max_snippet_chars == 240
    """

    DEFAULT_MAX_SNIPPET_CHARS = 240

    def __init__(self, mode: RosMode, no_network: Optional[bool] = None):
        """Initialize policy with mode and optional network isolation flag.

        Args:
            mode: Current RosMode enum value (STANDBY, SANDBOX, ACTIVE, LIVE)
            no_network: Network isolation flag. If None, reads from NO_NETWORK
                        environment variable (defaults to checking os.environ)

        Note:
            The no_network parameter allows dependency injection for testing
            while defaulting to environment-based detection for production use.
        """
        self.mode = mode
        # Allow injection for testing, but default to environment
        if no_network is None:
            no_network = os.getenv("NO_NETWORK") == "1"
        self.no_network = no_network

    def evaluate(self) -> SourcelitPolicyDecision:
        """Evaluate policy and return decision.

        Decision logic (fail-closed):
        1. STANDBY always blocks snippets (immutable restriction)
        2. SANDBOX allows snippets only when NO_NETWORK=1
        3. ACTIVE/LIVE fail-closed until future governance approval

        Returns:
            SourcelitPolicyDecision with allow_snippets, max_snippet_chars,
            reason, reason_code, and mode

        Note:
            All decisions are immutable (frozen dataclass) for auditability.
            Reason codes are machine-readable for provenance logging.
        """
        # RULE 1: STANDBY always blocks snippets
        if self.mode == RosMode.STANDBY:
            return SourcelitPolicyDecision(
                allow_snippets=False,
                max_snippet_chars=0,
                reason="Snippets are permanently disabled in STANDBY mode",
                reason_code="STANDBY_NO_SNIPPETS",
                mode=self.mode,
            )

        # RULE 2: SANDBOX allows snippets only when offline (NO_NETWORK=1)
        if self.mode == RosMode.SANDBOX:
            if self.no_network:
                return SourcelitPolicyDecision(
                    allow_snippets=True,
                    max_snippet_chars=self.DEFAULT_MAX_SNIPPET_CHARS,
                    reason="Snippets allowed in SANDBOX mode with network isolation",
                    reason_code="SANDBOX_ALLOWED",
                    mode=self.mode,
                )
            else:
                return SourcelitPolicyDecision(
                    allow_snippets=False,
                    max_snippet_chars=0,
                    reason="Snippets require NO_NETWORK=1 in SANDBOX mode",
                    reason_code="SANDBOX_REQUIRES_OFFLINE",
                    mode=self.mode,
                )

        # RULE 3: ACTIVE/LIVE fail-closed (until future governance approval)
        return SourcelitPolicyDecision(
            allow_snippets=False,
            max_snippet_chars=0,
            reason=f"Snippets not yet approved for {self.mode.name} mode",
            reason_code=f"{self.mode.name}_BLOCKED",
            mode=self.mode,
        )

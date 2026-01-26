"""Runtime capability enforcement and attestation gates.

Implements PR47 capability system as documented in docs/governance/CAPABILITIES.md.

Design Principles:
- STANDBY mode is immutable (no capability can override)
- Fail-closed: missing config or attestation → block
- Offline-first: no network calls, no external dependencies
- Metadata-only: no PHI in logs or decision reasons

Governance Reference: docs/governance/CAPABILITIES.md
"""

from dataclasses import dataclass
from enum import Enum
import os
from typing import Dict, Optional


class RosMode(Enum):
    """Operating modes for Research Operating System.

    STANDBY: Fail-closed default, immutable restrictions
    SANDBOX: Testing with synthetic data, limited capabilities
    ACTIVE: Online/interactive workflows (Phase 1+)
    LIVE: Production mode (future, requires formal approval)
    """

    STANDBY = "STANDBY"
    SANDBOX = "SANDBOX"
    ACTIVE = "ACTIVE"
    LIVE = "LIVE"


class DataAdmissibility(Enum):
    """Data admissibility categories for capability gating.

    Values match exact strings from CAPABILITIES.md.
    """

    TEMPLATE = "TEMPLATE"
    VERIFIED_SCRUBBED = "VERIFIED_SCRUBBED"
    SYNTHETIC_PHI_TEST = "SYNTHETIC_PHI_TEST"

    @classmethod
    def from_string(cls, value: str) -> "DataAdmissibility":
        """Parse admissibility from string (case-insensitive).

        Args:
            value: Admissibility string

        Returns:
            Matching DataAdmissibility enum

        Raises:
            ValueError: If string does not match any category
        """
        normalized = value.upper().strip()
        for category in cls:
            if category.value == normalized:
                return category
        valid = [c.value for c in cls]
        raise ValueError(f"Invalid data admissibility: '{value}'. Valid: {valid}")


@dataclass
class CapabilityDecision:
    """Result of a capability authorization check.

    Attributes:
        allowed: Whether the capability is granted
        reason: Human-readable explanation
        reason_code: Machine-readable code (e.g., "STANDBY_BLOCKED")
        required_action: Optional action needed to grant capability
        capability: Capability name checked
        mode: Current ROS operating mode
        admissibility: Data admissibility category checked
    """

    allowed: bool
    reason: str
    reason_code: str
    required_action: Optional[str]
    capability: str
    mode: RosMode
    admissibility: Optional[DataAdmissibility] = None


# =============================================================================
# CAPABILITY FLAG DEFINITIONS
# =============================================================================
# These match exact names from docs/governance/CAPABILITIES.md

CAPABILITY_FLAGS = {
    "allow_real_phi": False,  # Requires IRB + HIPAA + Security
    "allow_external_runner": False,  # Requires Security + Network
    "allow_multifile_uploads": False,  # Requires Security
    "enable_ui_polish_features": False,  # Requires Product approval
    "allow_template_uploads_test": False,  # Requires Tech Lead
    "promote_dataset": False,  # Requires Tech Lead (Phase 2)
    "allow_online_ai_downstream": False,  # Requires Security (downstream artifacts only)
}

# Capabilities that require attestation
ATTESTATION_REQUIRED = {
    "allow_real_phi",
    "allow_multifile_uploads",
    "allow_template_uploads_test",
    "promote_dataset",
    "allow_online_ai_downstream",
}

# Capabilities permanently blocked in STANDBY (no override)
STANDBY_BLOCKED = {
    "allow_real_phi",
    "allow_external_runner",
    "allow_multifile_uploads",
    "promote_dataset",
    "allow_online_ai_downstream",
}


# =============================================================================
# MODE DETECTION
# =============================================================================


def get_current_mode() -> RosMode:
    """Determine current operating mode from environment/config.

    This function now delegates to RuntimeConfig for centralized configuration
    management. Maintains backward compatibility with existing callers.

    STANDBY mode detection (all must be true):
    - MOCK_ONLY=1
    - NO_NETWORK=1
    - ALLOW_UPLOADS=0

    Returns:
        Current RosMode

    Note:
        This function uses RuntimeConfig internally. For new code, consider
        using RuntimeConfig.from_env_and_optional_yaml().to_ros_mode() directly.
    """
    from src.runtime_config import RuntimeConfig

    # Delegate to RuntimeConfig for unified parsing logic
    # APP_MODE support for legacy compatibility
    config = RuntimeConfig.from_env_and_optional_yaml(None)

    # Handle legacy APP_MODE fallback (not in RuntimeConfig)
    if not os.getenv("ROS_MODE") and os.getenv("APP_MODE"):
        legacy_mode = os.getenv("APP_MODE", "").upper().strip()
        for mode in (RosMode.STANDBY, RosMode.ACTIVE, RosMode.SANDBOX, RosMode.LIVE):
            if legacy_mode == mode.value:
                return mode

    return config.to_ros_mode()


def get_capability_flag(capability_name: str) -> bool:
    """Get capability flag value from environment or defaults.

    Checks environment variable first (uppercase), then falls back to
    hardcoded defaults. All flags default to False (fail-closed).

    Args:
        capability_name: Capability flag name

    Returns:
        Boolean flag value
    """
    # Check environment variable (uppercase)
    env_var = capability_name.upper()
    env_value = os.getenv(env_var)

    if env_value is not None:
        return env_value == "1"

    # Fall back to default
    return CAPABILITY_FLAGS.get(capability_name, False)


# =============================================================================
# CAPABILITY DECISION API
# =============================================================================


def require_capability(
    capability_name: str,
    admissibility: Optional[DataAdmissibility] = None,
    attestation_complete: bool = False,
    context: Optional[Dict] = None,
) -> CapabilityDecision:
    """Check if a capability is authorized with current governance state.

    Decision rules (fail-closed):
    1. If STANDBY and capability in STANDBY_BLOCKED → always deny
    2. If capability flag is False → deny
    3. If attestation required but not complete → deny
    4. If admissibility provided but incompatible → deny
    5. Otherwise → allow

    Args:
        capability_name: Name of capability (must match CAPABILITIES.md)
        admissibility: Data admissibility category (optional)
        attestation_complete: Whether runtime attestation is complete
        context: Optional context dict (for logging/debugging)

    Returns:
        CapabilityDecision with authorization result
    """
    mode = get_current_mode()

    # RULE 1: STANDBY is immutable for risky capabilities
    if mode == RosMode.STANDBY and capability_name in STANDBY_BLOCKED:
        return CapabilityDecision(
            allowed=False,
            reason=f"Capability '{capability_name}' is permanently disabled in STANDBY mode",
            reason_code="STANDBY_BLOCKED",
            required_action="Switch to SANDBOX mode (requires governance approval)",
            capability=capability_name,
            mode=mode,
            admissibility=admissibility,
        )

    # RULE 2: Check capability flag
    flag_enabled = get_capability_flag(capability_name)
    if not flag_enabled:
        return CapabilityDecision(
            allowed=False,
            reason=f"Capability '{capability_name}' is disabled in configuration",
            reason_code="FLAG_DISABLED",
            required_action=f"Set {capability_name.upper()}=1 (requires governance approval)",
            capability=capability_name,
            mode=mode,
            admissibility=admissibility,
        )

    # RULE 3: Check attestation requirement
    if capability_name in ATTESTATION_REQUIRED and not attestation_complete:
        return CapabilityDecision(
            allowed=False,
            reason=f"Capability '{capability_name}' requires runtime attestation",
            reason_code="ATTESTATION_REQUIRED",
            required_action="Complete attestation form with correct phrase and data category",
            capability=capability_name,
            mode=mode,
            admissibility=admissibility,
        )

    # RULE 4: Admissibility checks (future: more complex rules)
    # For Phase 1, we accept any admissibility if attestation is complete
    # PR48+ may add capability-specific admissibility requirements

    # RULE 5: All checks passed → allow
    return CapabilityDecision(
        allowed=True,
        reason=f"Capability '{capability_name}' authorized",
        reason_code="AUTHORIZED",
        required_action=None,
        capability=capability_name,
        mode=mode,
        admissibility=admissibility,
    )


# =============================================================================
# ATTESTATION PHRASE VALIDATION
# =============================================================================

# Exact attestation phrases from CAPABILITIES.md (case-sensitive)
ATTESTATION_PHRASES = {
    DataAdmissibility.TEMPLATE: "I confirm this is template/fixture data",
    DataAdmissibility.VERIFIED_SCRUBBED: "I confirm this data has been scrubbed and verified",
    DataAdmissibility.SYNTHETIC_PHI_TEST: "I confirm this is synthetic PHI for scanner testing",
}


def validate_attestation_phrase(
    admissibility: DataAdmissibility,
    phrase: str,
) -> bool:
    """Validate attestation phrase matches required exact string.

    Args:
        admissibility: Data category
        phrase: User-entered phrase

    Returns:
        True if phrase matches exactly (case-sensitive), False otherwise
    """
    expected = ATTESTATION_PHRASES.get(admissibility)
    if expected is None:
        return False

    # Exact match, case-sensitive
    return phrase == expected


def get_required_attestation_phrase(admissibility: DataAdmissibility) -> str:
    """Get the required attestation phrase for a data category.

    Args:
        admissibility: Data category

    Returns:
        Required attestation phrase
    """
    return ATTESTATION_PHRASES.get(admissibility, "")

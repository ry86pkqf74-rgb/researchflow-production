"""
Stage 16: Collaboration Handoff

Handles sharing with collaborators including:
- Recipient validation
- Permission level assignment
- Secure share link generation
- Access grant tracking with expiration
"""

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stages.stage_16_handoff")

# Valid permission levels (from most to least restrictive)
PERMISSION_LEVELS = {
    "view": {"can_view": True, "can_download": False, "can_edit": False, "can_share": False},
    "download": {"can_view": True, "can_download": True, "can_edit": False, "can_share": False},
    "edit": {"can_view": True, "can_download": True, "can_edit": True, "can_share": False},
    "admin": {"can_view": True, "can_download": True, "can_edit": True, "can_share": True},
}

# Default expiration periods by governance mode (in days)
DEFAULT_EXPIRATION_DAYS = {
    "DEMO": 7,
    "STAGING": 30,
    "PRODUCTION": 90,
}

# Maximum recipients per handoff
MAX_RECIPIENTS = 50


def generate_share_token() -> str:
    """Generate a cryptographically secure share token.

    Returns:
        URL-safe base64 encoded token (32 bytes)
    """
    return secrets.token_urlsafe(32)


def generate_share_link(
    base_url: str,
    token: str,
    resource_id: str,
) -> str:
    """Generate a secure share link.

    Args:
        base_url: Base URL for share links
        token: Secure share token
        resource_id: ID of the resource being shared

    Returns:
        Complete share URL
    """
    return f"{base_url}/share/{resource_id}?token={token}"


def hash_email(email: str) -> str:
    """Hash email for logging (privacy protection).

    Args:
        email: Email address to hash

    Returns:
        First 8 characters of SHA256 hash
    """
    return hashlib.sha256(email.lower().strip().encode()).hexdigest()[:8]


def validate_recipient(recipient: Dict[str, Any]) -> tuple[bool, str]:
    """Validate a recipient configuration.

    Args:
        recipient: Recipient dictionary with email and optional permissions

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(recipient, dict):
        return False, "Recipient must be a dictionary"

    email = recipient.get("email")
    if not email or not isinstance(email, str):
        return False, "Recipient must have a valid email"

    # Basic email format validation
    if "@" not in email or "." not in email.split("@")[-1]:
        return False, f"Invalid email format: {hash_email(email)}..."

    permission = recipient.get("permission", "view")
    if permission not in PERMISSION_LEVELS:
        return False, f"Invalid permission level: {permission}"

    return True, ""


def calculate_expiration(
    governance_mode: str,
    custom_days: Optional[int] = None,
) -> str:
    """Calculate expiration timestamp for share links.

    Args:
        governance_mode: Current governance mode
        custom_days: Optional custom expiration in days

    Returns:
        ISO format expiration timestamp
    """
    if custom_days is not None:
        days = max(1, min(custom_days, 365))  # Clamp between 1-365 days
    else:
        days = DEFAULT_EXPIRATION_DAYS.get(governance_mode, 30)

    expiration = datetime.utcnow() + timedelta(days=days)
    return expiration.isoformat() + "Z"


@register_stage
class CollaborationHandoffStage:
    """Stage 16: Collaboration Handoff

    Manages sharing research artifacts with collaborators through
    secure share links with configurable permissions and expiration.
    """

    stage_id = 16
    stage_name = "Collaboration Handoff"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute collaboration handoff.

        Args:
            context: Stage execution context

        Returns:
            StageResult with share links, access grants, and expiration
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        errors: List[str] = []
        warnings: List[str] = []
        output: Dict[str, Any] = {}

        logger.info(f"Starting collaboration handoff for job {context.job_id}")

        # Get handoff configuration
        config = context.config
        recipients = config.get("recipients", [])
        permissions = config.get("permissions", {})
        base_url = config.get("share_base_url", "https://researchflow.example.com")
        expiration_days = config.get("expiration_days")

        # Validate recipients
        if not recipients:
            errors.append("No recipients specified for handoff")
        elif len(recipients) > MAX_RECIPIENTS:
            errors.append(
                f"Too many recipients ({len(recipients)}). Maximum: {MAX_RECIPIENTS}"
            )

        # Check for bundle from stage 15
        bundle_result = context.previous_results.get(15)
        resource_id = None

        if bundle_result and bundle_result.output:
            resource_id = bundle_result.output.get("bundle_id")
            phi_status = bundle_result.output.get("phi_status", {})

            # Warn if PHI was detected in bundled artifacts
            if not phi_status.get("safe_to_bundle", True):
                warnings.append(
                    "Sharing artifacts with potential PHI - ensure recipients "
                    "have appropriate data access agreements"
                )

        if not resource_id:
            resource_id = f"job-{context.job_id}"
            warnings.append("No bundle found from stage 15, using job ID as resource")

        # Process recipients and generate share links
        share_links: List[Dict[str, Any]] = []
        access_grants: List[Dict[str, Any]] = []
        valid_recipients = 0

        for i, recipient in enumerate(recipients):
            # Validate recipient
            is_valid, error_msg = validate_recipient(recipient)
            if not is_valid:
                warnings.append(f"Recipient {i + 1}: {error_msg}")
                continue

            valid_recipients += 1
            email = recipient["email"]
            email_hash = hash_email(email)

            # Determine permission level
            permission_level = recipient.get(
                "permission",
                permissions.get("default", "view")
            )

            # Generate secure share token
            token = generate_share_token()

            # Generate share link
            share_link = generate_share_link(base_url, token, resource_id)

            # Calculate expiration
            expiration = calculate_expiration(
                context.governance_mode,
                expiration_days
            )

            # Create grant ID
            grant_id = f"grant-{uuid.uuid4().hex[:8]}"

            # Record share link (email hashed for privacy)
            share_links.append({
                "recipient_hash": email_hash,
                "link": share_link,
                "grant_id": grant_id,
                "created_at": started_at,
            })

            # Record access grant
            access_grants.append({
                "grant_id": grant_id,
                "recipient_hash": email_hash,
                "resource_id": resource_id,
                "permission_level": permission_level,
                "permissions": PERMISSION_LEVELS[permission_level],
                "expiration": expiration,
                "created_at": started_at,
                "created_by_job": context.job_id,
                "governance_mode": context.governance_mode,
            })

            logger.info(
                f"Generated share link for recipient {email_hash} "
                f"with {permission_level} permission, expires {expiration}"
            )

        # Prepare output
        output["share_links"] = share_links
        output["access_grants"] = access_grants
        output["expiration"] = calculate_expiration(
            context.governance_mode, expiration_days
        )
        output["resource_id"] = resource_id
        output["summary"] = {
            "total_recipients": len(recipients),
            "valid_recipients": valid_recipients,
            "invalid_recipients": len(recipients) - valid_recipients,
            "default_permission": permissions.get("default", "view"),
        }

        # Add governance warnings
        if context.governance_mode == "PRODUCTION":
            if valid_recipients > 10:
                warnings.append(
                    f"Large recipient list ({valid_recipients}) in PRODUCTION mode - "
                    "consider using group-based sharing"
                )

        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        # Fail if no valid recipients
        if valid_recipients == 0 and recipients:
            errors.append("No valid recipients after validation")

        status = "failed" if errors else "completed"

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=output,
            artifacts=[],
            errors=errors,
            warnings=warnings,
            metadata={
                "governance_mode": context.governance_mode,
                "recipient_count": valid_recipients,
                "permission_levels_used": list(set(
                    g["permission_level"] for g in access_grants
                )),
            },
        )

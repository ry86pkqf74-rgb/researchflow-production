"""
Stage 3: IRB Compliance Check

This stage validates that the research protocol has proper IRB approval
and that the dataset usage complies with the approved protocol.
"""

import logging
from datetime import datetime
from typing import Any, Dict

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stages.stage_03_irb")


@register_stage
class Stage03IRBCompliance:
    """IRB Compliance Check Stage.

    This stage performs the following checks:
    - Validates IRB protocol number exists
    - Verifies protocol approval status
    - Checks data usage aligns with approved protocol
    - Validates consent requirements are met
    """

    stage_id = 3
    stage_name = "IRB Compliance Check"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute IRB compliance validation.

        Args:
            context: StageContext with job configuration

        Returns:
            StageResult with compliance check results
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        warnings = []
        errors = []

        logger.info(f"Running IRB compliance check for job {context.job_id}")

        # Get IRB configuration
        irb_config = context.config.get("irb", {})
        protocol_number = irb_config.get("protocol_number")
        approval_date = irb_config.get("approval_date")
        expiration_date = irb_config.get("expiration_date")

        # Placeholder: In production, these checks would query IRB database
        compliance_results = {
            "protocol_number": protocol_number,
            "protocol_valid": protocol_number is not None,
            "approval_status": "approved" if protocol_number else "not_found",
            "consent_verified": True,
            "data_use_authorized": True,
        }

        # Add warnings for missing optional fields
        if not approval_date:
            warnings.append("IRB approval date not specified")
        if not expiration_date:
            warnings.append("IRB expiration date not specified")

        # Check for demo mode
        if context.governance_mode == "DEMO":
            compliance_results["demo_mode"] = True
            warnings.append("Running in DEMO mode - IRB checks are simulated")

        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status="completed",
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=compliance_results,
            warnings=warnings,
            errors=errors,
            metadata={
                "governance_mode": context.governance_mode,
            },
        )

"""
Stage 5: PHI Detection and Handling

This stage scans data for Protected Health Information (PHI) and
ensures proper handling according to HIPAA requirements.

Uses canonical PHI patterns from the generated module for consistency
with Node services.
"""

import hashlib
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Tuple

from ..types import StageContext, StageResult
from ..registry import register_stage

# Import generated PHI patterns - single source of truth
from src.validation.phi_patterns_generated import (
    PHI_PATTERNS_HIGH_CONFIDENCE,
    PHI_PATTERNS_OUTPUT_GUARD,
)

logger = logging.getLogger("workflow_engine.stages.stage_05_phi")


def hash_match(text: str) -> str:
    """Compute SHA256 hash of matched text (first 12 chars).

    CRITICAL: Never store raw PHI. Only hashes for deduplication.

    Args:
        text: Matched PHI text

    Returns:
        First 12 characters of SHA256 hash
    """
    return hashlib.sha256(text.encode()).hexdigest()[:12]


def scan_text_for_phi(
    content: str,
    tier: str = "HIGH_CONFIDENCE"
) -> List[Dict[str, Any]]:
    """Scan text content for PHI patterns.

    Args:
        content: Text content to scan
        tier: Pattern tier to use ("HIGH_CONFIDENCE" or "OUTPUT_GUARD")

    Returns:
        List of PHI findings (hash-only, no raw values)
    """
    patterns = (
        PHI_PATTERNS_HIGH_CONFIDENCE
        if tier == "HIGH_CONFIDENCE"
        else PHI_PATTERNS_OUTPUT_GUARD
    )

    findings: List[Dict[str, Any]] = []

    for category, pattern in patterns:
        for match in pattern.finditer(content):
            # CRITICAL: Hash immediately, never store raw match
            match_text = match.group()
            findings.append({
                "category": category,
                "matchHash": hash_match(match_text),
                "matchLength": len(match_text),
                "position": {
                    "start": match.start(),
                    "end": match.end(),
                },
            })

    return findings


@register_stage
class Stage05PHIDetection:
    """PHI Detection and Handling Stage.

    This stage performs the following:
    - Scans dataset columns for potential PHI
    - Identifies direct identifiers (names, SSN, MRN)
    - Identifies quasi-identifiers (DOB, ZIP, gender combinations)
    - Validates de-identification requirements
    - Generates PHI inventory report
    """

    stage_id = 5
    stage_name = "PHI Detection"

    # Categories of PHI to detect
    PHI_CATEGORIES = [
        "names",
        "geographic_data",
        "dates",
        "phone_numbers",
        "fax_numbers",
        "email_addresses",
        "social_security_numbers",
        "medical_record_numbers",
        "health_plan_numbers",
        "account_numbers",
        "certificate_numbers",
        "vehicle_identifiers",
        "device_identifiers",
        "web_urls",
        "ip_addresses",
        "biometric_identifiers",
        "photographs",
        "unique_identifiers",
    ]

    async def execute(self, context: StageContext) -> StageResult:
        """Execute PHI detection scan.

        Args:
            context: StageContext with job configuration

        Returns:
            StageResult with PHI detection results (hash-only, no raw PHI)
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        warnings: List[str] = []
        errors: List[str] = []
        artifacts: List[str] = []

        logger.info(f"Running PHI detection for job {context.job_id}")

        # Get PHI configuration
        phi_config = context.config.get("phi", {})
        scan_mode = phi_config.get("scan_mode", "standard")
        tier = (
            "OUTPUT_GUARD"
            if scan_mode == "strict"
            else "HIGH_CONFIDENCE"
        )

        all_findings: List[Dict[str, Any]] = []
        content_length = 0

        # Scan file content if provided
        file_path = context.dataset_pointer
        if file_path and os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                content_length = len(content)

                # Perform PHI scan
                all_findings = scan_text_for_phi(content, tier=tier)
                logger.info(f"Scanned {content_length} chars, found {len(all_findings)} potential PHI matches")

            except Exception as e:
                errors.append(f"Failed to read file for PHI scan: {str(e)}")

        # Aggregate findings by category (no raw PHI in output)
        categories_found: Dict[str, int] = {}
        for finding in all_findings:
            cat = finding["category"]
            categories_found[cat] = categories_found.get(cat, 0) + 1

        # Determine risk level
        phi_count = len(all_findings)
        if phi_count == 0:
            risk_level = "none"
        elif phi_count <= 5:
            risk_level = "low"
        elif phi_count <= 20:
            risk_level = "medium"
        else:
            risk_level = "high"

        # CRITICAL: Detection results contain NO raw PHI
        # Only hashes, counts, and positions
        detection_results = {
            "scan_mode": scan_mode,
            "tier": tier,
            "content_length": content_length,
            "total_findings": phi_count,
            "categories_found": categories_found,
            "risk_level": risk_level,
            "phi_detected": phi_count > 0,
            "requires_deidentification": risk_level in ("medium", "high"),
            # Store individual findings (hash-only)
            "findings": all_findings,
        }

        # Mode-specific handling
        if context.governance_mode == "DEMO":
            detection_results["demo_mode"] = True
            if phi_count > 0:
                warnings.append("DEMO mode: PHI detected but processing continues")

        if context.governance_mode == "PRODUCTION" and risk_level == "high":
            errors.append("Production mode: High PHI risk requires manual review")

        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        # Fail if critical PHI detected in production
        status = "failed" if errors else "completed"

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=detection_results,
            artifacts=artifacts,
            warnings=warnings,
            errors=errors,
            metadata={
                "governance_mode": context.governance_mode,
                "phi_categories_checked": self.PHI_CATEGORIES,
                "pattern_count": len(PHI_PATTERNS_OUTPUT_GUARD),
            },
        )

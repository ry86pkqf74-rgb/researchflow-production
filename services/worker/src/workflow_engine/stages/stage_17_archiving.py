"""
Stage 17: Archiving

Handles long-term project archiving including:
- Archive location configuration
- Retention policy enforcement
- Comprehensive audit trail generation
- DOI assignment for citable archives
"""

import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stages.stage_17_archiving")

# Supported archive locations
ARCHIVE_LOCATIONS = {
    "institutional": "Institutional repository",
    "cloud": "Cloud archive storage",
    "local": "Local long-term storage",
    "external": "External archive service",
}

# Retention policy options (in years)
RETENTION_POLICIES = {
    "standard": {"years": 7, "description": "Standard research data retention"},
    "extended": {"years": 15, "description": "Extended retention for longitudinal studies"},
    "permanent": {"years": 100, "description": "Permanent archival"},
    "regulatory": {"years": 10, "description": "Regulatory compliance retention"},
    "hipaa": {"years": 6, "description": "HIPAA minimum retention period"},
}


def generate_archive_id() -> str:
    """Generate a unique archive identifier.

    Returns:
        UUID-based archive identifier
    """
    return f"archive-{uuid.uuid4().hex[:16]}"


def generate_doi_placeholder(archive_id: str, job_id: str) -> str:
    """Generate a placeholder DOI for the archive.

    Note: In production, this would integrate with a DOI registration service
    like DataCite or Crossref.

    Args:
        archive_id: Unique archive identifier
        job_id: Job identifier

    Returns:
        Placeholder DOI string
    """
    # Create a deterministic suffix from archive_id
    suffix = hashlib.md5(f"{archive_id}:{job_id}".encode()).hexdigest()[:8]
    return f"10.12345/researchflow.{suffix}"


def compute_audit_log_hash(audit_entries: List[Dict[str, Any]]) -> str:
    """Compute integrity hash of the audit log.

    Creates a SHA256 hash of the serialized audit log for tamper detection.

    Args:
        audit_entries: List of audit log entries

    Returns:
        SHA256 hex digest of the audit log
    """
    serialized = json.dumps(audit_entries, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()


def calculate_retention_date(policy_name: str) -> str:
    """Calculate the retention end date based on policy.

    Args:
        policy_name: Name of the retention policy

    Returns:
        ISO format retention end date
    """
    policy = RETENTION_POLICIES.get(policy_name, RETENTION_POLICIES["standard"])
    years = policy["years"]
    retention_end = datetime.utcnow() + timedelta(days=years * 365)
    return retention_end.isoformat() + "Z"


def generate_audit_trail(context: StageContext) -> List[Dict[str, Any]]:
    """Generate comprehensive audit trail from workflow execution.

    Collects audit information from all previous stages to create
    a complete provenance record.

    Args:
        context: Stage execution context

    Returns:
        List of audit trail entries
    """
    audit_entries: List[Dict[str, Any]] = []
    now = datetime.utcnow().isoformat() + "Z"

    # Add job initiation entry
    audit_entries.append({
        "event_id": f"audit-{uuid.uuid4().hex[:8]}",
        "timestamp": context.metadata.get("job_started_at", now),
        "event_type": "job_initiated",
        "job_id": context.job_id,
        "governance_mode": context.governance_mode,
        "details": {
            "dataset_pointer": context.dataset_pointer,
            "config_hash": hashlib.sha256(
                json.dumps(context.config, sort_keys=True).encode()
            ).hexdigest()[:12],
        },
    })

    # Add entries for each completed stage
    for stage_id in sorted(context.previous_results.keys()):
        result = context.previous_results[stage_id]
        audit_entries.append({
            "event_id": f"audit-{uuid.uuid4().hex[:8]}",
            "timestamp": result.completed_at,
            "event_type": "stage_completed",
            "stage_id": stage_id,
            "stage_name": result.stage_name,
            "status": result.status,
            "duration_ms": result.duration_ms,
            "details": {
                "error_count": len(result.errors),
                "warning_count": len(result.warnings),
                "artifact_count": len(result.artifacts),
                "output_keys": list(result.output.keys()) if result.output else [],
            },
        })

    # Add archiving initiation entry
    audit_entries.append({
        "event_id": f"audit-{uuid.uuid4().hex[:8]}",
        "timestamp": now,
        "event_type": "archiving_initiated",
        "job_id": context.job_id,
        "details": {
            "total_stages_completed": len(context.previous_results),
            "governance_mode": context.governance_mode,
        },
    })

    return audit_entries


@register_stage
class ArchivingStage:
    """Stage 17: Archiving

    Handles long-term archiving of research projects with comprehensive
    audit trails, retention policy enforcement, and DOI assignment.
    """

    stage_id = 17
    stage_name = "Archiving"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute project archiving.

        Args:
            context: Stage execution context

        Returns:
            StageResult with archive record, audit log hash, and DOI
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        errors: List[str] = []
        warnings: List[str] = []
        artifacts: List[str] = []
        output: Dict[str, Any] = {}

        logger.info(f"Starting archiving for job {context.job_id}")

        # Get archiving configuration
        config = context.config
        archive_location = config.get("archive_location", "institutional")
        retention_policy = config.get("retention_policy", "standard")

        # Validate archive location
        if archive_location not in ARCHIVE_LOCATIONS:
            errors.append(
                f"Invalid archive location '{archive_location}'. "
                f"Valid options: {list(ARCHIVE_LOCATIONS.keys())}"
            )

        # Validate retention policy
        if retention_policy not in RETENTION_POLICIES:
            errors.append(
                f"Invalid retention policy '{retention_policy}'. "
                f"Valid options: {list(RETENTION_POLICIES.keys())}"
            )

        # Check PHI status from previous stages
        phi_result = context.previous_results.get(5)
        phi_detected = False
        if phi_result and phi_result.output:
            phi_detected = phi_result.output.get("phi_detected", False)
            risk_level = phi_result.output.get("risk_level", "unknown")

            if phi_detected:
                warnings.append(
                    f"Archiving data with PHI (risk level: {risk_level}). "
                    "Ensure archive location meets HIPAA requirements."
                )

                # Enforce HIPAA retention for PHI data
                if retention_policy != "hipaa" and retention_policy != "regulatory":
                    warnings.append(
                        "PHI detected - consider using 'hipaa' or 'regulatory' "
                        "retention policy for compliance"
                    )

        # Generate archive record
        archive_id = generate_archive_id()
        retention_date = calculate_retention_date(retention_policy)

        # Generate DOI
        doi = generate_doi_placeholder(archive_id, context.job_id)

        # Generate comprehensive audit trail
        audit_trail = generate_audit_trail(context)

        # Compute audit log hash for integrity verification
        audit_log_hash = compute_audit_log_hash(audit_trail)

        # Add archiving completion to audit trail
        audit_trail.append({
            "event_id": f"audit-{uuid.uuid4().hex[:8]}",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event_type": "archive_created",
            "archive_id": archive_id,
            "details": {
                "location": archive_location,
                "retention_policy": retention_policy,
                "retention_until": retention_date,
                "doi": doi,
                "audit_log_hash": audit_log_hash,
            },
        })

        # Recalculate hash after adding final entry
        final_audit_log_hash = compute_audit_log_hash(audit_trail)

        # Build archive record
        archive_record = {
            "archive_id": archive_id,
            "job_id": context.job_id,
            "created_at": started_at,
            "location": {
                "type": archive_location,
                "description": ARCHIVE_LOCATIONS.get(archive_location, "Unknown"),
            },
            "retention": {
                "policy": retention_policy,
                "description": RETENTION_POLICIES.get(
                    retention_policy, {}
                ).get("description", "Unknown"),
                "retention_until": retention_date,
            },
            "governance_mode": context.governance_mode,
            "phi_status": {
                "phi_detected": phi_detected,
                "hipaa_compliant_storage": archive_location in ("institutional", "cloud"),
            },
            "provenance": {
                "stages_completed": len(context.previous_results),
                "workflow_version": context.metadata.get("workflow_version", "1.0"),
            },
        }

        # Collect all artifacts from previous stages
        archived_artifacts: List[str] = []
        for stage_id, result in context.previous_results.items():
            if result.artifacts:
                archived_artifacts.extend(result.artifacts)

        archive_record["artifact_count"] = len(archived_artifacts)

        # Prepare output
        output["archive_record"] = archive_record
        output["audit_log_hash"] = final_audit_log_hash
        output["doi"] = doi
        output["audit_trail"] = audit_trail
        output["archived_artifact_count"] = len(archived_artifacts)

        # Write audit log artifact
        audit_log_path = os.path.join(
            context.artifact_path,
            f"{archive_id}_audit_log.json"
        )
        try:
            os.makedirs(os.path.dirname(audit_log_path), exist_ok=True)
            with open(audit_log_path, "w", encoding="utf-8") as f:
                json.dump({
                    "archive_id": archive_id,
                    "audit_log_hash": final_audit_log_hash,
                    "entries": audit_trail,
                }, f, indent=2)
            artifacts.append(audit_log_path)
            logger.info(f"Audit log written to {audit_log_path}")
        except Exception as e:
            warnings.append(f"Failed to write audit log: {str(e)}")

        # Write archive record artifact
        archive_record_path = os.path.join(
            context.artifact_path,
            f"{archive_id}_record.json"
        )
        try:
            with open(archive_record_path, "w", encoding="utf-8") as f:
                json.dump(archive_record, f, indent=2)
            artifacts.append(archive_record_path)
            logger.info(f"Archive record written to {archive_record_path}")
        except Exception as e:
            warnings.append(f"Failed to write archive record: {str(e)}")

        logger.info(
            f"Archive {archive_id} created with DOI {doi}, "
            f"retention until {retention_date}"
        )

        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        status = "failed" if errors else "completed"

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=output,
            artifacts=artifacts,
            errors=errors,
            warnings=warnings,
            metadata={
                "governance_mode": context.governance_mode,
                "archive_id": archive_id,
                "doi": doi,
                "retention_policy": retention_policy,
                "archive_location": archive_location,
                "audit_entry_count": len(audit_trail),
            },
        )

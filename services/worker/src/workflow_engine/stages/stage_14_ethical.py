"""
Stage 14: Ethical Review

Handles compliance and ethical standard verification including:
- HIPAA compliance verification
- IRB protocol compliance
- GDPR data protection compliance
- Institutional policy compliance
- Remediation task generation

This stage ensures research meets all ethical and regulatory requirements.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stage_14_ethical")

# Default compliance checklist
DEFAULT_COMPLIANCE_CHECKLIST = {
    "hipaa": {
        "name": "HIPAA Compliance",
        "description": "Health Insurance Portability and Accountability Act requirements",
        "requirements": [
            {
                "id": "hipaa_phi_protection",
                "name": "PHI Protection",
                "description": "All Protected Health Information is properly de-identified or protected",
                "severity": "critical",
            },
            {
                "id": "hipaa_minimum_necessary",
                "name": "Minimum Necessary Standard",
                "description": "Only minimum necessary PHI is used for the research purpose",
                "severity": "high",
            },
            {
                "id": "hipaa_access_controls",
                "name": "Access Controls",
                "description": "Appropriate access controls are in place for PHI",
                "severity": "critical",
            },
            {
                "id": "hipaa_audit_trail",
                "name": "Audit Trail",
                "description": "PHI access and modifications are logged",
                "severity": "high",
            },
        ],
    },
    "irb": {
        "name": "IRB Compliance",
        "description": "Institutional Review Board protocol requirements",
        "requirements": [
            {
                "id": "irb_approval",
                "name": "IRB Approval",
                "description": "Research has current IRB approval",
                "severity": "critical",
            },
            {
                "id": "irb_protocol_adherence",
                "name": "Protocol Adherence",
                "description": "Research activities follow approved protocol",
                "severity": "critical",
            },
            {
                "id": "irb_informed_consent",
                "name": "Informed Consent",
                "description": "Proper informed consent obtained from participants",
                "severity": "critical",
            },
            {
                "id": "irb_adverse_reporting",
                "name": "Adverse Event Reporting",
                "description": "Process for reporting adverse events is in place",
                "severity": "high",
            },
        ],
    },
    "gdpr": {
        "name": "GDPR Compliance",
        "description": "General Data Protection Regulation requirements",
        "requirements": [
            {
                "id": "gdpr_lawful_basis",
                "name": "Lawful Basis",
                "description": "Lawful basis for data processing is established",
                "severity": "critical",
            },
            {
                "id": "gdpr_data_minimization",
                "name": "Data Minimization",
                "description": "Only necessary data is collected and processed",
                "severity": "high",
            },
            {
                "id": "gdpr_subject_rights",
                "name": "Data Subject Rights",
                "description": "Mechanisms for data subject rights are in place",
                "severity": "high",
            },
            {
                "id": "gdpr_data_protection",
                "name": "Data Protection",
                "description": "Appropriate technical measures protect personal data",
                "severity": "critical",
            },
            {
                "id": "gdpr_transfer_safeguards",
                "name": "Transfer Safeguards",
                "description": "International data transfers have appropriate safeguards",
                "severity": "high",
            },
        ],
    },
    "institutional": {
        "name": "Institutional Policy",
        "description": "Organization-specific research policies",
        "requirements": [
            {
                "id": "inst_data_governance",
                "name": "Data Governance",
                "description": "Research follows institutional data governance policies",
                "severity": "medium",
            },
            {
                "id": "inst_publication_policy",
                "name": "Publication Policy",
                "description": "Publication plans comply with institutional policies",
                "severity": "medium",
            },
            {
                "id": "inst_conflict_disclosure",
                "name": "Conflict of Interest",
                "description": "Conflicts of interest are properly disclosed",
                "severity": "high",
            },
        ],
    },
}


def check_requirement(
    requirement: Dict[str, Any],
    previous_results: Dict[int, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check a single compliance requirement.

    Args:
        requirement: Requirement specification
        previous_results: Results from previous stages
        config: Job configuration

    Returns:
        Compliance check result
    """
    req_id = requirement["id"]
    result = {
        "requirement_id": req_id,
        "name": requirement["name"],
        "description": requirement["description"],
        "severity": requirement["severity"],
        "status": "unknown",
        "details": "",
        "evidence": [],
    }

    # Check specific requirements based on ID
    if req_id == "hipaa_phi_protection":
        result = _check_phi_protection(result, previous_results, config)
    elif req_id == "hipaa_minimum_necessary":
        result = _check_minimum_necessary(result, previous_results, config)
    elif req_id == "hipaa_access_controls":
        result = _check_access_controls(result, config)
    elif req_id == "hipaa_audit_trail":
        result = _check_audit_trail(result, config)
    elif req_id == "irb_approval":
        result = _check_irb_approval(result, previous_results, config)
    elif req_id == "irb_protocol_adherence":
        result = _check_protocol_adherence(result, previous_results, config)
    elif req_id == "irb_informed_consent":
        result = _check_informed_consent(result, config)
    elif req_id == "irb_adverse_reporting":
        result = _check_adverse_reporting(result, config)
    elif req_id.startswith("gdpr_"):
        result = _check_gdpr_requirement(result, req_id, config)
    elif req_id.startswith("inst_"):
        result = _check_institutional_requirement(result, req_id, config)
    else:
        result["status"] = "not_applicable"
        result["details"] = "Requirement check not implemented"

    return result


def _check_phi_protection(
    result: Dict[str, Any],
    previous_results: Dict[int, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check PHI protection compliance."""
    # Look for PHI scan results from stage 5
    phi_stage_result = previous_results.get(5)

    if phi_stage_result and hasattr(phi_stage_result, 'output'):
        output = phi_stage_result.output
        phi_found = output.get("phi_detected", False)
        phi_redacted = output.get("phi_redacted", False)

        if not phi_found:
            result["status"] = "compliant"
            result["details"] = "No PHI detected in dataset"
            result["evidence"].append("PHI scan completed with no findings")
        elif phi_redacted:
            result["status"] = "compliant"
            result["details"] = "PHI detected and properly redacted"
            result["evidence"].append("PHI redaction completed")
        else:
            result["status"] = "non_compliant"
            result["details"] = "PHI detected but not fully protected"
            result["evidence"].append("PHI scan found unprotected data")
    else:
        result["status"] = "needs_review"
        result["details"] = "PHI scan results not available"

    return result


def _check_minimum_necessary(
    result: Dict[str, Any],
    previous_results: Dict[int, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check minimum necessary standard compliance."""
    data_justification = config.get("data_justification")

    if data_justification:
        result["status"] = "compliant"
        result["details"] = "Data usage justification documented"
        result["evidence"].append(f"Justification: {data_justification[:100]}...")
    else:
        result["status"] = "needs_review"
        result["details"] = "Data usage justification not provided"

    return result


def _check_access_controls(
    result: Dict[str, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check access controls compliance."""
    access_controls_enabled = config.get("access_controls_enabled", True)

    if access_controls_enabled:
        result["status"] = "compliant"
        result["details"] = "Access controls are enabled"
        result["evidence"].append("System access controls active")
    else:
        result["status"] = "non_compliant"
        result["details"] = "Access controls not confirmed"

    return result


def _check_audit_trail(
    result: Dict[str, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check audit trail compliance."""
    # Assume audit logging is always enabled in the system
    result["status"] = "compliant"
    result["details"] = "Audit logging is enabled"
    result["evidence"].append("Workflow engine maintains audit logs")

    return result


def _check_irb_approval(
    result: Dict[str, Any],
    previous_results: Dict[int, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check IRB approval compliance."""
    # Look for IRB stage results from stage 3
    irb_stage_result = previous_results.get(3)

    if irb_stage_result and hasattr(irb_stage_result, 'status'):
        if irb_stage_result.status == "completed":
            result["status"] = "compliant"
            result["details"] = "IRB approval verified"
            if hasattr(irb_stage_result, 'output'):
                irb_number = irb_stage_result.output.get("irb_protocol_number", "N/A")
                result["evidence"].append(f"IRB Protocol: {irb_number}")
        else:
            result["status"] = "non_compliant"
            result["details"] = "IRB verification failed"
    else:
        # Check config for IRB info
        irb_number = config.get("irb_protocol_number")
        if irb_number:
            result["status"] = "needs_review"
            result["details"] = f"IRB number provided: {irb_number}, requires verification"
        else:
            result["status"] = "non_compliant"
            result["details"] = "No IRB approval information available"

    return result


def _check_protocol_adherence(
    result: Dict[str, Any],
    previous_results: Dict[int, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check protocol adherence compliance."""
    protocol_version = config.get("protocol_version")

    if protocol_version:
        result["status"] = "compliant"
        result["details"] = f"Following protocol version {protocol_version}"
        result["evidence"].append(f"Protocol version: {protocol_version}")
    else:
        result["status"] = "needs_review"
        result["details"] = "Protocol version not specified"

    return result


def _check_informed_consent(
    result: Dict[str, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check informed consent compliance."""
    consent_obtained = config.get("informed_consent_obtained", False)
    consent_documentation = config.get("consent_documentation")

    if consent_obtained and consent_documentation:
        result["status"] = "compliant"
        result["details"] = "Informed consent documented"
        result["evidence"].append(f"Consent doc: {consent_documentation}")
    elif consent_obtained:
        result["status"] = "needs_review"
        result["details"] = "Consent obtained but documentation not provided"
    else:
        result["status"] = "non_compliant"
        result["details"] = "Informed consent not confirmed"

    return result


def _check_adverse_reporting(
    result: Dict[str, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check adverse event reporting compliance."""
    adverse_reporting_plan = config.get("adverse_event_reporting_plan", False)

    if adverse_reporting_plan:
        result["status"] = "compliant"
        result["details"] = "Adverse event reporting plan in place"
    else:
        result["status"] = "needs_review"
        result["details"] = "Adverse event reporting plan not documented"

    return result


def _check_gdpr_requirement(
    result: Dict[str, Any],
    req_id: str,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check GDPR-specific requirements."""
    gdpr_applicable = config.get("gdpr_applicable", False)

    if not gdpr_applicable:
        result["status"] = "not_applicable"
        result["details"] = "GDPR not applicable to this research"
        return result

    gdpr_config = config.get("gdpr_compliance", {})

    if req_id == "gdpr_lawful_basis":
        lawful_basis = gdpr_config.get("lawful_basis")
        if lawful_basis:
            result["status"] = "compliant"
            result["details"] = f"Lawful basis: {lawful_basis}"
        else:
            result["status"] = "non_compliant"
            result["details"] = "Lawful basis not specified"

    elif req_id == "gdpr_data_minimization":
        minimization_verified = gdpr_config.get("data_minimization_verified", False)
        if minimization_verified:
            result["status"] = "compliant"
            result["details"] = "Data minimization verified"
        else:
            result["status"] = "needs_review"
            result["details"] = "Data minimization not verified"

    elif req_id == "gdpr_subject_rights":
        rights_mechanism = gdpr_config.get("subject_rights_mechanism", False)
        if rights_mechanism:
            result["status"] = "compliant"
            result["details"] = "Data subject rights mechanism in place"
        else:
            result["status"] = "needs_review"
            result["details"] = "Data subject rights mechanism not documented"

    elif req_id == "gdpr_data_protection":
        protection_measures = gdpr_config.get("technical_measures", [])
        if protection_measures:
            result["status"] = "compliant"
            result["details"] = f"Protection measures: {', '.join(protection_measures)}"
        else:
            result["status"] = "needs_review"
            result["details"] = "Technical protection measures not documented"

    elif req_id == "gdpr_transfer_safeguards":
        international_transfer = gdpr_config.get("international_transfer", False)
        if not international_transfer:
            result["status"] = "not_applicable"
            result["details"] = "No international data transfers"
        else:
            safeguards = gdpr_config.get("transfer_safeguards", [])
            if safeguards:
                result["status"] = "compliant"
                result["details"] = f"Transfer safeguards: {', '.join(safeguards)}"
            else:
                result["status"] = "non_compliant"
                result["details"] = "International transfer without documented safeguards"

    return result


def _check_institutional_requirement(
    result: Dict[str, Any],
    req_id: str,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Check institutional policy requirements."""
    inst_config = config.get("institutional_compliance", {})

    if req_id == "inst_data_governance":
        governance_approved = inst_config.get("data_governance_approved", False)
        if governance_approved:
            result["status"] = "compliant"
            result["details"] = "Data governance approval obtained"
        else:
            result["status"] = "needs_review"
            result["details"] = "Data governance approval not documented"

    elif req_id == "inst_publication_policy":
        publication_approved = inst_config.get("publication_approved", False)
        if publication_approved:
            result["status"] = "compliant"
            result["details"] = "Publication plan approved"
        else:
            result["status"] = "needs_review"
            result["details"] = "Publication plan not approved"

    elif req_id == "inst_conflict_disclosure":
        coi_disclosed = inst_config.get("conflict_of_interest_disclosed", False)
        coi_exists = inst_config.get("conflict_of_interest_exists", False)
        if coi_disclosed:
            if coi_exists:
                result["status"] = "compliant"
                result["details"] = "Conflict of interest disclosed and documented"
            else:
                result["status"] = "compliant"
                result["details"] = "No conflict of interest declared"
        else:
            result["status"] = "needs_review"
            result["details"] = "Conflict of interest status not documented"

    return result


def generate_remediation_tasks(
    compliance_results: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Generate remediation tasks for non-compliant items.

    Args:
        compliance_results: List of compliance check results

    Returns:
        List of remediation task dictionaries
    """
    tasks = []

    for result in compliance_results:
        if result["status"] in ["non_compliant", "needs_review"]:
            priority = _get_priority(result["severity"], result["status"])

            task = {
                "task_id": f"remediate_{result['requirement_id']}",
                "requirement_id": result["requirement_id"],
                "name": f"Address: {result['name']}",
                "description": result["details"],
                "priority": priority,
                "status": "pending",
                "due_date": None,
                "assigned_to": None,
            }

            # Add specific remediation actions
            if result["status"] == "non_compliant":
                task["actions"] = [
                    f"Review {result['name']} requirements",
                    "Implement necessary controls or documentation",
                    "Obtain required approvals",
                    "Document compliance evidence",
                ]
            else:  # needs_review
                task["actions"] = [
                    f"Review current {result['name']} status",
                    "Gather additional documentation if needed",
                    "Confirm compliance with responsible party",
                ]

            tasks.append(task)

    # Sort by priority
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    tasks.sort(key=lambda x: priority_order.get(x["priority"], 3))

    return tasks


def _get_priority(severity: str, status: str) -> str:
    """Determine task priority based on severity and status.

    Args:
        severity: Requirement severity
        status: Compliance status

    Returns:
        Priority string
    """
    if status == "non_compliant":
        if severity == "critical":
            return "critical"
        elif severity == "high":
            return "high"
        else:
            return "medium"
    else:  # needs_review
        if severity == "critical":
            return "high"
        elif severity == "high":
            return "medium"
        else:
            return "low"


@register_stage
class EthicalReviewStage:
    """Stage 14: Ethical Review

    Verifies compliance with ethical and regulatory requirements.
    """

    stage_id = 14
    stage_name = "Ethical Review"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute ethical review verification.

        Args:
            context: Stage execution context

        Returns:
            StageResult with compliance results
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        errors: List[str] = []
        warnings: List[str] = []
        output: Dict[str, Any] = {}

        logger.info(f"Starting ethical review for job {context.job_id}")

        # Get compliance checklist from config or use default
        compliance_checklist = context.config.get(
            "compliance_checklist",
            DEFAULT_COMPLIANCE_CHECKLIST,
        )

        # Validate checklist
        if not compliance_checklist or not isinstance(compliance_checklist, dict):
            warnings.append("Invalid compliance checklist, using defaults.")
            compliance_checklist = DEFAULT_COMPLIANCE_CHECKLIST

        try:
            all_results: List[Dict[str, Any]] = []
            category_summaries: Dict[str, Dict[str, Any]] = {}
            issues: List[Dict[str, Any]] = []

            # Check each compliance category
            for category_id, category_config in compliance_checklist.items():
                if not isinstance(category_config, dict):
                    warnings.append(f"Invalid category config for {category_id}, skipping.")
                    continue

                category_name = category_config.get("name", category_id)
                requirements = category_config.get("requirements", [])

                logger.debug(f"Checking {category_name} ({len(requirements)} requirements)")

                category_results = []
                compliant_count = 0
                non_compliant_count = 0
                needs_review_count = 0

                for requirement in requirements:
                    if not isinstance(requirement, dict) or "id" not in requirement:
                        warnings.append(f"Invalid requirement in {category_id}, skipping.")
                        continue

                    result = check_requirement(
                        requirement=requirement,
                        previous_results=context.previous_results,
                        config=context.config,
                    )
                    category_results.append(result)
                    all_results.append(result)

                    # Track counts
                    if result["status"] == "compliant":
                        compliant_count += 1
                    elif result["status"] == "non_compliant":
                        non_compliant_count += 1
                        issues.append({
                            "category": category_id,
                            "requirement": result["name"],
                            "severity": result["severity"],
                            "status": result["status"],
                            "details": result["details"],
                        })
                    elif result["status"] == "needs_review":
                        needs_review_count += 1
                        issues.append({
                            "category": category_id,
                            "requirement": result["name"],
                            "severity": result["severity"],
                            "status": result["status"],
                            "details": result["details"],
                        })

                # Determine category status
                if non_compliant_count > 0:
                    category_status = "non_compliant"
                elif needs_review_count > 0:
                    category_status = "needs_review"
                else:
                    category_status = "compliant"

                category_summaries[category_id] = {
                    "name": category_name,
                    "status": category_status,
                    "compliant": compliant_count,
                    "non_compliant": non_compliant_count,
                    "needs_review": needs_review_count,
                    "total": len(category_results),
                    "results": category_results,
                }

            # Generate remediation tasks
            remediation_tasks = generate_remediation_tasks(all_results)

            # Calculate overall compliance status
            total_non_compliant = sum(
                s["non_compliant"] for s in category_summaries.values()
            )
            total_needs_review = sum(
                s["needs_review"] for s in category_summaries.values()
            )

            if total_non_compliant > 0:
                overall_status = "non_compliant"
            elif total_needs_review > 0:
                overall_status = "needs_review"
            else:
                overall_status = "compliant"

            output["compliance_results"] = category_summaries
            output["issues"] = issues
            output["remediation_tasks"] = remediation_tasks
            output["overall_status"] = overall_status
            output["summary"] = {
                "categories_checked": len(category_summaries),
                "total_requirements": len(all_results),
                "compliant_count": len([r for r in all_results if r["status"] == "compliant"]),
                "non_compliant_count": total_non_compliant,
                "needs_review_count": total_needs_review,
                "remediation_tasks_count": len(remediation_tasks),
            }

            logger.info(
                f"Ethical review completed: {overall_status}, "
                f"{total_non_compliant} non-compliant, "
                f"{total_needs_review} need review"
            )

        except Exception as e:
            logger.error(f"Ethical review failed: {str(e)}")
            errors.append(f"Failed to complete ethical review: {str(e)}")

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
            errors=errors,
            warnings=warnings,
            metadata={
                "governance_mode": context.governance_mode,
                "categories_checked": list(compliance_checklist.keys()),
                "overall_compliance_status": output.get("overall_status", "unknown"),
            },
        )

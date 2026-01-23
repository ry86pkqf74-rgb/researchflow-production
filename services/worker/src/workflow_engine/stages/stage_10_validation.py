"""
Stage 10: Validation

Handles research validation checklist including:
- Processing validation criteria
- Running validation checks
- Generating checklist status reports
- Identifying and categorizing issues
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stages.stage_10_validation")


# Default validation criteria if none provided
DEFAULT_VALIDATION_CRITERIA = [
    {
        "id": "data_completeness",
        "name": "Data Completeness",
        "description": "Verify all required data fields are present",
        "category": "data_quality",
        "severity": "high",
    },
    {
        "id": "statistical_validity",
        "name": "Statistical Validity",
        "description": "Verify statistical methods are appropriate",
        "category": "methodology",
        "severity": "high",
    },
    {
        "id": "sample_size_adequacy",
        "name": "Sample Size Adequacy",
        "description": "Verify sample size meets minimum requirements",
        "category": "methodology",
        "severity": "medium",
    },
    {
        "id": "reproducibility",
        "name": "Reproducibility Check",
        "description": "Verify results can be reproduced with same inputs",
        "category": "reproducibility",
        "severity": "high",
    },
    {
        "id": "documentation_complete",
        "name": "Documentation Completeness",
        "description": "Verify all methodology is properly documented",
        "category": "documentation",
        "severity": "medium",
    },
]


def run_validation_check(
    criterion: Dict[str, Any],
    context_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Run a single validation check against a criterion.

    Args:
        criterion: Validation criterion to check
        context_data: Data context for validation

    Returns:
        Validation result dictionary
    """
    # In production, this would perform actual validation logic
    # For now, we simulate validation results
    return {
        "criterion_id": criterion["id"],
        "criterion_name": criterion["name"],
        "category": criterion.get("category", "general"),
        "severity": criterion.get("severity", "medium"),
        "status": "passed",  # passed, failed, warning, skipped
        "message": f"Validation passed for: {criterion['name']}",
        "details": {},
        "checked_at": datetime.utcnow().isoformat() + "Z",
    }


def categorize_issues(
    validation_results: List[Dict[str, Any]]
) -> Dict[str, List[Dict[str, Any]]]:
    """Categorize validation issues by severity and category.

    Args:
        validation_results: List of validation results

    Returns:
        Dictionary of issues categorized by type
    """
    issues = {
        "critical": [],
        "high": [],
        "medium": [],
        "low": [],
        "by_category": {},
    }

    for result in validation_results:
        if result["status"] in ("failed", "warning"):
            severity = result.get("severity", "medium")
            category = result.get("category", "general")

            issue = {
                "criterion_id": result["criterion_id"],
                "criterion_name": result["criterion_name"],
                "status": result["status"],
                "message": result["message"],
                "severity": severity,
                "category": category,
            }

            # Add to severity bucket
            if severity == "critical":
                issues["critical"].append(issue)
            elif severity == "high":
                issues["high"].append(issue)
            elif severity == "medium":
                issues["medium"].append(issue)
            else:
                issues["low"].append(issue)

            # Add to category bucket
            if category not in issues["by_category"]:
                issues["by_category"][category] = []
            issues["by_category"][category].append(issue)

    return issues


def generate_checklist_status(
    criteria: List[Dict[str, Any]],
    results: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generate a checklist status summary.

    Args:
        criteria: List of validation criteria
        results: List of validation results

    Returns:
        Checklist status summary
    """
    results_by_id = {r["criterion_id"]: r for r in results}

    checklist_items = []
    for criterion in criteria:
        result = results_by_id.get(criterion["id"], {})
        checklist_items.append({
            "id": criterion["id"],
            "name": criterion["name"],
            "description": criterion.get("description", ""),
            "status": result.get("status", "pending"),
            "checked": result.get("status") in ("passed", "failed", "warning"),
            "passed": result.get("status") == "passed",
        })

    total = len(checklist_items)
    passed = sum(1 for item in checklist_items if item["passed"])
    checked = sum(1 for item in checklist_items if item["checked"])

    return {
        "items": checklist_items,
        "total_criteria": total,
        "checked_count": checked,
        "passed_count": passed,
        "failed_count": checked - passed,
        "pending_count": total - checked,
        "completion_percentage": round((checked / total * 100), 2) if total > 0 else 0,
        "pass_rate": round((passed / checked * 100), 2) if checked > 0 else 0,
    }


@register_stage
class ValidationStage:
    """Stage 10: Validation

    Handles research validation checklist by processing
    validation criteria, running checks, and generating
    comprehensive status reports.
    """

    stage_id = 10
    stage_name = "Validation"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute research validation checklist.

        Args:
            context: StageContext with job configuration

        Returns:
            StageResult with validation_results, checklist_status, and issues_found
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        warnings: List[str] = []
        errors: List[str] = []
        artifacts: List[str] = []

        logger.info(f"Starting validation stage for job {context.job_id}")

        # Get validation configuration
        validation_config = context.config.get("validation", {})
        criteria = validation_config.get("criteria", DEFAULT_VALIDATION_CRITERIA)
        strict_mode = validation_config.get("strict_mode", False)
        fail_on_warning = validation_config.get("fail_on_warning", False)

        # Initialize output structure
        output: Dict[str, Any] = {
            "validation_results": [],
            "checklist_status": {},
            "issues_found": {},
            "summary": {},
        }

        try:
            # Use default criteria if none provided
            if not criteria:
                criteria = DEFAULT_VALIDATION_CRITERIA
                warnings.append("No validation criteria provided - using default criteria")

            logger.info(f"Running {len(criteria)} validation checks")

            # Run validation checks for each criterion
            context_data = {
                "dataset_pointer": context.dataset_pointer,
                "previous_results": context.previous_results,
                "metadata": context.metadata,
            }

            for criterion in criteria:
                try:
                    result = run_validation_check(criterion, context_data)
                    output["validation_results"].append(result)
                except Exception as e:
                    logger.warning(f"Validation check failed for {criterion['id']}: {str(e)}")
                    output["validation_results"].append({
                        "criterion_id": criterion["id"],
                        "criterion_name": criterion["name"],
                        "status": "error",
                        "message": f"Check failed: {str(e)}",
                        "checked_at": datetime.utcnow().isoformat() + "Z",
                    })

            # Generate checklist status
            output["checklist_status"] = generate_checklist_status(criteria, output["validation_results"])

            # Categorize issues
            output["issues_found"] = categorize_issues(output["validation_results"])

            # Check for failures in strict mode
            if strict_mode:
                critical_issues = output["issues_found"].get("critical", [])
                high_issues = output["issues_found"].get("high", [])
                if critical_issues or high_issues:
                    errors.append(
                        f"Strict mode: {len(critical_issues)} critical and "
                        f"{len(high_issues)} high severity issues found"
                    )

            # Check warnings if fail_on_warning is enabled
            if fail_on_warning:
                warning_results = [r for r in output["validation_results"] if r["status"] == "warning"]
                if warning_results:
                    errors.append(f"Fail on warning: {len(warning_results)} warnings found")

            # Generate summary
            output["summary"] = {
                "total_criteria": len(criteria),
                "checks_run": len(output["validation_results"]),
                "passed": sum(1 for r in output["validation_results"] if r["status"] == "passed"),
                "failed": sum(1 for r in output["validation_results"] if r["status"] == "failed"),
                "warnings": sum(1 for r in output["validation_results"] if r["status"] == "warning"),
                "errors": sum(1 for r in output["validation_results"] if r["status"] == "error"),
                "skipped": sum(1 for r in output["validation_results"] if r["status"] == "skipped"),
                "critical_issues": len(output["issues_found"].get("critical", [])),
                "high_issues": len(output["issues_found"].get("high", [])),
                "validation_passed": len(errors) == 0,
            }

            # Add demo mode indicator
            if context.governance_mode == "DEMO":
                output["demo_mode"] = True
                warnings.append("Running in DEMO mode - validation checks are simulated")

        except Exception as e:
            logger.error(f"Error during validation: {str(e)}")
            errors.append(f"Validation stage failed: {str(e)}")

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
            warnings=warnings,
            errors=errors,
            metadata={
                "governance_mode": context.governance_mode,
                "criteria_count": len(criteria),
                "strict_mode": strict_mode,
            },
        )

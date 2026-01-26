"""
Stage 11: Iteration

Handles analysis iteration with AI routing including:
- Processing iteration requests with changes to apply
- Tracking version history and diffs
- Generating AI-powered suggestions for improvements
- Managing the iterative refinement workflow
"""

import hashlib
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stages.stage_11_iteration")


def compute_content_hash(content: Any) -> str:
    """Compute a hash for content to track changes.

    Args:
        content: Content to hash (will be serialized to string)

    Returns:
        SHA256 hash of the content
    """
    content_str = str(content)
    return hashlib.sha256(content_str.encode()).hexdigest()[:16]


def generate_diff(
    previous_version: Dict[str, Any],
    current_version: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate a diff between two versions.

    Args:
        previous_version: The previous version data
        current_version: The current version data

    Returns:
        Diff summary showing changes
    """
    diff = {
        "added": [],
        "removed": [],
        "modified": [],
        "unchanged": [],
    }

    prev_keys = set(previous_version.keys()) if previous_version else set()
    curr_keys = set(current_version.keys()) if current_version else set()

    # Find added keys
    for key in curr_keys - prev_keys:
        diff["added"].append({
            "key": key,
            "value": current_version[key],
        })

    # Find removed keys
    for key in prev_keys - curr_keys:
        diff["removed"].append({
            "key": key,
            "value": previous_version[key],
        })

    # Find modified and unchanged
    for key in prev_keys & curr_keys:
        if previous_version[key] != current_version[key]:
            diff["modified"].append({
                "key": key,
                "old_value": previous_version[key],
                "new_value": current_version[key],
            })
        else:
            diff["unchanged"].append(key)

    return diff


def create_version_entry(
    version_number: int,
    changes: Dict[str, Any],
    author: str = "system"
) -> Dict[str, Any]:
    """Create a version history entry.

    Args:
        version_number: The version number
        changes: Changes applied in this version
        author: Author of the changes

    Returns:
        Version entry dictionary
    """
    return {
        "version_id": str(uuid.uuid4()),
        "version_number": version_number,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "author": author,
        "changes_summary": changes.get("summary", ""),
        "changes_applied": changes.get("changes", []),
        "content_hash": compute_content_hash(changes),
        "rollback_available": version_number > 1,
    }


def generate_ai_suggestions(
    iteration_request: Dict[str, Any],
    previous_results: Dict[int, Any]
) -> List[Dict[str, Any]]:
    """Generate AI-powered suggestions for iteration improvements.

    Args:
        iteration_request: The current iteration request
        previous_results: Results from previous stages

    Returns:
        List of AI suggestions
    """
    suggestions = []

    # Analyze the iteration request and generate suggestions
    changes = iteration_request.get("changes", [])
    focus_areas = iteration_request.get("focus_areas", [])

    # Generate suggestions based on focus areas
    if "statistical_analysis" in focus_areas:
        suggestions.append({
            "suggestion_id": str(uuid.uuid4()),
            "type": "methodology",
            "priority": "high",
            "title": "Consider Additional Statistical Tests",
            "description": "Based on the data distribution, consider applying non-parametric tests for robustness.",
            "confidence": 0.85,
            "auto_applicable": False,
        })

    if "data_quality" in focus_areas:
        suggestions.append({
            "suggestion_id": str(uuid.uuid4()),
            "type": "data_quality",
            "priority": "medium",
            "title": "Outlier Detection Refinement",
            "description": "Apply IQR-based outlier detection to improve data quality.",
            "confidence": 0.78,
            "auto_applicable": True,
        })

    # Default suggestions if no focus areas specified
    if not suggestions:
        suggestions.append({
            "suggestion_id": str(uuid.uuid4()),
            "type": "general",
            "priority": "low",
            "title": "Review Parameter Settings",
            "description": "Consider reviewing analysis parameters based on current results.",
            "confidence": 0.65,
            "auto_applicable": False,
        })

    return suggestions


def route_iteration(
    iteration_request: Dict[str, Any]
) -> Dict[str, Any]:
    """Route the iteration to appropriate processing pipeline.

    Args:
        iteration_request: The iteration request with changes

    Returns:
        Routing decision with pipeline and parameters
    """
    iteration_type = iteration_request.get("type", "general")
    changes = iteration_request.get("changes", [])

    # Determine routing based on iteration type
    routing = {
        "pipeline": "default",
        "priority": "normal",
        "requires_reanalysis": False,
        "affected_stages": [],
        "estimated_duration_ms": 1000,
    }

    if iteration_type == "parameter_change":
        routing["pipeline"] = "parameter_update"
        routing["requires_reanalysis"] = True
        routing["affected_stages"] = [6, 7, 8]  # Analysis stages
        routing["estimated_duration_ms"] = 5000

    elif iteration_type == "data_subset":
        routing["pipeline"] = "data_subset"
        routing["requires_reanalysis"] = True
        routing["affected_stages"] = [4, 5, 6, 7, 8]  # From validation onwards
        routing["estimated_duration_ms"] = 10000

    elif iteration_type == "methodology_change":
        routing["pipeline"] = "full_reanalysis"
        routing["requires_reanalysis"] = True
        routing["affected_stages"] = [6, 7, 8, 9, 10]  # All analysis and interpretation
        routing["priority"] = "high"
        routing["estimated_duration_ms"] = 15000

    return routing


@register_stage
class IterationStage:
    """Stage 11: Iteration

    Handles analysis iteration with AI routing by processing
    iteration requests, tracking version history, and generating
    AI-powered suggestions for improvements.
    """

    stage_id = 11
    stage_name = "Iteration"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute analysis iteration with AI routing.

        Args:
            context: StageContext with job configuration

        Returns:
            StageResult with iteration_log, version_info, and ai_suggestions
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        warnings: List[str] = []
        errors: List[str] = []
        artifacts: List[str] = []

        logger.info(f"Starting iteration stage for job {context.job_id}")

        # Get iteration configuration
        iteration_config = context.config.get("iteration", {})
        iteration_request = iteration_config.get("iteration_request", {})
        enable_ai_suggestions = iteration_config.get("enable_ai_suggestions", True)
        max_versions = iteration_config.get("max_versions", 100)

        # Get version history from metadata or initialize
        version_history = context.metadata.get("version_history", [])
        current_version = len(version_history) + 1

        # Initialize output structure
        output: Dict[str, Any] = {
            "iteration_log": [],
            "version_info": {},
            "ai_suggestions": [],
            "routing": {},
            "diff": {},
            "summary": {},
        }

        try:
            # Validate iteration request
            if not iteration_request:
                warnings.append("No iteration_request provided in configuration")
                iteration_request = {"type": "general", "changes": []}

            logger.info(f"Processing iteration request type: {iteration_request.get('type', 'unknown')}")

            # Create iteration log entry
            iteration_entry = {
                "iteration_id": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "request_type": iteration_request.get("type", "general"),
                "changes_requested": iteration_request.get("changes", []),
                "focus_areas": iteration_request.get("focus_areas", []),
                "requester": iteration_request.get("requester", "system"),
                "status": "processing",
            }
            output["iteration_log"].append(iteration_entry)

            # Route the iteration to appropriate pipeline
            output["routing"] = route_iteration(iteration_request)
            logger.info(f"Routing to pipeline: {output['routing']['pipeline']}")

            # Generate diff if we have previous version data
            previous_data = iteration_request.get("previous_data", {})
            current_data = iteration_request.get("current_data", {})
            if previous_data or current_data:
                output["diff"] = generate_diff(previous_data, current_data)

            # Create version entry
            version_entry = create_version_entry(
                version_number=current_version,
                changes=iteration_request,
                author=iteration_request.get("requester", "system")
            )

            # Check version limit
            if current_version > max_versions:
                warnings.append(f"Version limit ({max_versions}) reached - consider archiving old versions")

            output["version_info"] = {
                "current_version": version_entry,
                "version_number": current_version,
                "total_versions": current_version,
                "previous_versions_count": len(version_history),
                "version_history_summary": [
                    {"version": v.get("version_number"), "created_at": v.get("created_at")}
                    for v in version_history[-5:]  # Last 5 versions
                ],
            }

            # Generate AI suggestions if enabled
            if enable_ai_suggestions:
                output["ai_suggestions"] = generate_ai_suggestions(
                    iteration_request,
                    context.previous_results
                )
                logger.info(f"Generated {len(output['ai_suggestions'])} AI suggestions")
            else:
                warnings.append("AI suggestions are disabled")

            # Update iteration log entry status
            iteration_entry["status"] = "completed"
            iteration_entry["routing_pipeline"] = output["routing"]["pipeline"]
            iteration_entry["version_created"] = current_version

            # Generate summary
            output["summary"] = {
                "iteration_type": iteration_request.get("type", "general"),
                "changes_count": len(iteration_request.get("changes", [])),
                "version_created": current_version,
                "requires_reanalysis": output["routing"]["requires_reanalysis"],
                "affected_stages": output["routing"]["affected_stages"],
                "ai_suggestions_count": len(output["ai_suggestions"]),
                "diff_summary": {
                    "added": len(output["diff"].get("added", [])),
                    "removed": len(output["diff"].get("removed", [])),
                    "modified": len(output["diff"].get("modified", [])),
                },
            }

            # Add demo mode indicator
            if context.governance_mode == "DEMO":
                output["demo_mode"] = True
                warnings.append("Running in DEMO mode - iteration processing is simulated")

        except Exception as e:
            logger.error(f"Error during iteration: {str(e)}")
            errors.append(f"Iteration stage failed: {str(e)}")

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
                "version_number": current_version,
                "routing_pipeline": output.get("routing", {}).get("pipeline", "unknown"),
            },
        )

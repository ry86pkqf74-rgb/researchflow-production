"""
Workflow Runner

This module provides the run_stages function that orchestrates execution
of registered stages with proper error handling and PHI-safe sanitization.

Uses the canonical PHI patterns from the generated module to ensure
consistency across the entire codebase.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from .types import StageContext, StageResult
from .registry import get_stage

# Import generated PHI patterns from canonical source
from src.validation.phi_patterns_generated import (
    PHI_PATTERNS_OUTPUT_GUARD,
)

logger = logging.getLogger("workflow_engine.runner")

# Use generated patterns for PHI sanitization in error messages
# OUTPUT_GUARD tier provides comprehensive coverage for logs/errors
_compiled_patterns = [pattern for _, pattern in PHI_PATTERNS_OUTPUT_GUARD]


def sanitize_phi(text: str) -> str:
    """Remove potential PHI from error messages.

    This function applies pattern-based sanitization to remove
    data that may contain Protected Health Information. It errs
    on the side of caution - if something looks like PHI, it's redacted.

    Args:
        text: The text to sanitize

    Returns:
        Sanitized text with PHI replaced by [REDACTED]
    """
    if not text:
        return text

    sanitized = text
    for pattern in _compiled_patterns:
        sanitized = pattern.sub('[REDACTED]', sanitized)

    return sanitized


def create_error_result(
    stage_id: int,
    stage_name: str,
    error: Exception,
    started_at: str,
) -> StageResult:
    """Create a StageResult for a failed stage with PHI-safe error message.

    Args:
        stage_id: The stage identifier
        stage_name: Human-readable stage name
        error: The exception that occurred
        started_at: ISO timestamp when stage started

    Returns:
        StageResult with status='failed' and sanitized error
    """
    completed_at = datetime.utcnow().isoformat() + "Z"
    started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
    duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

    # Sanitize the error message
    error_message = sanitize_phi(str(error))
    error_type = type(error).__name__

    return StageResult(
        stage_id=stage_id,
        stage_name=stage_name,
        status="failed",
        started_at=started_at,
        completed_at=completed_at,
        duration_ms=duration_ms,
        output={},
        errors=[f"{error_type}: {error_message}"],
    )


async def run_stages(
    stage_ids: List[int],
    context: StageContext,
    stop_on_failure: bool = True,
) -> Dict[str, Any]:
    """Execute a sequence of workflow stages.

    This function runs the specified stages in order, tracking results
    and handling errors with PHI-safe sanitization.

    Args:
        stage_ids: List of stage IDs to execute (1-19)
        context: StageContext with job configuration
        stop_on_failure: If True, stop execution on first failure

    Returns:
        Dict containing:
        - stages_completed: List of completed stage IDs
        - stages_failed: List of failed stage IDs
        - stages_skipped: List of skipped stage IDs
        - results: Dict mapping stage_id to StageResult
        - success: Boolean indicating all stages completed
    """
    results: Dict[int, StageResult] = {}
    stages_completed: List[int] = []
    stages_failed: List[int] = []
    stages_skipped: List[int] = []

    logger.info(f"Running {len(stage_ids)} stages for job {context.job_id}")

    for stage_id in stage_ids:
        # Check if we should skip due to previous failure
        if stages_failed and stop_on_failure:
            stages_skipped.append(stage_id)
            logger.info(f"Skipping stage {stage_id} due to previous failure")
            continue

        # Get the registered stage
        stage_cls = get_stage(stage_id)
        if stage_cls is None:
            logger.warning(f"Stage {stage_id} not registered, skipping")
            stages_skipped.append(stage_id)
            continue

        # Create stage instance
        stage = stage_cls()
        started_at = datetime.utcnow().isoformat() + "Z"

        logger.info(f"Executing stage {stage_id}: {stage.stage_name}")

        try:
            # Update context with previous results
            context.previous_results = dict(results)

            # Execute the stage
            result = await stage.execute(context)

            # Store result
            results[stage_id] = result

            if result.status == "completed":
                stages_completed.append(stage_id)
                logger.info(
                    f"Stage {stage_id} completed in {result.duration_ms}ms"
                )
            elif result.status == "failed":
                stages_failed.append(stage_id)
                logger.error(
                    f"Stage {stage_id} failed: {result.errors}"
                )
            else:
                stages_skipped.append(stage_id)
                logger.info(f"Stage {stage_id} skipped")

        except Exception as e:
            logger.exception(f"Stage {stage_id} raised exception")

            # Create error result with PHI sanitization
            result = create_error_result(
                stage_id=stage_id,
                stage_name=stage.stage_name,
                error=e,
                started_at=started_at,
            )
            results[stage_id] = result
            stages_failed.append(stage_id)

    success = len(stages_failed) == 0 and len(stages_completed) == len(stage_ids)

    logger.info(
        f"Stage execution complete: "
        f"{len(stages_completed)} completed, "
        f"{len(stages_failed)} failed, "
        f"{len(stages_skipped)} skipped"
    )

    return {
        "stages_completed": stages_completed,
        "stages_failed": stages_failed,
        "stages_skipped": stages_skipped,
        "results": {k: _result_to_dict(v) for k, v in results.items()},
        "success": success,
    }


def _result_to_dict(result: StageResult) -> Dict[str, Any]:
    """Convert StageResult to dictionary for serialization."""
    return {
        "stage_id": result.stage_id,
        "stage_name": result.stage_name,
        "status": result.status,
        "started_at": result.started_at,
        "completed_at": result.completed_at,
        "duration_ms": result.duration_ms,
        "output": result.output,
        "artifacts": result.artifacts,
        "errors": result.errors,
        "warnings": result.warnings,
        "metadata": result.metadata,
    }

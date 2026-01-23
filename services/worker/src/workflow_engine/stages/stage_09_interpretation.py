"""
Stage 09: Interpretation

Handles collaborative result interpretation including:
- Processing analysis findings
- Generating discussion threads
- Creating annotations for key findings
- Facilitating collaborative interpretation workflows
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stages.stage_09_interpretation")


def generate_discussion_thread(
    finding_id: str,
    finding_text: str,
    author: str = "system"
) -> Dict[str, Any]:
    """Generate a discussion thread for a finding.

    Args:
        finding_id: Unique identifier for the finding
        finding_text: Text description of the finding
        author: Author of the initial thread

    Returns:
        Dictionary representing a discussion thread
    """
    return {
        "thread_id": str(uuid.uuid4()),
        "finding_id": finding_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "author": author,
        "initial_comment": f"Discussion initiated for finding: {finding_text[:100]}...",
        "replies": [],
        "status": "open",
        "tags": [],
    }


def create_annotation(
    finding_id: str,
    annotation_type: str,
    content: str,
    author: str = "system"
) -> Dict[str, Any]:
    """Create an annotation for a finding.

    Args:
        finding_id: The finding this annotation relates to
        annotation_type: Type of annotation (highlight, note, question, etc.)
        content: Annotation content
        author: Author of the annotation

    Returns:
        Dictionary representing an annotation
    """
    return {
        "annotation_id": str(uuid.uuid4()),
        "finding_id": finding_id,
        "type": annotation_type,
        "content": content,
        "author": author,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "resolved": False,
    }


def extract_key_findings(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract and prioritize key findings from analysis results.

    Args:
        findings: List of findings from analysis

    Returns:
        List of key findings with priority scores
    """
    key_findings = []
    for idx, finding in enumerate(findings):
        priority = finding.get("priority", "medium")
        priority_score = {"high": 3, "medium": 2, "low": 1}.get(priority, 2)

        key_findings.append({
            "finding_id": finding.get("id", f"finding_{idx}"),
            "summary": finding.get("summary", finding.get("text", "")),
            "priority": priority,
            "priority_score": priority_score,
            "category": finding.get("category", "general"),
            "confidence": finding.get("confidence", 0.8),
            "supporting_data": finding.get("supporting_data", []),
        })

    # Sort by priority score descending
    key_findings.sort(key=lambda x: x["priority_score"], reverse=True)
    return key_findings


@register_stage
class InterpretationStage:
    """Stage 09: Interpretation

    Handles collaborative result interpretation by processing
    analysis findings, generating discussion threads, and
    creating annotations for team collaboration.
    """

    stage_id = 9
    stage_name = "Interpretation"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute collaborative result interpretation.

        Args:
            context: StageContext with job configuration

        Returns:
            StageResult with interpretations, key_findings, and discussion_threads
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        warnings: List[str] = []
        errors: List[str] = []
        artifacts: List[str] = []

        logger.info(f"Starting interpretation stage for job {context.job_id}")

        # Get findings from context configuration
        interpretation_config = context.config.get("interpretation", {})
        findings = interpretation_config.get("findings", [])
        auto_generate_threads = interpretation_config.get("auto_generate_threads", True)
        annotation_types = interpretation_config.get("annotation_types", ["highlight", "note", "question"])

        # Initialize output structure
        output: Dict[str, Any] = {
            "interpretations": [],
            "key_findings": [],
            "discussion_threads": [],
            "annotations": [],
            "summary": {},
        }

        try:
            # Extract key findings
            if findings:
                output["key_findings"] = extract_key_findings(findings)
                logger.info(f"Extracted {len(output['key_findings'])} key findings")
            else:
                warnings.append("No findings provided in configuration - using empty findings list")

            # Generate interpretations for each key finding
            for finding in output["key_findings"]:
                interpretation = {
                    "finding_id": finding["finding_id"],
                    "interpretation_id": str(uuid.uuid4()),
                    "original_summary": finding["summary"],
                    "interpreted_meaning": f"Analysis indicates: {finding['summary']}",
                    "clinical_relevance": finding.get("category", "general"),
                    "confidence_level": finding.get("confidence", 0.8),
                    "recommended_actions": [],
                    "created_at": datetime.utcnow().isoformat() + "Z",
                }
                output["interpretations"].append(interpretation)

            # Generate discussion threads if enabled
            if auto_generate_threads and output["key_findings"]:
                for finding in output["key_findings"]:
                    if finding["priority_score"] >= 2:  # Medium or high priority
                        thread = generate_discussion_thread(
                            finding_id=finding["finding_id"],
                            finding_text=finding["summary"],
                            author="interpretation_engine"
                        )
                        output["discussion_threads"].append(thread)

                logger.info(f"Generated {len(output['discussion_threads'])} discussion threads")

            # Create initial annotations for high-priority findings
            for finding in output["key_findings"]:
                if finding["priority_score"] >= 3:  # High priority only
                    annotation = create_annotation(
                        finding_id=finding["finding_id"],
                        annotation_type="highlight",
                        content=f"High-priority finding requiring review: {finding['summary'][:50]}",
                        author="interpretation_engine"
                    )
                    output["annotations"].append(annotation)

            # Generate summary statistics
            output["summary"] = {
                "total_findings": len(findings),
                "key_findings_count": len(output["key_findings"]),
                "high_priority_count": sum(1 for f in output["key_findings"] if f["priority_score"] >= 3),
                "medium_priority_count": sum(1 for f in output["key_findings"] if f["priority_score"] == 2),
                "low_priority_count": sum(1 for f in output["key_findings"] if f["priority_score"] == 1),
                "discussion_threads_created": len(output["discussion_threads"]),
                "annotations_created": len(output["annotations"]),
            }

            # Add demo mode indicator
            if context.governance_mode == "DEMO":
                output["demo_mode"] = True
                warnings.append("Running in DEMO mode - interpretation is simulated")

        except Exception as e:
            logger.error(f"Error during interpretation: {str(e)}")
            errors.append(f"Interpretation failed: {str(e)}")

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
                "findings_processed": len(findings),
            },
        )

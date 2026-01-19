"""
Lineage Logger for Worker

Logs data lineage events for provenance tracking in the worker pipeline.
Integrates with the central lineage tracking system.
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class LineageLogger:
    """
    Logs lineage events to append-only JSONL files for immutability.
    """

    def __init__(self, lineage_dir: str = "/data/lineage"):
        self.lineage_dir = Path(lineage_dir)
        self.lineage_dir.mkdir(parents=True, exist_ok=True)

    def log_transformation(
        self,
        input_id: str,
        output_id: str,
        operation: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log a data transformation event.

        Args:
            input_id: ID of input artifact
            output_id: ID of output artifact
            operation: Name of transformation operation
            metadata: Additional metadata
        """
        event = {
            "event_type": "transformation",
            "timestamp": datetime.utcnow().isoformat(),
            "input_id": input_id,
            "output_id": output_id,
            "operation": operation,
            "metadata": metadata or {}
        }

        self._append_event(output_id, event)
        logger.info(f"Logged transformation: {operation} ({input_id} -> {output_id})")

    def log_validation(
        self,
        artifact_id: str,
        validator: str,
        passed: bool,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log a validation event.

        Args:
            artifact_id: ID of artifact being validated
            validator: Name of validator
            passed: Whether validation passed
            details: Validation details
        """
        event = {
            "event_type": "validation",
            "timestamp": datetime.utcnow().isoformat(),
            "artifact_id": artifact_id,
            "validator": validator,
            "passed": passed,
            "details": details or {}
        }

        self._append_event(artifact_id, event)
        logger.info(
            f"Logged validation: {validator} on {artifact_id} - "
            f"{'PASSED' if passed else 'FAILED'}"
        )

    def log_ingestion(
        self,
        artifact_id: str,
        source: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log data ingestion event.

        Args:
            artifact_id: ID of ingested artifact
            source: Source of data (file, API, etc.)
            metadata: Source metadata
        """
        event = {
            "event_type": "ingestion",
            "timestamp": datetime.utcnow().isoformat(),
            "artifact_id": artifact_id,
            "source": source,
            "metadata": metadata or {}
        }

        self._append_event(artifact_id, event)
        logger.info(f"Logged ingestion: {artifact_id} from {source}")

    def log_aggregation(
        self,
        input_ids: List[str],
        output_id: str,
        operation: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log an aggregation event (multiple inputs -> one output).

        Args:
            input_ids: List of input artifact IDs
            output_id: Output artifact ID
            operation: Aggregation operation
            metadata: Additional metadata
        """
        event = {
            "event_type": "aggregation",
            "timestamp": datetime.utcnow().isoformat(),
            "input_ids": input_ids,
            "output_id": output_id,
            "operation": operation,
            "metadata": metadata or {}
        }

        self._append_event(output_id, event)
        logger.info(
            f"Logged aggregation: {operation} "
            f"({len(input_ids)} inputs -> {output_id})"
        )

    def log_export(
        self,
        artifact_id: str,
        destination: str,
        format: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log data export event.

        Args:
            artifact_id: ID of exported artifact
            destination: Export destination
            format: Export format
            metadata: Export metadata
        """
        event = {
            "event_type": "export",
            "timestamp": datetime.utcnow().isoformat(),
            "artifact_id": artifact_id,
            "destination": destination,
            "format": format,
            "metadata": metadata or {}
        }

        self._append_event(artifact_id, event)
        logger.info(f"Logged export: {artifact_id} to {destination}")

    def get_lineage(self, artifact_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve full lineage for an artifact.

        Args:
            artifact_id: Artifact ID

        Returns:
            List of lineage events
        """
        lineage_file = self._get_lineage_path(artifact_id)

        if not lineage_file.exists():
            return []

        events = []
        with open(lineage_file, 'r') as f:
            for line in f:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON line in {lineage_file}")

        return events

    def get_upstream(self, artifact_id: str) -> List[str]:
        """
        Get all upstream artifact IDs.

        Args:
            artifact_id: Artifact ID

        Returns:
            List of upstream artifact IDs
        """
        lineage = self.get_lineage(artifact_id)
        upstream = set()

        for event in lineage:
            if event.get("event_type") == "transformation":
                upstream.add(event.get("input_id"))
            elif event.get("event_type") == "aggregation":
                upstream.update(event.get("input_ids", []))

        return list(upstream)

    def generate_provenance_report(self, artifact_id: str) -> str:
        """
        Generate a human-readable provenance report.

        Args:
            artifact_id: Artifact ID

        Returns:
            Markdown-formatted report
        """
        lineage = self.get_lineage(artifact_id)

        if not lineage:
            return f"# Provenance Report: {artifact_id}\n\nNo lineage data found."

        lines = [
            f"# Provenance Report: {artifact_id}",
            "",
            f"**Total Events**: {len(lineage)}",
            "",
            "## Lineage Events",
            ""
        ]

        for i, event in enumerate(lineage, 1):
            event_type = event.get("event_type", "unknown")
            timestamp = event.get("timestamp", "unknown")

            lines.append(f"### {i}. {event_type.title()} Event")
            lines.append(f"**Timestamp**: {timestamp}")

            if event_type == "transformation":
                lines.append(f"**Input**: {event.get('input_id')}")
                lines.append(f"**Operation**: {event.get('operation')}")
                lines.append(f"**Output**: {event.get('output_id')}")
            elif event_type == "validation":
                lines.append(f"**Validator**: {event.get('validator')}")
                lines.append(f"**Result**: {'PASSED' if event.get('passed') else 'FAILED'}")
            elif event_type == "ingestion":
                lines.append(f"**Source**: {event.get('source')}")
            elif event_type == "aggregation":
                lines.append(f"**Inputs**: {', '.join(event.get('input_ids', []))}")
                lines.append(f"**Operation**: {event.get('operation')}")

            # Add metadata if present
            metadata = event.get("metadata", {})
            if metadata:
                lines.append("**Metadata**:")
                for key, value in metadata.items():
                    lines.append(f"- {key}: {value}")

            lines.append("")

        return "\n".join(lines)

    def _append_event(self, artifact_id: str, event: Dict[str, Any]) -> None:
        """
        Append event to lineage file (JSONL format for immutability).
        """
        lineage_file = self._get_lineage_path(artifact_id)

        # Ensure directory exists
        lineage_file.parent.mkdir(parents=True, exist_ok=True)

        # Append event
        with open(lineage_file, 'a') as f:
            f.write(json.dumps(event) + '\n')

    def _get_lineage_path(self, artifact_id: str) -> Path:
        """Get path to lineage file for artifact"""
        # Use first 2 chars of ID for directory sharding
        shard = artifact_id[:2] if len(artifact_id) >= 2 else "00"
        return self.lineage_dir / shard / f"{artifact_id}.jsonl"


# Global lineage logger instance
lineage_logger = LineageLogger()


# Integration with pipeline stages
async def lineage_tracking_stage(
    job_spec: Dict[str, Any],
    stage_name: str,
    operation: str
) -> Dict[str, Any]:
    """
    Pipeline stage wrapper that logs lineage.

    Args:
        job_spec: Job specification
        stage_name: Name of current stage
        operation: Operation being performed

    Returns:
        Updated job spec
    """
    input_artifact_id = job_spec.get("input_artifact_id")
    output_artifact_id = job_spec.get("artifact_id")

    if input_artifact_id and output_artifact_id:
        lineage_logger.log_transformation(
            input_artifact_id,
            output_artifact_id,
            operation,
            metadata={
                "stage": stage_name,
                "job_id": job_spec.get("job_id"),
                "worker_version": job_spec.get("worker_version", "1.0.0")
            }
        )

    return job_spec


# CLI for querying lineage
if __name__ == "__main__":
    import sys
    import argparse

    parser = argparse.ArgumentParser(description='Lineage Query CLI')
    parser.add_argument('command', choices=['get', 'upstream', 'report'])
    parser.add_argument('artifact_id', help='Artifact ID')

    args = parser.parse_args()

    logger_instance = LineageLogger()

    if args.command == 'get':
        lineage = logger_instance.get_lineage(args.artifact_id)
        print(json.dumps(lineage, indent=2))
    elif args.command == 'upstream':
        upstream = logger_instance.get_upstream(args.artifact_id)
        print("Upstream artifacts:")
        for artifact_id in upstream:
            print(f"  - {artifact_id}")
    elif args.command == 'report':
        report = logger_instance.generate_provenance_report(args.artifact_id)
        print(report)

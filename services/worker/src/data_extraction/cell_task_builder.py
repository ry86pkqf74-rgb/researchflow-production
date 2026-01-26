"""
Cell Task Builder Module - Build extraction tasks from detected cells.

This module converts block text detections into extraction task specifications
suitable for queuing and processing by the LLM extraction pipeline.

Key Features:
- Task spec generation from CellDetection
- Task deduplication via content hashing
- Priority assignment based on cell complexity
- Partition-level task grouping
- Batch formation for micro-batching

Architecture:
- Tasks are JSON-serializable for queue storage
- Tasks contain no raw PHI (use hashes/references)
- Tasks track provenance (source file, row, column)
"""

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum

from .block_text_detector import CellDetection, CellClassification

logger = logging.getLogger(__name__)


class TaskPriority(str, Enum):
    """Priority levels for extraction tasks."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, Enum):
    """Status of an extraction task."""
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class ExtractionTask:
    """
    Specification for a single cell extraction task.
    
    This is the unit of work for the extraction pipeline.
    """
    task_id: str
    job_id: str
    partition_id: int
    row_idx: int
    col_name: str
    content_hash: str
    text_length: int
    newline_count: int
    clinical_markers: List[str]
    heading_sections: List[str]
    priority: TaskPriority
    status: TaskStatus = TaskStatus.PENDING
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    prompt_template: Optional[str] = None
    force_tier: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Note: actual text content stored separately, not in task spec
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "job_id": self.job_id,
            "partition_id": self.partition_id,
            "row_idx": self.row_idx,
            "col_name": self.col_name,
            "content_hash": self.content_hash,
            "text_length": self.text_length,
            "newline_count": self.newline_count,
            "clinical_markers": self.clinical_markers,
            "heading_sections": self.heading_sections,
            "priority": self.priority.value,
            "status": self.status.value,
            "created_at": self.created_at,
            "prompt_template": self.prompt_template,
            "force_tier": self.force_tier,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExtractionTask":
        return cls(
            task_id=data["task_id"],
            job_id=data["job_id"],
            partition_id=data["partition_id"],
            row_idx=data["row_idx"],
            col_name=data["col_name"],
            content_hash=data["content_hash"],
            text_length=data["text_length"],
            newline_count=data["newline_count"],
            clinical_markers=data["clinical_markers"],
            heading_sections=data["heading_sections"],
            priority=TaskPriority(data["priority"]),
            status=TaskStatus(data.get("status", "pending")),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
            prompt_template=data.get("prompt_template"),
            force_tier=data.get("force_tier"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class TaskBatch:
    """A batch of tasks for micro-batching."""
    batch_id: str
    job_id: str
    tasks: List[ExtractionTask]
    total_text_length: int
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "job_id": self.job_id,
            "task_count": len(self.tasks),
            "total_text_length": self.total_text_length,
            "created_at": self.created_at,
            "task_ids": [t.task_id for t in self.tasks],
        }


@dataclass
class PartitionTasks:
    """Tasks grouped by partition (chunk)."""
    partition_id: int
    chunk_index: int
    row_start: int
    row_end: int
    tasks: List[ExtractionTask]
    total_tasks: int
    deduped_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "partition_id": self.partition_id,
            "chunk_index": self.chunk_index,
            "row_start": self.row_start,
            "row_end": self.row_end,
            "total_tasks": self.total_tasks,
            "deduped_count": self.deduped_count,
        }


def generate_task_id(job_id: str, row_idx: int, col_name: str) -> str:
    """Generate unique task ID."""
    key = f"{job_id}:{row_idx}:{col_name}"
    hash_part = hashlib.sha256(key.encode()).hexdigest()[:8]
    return f"task_{hash_part}"


def generate_batch_id(job_id: str, batch_num: int) -> str:
    """Generate unique batch ID."""
    return f"batch_{job_id[:8]}_{batch_num:04d}"


def determine_priority(detection: CellDetection) -> TaskPriority:
    """
    Determine task priority based on cell characteristics.
    
    Priority logic:
    - CRITICAL: Very long texts or many clinical markers
    - HIGH: Long texts or multiple sections
    - NORMAL: Default for block text
    - LOW: Short texts that barely meet threshold
    """
    # Very long or complex → critical
    if detection.text_length > 5000 or len(detection.clinical_markers_found) >= 5:
        return TaskPriority.CRITICAL
    
    # Long or multi-section → high
    if detection.text_length > 2000 or len(detection.heading_sections) >= 3:
        return TaskPriority.HIGH
    
    # Short but meets threshold → low
    if detection.text_length < 200:
        return TaskPriority.LOW
    
    return TaskPriority.NORMAL


def select_prompt_template(detection: CellDetection) -> str:
    """
    Select appropriate prompt template based on cell characteristics.
    
    Returns prompt template name to use for extraction.
    """
    col_lower = detection.col_name.lower()
    
    # ROS-specific
    if "ros" in col_lower or "review_of_systems" in col_lower:
        return "ros_extract_v1"
    if "ROS" in detection.heading_sections:
        return "ros_extract_v1"
    
    # Outcome/complication-specific
    outcome_indicators = {"outcome", "complication", "postop", "post_op", "follow_up"}
    if any(ind in col_lower for ind in outcome_indicators):
        return "outcome_extract_v1"
    
    # Check for outcome markers in text
    outcome_markers = {"POD", "post-op", "complication", "Clavien", "readmission"}
    if any(m in detection.clinical_markers_found for m in outcome_markers):
        return "outcome_extract_v1"
    
    # Default clinical extraction
    return "clinical_note_extract_v2"


class CellTaskBuilder:
    """
    Builder for creating extraction tasks from cell detections.
    
    Example:
        builder = CellTaskBuilder(job_id="job_abc123")
        
        # Build from detections
        detections = detector.detect_dataframe(df)
        tasks = builder.build_tasks(detections)
        
        # Or build from chunk
        partition_tasks = builder.build_partition_tasks(
            detections=detections,
            chunk_index=0,
            row_start=0,
            row_end=50000,
        )
    """
    
    def __init__(
        self,
        job_id: str,
        enable_dedup: bool = True,
        default_tier: Optional[str] = None,
    ):
        """
        Initialize task builder.
        
        Args:
            job_id: Job identifier for all tasks
            enable_dedup: Enable content hash deduplication
            default_tier: Force specific model tier for all tasks
        """
        self.job_id = job_id
        self.enable_dedup = enable_dedup
        self.default_tier = default_tier
        
        # Track seen content hashes for dedup
        self._seen_hashes: set = set()
        self._dedup_count = 0
        self._task_counter = 0
        self._partition_counter = 0
    
    def reset(self):
        """Reset builder state."""
        self._seen_hashes.clear()
        self._dedup_count = 0
        self._task_counter = 0
        self._partition_counter = 0
    
    def build_task(
        self,
        detection: CellDetection,
        partition_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[ExtractionTask]:
        """
        Build a single extraction task from a cell detection.
        
        Args:
            detection: CellDetection from block_text_detector
            partition_id: Partition/chunk ID
            metadata: Additional task metadata
            
        Returns:
            ExtractionTask or None if deduped/skipped
        """
        if not detection.should_extract:
            return None
        
        # Deduplication check
        if self.enable_dedup:
            if detection.content_hash in self._seen_hashes:
                self._dedup_count += 1
                return None
            self._seen_hashes.add(detection.content_hash)
        
        # Generate task
        task = ExtractionTask(
            task_id=generate_task_id(
                self.job_id, 
                detection.row_idx, 
                detection.col_name
            ),
            job_id=self.job_id,
            partition_id=partition_id or self._partition_counter,
            row_idx=detection.row_idx,
            col_name=detection.col_name,
            content_hash=detection.content_hash,
            text_length=detection.text_length,
            newline_count=detection.newline_count,
            clinical_markers=detection.clinical_markers_found,
            heading_sections=list(detection.heading_sections.keys()),
            priority=determine_priority(detection),
            prompt_template=select_prompt_template(detection),
            force_tier=self.default_tier,
            metadata=metadata or {},
        )
        
        self._task_counter += 1
        return task
    
    def build_tasks(
        self,
        detections: List[CellDetection],
        partition_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> List[ExtractionTask]:
        """
        Build tasks from a list of detections.
        
        Args:
            detections: List of CellDetection objects
            partition_id: Partition ID for all tasks
            metadata: Additional metadata for all tasks
            
        Returns:
            List of ExtractionTask objects
        """
        tasks = []
        
        for detection in detections:
            task = self.build_task(detection, partition_id, metadata)
            if task:
                tasks.append(task)
        
        logger.info(
            f"Built {len(tasks)} tasks from {len(detections)} detections "
            f"(deduped: {self._dedup_count})"
        )
        
        return tasks
    
    def build_partition_tasks(
        self,
        detections: List[CellDetection],
        chunk_index: int,
        row_start: int,
        row_end: int,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> PartitionTasks:
        """
        Build tasks for a partition (chunk) of data.
        
        Args:
            detections: Detections from this chunk
            chunk_index: Chunk index
            row_start: Starting row index
            row_end: Ending row index
            metadata: Additional metadata
            
        Returns:
            PartitionTasks object
        """
        partition_id = self._partition_counter
        self._partition_counter += 1
        
        initial_dedup = self._dedup_count
        tasks = self.build_tasks(detections, partition_id, metadata)
        deduped = self._dedup_count - initial_dedup
        
        return PartitionTasks(
            partition_id=partition_id,
            chunk_index=chunk_index,
            row_start=row_start,
            row_end=row_end,
            tasks=tasks,
            total_tasks=len(tasks),
            deduped_count=deduped,
        )
    
    def build_batches(
        self,
        tasks: List[ExtractionTask],
        batch_size: int = 20,
        max_batch_chars: int = 50000,
    ) -> List[TaskBatch]:
        """
        Group tasks into batches for micro-batching.
        
        Batches are formed by count OR total text length, whichever
        limit is hit first.
        
        Args:
            tasks: Tasks to batch
            batch_size: Maximum tasks per batch
            max_batch_chars: Maximum total characters per batch
            
        Returns:
            List of TaskBatch objects
        """
        batches = []
        current_batch = []
        current_chars = 0
        batch_num = 0
        
        for task in tasks:
            # Check if adding this task would exceed limits
            if len(current_batch) >= batch_size or \
               (current_chars + task.text_length > max_batch_chars and current_batch):
                # Finalize current batch
                batches.append(TaskBatch(
                    batch_id=generate_batch_id(self.job_id, batch_num),
                    job_id=self.job_id,
                    tasks=current_batch,
                    total_text_length=current_chars,
                ))
                batch_num += 1
                current_batch = []
                current_chars = 0
            
            current_batch.append(task)
            current_chars += task.text_length
        
        # Don't forget last batch
        if current_batch:
            batches.append(TaskBatch(
                batch_id=generate_batch_id(self.job_id, batch_num),
                job_id=self.job_id,
                tasks=current_batch,
                total_text_length=current_chars,
            ))
        
        logger.info(
            f"Created {len(batches)} batches from {len(tasks)} tasks "
            f"(avg size: {len(tasks)/max(len(batches),1):.1f})"
        )
        
        return batches
    
    def get_stats(self) -> Dict[str, Any]:
        """Get builder statistics."""
        return {
            "job_id": self.job_id,
            "tasks_created": self._task_counter,
            "dedup_count": self._dedup_count,
            "partitions_created": self._partition_counter,
            "unique_hashes": len(self._seen_hashes),
        }


__all__ = [
    "TaskPriority",
    "TaskStatus",
    "ExtractionTask",
    "TaskBatch",
    "PartitionTasks",
    "CellTaskBuilder",
    "generate_task_id",
    "generate_batch_id",
    "determine_priority",
    "select_prompt_template",
]

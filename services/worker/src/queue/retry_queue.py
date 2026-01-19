"""
Retry Queue

Handles failed operations with exponential backoff retry.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class RetryConfig:
    """Configuration for retry behavior"""
    max_retries: int = 3
    initial_delay: float = 1.0  # seconds
    max_delay: float = 60.0  # seconds
    backoff_multiplier: float = 2.0
    jitter: float = 0.1  # Random jitter factor


@dataclass
class RetryTask:
    """A task in the retry queue"""
    task_id: str
    task_type: str
    payload: Dict[str, Any]
    created_at: str
    retry_count: int = 0
    last_attempt: Optional[str] = None
    next_attempt: Optional[str] = None
    last_error: Optional[str] = None
    status: str = "pending"  # pending, processing, completed, failed, exhausted
    metadata: Dict[str, Any] = field(default_factory=dict)


class RetryQueue:
    """
    Queue for retrying failed operations.

    Features:
    - Exponential backoff with jitter
    - Persistent storage
    - Task priority
    - Dead letter handling
    """

    def __init__(
        self,
        storage_path: str = ".tmp/retry_queue",
        config: Optional[RetryConfig] = None
    ):
        """
        Initialize retry queue.

        Args:
            storage_path: Path to store queue state
            config: Retry configuration
        """
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.config = config or RetryConfig()
        self._handlers: Dict[str, Callable] = {}
        self._queue: List[RetryTask] = []
        self._load_queue()

    def _load_queue(self) -> None:
        """Load queue from storage"""
        queue_file = self.storage_path / "queue.json"

        if queue_file.exists():
            try:
                with open(queue_file, 'r') as f:
                    data = json.load(f)

                self._queue = [
                    RetryTask(
                        task_id=t['task_id'],
                        task_type=t['task_type'],
                        payload=t['payload'],
                        created_at=t['created_at'],
                        retry_count=t.get('retry_count', 0),
                        last_attempt=t.get('last_attempt'),
                        next_attempt=t.get('next_attempt'),
                        last_error=t.get('last_error'),
                        status=t.get('status', 'pending'),
                        metadata=t.get('metadata', {})
                    )
                    for t in data.get('tasks', [])
                ]
            except Exception as e:
                logger.warning(f"Failed to load queue: {e}")
                self._queue = []
        else:
            self._queue = []

    def _save_queue(self) -> None:
        """Save queue to storage"""
        queue_file = self.storage_path / "queue.json"

        data = {
            'tasks': [
                {
                    'task_id': t.task_id,
                    'task_type': t.task_type,
                    'payload': t.payload,
                    'created_at': t.created_at,
                    'retry_count': t.retry_count,
                    'last_attempt': t.last_attempt,
                    'next_attempt': t.next_attempt,
                    'last_error': t.last_error,
                    'status': t.status,
                    'metadata': t.metadata
                }
                for t in self._queue
            ],
            'saved_at': datetime.utcnow().isoformat()
        }

        with open(queue_file, 'w') as f:
            json.dump(data, f, indent=2)

    def register_handler(
        self,
        task_type: str,
        handler: Callable[[Dict[str, Any]], Any]
    ) -> None:
        """
        Register a handler for a task type.

        Args:
            task_type: Type of task
            handler: Function to execute for this task type
        """
        self._handlers[task_type] = handler
        logger.info(f"Registered handler for task type: {task_type}")

    def enqueue(
        self,
        task_type: str,
        payload: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add a task to the retry queue.

        Args:
            task_type: Type of task
            payload: Task payload
            metadata: Optional metadata

        Returns:
            Task ID
        """
        task_id = str(uuid.uuid4())

        task = RetryTask(
            task_id=task_id,
            task_type=task_type,
            payload=payload,
            created_at=datetime.utcnow().isoformat(),
            next_attempt=datetime.utcnow().isoformat(),
            metadata=metadata or {}
        )

        self._queue.append(task)
        self._save_queue()

        logger.info(f"Enqueued task {task_id} of type {task_type}")
        return task_id

    def _calculate_next_delay(self, retry_count: int) -> float:
        """Calculate delay until next retry with exponential backoff"""
        import random

        delay = self.config.initial_delay * (
            self.config.backoff_multiplier ** retry_count
        )
        delay = min(delay, self.config.max_delay)

        # Add jitter
        jitter = delay * self.config.jitter * (random.random() * 2 - 1)
        delay = max(0, delay + jitter)

        return delay

    def process_ready_tasks(self) -> Dict[str, Any]:
        """
        Process all tasks that are ready for execution.

        Returns:
            Summary of processed tasks
        """
        now = datetime.utcnow()
        processed = 0
        succeeded = 0
        failed = 0
        exhausted = 0

        for task in self._queue:
            if task.status not in ('pending', 'processing'):
                continue

            # Check if task is ready
            if task.next_attempt:
                next_time = datetime.fromisoformat(task.next_attempt)
                if next_time > now:
                    continue

            # Check for handler
            handler = self._handlers.get(task.task_type)
            if not handler:
                logger.warning(f"No handler for task type: {task.task_type}")
                continue

            # Execute task
            task.status = 'processing'
            task.last_attempt = now.isoformat()
            processed += 1

            try:
                handler(task.payload)
                task.status = 'completed'
                succeeded += 1
                logger.info(f"Task {task.task_id} completed successfully")

            except Exception as e:
                task.retry_count += 1
                task.last_error = str(e)

                if task.retry_count >= self.config.max_retries:
                    task.status = 'exhausted'
                    exhausted += 1
                    logger.error(
                        f"Task {task.task_id} exhausted after {task.retry_count} retries"
                    )
                    # Move to dead letter
                    self._move_to_dead_letter(task)
                else:
                    task.status = 'pending'
                    delay = self._calculate_next_delay(task.retry_count)
                    task.next_attempt = (now + timedelta(seconds=delay)).isoformat()
                    failed += 1
                    logger.warning(
                        f"Task {task.task_id} failed (attempt {task.retry_count}), "
                        f"retry in {delay:.1f}s"
                    )

        self._save_queue()

        return {
            'processed': processed,
            'succeeded': succeeded,
            'failed': failed,
            'exhausted': exhausted
        }

    def _move_to_dead_letter(self, task: RetryTask) -> None:
        """Move exhausted task to dead letter storage"""
        dead_letter_file = self.storage_path / "dead_letter.json"

        dead_letters = []
        if dead_letter_file.exists():
            with open(dead_letter_file, 'r') as f:
                dead_letters = json.load(f)

        dead_letters.append({
            'task_id': task.task_id,
            'task_type': task.task_type,
            'payload': task.payload,
            'created_at': task.created_at,
            'exhausted_at': datetime.utcnow().isoformat(),
            'retry_count': task.retry_count,
            'last_error': task.last_error
        })

        with open(dead_letter_file, 'w') as f:
            json.dump(dead_letters, f, indent=2)

    def get_task(self, task_id: str) -> Optional[RetryTask]:
        """Get a task by ID"""
        for task in self._queue:
            if task.task_id == task_id:
                return task
        return None

    def get_pending_count(self) -> int:
        """Get count of pending tasks"""
        return sum(1 for t in self._queue if t.status == 'pending')

    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        status_counts = {}
        type_counts = {}

        for task in self._queue:
            status_counts[task.status] = status_counts.get(task.status, 0) + 1
            type_counts[task.task_type] = type_counts.get(task.task_type, 0) + 1

        return {
            'total_tasks': len(self._queue),
            'by_status': status_counts,
            'by_type': type_counts
        }

    def clear_completed(self) -> int:
        """Remove completed tasks from queue"""
        before = len(self._queue)
        self._queue = [t for t in self._queue if t.status != 'completed']
        after = len(self._queue)
        self._save_queue()
        return before - after

    def retry_exhausted(self, task_id: str) -> bool:
        """
        Manually retry an exhausted task.

        Args:
            task_id: Task ID to retry

        Returns:
            True if task was reset for retry
        """
        for task in self._queue:
            if task.task_id == task_id and task.status == 'exhausted':
                task.status = 'pending'
                task.retry_count = 0
                task.next_attempt = datetime.utcnow().isoformat()
                self._save_queue()
                return True
        return False

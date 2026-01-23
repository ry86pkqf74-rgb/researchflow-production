"""
Checkpoints Module - Persistent checkpointing for large sheet processing.

This module provides checkpoint/resume capability for long-running extraction
jobs, enabling recovery from failures without re-processing completed work.

Key Features:
- Task checkpoint writing as JSONL
- Extraction result checkpointing (JSONL or Parquet)
- Atomic writes to prevent corruption
- Resume from last checkpoint
- Checkpoint validation and cleanup

Design Principles:
- All writes are atomic (write to temp, then rename)
- Checkpoints are self-describing with metadata
- Support both JSONL (streaming) and Parquet (columnar)
"""

import json
import os
import shutil
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Iterator, Literal
import tempfile

logger = logging.getLogger(__name__)

# Optional imports
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

try:
    import pyarrow as pa
    import pyarrow.parquet as pq
    PARQUET_AVAILABLE = True
except ImportError:
    PARQUET_AVAILABLE = False
    logger.info("pyarrow not available - Parquet checkpoints disabled")


@dataclass
class CheckpointMetadata:
    """Metadata for a checkpoint file."""
    job_id: str
    checkpoint_type: Literal["tasks", "results", "manifest"]
    partition_id: int
    chunk_index: int
    row_start: int
    row_end: int
    item_count: int
    format: Literal["jsonl", "parquet"]
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    version: str = "1.0"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "checkpoint_type": self.checkpoint_type,
            "partition_id": self.partition_id,
            "chunk_index": self.chunk_index,
            "row_start": self.row_start,
            "row_end": self.row_end,
            "item_count": self.item_count,
            "format": self.format,
            "created_at": self.created_at,
            "version": self.version,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CheckpointMetadata":
        return cls(
            job_id=data["job_id"],
            checkpoint_type=data["checkpoint_type"],
            partition_id=data["partition_id"],
            chunk_index=data["chunk_index"],
            row_start=data["row_start"],
            row_end=data["row_end"],
            item_count=data["item_count"],
            format=data["format"],
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
            version=data.get("version", "1.0"),
        )


@dataclass
class CheckpointState:
    """State of checkpointing for a job."""
    job_id: str
    base_dir: Path
    completed_partitions: List[int]
    task_checkpoints: List[str]
    result_checkpoints: List[str]
    total_tasks_written: int
    total_results_written: int
    last_checkpoint_at: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "base_dir": str(self.base_dir),
            "completed_partitions": self.completed_partitions,
            "task_checkpoints": self.task_checkpoints,
            "result_checkpoints": self.result_checkpoints,
            "total_tasks_written": self.total_tasks_written,
            "total_results_written": self.total_results_written,
            "last_checkpoint_at": self.last_checkpoint_at,
        }


def atomic_write_json(path: Path, data: Any) -> None:
    """Write JSON atomically (temp file + rename)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write to temp file in same directory (for atomic rename)
    fd, temp_path = tempfile.mkstemp(
        suffix=".tmp",
        prefix=path.stem,
        dir=path.parent,
    )
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(data, f, indent=2)
        # Atomic rename
        shutil.move(temp_path, path)
    except Exception:
        # Clean up temp file on error
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise


def atomic_write_jsonl(path: Path, items: List[Dict[str, Any]]) -> None:
    """Write JSONL atomically."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    fd, temp_path = tempfile.mkstemp(
        suffix=".tmp",
        prefix=path.stem,
        dir=path.parent,
    )
    try:
        with os.fdopen(fd, 'w') as f:
            for item in items:
                f.write(json.dumps(item) + "\n")
        shutil.move(temp_path, path)
    except Exception:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise


def read_jsonl(path: Path) -> Iterator[Dict[str, Any]]:
    """Read JSONL file as iterator."""
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def atomic_write_parquet(path: Path, data: List[Dict[str, Any]]) -> None:
    """Write Parquet atomically."""
    if not PARQUET_AVAILABLE:
        raise ImportError("pyarrow required for Parquet output")
    if not PANDAS_AVAILABLE:
        raise ImportError("pandas required for Parquet output")
    
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    df = pd.DataFrame(data)
    table = pa.Table.from_pandas(df)
    
    fd, temp_path = tempfile.mkstemp(
        suffix=".tmp",
        prefix=path.stem,
        dir=path.parent,
    )
    os.close(fd)  # Close fd, we'll use path
    
    try:
        pq.write_table(table, temp_path)
        shutil.move(temp_path, path)
    except Exception:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise


class CheckpointWriter:
    """
    Writer for task and result checkpoints.
    
    Example:
        writer = CheckpointWriter(
            job_id="job_abc123",
            base_dir=Path("/data/artifacts/job_abc123"),
        )
        
        # Write task checkpoint
        writer.write_tasks(partition_id=0, tasks=[...])
        
        # Write result checkpoint
        writer.write_results(partition_id=0, results=[...])
        
        # Get state for resume
        state = writer.get_state()
    """
    
    def __init__(
        self,
        job_id: str,
        base_dir: Path,
        output_format: Literal["parquet", "jsonl"] = "parquet",
    ):
        """
        Initialize checkpoint writer.
        
        Args:
            job_id: Job identifier
            base_dir: Base directory for checkpoints
            output_format: Output format for results
        """
        self.job_id = job_id
        self.base_dir = Path(base_dir)
        self.output_format = output_format
        
        # Create directories
        self.tasks_dir = self.base_dir / "tasks"
        self.results_dir = self.base_dir / "results"
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)
        
        # Track state
        self._completed_partitions: List[int] = []
        self._task_files: List[str] = []
        self._result_files: List[str] = []
        self._total_tasks = 0
        self._total_results = 0
    
    def write_tasks(
        self,
        partition_id: int,
        chunk_index: int,
        row_start: int,
        row_end: int,
        tasks: List[Dict[str, Any]],
    ) -> str:
        """
        Write task checkpoint for a partition.
        
        Args:
            partition_id: Partition identifier
            chunk_index: Chunk index
            row_start: Start row
            row_end: End row
            tasks: Task dictionaries to write
            
        Returns:
            Path to checkpoint file
        """
        filename = f"tasks_{partition_id:06d}.jsonl"
        filepath = self.tasks_dir / filename
        
        # Create metadata header
        metadata = CheckpointMetadata(
            job_id=self.job_id,
            checkpoint_type="tasks",
            partition_id=partition_id,
            chunk_index=chunk_index,
            row_start=row_start,
            row_end=row_end,
            item_count=len(tasks),
            format="jsonl",
        )
        
        # Write with metadata as first line
        items = [{"_metadata": metadata.to_dict()}] + tasks
        atomic_write_jsonl(filepath, items)
        
        self._task_files.append(str(filepath))
        self._total_tasks += len(tasks)
        
        logger.debug(f"Wrote {len(tasks)} tasks to {filepath}")
        return str(filepath)
    
    def write_results(
        self,
        partition_id: int,
        chunk_index: int,
        row_start: int,
        row_end: int,
        results: List[Dict[str, Any]],
    ) -> str:
        """
        Write result checkpoint for a partition.
        
        Args:
            partition_id: Partition identifier
            chunk_index: Chunk index
            row_start: Start row
            row_end: End row
            results: Extraction result dictionaries
            
        Returns:
            Path to checkpoint file
        """
        if self.output_format == "parquet" and PARQUET_AVAILABLE:
            filename = f"results_{partition_id:06d}.parquet"
            filepath = self.results_dir / filename
            
            # Add metadata to each row
            for r in results:
                r["_partition_id"] = partition_id
                r["_chunk_index"] = chunk_index
            
            atomic_write_parquet(filepath, results)
            
        else:
            # Fall back to JSONL
            filename = f"results_{partition_id:06d}.jsonl"
            filepath = self.results_dir / filename
            
            metadata = CheckpointMetadata(
                job_id=self.job_id,
                checkpoint_type="results",
                partition_id=partition_id,
                chunk_index=chunk_index,
                row_start=row_start,
                row_end=row_end,
                item_count=len(results),
                format="jsonl",
            )
            
            items = [{"_metadata": metadata.to_dict()}] + results
            atomic_write_jsonl(filepath, items)
        
        self._result_files.append(str(filepath))
        self._total_results += len(results)
        self._completed_partitions.append(partition_id)
        
        logger.debug(f"Wrote {len(results)} results to {filepath}")
        return str(filepath)
    
    def write_manifest(self) -> str:
        """
        Write job manifest with checkpoint state.
        
        Returns:
            Path to manifest file
        """
        manifest_path = self.base_dir / "manifest.json"
        
        manifest = {
            "job_id": self.job_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "output_format": self.output_format,
            "completed_partitions": sorted(self._completed_partitions),
            "task_checkpoints": self._task_files,
            "result_checkpoints": self._result_files,
            "total_tasks": self._total_tasks,
            "total_results": self._total_results,
        }
        
        atomic_write_json(manifest_path, manifest)
        logger.info(f"Wrote manifest to {manifest_path}")
        
        return str(manifest_path)
    
    def get_state(self) -> CheckpointState:
        """Get current checkpoint state."""
        return CheckpointState(
            job_id=self.job_id,
            base_dir=self.base_dir,
            completed_partitions=list(self._completed_partitions),
            task_checkpoints=list(self._task_files),
            result_checkpoints=list(self._result_files),
            total_tasks_written=self._total_tasks,
            total_results_written=self._total_results,
            last_checkpoint_at=datetime.now(timezone.utc).isoformat(),
        )


class CheckpointReader:
    """
    Reader for resuming from checkpoints.
    
    Example:
        reader = CheckpointReader(base_dir=Path("/data/artifacts/job_abc123"))
        
        # Check completed partitions
        completed = reader.get_completed_partitions()
        
        # Load results
        for result in reader.read_results():
            process(result)
    """
    
    def __init__(self, base_dir: Path):
        """
        Initialize checkpoint reader.
        
        Args:
            base_dir: Base directory with checkpoints
        """
        self.base_dir = Path(base_dir)
        self.tasks_dir = self.base_dir / "tasks"
        self.results_dir = self.base_dir / "results"
        self._manifest = None
    
    def load_manifest(self) -> Optional[Dict[str, Any]]:
        """Load job manifest if exists."""
        manifest_path = self.base_dir / "manifest.json"
        if manifest_path.exists():
            with open(manifest_path) as f:
                self._manifest = json.load(f)
            return self._manifest
        return None
    
    def get_completed_partitions(self) -> List[int]:
        """Get list of completed partition IDs."""
        manifest = self._manifest or self.load_manifest()
        if manifest:
            return manifest.get("completed_partitions", [])
        
        # Infer from files
        completed = set()
        if self.results_dir.exists():
            for path in self.results_dir.iterdir():
                if path.name.startswith("results_"):
                    # Extract partition ID from filename
                    try:
                        part_str = path.stem.split("_")[1]
                        completed.add(int(part_str))
                    except (IndexError, ValueError):
                        pass
        
        return sorted(completed)
    
    def read_tasks(self, partition_id: Optional[int] = None) -> Iterator[Dict[str, Any]]:
        """
        Read task checkpoints.
        
        Args:
            partition_id: Specific partition (None = all)
            
        Yields:
            Task dictionaries
        """
        if not self.tasks_dir.exists():
            return
        
        for path in sorted(self.tasks_dir.iterdir()):
            if not path.name.endswith(".jsonl"):
                continue
            
            # Filter by partition if specified
            if partition_id is not None:
                expected = f"tasks_{partition_id:06d}.jsonl"
                if path.name != expected:
                    continue
            
            for item in read_jsonl(path):
                # Skip metadata line
                if "_metadata" not in item:
                    yield item
    
    def read_results(self, partition_id: Optional[int] = None) -> Iterator[Dict[str, Any]]:
        """
        Read result checkpoints.
        
        Args:
            partition_id: Specific partition (None = all)
            
        Yields:
            Result dictionaries
        """
        if not self.results_dir.exists():
            return
        
        for path in sorted(self.results_dir.iterdir()):
            # Filter by partition if specified
            if partition_id is not None:
                if path.name.startswith(f"results_{partition_id:06d}"):
                    pass
                else:
                    continue
            
            if path.suffix == ".parquet" and PARQUET_AVAILABLE and PANDAS_AVAILABLE:
                df = pd.read_parquet(path)
                for _, row in df.iterrows():
                    yield row.to_dict()
                    
            elif path.suffix == ".jsonl":
                for item in read_jsonl(path):
                    if "_metadata" not in item:
                        yield item
    
    def get_resume_info(self) -> Dict[str, Any]:
        """
        Get information needed for resuming a job.
        
        Returns:
            Dict with resume information
        """
        manifest = self._manifest or self.load_manifest()
        completed = self.get_completed_partitions()
        
        return {
            "has_manifest": manifest is not None,
            "job_id": manifest.get("job_id") if manifest else None,
            "completed_partitions": completed,
            "next_partition": max(completed) + 1 if completed else 0,
            "total_results": manifest.get("total_results", 0) if manifest else 0,
        }


__all__ = [
    "CheckpointMetadata",
    "CheckpointState",
    "CheckpointWriter",
    "CheckpointReader",
    "atomic_write_json",
    "atomic_write_jsonl",
    "atomic_write_parquet",
    "read_jsonl",
]

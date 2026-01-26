"""
Large Sheet Pipeline Module - Memory-safe processing of large spreadsheets.

This module orchestrates the complete pipeline for processing large CSV/Excel
files with cell-level clinical extraction. It coordinates all the components:
- Sheet reading (streaming)
- Block text detection
- Task building
- Checkpointing
- LLM extraction (with bounded concurrency)
- Result merging

Key Features:
- Memory-safe streaming for multi-GB files
- Bounded LLM concurrency to avoid rate limits
- Checkpoint/resume for long-running jobs
- Micro-batching for efficiency
- PHI scanning integration

Architecture:
scan → detect → build_tasks → checkpoint → extract → merge → validate → output
"""

import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable, Awaitable, Tuple
import json

from .config import LargeSheetConfig, get_config, config_to_dict
from .sheet_reader import SheetReader, ChunkResult, get_sheet_metadata, SheetMetadata
from .block_text_detector import BlockTextDetector, CellDetection
from .cell_task_builder import CellTaskBuilder, ExtractionTask, TaskBatch
from .checkpoints import CheckpointWriter, CheckpointReader, CheckpointState

logger = logging.getLogger(__name__)


@dataclass
class PipelineProgress:
    """Progress tracking for pipeline execution."""
    phase: str
    total_rows: int
    processed_rows: int
    total_chunks: int
    completed_chunks: int
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    skipped_tasks: int
    current_chunk: int
    estimated_remaining_ms: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "phase": self.phase,
            "total_rows": self.total_rows,
            "processed_rows": self.processed_rows,
            "total_chunks": self.total_chunks,
            "completed_chunks": self.completed_chunks,
            "total_tasks": self.total_tasks,
            "completed_tasks": self.completed_tasks,
            "failed_tasks": self.failed_tasks,
            "skipped_tasks": self.skipped_tasks,
            "current_chunk": self.current_chunk,
            "progress_pct": (self.processed_rows / max(self.total_rows, 1)) * 100,
            "estimated_remaining_ms": self.estimated_remaining_ms,
        }


@dataclass
class PipelineResult:
    """Result of pipeline execution."""
    job_id: str
    success: bool
    phase_completed: str
    total_rows: int
    total_chunks: int
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    deduped_tasks: int
    total_cost_usd: float
    total_tokens: Dict[str, int]
    artifact_paths: Dict[str, str]
    manifest_path: str
    processing_time_ms: int
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "success": self.success,
            "phase_completed": self.phase_completed,
            "total_rows": self.total_rows,
            "total_chunks": self.total_chunks,
            "total_tasks": self.total_tasks,
            "completed_tasks": self.completed_tasks,
            "failed_tasks": self.failed_tasks,
            "deduped_tasks": self.deduped_tasks,
            "total_cost_usd": self.total_cost_usd,
            "total_tokens": self.total_tokens,
            "artifact_paths": self.artifact_paths,
            "manifest_path": self.manifest_path,
            "processing_time_ms": self.processing_time_ms,
            "errors": self.errors,
            "warnings": self.warnings,
        }


# Type alias for extraction function
ExtractionFn = Callable[[str, Dict[str, Any]], Awaitable[Dict[str, Any]]]


class LargeSheetPipeline:
    """
    Pipeline for processing large spreadsheets with clinical extraction.
    
    Example:
        pipeline = LargeSheetPipeline(
            job_id="job_abc123",
            output_dir=Path("/data/artifacts/job_abc123"),
        )
        
        # Run with extraction function
        result = await pipeline.run(
            input_path=Path("data.csv"),
            extract_fn=my_extraction_function,
        )
        
        print(f"Completed: {result.completed_tasks} tasks")
    """
    
    def __init__(
        self,
        job_id: str,
        output_dir: Path,
        config: Optional[LargeSheetConfig] = None,
        progress_callback: Optional[Callable[[PipelineProgress], None]] = None,
    ):
        """
        Initialize pipeline.
        
        Args:
            job_id: Unique job identifier
            output_dir: Directory for outputs and checkpoints
            config: Pipeline configuration (uses global if None)
            progress_callback: Optional callback for progress updates
        """
        self.job_id = job_id
        self.output_dir = Path(output_dir)
        self.config = config or get_config().large_sheet
        self.progress_callback = progress_callback
        
        # Create output directories
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize components
        self.reader = SheetReader(
            chunk_rows=self.config.chunk_rows,
            enable_dask=self.config.enable_dask,
            dask_blocksize=self.config.dask_blocksize,
        )
        self.detector = BlockTextDetector()
        self.task_builder = CellTaskBuilder(job_id=job_id)
        self.checkpoint_writer = CheckpointWriter(
            job_id=job_id,
            base_dir=self.output_dir,
            output_format=self.config.output_format,
        )
        
        # State tracking
        self._progress = PipelineProgress(
            phase="init",
            total_rows=0,
            processed_rows=0,
            total_chunks=0,
            completed_chunks=0,
            total_tasks=0,
            completed_tasks=0,
            failed_tasks=0,
            skipped_tasks=0,
            current_chunk=0,
        )
        self._start_time: Optional[float] = None
        self._all_tasks: List[ExtractionTask] = []
        self._task_texts: Dict[str, str] = {}  # task_id -> text
        self._results: List[Dict[str, Any]] = []
        self._total_cost = 0.0
        self._total_tokens = {"input": 0, "output": 0}
    
    def _update_progress(self, phase: str, **kwargs):
        """Update progress and notify callback."""
        self._progress.phase = phase
        for key, value in kwargs.items():
            if hasattr(self._progress, key):
                setattr(self._progress, key, value)
        
        if self.progress_callback:
            self.progress_callback(self._progress)
    
    async def _scan_and_detect(
        self,
        input_path: Path,
        sheet_name: Optional[str] = None,
        resume_from: Optional[int] = None,
    ) -> Tuple[SheetMetadata, int]:
        """
        Phase 1: Scan file and detect block text cells.
        
        Returns:
            Tuple of (metadata, total_chunks)
        """
        self._update_progress("scan", current_chunk=0)
        
        # Get metadata
        metadata = self.reader.get_metadata(input_path)
        estimated_chunks = (
            (metadata.estimated_rows or 0) // self.config.chunk_rows + 1
        )
        
        self._progress.total_rows = metadata.estimated_rows or 0
        self._progress.total_chunks = estimated_chunks
        
        logger.info(
            f"Scanning {metadata.file_type} file: "
            f"{metadata.file_size_mb:.1f}MB, ~{metadata.estimated_rows} rows"
        )
        
        # Process chunks
        chunk_count = 0
        for chunk in self.reader.read_chunks(input_path, sheet_name):
            # Skip already completed chunks
            if resume_from and chunk.chunk_index < resume_from:
                continue
            
            self._update_progress(
                "detect",
                current_chunk=chunk.chunk_index,
                processed_rows=chunk.row_end,
            )
            
            # Detect block text cells
            detections = self.detector.detect_dataframe(
                chunk.df,
                check_dedup=True,
            )
            
            # Build tasks for this chunk
            partition = self.task_builder.build_partition_tasks(
                detections=detections,
                chunk_index=chunk.chunk_index,
                row_start=chunk.row_start,
                row_end=chunk.row_end,
            )
            
            # Store task texts for extraction
            for detection in detections:
                if detection.should_extract:
                    task_id = f"task_{self.job_id[:8]}_{detection.row_idx}_{detection.col_name}"
                    # Find matching task
                    for task in partition.tasks:
                        if task.row_idx == detection.row_idx and task.col_name == detection.col_name:
                            self._task_texts[task.task_id] = detection.text
                            break
            
            # Write task checkpoint
            self.checkpoint_writer.write_tasks(
                partition_id=partition.partition_id,
                chunk_index=chunk.chunk_index,
                row_start=chunk.row_start,
                row_end=chunk.row_end,
                tasks=[t.to_dict() for t in partition.tasks],
            )
            
            self._all_tasks.extend(partition.tasks)
            chunk_count += 1
            
            self._update_progress(
                "detect",
                completed_chunks=chunk_count,
                total_tasks=len(self._all_tasks),
            )
        
        logger.info(
            f"Detection complete: {len(self._all_tasks)} tasks from {chunk_count} chunks"
        )
        
        return metadata, chunk_count
    
    async def _extract_tasks(
        self,
        extract_fn: ExtractionFn,
        resume_from_task: int = 0,
    ) -> int:
        """
        Phase 2: Execute extraction on all tasks with bounded concurrency.
        
        Returns:
            Number of completed tasks
        """
        self._update_progress("llm", completed_tasks=0)
        
        # Skip already completed tasks
        tasks_to_process = self._all_tasks[resume_from_task:]
        
        if not tasks_to_process:
            logger.info("No tasks to process")
            return 0
        
        # Create batches for micro-batching
        batches = self.task_builder.build_batches(
            tasks_to_process,
            batch_size=self.config.llm_batch_size,
        )
        
        # Semaphore for concurrency control
        semaphore = asyncio.Semaphore(self.config.llm_concurrency)
        
        async def process_task(task: ExtractionTask) -> Dict[str, Any]:
            """Process single extraction task."""
            async with semaphore:
                try:
                    text = self._task_texts.get(task.task_id, "")
                    if not text:
                        return {
                            "task_id": task.task_id,
                            "success": False,
                            "error": "text_not_found",
                        }
                    
                    # Call extraction function
                    result = await extract_fn(text, {
                        "task_id": task.task_id,
                        "row_idx": task.row_idx,
                        "col_name": task.col_name,
                        "prompt_template": task.prompt_template,
                        "force_tier": task.force_tier,
                    })
                    
                    # Track costs
                    if "cost_usd" in result:
                        self._total_cost += result["cost_usd"]
                    if "tokens" in result:
                        self._total_tokens["input"] += result["tokens"].get("input", 0)
                        self._total_tokens["output"] += result["tokens"].get("output", 0)
                    
                    return {
                        "task_id": task.task_id,
                        "row_idx": task.row_idx,
                        "col_name": task.col_name,
                        "success": result.get("success", True),
                        "extraction": result.get("extraction"),
                        "tier_used": result.get("tier_used"),
                        "cost_usd": result.get("cost_usd", 0),
                        "processing_time_ms": result.get("processing_time_ms"),
                    }
                    
                except Exception as e:
                    logger.error(f"Task {task.task_id} failed: {e}")
                    return {
                        "task_id": task.task_id,
                        "success": False,
                        "error": str(e)[:200],
                    }
        
        # Process all tasks concurrently (respecting semaphore)
        completed = 0
        failed = 0
        
        # Process in batches to update progress and checkpoint
        for batch_idx, batch in enumerate(batches):
            tasks_coros = [process_task(t) for t in batch.tasks]
            batch_results = await asyncio.gather(*tasks_coros, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    failed += 1
                    self._results.append({
                        "success": False,
                        "error": str(result)[:200],
                    })
                else:
                    if result.get("success", False):
                        completed += 1
                    else:
                        failed += 1
                    self._results.append(result)
            
            self._update_progress(
                "llm",
                completed_tasks=completed,
                failed_tasks=failed,
            )
            
            # Checkpoint every N chunks
            if (batch_idx + 1) % self.config.task_checkpoint_every_chunks == 0:
                # Write results checkpoint
                batch_results_clean = [
                    r for r in batch_results 
                    if isinstance(r, dict)
                ]
                if batch_results_clean:
                    self.checkpoint_writer.write_results(
                        partition_id=batch_idx,
                        chunk_index=batch_idx,
                        row_start=0,
                        row_end=0,
                        results=batch_results_clean,
                    )
        
        logger.info(f"Extraction complete: {completed} succeeded, {failed} failed")
        return completed
    
    async def _finalize(
        self,
        metadata: SheetMetadata,
        total_chunks: int,
    ) -> PipelineResult:
        """
        Phase 3: Finalize outputs and write manifest.
        """
        self._update_progress("finalize")
        
        # Write final results
        if self._results:
            self.checkpoint_writer.write_results(
                partition_id=999999,  # Final partition
                chunk_index=total_chunks,
                row_start=0,
                row_end=self._progress.total_rows,
                results=self._results,
            )
        
        # Write manifest
        manifest_path = self.checkpoint_writer.write_manifest()
        
        # Calculate processing time
        processing_time_ms = int(
            (datetime.now(timezone.utc).timestamp() - self._start_time) * 1000
        ) if self._start_time else 0
        
        # Build result
        result = PipelineResult(
            job_id=self.job_id,
            success=self._progress.failed_tasks == 0,
            phase_completed="finalize",
            total_rows=self._progress.total_rows,
            total_chunks=total_chunks,
            total_tasks=len(self._all_tasks),
            completed_tasks=self._progress.completed_tasks,
            failed_tasks=self._progress.failed_tasks,
            deduped_tasks=self.task_builder.get_stats()["dedup_count"],
            total_cost_usd=self._total_cost,
            total_tokens=self._total_tokens,
            artifact_paths={
                "tasks": str(self.output_dir / "tasks"),
                "results": str(self.output_dir / "results"),
            },
            manifest_path=manifest_path,
            processing_time_ms=processing_time_ms,
        )
        
        self._update_progress("complete")
        return result
    
    async def run(
        self,
        input_path: Path,
        extract_fn: ExtractionFn,
        sheet_name: Optional[str] = None,
        resume: bool = True,
    ) -> PipelineResult:
        """
        Run the complete pipeline.
        
        Args:
            input_path: Path to input CSV/Excel file
            extract_fn: Async function for extraction
            sheet_name: Sheet name for Excel (None = first)
            resume: Attempt to resume from checkpoints
            
        Returns:
            PipelineResult with completion status
        """
        self._start_time = datetime.now(timezone.utc).timestamp()
        input_path = Path(input_path)
        
        logger.info(f"Starting pipeline for job {self.job_id}: {input_path}")
        
        # Check for resume
        resume_from_chunk = None
        resume_from_task = 0
        
        if resume:
            reader = CheckpointReader(self.output_dir)
            resume_info = reader.get_resume_info()
            if resume_info["completed_partitions"]:
                resume_from_chunk = resume_info["next_partition"]
                logger.info(f"Resuming from chunk {resume_from_chunk}")
        
        try:
            # Phase 1: Scan and detect
            metadata, total_chunks = await self._scan_and_detect(
                input_path,
                sheet_name,
                resume_from_chunk,
            )
            
            # Phase 2: Extract
            await self._extract_tasks(
                extract_fn,
                resume_from_task,
            )
            
            # Phase 3: Finalize
            result = await self._finalize(metadata, total_chunks)
            
            return result
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}", exc_info=True)
            
            return PipelineResult(
                job_id=self.job_id,
                success=False,
                phase_completed=self._progress.phase,
                total_rows=self._progress.total_rows,
                total_chunks=self._progress.total_chunks,
                total_tasks=len(self._all_tasks),
                completed_tasks=self._progress.completed_tasks,
                failed_tasks=self._progress.failed_tasks,
                deduped_tasks=0,
                total_cost_usd=self._total_cost,
                total_tokens=self._total_tokens,
                artifact_paths={},
                manifest_path="",
                processing_time_ms=0,
                errors=[str(e)],
            )


def run_pipeline_sync(
    job_id: str,
    input_path: Path,
    output_dir: Path,
    extract_fn: ExtractionFn,
    **kwargs,
) -> PipelineResult:
    """
    Synchronous wrapper for pipeline execution.
    
    Args:
        job_id: Job identifier
        input_path: Input file path
        output_dir: Output directory
        extract_fn: Extraction function
        **kwargs: Additional pipeline arguments
        
    Returns:
        PipelineResult
    """
    pipeline = LargeSheetPipeline(
        job_id=job_id,
        output_dir=output_dir,
        **kwargs,
    )
    
    return asyncio.run(pipeline.run(
        input_path=input_path,
        extract_fn=extract_fn,
    ))


__all__ = [
    "PipelineProgress",
    "PipelineResult",
    "LargeSheetPipeline",
    "run_pipeline_sync",
    "ExtractionFn",
]

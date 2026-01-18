"""
ResearchFlow Worker - Job Consumer

This module implements the job consumer for the Python compute worker.
It connects to Redis, consumes jobs from the queue, and executes the
19-stage workflow engine for data processing and analysis.
"""

import os
import json
import asyncio
import signal
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
import httpx
import redis.asyncio as redis

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s" if os.getenv("LOG_FORMAT") != "json" else None,
)
logger = logging.getLogger("worker")


@dataclass
class JobRequest:
    """Represents a job request from the orchestrator."""
    job_id: str
    type: str
    config: Dict[str, Any]
    dataset_pointer: Optional[str] = None
    stages: Optional[list] = None
    callback_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class JobResult:
    """Represents a job result to send back to orchestrator."""
    job_id: str
    status: str  # completed, failed, cancelled, timeout
    completed_at: str
    duration: int  # milliseconds
    stages_completed: list
    result: Optional[Dict[str, Any]] = None
    artifacts: Optional[list] = None
    manifest: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None


class WorkerService:
    """Main worker service class for job processing."""

    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.callback_base_url = os.getenv("ORCHESTRATOR_URL", "http://orchestrator:3001")
        self.governance_mode = os.getenv("GOVERNANCE_MODE", "DEMO")
        self.artifact_path = os.getenv("ARTIFACT_PATH", "/data/artifacts")
        self.log_path = os.getenv("LOG_PATH", "/data/logs")

        self.redis_client: Optional[redis.Redis] = None
        self.http_client: Optional[httpx.AsyncClient] = None
        self.running = False
        self.current_job: Optional[str] = None

    async def start(self):
        """Start the worker service."""
        logger.info("Starting ResearchFlow Worker...")
        logger.info(f"Governance Mode: {self.governance_mode}")
        logger.info(f"Redis URL: {self.redis_url}")
        logger.info(f"Orchestrator URL: {self.callback_base_url}")

        # Initialize connections
        self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
        self.http_client = httpx.AsyncClient(timeout=30.0)

        # Test Redis connection
        try:
            await self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

        # Create directories
        os.makedirs(self.artifact_path, exist_ok=True)
        os.makedirs(self.log_path, exist_ok=True)

        self.running = True
        logger.info("Worker started successfully")

    async def stop(self):
        """Stop the worker service gracefully."""
        logger.info("Stopping worker...")
        self.running = False

        if self.current_job:
            logger.warning(f"Job {self.current_job} was in progress, marking as interrupted")

        if self.redis_client:
            await self.redis_client.close()

        if self.http_client:
            await self.http_client.aclose()

        logger.info("Worker stopped")

    async def consume_jobs(self):
        """Main job consumption loop."""
        job_queue = "researchflow:jobs:pending"
        processing_queue = "researchflow:jobs:processing"

        logger.info(f"Listening for jobs on queue: {job_queue}")

        while self.running:
            try:
                # Block and wait for a job (with timeout to check running flag)
                result = await self.redis_client.brpoplpush(
                    job_queue,
                    processing_queue,
                    timeout=5
                )

                if result is None:
                    continue

                # Parse and process the job
                job_data = json.loads(result)
                job = JobRequest(**job_data)

                self.current_job = job.job_id
                logger.info(f"Processing job {job.job_id} (type: {job.type})")

                # Process the job
                job_result = await self.process_job(job)

                # Send callback to orchestrator
                await self.send_callback(job, job_result)

                # Remove from processing queue
                await self.redis_client.lrem(processing_queue, 1, result)

                self.current_job = None

            except json.JSONDecodeError as e:
                logger.error(f"Invalid job data: {e}")
                continue
            except Exception as e:
                logger.exception(f"Error processing job: {e}")
                await asyncio.sleep(1)

    async def process_job(self, job: JobRequest) -> JobResult:
        """Process a single job and return the result."""
        start_time = datetime.now()
        stages_completed = []
        artifacts = []

        try:
            if job.type == "validation":
                result = await self.run_validation(job)
            elif job.type == "analysis":
                result = await self.run_analysis(job)
            elif job.type == "stage_run":
                result, stages_completed = await self.run_stages(job)
            elif job.type == "artifact_generation":
                result, artifacts = await self.generate_artifacts(job)
            else:
                raise ValueError(f"Unknown job type: {job.type}")

            end_time = datetime.now()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            return JobResult(
                job_id=job.job_id,
                status="completed",
                completed_at=end_time.isoformat(),
                duration=duration_ms,
                stages_completed=stages_completed,
                result=result,
                artifacts=artifacts,
            )

        except Exception as e:
            end_time = datetime.now()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            logger.exception(f"Job {job.job_id} failed: {e}")

            return JobResult(
                job_id=job.job_id,
                status="failed",
                completed_at=end_time.isoformat(),
                duration=duration_ms,
                stages_completed=stages_completed,
                error={
                    "code": "PROCESSING_ERROR",
                    "message": str(e),
                    "retryable": True,
                },
            )

    async def run_validation(self, job: JobRequest) -> Dict[str, Any]:
        """Run data validation using Pandera schemas."""
        logger.info(f"Running validation for job {job.job_id}")

        # Import validation modules
        # from validation import validate_dataset

        # Placeholder implementation
        return {
            "valid": True,
            "errors": [],
            "warnings": [],
            "record_count": 0,
        }

    async def run_analysis(self, job: JobRequest) -> Dict[str, Any]:
        """Run statistical analysis."""
        logger.info(f"Running analysis for job {job.job_id}")

        # Import analysis modules
        # from analysis import run_analysis

        # Placeholder implementation
        return {
            "analysis_type": job.config.get("analysisType", "descriptive"),
            "metrics": {},
            "summary": {},
        }

    async def run_stages(self, job: JobRequest) -> tuple:
        """Run specific workflow stages."""
        stages = job.stages or list(range(1, 20))
        completed = []

        logger.info(f"Running stages {stages} for job {job.job_id}")

        for stage in stages:
            logger.info(f"Executing stage {stage}")
            # Import and execute stage
            # from stages import execute_stage
            # await execute_stage(stage, job.config)
            completed.append(stage)

        return {"stages_executed": completed}, completed

    async def generate_artifacts(self, job: JobRequest) -> tuple:
        """Generate output artifacts (figures, tables, reports)."""
        logger.info(f"Generating artifacts for job {job.job_id}")

        artifacts = []

        # Import artifact generation
        # from artifacts import generate_figure, generate_table

        # Placeholder implementation
        return {"artifact_count": 0}, artifacts

    async def send_callback(self, job: JobRequest, result: JobResult):
        """Send job result callback to orchestrator."""
        callback_url = job.callback_url or f"{self.callback_base_url}/api/jobs/{job.job_id}/callback"

        try:
            response = await self.http_client.post(
                callback_url,
                json=asdict(result),
            )
            response.raise_for_status()
            logger.info(f"Callback sent for job {job.job_id}")
        except Exception as e:
            logger.error(f"Failed to send callback for job {job.job_id}: {e}")


async def health_check_server(worker: WorkerService):
    """Simple HTTP health check server."""
    from aiohttp import web

    async def health_handler(request):
        return web.json_response({
            "status": "healthy",
            "service": "worker",
            "running": worker.running,
            "current_job": worker.current_job,
            "governance_mode": worker.governance_mode,
            "timestamp": datetime.now().isoformat(),
        })

    app = web.Application()
    app.router.add_get("/health", health_handler)

    runner = web.AppRunner(app)
    await runner.setup()

    site = web.TCPSite(runner, "0.0.0.0", 8000)
    await site.start()

    logger.info("Health check server running on port 8000")

    return runner


async def main():
    """Main entry point."""
    worker = WorkerService()

    # Setup signal handlers
    loop = asyncio.get_event_loop()

    def signal_handler():
        logger.info("Received shutdown signal")
        asyncio.create_task(worker.stop())

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, signal_handler)

    try:
        await worker.start()

        # Start health check server
        health_runner = await health_check_server(worker)

        # Start consuming jobs
        await worker.consume_jobs()

    except Exception as e:
        logger.exception(f"Worker error: {e}")
    finally:
        await worker.stop()


if __name__ == "__main__":
    asyncio.run(main())

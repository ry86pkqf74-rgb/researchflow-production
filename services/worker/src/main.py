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
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
import httpx
import redis.asyncio as redis

# Phase C imports - Literature and Data Processing
from src.jobs import (
    index_literature,
    LiteratureIndexingConfig,
    summarize_literature,
    SummarizationConfig,
)

# Workflow Engine imports
from src.workflow_engine import (
    run_stages as workflow_run_stages,
    StageContext,
    StageResult,
    list_stages,
)

# Cumulative data client for LIVE mode
from src.services import (
    get_cumulative_data_client,
    close_cumulative_data_client,
)

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

        # Close cumulative data client
        await close_cumulative_data_client()

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
            # Phase C: Literature processing jobs
            elif job.type == "literature_indexing":
                result = await self.run_literature_indexing(job)
            elif job.type == "literature_summarization":
                result = await self.run_literature_summarization(job)
            elif job.type == "literature_search":
                result = await self.run_literature_search(job)
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
        """Run specific workflow stages using the workflow engine."""
        stages = job.stages or list(range(1, 20))

        logger.info(f"Running stages {stages} for job {job.job_id}")

        # Log registered stages for visibility
        registered = list_stages()
        logger.info(f"Registered stages: {[s['stage_id'] for s in registered]}")

        # Extract identifiers from job metadata
        metadata = job.metadata or {}
        project_id = metadata.get("project_id")
        research_id = metadata.get("research_id")
        user_id = metadata.get("user_id")

        # Initialize cumulative data fields
        manifest_id = None
        cumulative_data = {}
        phi_schemas = {}
        prior_stage_outputs = {}

        # In LIVE mode, fetch cumulative data from orchestrator
        if self.governance_mode == "LIVE" and (project_id or research_id):
            logger.info(f"LIVE mode: Fetching cumulative data for project={project_id}, research={research_id}")

            try:
                cumulative_client = get_cumulative_data_client()
                identifier = {"project_id": project_id, "research_id": research_id}

                # Get cumulative data up to the first stage we're running
                first_stage = min(stages)
                cumulative_result = await cumulative_client.get_cumulative_data(
                    identifier=identifier,
                    stage_number=first_stage,
                )

                manifest_id = cumulative_result.manifest_id
                cumulative_data = cumulative_result.cumulative_data
                phi_schemas = cumulative_result.phi_schemas
                prior_stage_outputs = cumulative_result.stage_outputs

                logger.info(
                    f"Loaded cumulative data: manifest={manifest_id}, "
                    f"stages_loaded={list(prior_stage_outputs.keys())}, "
                    f"phi_schemas={list(phi_schemas.keys())}"
                )

            except Exception as e:
                logger.warning(f"Failed to fetch cumulative data (continuing with empty): {e}")

        # Also check if cumulative data was passed directly in job config
        # (alternative path for orchestrator to pass data inline)
        if "cumulativeData" in job.config:
            cumulative_data = {**cumulative_data, **job.config["cumulativeData"]}
            logger.info("Merged inline cumulativeData from job config")

        if "phiSchemas" in job.config:
            phi_schemas = {**phi_schemas, **job.config["phiSchemas"]}
            logger.info("Merged inline phiSchemas from job config")

        if "priorStageOutputs" in job.config:
            for stage_key, output in job.config["priorStageOutputs"].items():
                try:
                    stage_num = int(stage_key)
                    prior_stage_outputs[stage_num] = output
                except (ValueError, TypeError):
                    pass
            logger.info("Merged inline priorStageOutputs from job config")

        # Create execution context with cumulative data
        context = StageContext(
            job_id=job.job_id,
            config=job.config,
            dataset_pointer=job.dataset_pointer,
            artifact_path=self.artifact_path,
            log_path=self.log_path,
            governance_mode=self.governance_mode,
            metadata=metadata,
            # Cumulative data fields
            manifest_id=manifest_id,
            project_id=project_id,
            research_id=research_id,
            cumulative_data=cumulative_data,
            phi_schemas=phi_schemas,
            prior_stage_outputs=prior_stage_outputs,
        )

        logger.info(
            f"Stage context created: governance={self.governance_mode}, "
            f"has_cumulative={bool(cumulative_data)}, "
            f"prior_stages={list(prior_stage_outputs.keys())}"
        )

        # Execute stages via workflow engine
        result = await workflow_run_stages(
            stage_ids=stages,
            context=context,
            stop_on_failure=job.config.get("stop_on_failure", True),
        )

        # In LIVE mode, report stage completions back to orchestrator
        if self.governance_mode == "LIVE" and (project_id or research_id):
            await self._report_stage_results(
                identifier={"project_id": project_id, "research_id": research_id},
                result=result,
            )

        completed = result["stages_completed"]
        return result, completed

    async def _report_stage_results(
        self,
        identifier: Dict[str, str],
        result: Dict[str, Any],
    ):
        """Report stage results back to orchestrator for persistence."""
        try:
            cumulative_client = get_cumulative_data_client()

            # Report completed stages
            for stage_id in result.get("stages_completed", []):
                stage_result = result.get("results", {}).get(str(stage_id), {})
                await cumulative_client.report_stage_completion(
                    identifier=identifier,
                    stage_number=stage_id,
                    output_data=stage_result.get("output", {}),
                    artifacts=stage_result.get("artifacts", []),
                    processing_time_ms=stage_result.get("duration_ms", 0),
                )

            # Report failed stages
            for stage_id in result.get("stages_failed", []):
                stage_result = result.get("results", {}).get(str(stage_id), {})
                errors = stage_result.get("errors", [])
                error_message = errors[0] if errors else "Stage execution failed"
                await cumulative_client.report_stage_failure(
                    identifier=identifier,
                    stage_number=stage_id,
                    error_message=error_message,
                )

        except Exception as e:
            logger.error(f"Failed to report stage results to orchestrator: {e}")

    async def generate_artifacts(self, job: JobRequest) -> tuple:
        """Generate output artifacts (figures, tables, reports)."""
        logger.info(f"Generating artifacts for job {job.job_id}")

        artifacts = []

        # Import artifact generation
        # from artifacts import generate_figure, generate_table

        # Placeholder implementation
        return {"artifact_count": 0}, artifacts

    # -------------------------------------------------------------------------
    # Phase C: Literature Processing Jobs
    # -------------------------------------------------------------------------

    async def run_literature_indexing(self, job: JobRequest) -> Dict[str, Any]:
        """Index literature items into Chroma vector database."""
        logger.info(f"Running literature indexing for job {job.job_id}")

        items = job.config.get("items", [])
        if not items:
            return {
                "indexed_count": 0,
                "updated_count": 0,
                "collection": "literature",
                "errors": [],
            }

        # Build config from job parameters
        config = LiteratureIndexingConfig(
            collection=job.config.get("collection", "literature"),
            upsert=job.config.get("upsert", True),
            include_abstract=job.config.get("include_abstract", True),
            include_title=job.config.get("include_title", True),
        )

        # Run indexing (sync function, run in thread pool)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: index_literature(items, config)
        )

        return result

    async def run_literature_summarization(self, job: JobRequest) -> Dict[str, Any]:
        """Summarize literature using LLM map-reduce approach."""
        logger.info(f"Running literature summarization for job {job.job_id}")

        items = job.config.get("items", [])
        query = job.config.get("query", "")

        if not items:
            return {
                "paper_summaries": [],
                "synthesis": {
                    "themes": [],
                    "contradictions": [],
                    "gaps": [],
                    "overall_summary": "No papers provided for summarization.",
                },
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "config": {},
            }

        # Build config from job parameters
        config = SummarizationConfig(
            include_methods=job.config.get("include_methods", True),
            include_findings=job.config.get("include_findings", True),
            include_limitations=job.config.get("include_limitations", True),
            max_papers_for_synthesis=job.config.get("max_papers_for_synthesis", 20),
            synthesis_style=job.config.get("synthesis_style", "structured"),
            model=job.config.get("model", "claude-3-haiku-20240307"),
            temperature=job.config.get("temperature", 0.3),
            max_tokens_per_paper=job.config.get("max_tokens_per_paper", 500),
            max_tokens_synthesis=job.config.get("max_tokens_synthesis", 2000),
        )

        # Run summarization (sync function with LLM calls)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: summarize_literature(
                items=items,
                query=query,
                config=config,
                save_artifact=job.config.get("save_artifact", True),
            )
        )

        return result

    async def run_literature_search(self, job: JobRequest) -> Dict[str, Any]:
        """Search literature using semantic similarity in Chroma."""
        logger.info(f"Running literature search for job {job.job_id}")

        from src.jobs.literature_indexing import search_literature

        query = job.config.get("query", "")
        k = job.config.get("k", 10)
        collection = job.config.get("collection", "literature")
        year_start = job.config.get("year_start")
        year_end = job.config.get("year_end")
        providers = job.config.get("providers")

        if not query:
            return {"results": [], "query": "", "k": k}

        # Run search (sync function)
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: search_literature(
                query=query,
                k=k,
                collection=collection,
                year_start=year_start,
                year_end=year_end,
                providers=providers,
            )
        )

        return {
            "results": results,
            "query": query,
            "k": k,
            "collection": collection,
        }

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

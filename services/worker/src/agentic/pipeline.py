"""
Agentic Pipeline

Main orchestrator for the agentic statistical analysis pipeline.
Coordinates schema introspection, stats selection, and execution.
"""

import logging
import time
import json
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime
import pandas as pd

from .models import (
    PlanSpec, PlanStage, StageType,
    ExecutionRequest, ExecutionResult, StageResult,
    ArtifactOutput, StatisticalMethod
)
from .schema_introspect import SchemaIntrospector, schema_introspector
from .stats_selector import StatsSelector, stats_selector
from .stats_executor import StatsExecutor, stats_executor
from .safe_query import SafeQueryBuilder, safe_query

logger = logging.getLogger(__name__)


class AgenticPipeline:
    """
    Main pipeline orchestrator.

    Execution flow:
    1. Load dataset (from file or database)
    2. Execute each stage in order
    3. Generate artifacts
    4. Return results
    """

    def __init__(
        self,
        data_dir: str = "/app/data",
        output_dir: str = "/app/artifacts"
    ):
        """
        Initialize pipeline.

        Args:
            data_dir: Directory for input data
            output_dir: Directory for output artifacts
        """
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.schema_introspector = schema_introspector
        self.stats_selector = stats_selector
        self.stats_executor = stats_executor
        self.safe_query = safe_query

    def execute(self, request: ExecutionRequest) -> ExecutionResult:
        """
        Execute an analysis plan.

        Args:
            request: Execution request with plan spec

        Returns:
            ExecutionResult with findings
        """
        start_time = time.time()
        stages_completed = []
        stages_failed = []
        stage_results = []
        artifacts = []

        logger.info(f"Starting execution of plan {request.plan_id}, job {request.job_id}")

        try:
            # Execute stages in dependency order
            for stage in request.plan_spec.stages:
                # Check dependencies
                if stage.depends_on:
                    missing_deps = [d for d in stage.depends_on if d not in stages_completed]
                    if missing_deps:
                        logger.warning(f"Stage {stage.stage_id} has missing dependencies: {missing_deps}")
                        if any(d in stages_failed for d in stage.depends_on):
                            # Skip if dependency failed
                            stages_failed.append(stage.stage_id)
                            stage_results.append(StageResult(
                                stage_id=stage.stage_id,
                                success=False,
                                error="Dependency failed"
                            ))
                            continue

                # Execute stage
                logger.info(f"Executing stage: {stage.name} ({stage.stage_id})")
                result = self._execute_stage(stage, request)

                if result.success:
                    stages_completed.append(stage.stage_id)
                    artifacts.extend(result.artifacts)
                else:
                    stages_failed.append(stage.stage_id)

                stage_results.append(result)

                # Dry run: stop after first stage
                if request.execution_mode == "dry_run":
                    logger.info("Dry run mode: stopping after first stage")
                    break

            # Generate summary
            summary = self._generate_summary(stage_results, artifacts)

            execution_time_ms = int((time.time() - start_time) * 1000)

            return ExecutionResult(
                plan_id=request.plan_id,
                job_id=request.job_id,
                success=len(stages_failed) == 0,
                message=f"Completed {len(stages_completed)} stages, {len(stages_failed)} failed",
                stages_completed=stages_completed,
                stages_failed=stages_failed,
                stage_results=stage_results,
                artifacts=artifacts,
                summary=summary,
                execution_time_ms=execution_time_ms
            )

        except Exception as e:
            logger.error(f"Pipeline execution failed: {e}")
            execution_time_ms = int((time.time() - start_time) * 1000)

            return ExecutionResult(
                plan_id=request.plan_id,
                job_id=request.job_id,
                success=False,
                message=f"Pipeline failed: {str(e)}",
                stages_completed=stages_completed,
                stages_failed=stages_failed,
                stage_results=stage_results,
                artifacts=artifacts,
                summary={"error": str(e)},
                execution_time_ms=execution_time_ms
            )

    def _execute_stage(
        self,
        stage: PlanStage,
        request: ExecutionRequest
    ) -> StageResult:
        """Execute a single stage."""
        start_time = time.time()

        try:
            if stage.stage_type == StageType.EXTRACTION:
                return self._execute_extraction(stage, request, start_time)
            elif stage.stage_type == StageType.TRANSFORM:
                return self._execute_transform(stage, request, start_time)
            elif stage.stage_type == StageType.ANALYSIS:
                return self._execute_analysis(stage, request, start_time)
            elif stage.stage_type == StageType.VALIDATION:
                return self._execute_validation(stage, request, start_time)
            elif stage.stage_type == StageType.OUTPUT:
                return self._execute_output(stage, request, start_time)
            else:
                return StageResult(
                    stage_id=stage.stage_id,
                    success=False,
                    error=f"Unknown stage type: {stage.stage_type}",
                    duration_ms=int((time.time() - start_time) * 1000)
                )
        except Exception as e:
            logger.error(f"Stage {stage.stage_id} failed: {e}")
            return StageResult(
                stage_id=stage.stage_id,
                success=False,
                error=str(e),
                duration_ms=int((time.time() - start_time) * 1000)
            )

    def _execute_extraction(
        self,
        stage: PlanStage,
        request: ExecutionRequest,
        start_time: float
    ) -> StageResult:
        """Execute data extraction stage."""
        config = stage.config

        # Get dataset info
        dataset_id = config.get("dataset_id")
        dataset_path = config.get("dataset_path")
        columns = config.get("columns")
        filters = config.get("filters")
        row_limit = request.constraints.get("maxRows", 100000)

        # Load dataset
        df = self.schema_introspector.load_dataset(
            dataset_id or "unknown",
            dataset_path
        )

        # Apply row limit
        if len(df) > row_limit:
            df = df.sample(n=row_limit, random_state=42)
            logger.info(f"Sampled {row_limit} rows from dataset")

        # Select columns
        if columns:
            df = df[[c for c in columns if c in df.columns]]

        # Store in context for later stages
        # (In production, this would use a proper context manager)
        request.config_overrides["_extracted_data"] = df.to_dict()

        return StageResult(
            stage_id=stage.stage_id,
            success=True,
            message=f"Extracted {len(df)} rows, {len(df.columns)} columns",
            data={
                "row_count": len(df),
                "column_count": len(df.columns),
                "columns": list(df.columns)
            },
            duration_ms=int((time.time() - start_time) * 1000)
        )

    def _execute_transform(
        self,
        stage: PlanStage,
        request: ExecutionRequest,
        start_time: float
    ) -> StageResult:
        """Execute data transformation stage."""
        config = stage.config

        # Get data from previous stage
        data_dict = request.config_overrides.get("_extracted_data")
        if not data_dict:
            return StageResult(
                stage_id=stage.stage_id,
                success=False,
                error="No data available from extraction stage",
                duration_ms=int((time.time() - start_time) * 1000)
            )

        df = pd.DataFrame(data_dict)

        # Apply transformations
        transformations = config.get("transformations", [])
        for transform in transformations:
            transform_type = transform.get("type")
            if transform_type == "drop_missing":
                df = df.dropna(subset=transform.get("columns", df.columns))
            elif transform_type == "fill_missing":
                fill_value = transform.get("value", 0)
                columns = transform.get("columns", df.columns)
                df[columns] = df[columns].fillna(fill_value)
            elif transform_type == "standardize":
                columns = transform.get("columns", [])
                for col in columns:
                    if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                        df[col] = (df[col] - df[col].mean()) / df[col].std()

        # Update context
        request.config_overrides["_extracted_data"] = df.to_dict()

        return StageResult(
            stage_id=stage.stage_id,
            success=True,
            message=f"Applied {len(transformations)} transformations",
            data={"row_count": len(df)},
            duration_ms=int((time.time() - start_time) * 1000)
        )

    def _execute_analysis(
        self,
        stage: PlanStage,
        request: ExecutionRequest,
        start_time: float
    ) -> StageResult:
        """Execute statistical analysis stage."""
        config = stage.config

        # Get data
        data_dict = request.config_overrides.get("_extracted_data")
        if not data_dict:
            return StageResult(
                stage_id=stage.stage_id,
                success=False,
                error="No data available for analysis",
                duration_ms=int((time.time() - start_time) * 1000)
            )

        df = pd.DataFrame(data_dict)

        # Get statistical method from config
        method_config = config.get("method", {})
        method = StatisticalMethod(
            method=method_config.get("method", "descriptive_statistics"),
            rationale=method_config.get("rationale", ""),
            assumptions=method_config.get("assumptions", []),
            variables=method_config.get("variables", {})
        )

        # Execute analysis
        result = self.stats_executor.execute(method, df)

        # Create artifact for results
        artifacts = []
        if result.success:
            artifact = ArtifactOutput(
                artifact_type="data",
                name=f"{stage.stage_id}_results",
                description=f"Results from {method.method}",
                inline_data=result.raw_output,
                metadata={"method": method.method, "p_value": result.p_value}
            )
            artifacts.append(artifact)

        return StageResult(
            stage_id=stage.stage_id,
            success=result.success,
            message=result.interpretation,
            data=result.raw_output,
            artifacts=artifacts,
            duration_ms=int((time.time() - start_time) * 1000)
        )

    def _execute_validation(
        self,
        stage: PlanStage,
        request: ExecutionRequest,
        start_time: float
    ) -> StageResult:
        """Execute validation stage."""
        config = stage.config

        validations = config.get("validations", [])
        results = []

        for validation in validations:
            val_type = validation.get("type")
            if val_type == "check_sample_size":
                min_n = validation.get("min_n", 30)
                data_dict = request.config_overrides.get("_extracted_data")
                if data_dict:
                    df = pd.DataFrame(data_dict)
                    results.append({
                        "validation": "sample_size",
                        "passed": len(df) >= min_n,
                        "actual": len(df),
                        "required": min_n
                    })

        all_passed = all(r.get("passed", False) for r in results)

        return StageResult(
            stage_id=stage.stage_id,
            success=all_passed,
            message=f"{sum(1 for r in results if r.get('passed'))}/{len(results)} validations passed",
            data={"validations": results},
            duration_ms=int((time.time() - start_time) * 1000)
        )

    def _execute_output(
        self,
        stage: PlanStage,
        request: ExecutionRequest,
        start_time: float
    ) -> StageResult:
        """Execute output generation stage."""
        config = stage.config
        artifacts = []

        output_types = config.get("outputs", [])

        for output in output_types:
            output_type = output.get("type")
            name = output.get("name", f"output_{stage.stage_id}")

            if output_type == "summary_table":
                # Generate summary table
                data_dict = request.config_overrides.get("_extracted_data")
                if data_dict:
                    df = pd.DataFrame(data_dict)
                    summary = df.describe().to_dict()

                    # Save to file
                    file_path = self.output_dir / f"{request.job_id}_{name}.json"
                    with open(file_path, "w") as f:
                        json.dump(summary, f, indent=2, default=str)

                    artifacts.append(ArtifactOutput(
                        artifact_type="table",
                        name=name,
                        description="Summary statistics table",
                        file_path=str(file_path),
                        file_size=file_path.stat().st_size,
                        mime_type="application/json"
                    ))

            elif output_type == "manifest":
                # Generate manifest
                manifest = {
                    "plan_id": request.plan_id,
                    "job_id": request.job_id,
                    "generated_at": datetime.utcnow().isoformat(),
                    "stages": len(request.plan_spec.stages),
                    "artifacts": len(artifacts)
                }

                file_path = self.output_dir / f"{request.job_id}_manifest.json"
                with open(file_path, "w") as f:
                    json.dump(manifest, f, indent=2)

                artifacts.append(ArtifactOutput(
                    artifact_type="manifest",
                    name="manifest",
                    file_path=str(file_path),
                    file_size=file_path.stat().st_size,
                    mime_type="application/json"
                ))

        return StageResult(
            stage_id=stage.stage_id,
            success=True,
            message=f"Generated {len(artifacts)} outputs",
            artifacts=artifacts,
            duration_ms=int((time.time() - start_time) * 1000)
        )

    def _generate_summary(
        self,
        stage_results: List[StageResult],
        artifacts: List[ArtifactOutput]
    ) -> Dict[str, Any]:
        """Generate execution summary."""
        return {
            "total_stages": len(stage_results),
            "successful_stages": sum(1 for r in stage_results if r.success),
            "failed_stages": sum(1 for r in stage_results if not r.success),
            "total_artifacts": len(artifacts),
            "artifact_types": list(set(a.artifact_type for a in artifacts)),
            "total_duration_ms": sum(r.duration_ms for r in stage_results)
        }


# Singleton instance
agentic_pipeline = AgenticPipeline()

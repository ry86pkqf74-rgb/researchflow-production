"""
Stage 06: Analysis

Handles computational analysis of datasets including:
- Exploratory data analysis
- Statistical analysis
- Correlation analysis
- Distribution analysis
- Clinical data extraction (LLM-powered)

This stage simulates analysis job execution with progress tracking
and generates mock analysis results.
"""

import asyncio
import logging
import random
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

# Clinical extraction imports (optional - graceful degradation if unavailable)
try:
    from data_extraction import extract_clinical_from_cell, extract_batch, ClinicalExtraction
    from data_extraction.nlm_enrichment import enrich_extraction
    EXTRACTION_AVAILABLE = True
except ImportError:
    EXTRACTION_AVAILABLE = False

logger = logging.getLogger("workflow_engine.stage_06_analysis")

# Supported analysis types
SUPPORTED_ANALYSIS_TYPES = {
    "exploratory": "Exploratory Data Analysis",
    "statistical": "Statistical Analysis",
    "correlation": "Correlation Analysis",
    "distribution": "Distribution Analysis",
    "regression": "Regression Analysis",
    "clustering": "Clustering Analysis",
    "clinical_extraction": "Clinical Data Extraction (LLM)",
}

# Default parameters for each analysis type
DEFAULT_PARAMETERS = {
    "exploratory": {
        "include_summary": True,
        "include_missing": True,
        "include_outliers": True,
        "sample_size": 1000,
    },
    "statistical": {
        "confidence_level": 0.95,
        "hypothesis_tests": ["t_test", "chi_square"],
        "descriptive_stats": True,
    },
    "correlation": {
        "method": "pearson",
        "min_correlation": 0.3,
        "include_pvalues": True,
    },
    "distribution": {
        "fit_distributions": ["normal", "exponential", "poisson"],
        "bins": 50,
        "kde": True,
    },
    "regression": {
        "model_type": "linear",
        "cross_validation_folds": 5,
        "include_diagnostics": True,
    },
    "clustering": {
        "algorithm": "kmeans",
        "n_clusters": 5,
        "max_iterations": 100,
    },
    "clinical_extraction": {
        "extract_diagnoses": True,
        "extract_procedures": True,
        "extract_medications": True,
        "extract_labs": True,
        "enrich_with_mesh": True,
        "batch_concurrency": 5,
        "force_tier": None,  # NANO, MINI, or FRONTIER
    },
}


def generate_mock_statistics() -> Dict[str, Any]:
    """Generate mock statistical results.

    Returns:
        Dictionary of mock statistics
    """
    return {
        "row_count": random.randint(1000, 100000),
        "column_count": random.randint(10, 50),
        "missing_percentage": round(random.uniform(0, 15), 2),
        "numeric_columns": random.randint(5, 30),
        "categorical_columns": random.randint(2, 15),
        "mean_values": {
            f"column_{i}": round(random.uniform(-100, 100), 4)
            for i in range(random.randint(3, 8))
        },
        "std_values": {
            f"column_{i}": round(random.uniform(0, 50), 4)
            for i in range(random.randint(3, 8))
        },
        "min_values": {
            f"column_{i}": round(random.uniform(-500, 0), 4)
            for i in range(random.randint(3, 8))
        },
        "max_values": {
            f"column_{i}": round(random.uniform(0, 500), 4)
            for i in range(random.randint(3, 8))
        },
    }


def generate_mock_correlations() -> Dict[str, Any]:
    """Generate mock correlation results.

    Returns:
        Dictionary of mock correlations
    """
    columns = [f"column_{i}" for i in range(random.randint(5, 10))]
    correlations = []

    for i, col1 in enumerate(columns):
        for col2 in columns[i + 1:]:
            corr_value = round(random.uniform(-1, 1), 4)
            p_value = round(random.uniform(0, 0.1), 6)
            if abs(corr_value) > 0.3:
                correlations.append({
                    "column_1": col1,
                    "column_2": col2,
                    "correlation": corr_value,
                    "p_value": p_value,
                    "significant": p_value < 0.05,
                })

    return {
        "method": "pearson",
        "significant_correlations": len([c for c in correlations if c["significant"]]),
        "total_pairs_analyzed": len(columns) * (len(columns) - 1) // 2,
        "correlations": correlations[:20],  # Limit to top 20
    }


def generate_mock_distributions() -> Dict[str, Any]:
    """Generate mock distribution analysis results.

    Returns:
        Dictionary of mock distribution results
    """
    columns = [f"column_{i}" for i in range(random.randint(3, 7))]
    distributions = {}

    for col in columns:
        best_fit = random.choice(["normal", "exponential", "poisson", "gamma", "uniform"])
        distributions[col] = {
            "best_fit": best_fit,
            "fit_score": round(random.uniform(0.7, 0.99), 4),
            "skewness": round(random.uniform(-2, 2), 4),
            "kurtosis": round(random.uniform(-1, 5), 4),
            "normality_test": {
                "statistic": round(random.uniform(0, 10), 4),
                "p_value": round(random.uniform(0, 1), 6),
                "is_normal": random.choice([True, False]),
            },
        }

    return {
        "columns_analyzed": len(columns),
        "distributions": distributions,
    }


def generate_resource_usage(duration_ms: int) -> Dict[str, Any]:
    """Generate mock resource usage metrics.

    Args:
        duration_ms: Analysis duration in milliseconds

    Returns:
        Dictionary of resource usage metrics
    """
    return {
        "cpu_percent_avg": round(random.uniform(20, 80), 2),
        "cpu_percent_peak": round(random.uniform(60, 100), 2),
        "memory_mb_avg": random.randint(256, 2048),
        "memory_mb_peak": random.randint(512, 4096),
        "io_read_mb": round(random.uniform(10, 500), 2),
        "io_write_mb": round(random.uniform(1, 100), 2),
        "duration_ms": duration_ms,
        "worker_id": f"worker-{random.randint(1, 10):02d}",
    }


async def perform_clinical_extraction(
    cells: List[Dict[str, Any]],
    parameters: Dict[str, Any],
    context: StageContext,
) -> Dict[str, Any]:
    """Perform LLM-powered clinical data extraction.

    Args:
        cells: List of cells to extract from, each with 'text' and optional 'metadata'
        parameters: Extraction parameters (enrich_with_mesh, force_tier, etc.)
        context: Stage execution context

    Returns:
        Dictionary containing extraction results and statistics
    """
    if not EXTRACTION_AVAILABLE:
        logger.warning("Clinical extraction module not available, returning mock results")
        return {
            "status": "unavailable",
            "message": "data_extraction module not installed",
            "mock_results": True,
            "cell_count": len(cells),
            "extractions": [],
        }

    results = {
        "cell_count": len(cells),
        "successful": 0,
        "failed": 0,
        "extractions": [],
        "total_cost_usd": 0.0,
        "total_tokens": {"input": 0, "output": 0},
        "tier_usage": {},
    }

    force_tier = parameters.get("force_tier")
    enrich_with_mesh = parameters.get("enrich_with_mesh", True)
    batch_concurrency = parameters.get("batch_concurrency", 5)

    logger.info(
        f"Starting clinical extraction for {len(cells)} cells "
        f"(concurrency={batch_concurrency}, enrich_mesh={enrich_with_mesh})"
    )

    try:
        # Process cells in batch
        batch_input = [
            {
                "text": cell.get("text", ""),
                "metadata": {
                    **cell.get("metadata", {}),
                    "job_id": context.job_id,
                    "governance_mode": context.governance_mode,
                },
            }
            for cell in cells
            if cell.get("text", "").strip()
        ]

        if not batch_input:
            logger.warning("No valid cells to extract from")
            return results

        # Run batch extraction
        extraction_responses = await extract_batch(batch_input, concurrency=batch_concurrency)

        for i, response in enumerate(extraction_responses):
            extraction_dict = response.extraction.model_dump() if response.extraction else {}

            # Enrich with MeSH terms if enabled
            if enrich_with_mesh and extraction_dict:
                try:
                    extraction_dict = await enrich_extraction(
                        extraction_dict, 
                        request_id=response.request_id
                    )
                except Exception as e:
                    logger.warning(f"MeSH enrichment failed for cell {i}: {e}")
                    extraction_dict.setdefault("warnings", []).append(
                        f"MeSH enrichment failed: {str(e)}"
                    )

            # Track statistics
            if response.extraction and response.extraction.confidence > 0.1:
                results["successful"] += 1
            else:
                results["failed"] += 1

            results["total_cost_usd"] += response.cost_usd
            results["total_tokens"]["input"] += response.tokens.get("input", 0)
            results["total_tokens"]["output"] += response.tokens.get("output", 0)

            tier = response.tier_used
            results["tier_usage"][tier] = results["tier_usage"].get(tier, 0) + 1

            results["extractions"].append({
                "cell_index": i,
                "request_id": response.request_id,
                "extraction": extraction_dict,
                "tier_used": response.tier_used,
                "model": response.model,
                "cost_usd": response.cost_usd,
                "processing_time_ms": response.processing_time_ms,
            })

        logger.info(
            f"Clinical extraction completed: {results['successful']} successful, "
            f"{results['failed']} failed, ${results['total_cost_usd']:.4f} total cost"
        )

    except Exception as e:
        logger.error(f"Clinical extraction batch failed: {e}")
        results["error"] = str(e)

    return results

@register_stage
class AnalysisStage:
    """Stage 06: Analysis

    Performs computational analysis on datasets.
    """

    stage_id = 6
    stage_name = "Analysis"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute computational analysis.

        Args:
            context: Stage execution context

        Returns:
            StageResult with analysis outcome
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        errors: List[str] = []
        warnings: List[str] = []
        output: Dict[str, Any] = {}
        artifacts: List[str] = []

        # Extract configuration
        analysis_type = context.config.get("analysis_type", "exploratory")
        parameters = context.config.get("parameters", {})
        dataset_pointer = context.dataset_pointer

        logger.info(
            f"Starting analysis job {context.job_id}: "
            f"type={analysis_type}, dataset={dataset_pointer}"
        )

        # Validate analysis type
        if analysis_type not in SUPPORTED_ANALYSIS_TYPES:
            completed_at = datetime.utcnow().isoformat() + "Z"
            return StageResult(
                stage_id=self.stage_id,
                stage_name=self.stage_name,
                status="failed",
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=0,
                errors=[
                    f"Unsupported analysis type: '{analysis_type}'. "
                    f"Supported types: {list(SUPPORTED_ANALYSIS_TYPES.keys())}"
                ],
            )

        # Validate dataset pointer
        if not dataset_pointer:
            warnings.append(
                "No dataset_pointer provided; using mock data for analysis"
            )
            logger.warning("No dataset pointer provided, proceeding with mock analysis")

        # Merge default parameters with provided parameters
        effective_params = {**DEFAULT_PARAMETERS.get(analysis_type, {}), **parameters}
        output["effective_parameters"] = effective_params
        output["analysis_type"] = analysis_type
        output["analysis_type_name"] = SUPPORTED_ANALYSIS_TYPES[analysis_type]

        try:
            # Simulate analysis job execution with progress tracking
            logger.info(f"Executing {SUPPORTED_ANALYSIS_TYPES[analysis_type]}...")

            # Simulate progress updates (in a real implementation, these would
            # be reported to a progress tracking system)
            progress_steps = [
                ("Loading dataset", 0.1),
                ("Preprocessing data", 0.2),
                ("Running analysis algorithms", 0.5),
                ("Generating results", 0.15),
                ("Finalizing output", 0.05),
            ]

            total_simulated_time = random.uniform(0.5, 2.0)  # 0.5-2 seconds simulation

            for step_name, step_weight in progress_steps:
                step_duration = total_simulated_time * step_weight
                logger.debug(f"Analysis step: {step_name}")
                await asyncio.sleep(step_duration)

            # Generate mock analysis results based on analysis type
            analysis_results: Dict[str, Any] = {}

            if analysis_type == "exploratory":
                analysis_results["statistics"] = generate_mock_statistics()
                analysis_results["correlations"] = generate_mock_correlations()
                analysis_results["distributions"] = generate_mock_distributions()

            elif analysis_type == "statistical":
                analysis_results["statistics"] = generate_mock_statistics()
                analysis_results["hypothesis_tests"] = {
                    "t_test": {
                        "statistic": round(random.uniform(-3, 3), 4),
                        "p_value": round(random.uniform(0, 0.2), 6),
                        "significant": random.choice([True, False]),
                    },
                    "chi_square": {
                        "statistic": round(random.uniform(0, 20), 4),
                        "p_value": round(random.uniform(0, 0.2), 6),
                        "degrees_of_freedom": random.randint(1, 10),
                    },
                }

            elif analysis_type == "correlation":
                analysis_results["correlations"] = generate_mock_correlations()

            elif analysis_type == "distribution":
                analysis_results["distributions"] = generate_mock_distributions()

            elif analysis_type == "regression":
                analysis_results["regression"] = {
                    "model_type": effective_params.get("model_type", "linear"),
                    "r_squared": round(random.uniform(0.5, 0.95), 4),
                    "adjusted_r_squared": round(random.uniform(0.45, 0.93), 4),
                    "rmse": round(random.uniform(0.1, 10), 4),
                    "mae": round(random.uniform(0.1, 8), 4),
                    "coefficients": {
                        f"feature_{i}": round(random.uniform(-5, 5), 4)
                        for i in range(random.randint(3, 8))
                    },
                    "cross_validation_scores": [
                        round(random.uniform(0.6, 0.9), 4)
                        for _ in range(effective_params.get("cross_validation_folds", 5))
                    ],
                }

            elif analysis_type == "clustering":
                n_clusters = effective_params.get("n_clusters", 5)
                analysis_results["clustering"] = {
                    "algorithm": effective_params.get("algorithm", "kmeans"),
                    "n_clusters": n_clusters,
                    "silhouette_score": round(random.uniform(0.3, 0.8), 4),
                    "inertia": round(random.uniform(100, 10000), 2),
                    "cluster_sizes": [
                        random.randint(100, 1000) for _ in range(n_clusters)
                    ],
                    "cluster_centers": {
                        f"cluster_{i}": [
                            round(random.uniform(-10, 10), 4)
                            for _ in range(random.randint(3, 6))
                        ]
                        for i in range(n_clusters)
                    },
                }

            elif analysis_type == "clinical_extraction":
                # Get clinical text cells from config or previous stage results
                cells = context.config.get("cells", [])
                
                # If no cells provided, check for data from previous stages
                if not cells and context.previous_results:
                    # Try to get data from Stage 5 (PHI) or Stage 4 (Validate)
                    for stage_id in [5, 4, 1]:
                        prev_result = context.previous_results.get(stage_id)
                        if prev_result and prev_result.output:
                            # Look for uploaded data or processed cells
                            cells = prev_result.output.get("cells", [])
                            if cells:
                                logger.info(f"Using {len(cells)} cells from stage {stage_id}")
                                break
                
                if not cells:
                    warnings.append(
                        "No cells provided for clinical extraction; "
                        "provide 'cells' in config or ensure previous stages output data"
                    )
                    analysis_results["clinical_extraction"] = {
                        "status": "no_input",
                        "message": "No cells available for extraction",
                    }
                else:
                    # Perform LLM-powered clinical extraction
                    extraction_results = await perform_clinical_extraction(
                        cells=cells,
                        parameters=effective_params,
                        context=context,
                    )
                    analysis_results["clinical_extraction"] = extraction_results
                    
                    # Add extraction-specific metadata
                    if extraction_results.get("total_cost_usd"):
                        output["ai_cost_usd"] = extraction_results["total_cost_usd"]
                    if extraction_results.get("tier_usage"):
                        output["ai_tier_usage"] = extraction_results["tier_usage"]

            output["analysis_results"] = analysis_results

            # Generate job metadata
            job_metadata = {
                "job_id": context.job_id,
                "analysis_type": analysis_type,
                "started_at": started_at,
                "dataset_pointer": dataset_pointer,
                "governance_mode": context.governance_mode,
                "parameters_used": effective_params,
            }
            output["job_metadata"] = job_metadata

            # Simulate artifact generation
            artifact_base = f"{context.artifact_path}/{context.job_id}"
            artifacts = [
                f"{artifact_base}/analysis_results.json",
                f"{artifact_base}/analysis_summary.txt",
            ]

            if analysis_type in ["exploratory", "correlation"]:
                artifacts.append(f"{artifact_base}/correlation_matrix.png")

            if analysis_type in ["exploratory", "distribution"]:
                artifacts.append(f"{artifact_base}/distribution_plots.png")

            if analysis_type == "regression":
                artifacts.append(f"{artifact_base}/regression_diagnostics.png")

            if analysis_type == "clustering":
                artifacts.append(f"{artifact_base}/cluster_visualization.png")

            if analysis_type == "clinical_extraction":
                artifacts.append(f"{artifact_base}/extractions.json")
                artifacts.append(f"{artifact_base}/extraction_summary.csv")
                if effective_params.get("enrich_with_mesh"):
                    artifacts.append(f"{artifact_base}/mesh_mappings.json")

            logger.info(f"Analysis completed, generated {len(artifacts)} artifacts")

        except asyncio.CancelledError:
            logger.warning(f"Analysis job {context.job_id} was cancelled")
            completed_at = datetime.utcnow().isoformat() + "Z"
            started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

            return StageResult(
                stage_id=self.stage_id,
                stage_name=self.stage_name,
                status="failed",
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                errors=["Analysis job was cancelled"],
                metadata={"cancelled": True},
            )

        except Exception as e:
            logger.error(f"Analysis failed for job {context.job_id}: {str(e)}")
            errors.append(f"Analysis execution failed: {str(e)}")

        # Calculate duration
        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        # Generate resource usage metrics
        resource_usage = generate_resource_usage(duration_ms)
        output["resource_usage"] = resource_usage

        status = "failed" if errors else "completed"

        logger.info(
            f"Analysis stage {status} for job {context.job_id} "
            f"in {duration_ms}ms"
        )

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=output,
            artifacts=artifacts,
            errors=errors,
            warnings=warnings,
            metadata={
                "governance_mode": context.governance_mode,
                "analysis_type": analysis_type,
            },
        )

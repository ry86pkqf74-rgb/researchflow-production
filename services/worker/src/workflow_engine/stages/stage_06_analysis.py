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
    from data_extraction.cell_parser import (
        parse_block_text,
        detect_narrative_columns,
        identify_extraction_targets,
        PHIScanner,
        BatchExtractionManifest,
    )
    EXTRACTION_AVAILABLE = True
    CELL_PARSER_AVAILABLE = True
except ImportError as e:
    EXTRACTION_AVAILABLE = False
    CELL_PARSER_AVAILABLE = False

# Pandas for DataFrame operations
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

# Import AnalysisService for REAL statistical analysis
try:
    from analysis_service import (
        AnalysisService,
        AnalysisRequest,
        AnalysisType,
        TestType,
        RegressionType,
        CorrectionMethod,
    )
    ANALYSIS_SERVICE_AVAILABLE = True
except ImportError:
    ANALYSIS_SERVICE_AVAILABLE = False

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
    "dataframe_extraction": "DataFrame Clinical Extraction with PHI Scanning",
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
    "dataframe_extraction": {
        "columns": None,  # Auto-detect narrative columns if None
        "min_text_length": 100,  # Minimum chars to trigger extraction
        "enable_phi_scanning": True,  # Pre/post PHI scanning
        "block_on_phi": True,  # Block extraction when PHI detected
        "enable_nlm_enrichment": True,  # MeSH term enrichment
        "force_tier": None,  # NANO, MINI, or FRONTIER
        "max_concurrent": 5,  # Concurrent API calls
        "output_format": "parquet",  # Output file format
    },
}


async def perform_real_statistical_analysis(
    df: "pd.DataFrame",
    analysis_type: str,
    parameters: Dict[str, Any],
) -> Dict[str, Any]:
    """Perform REAL statistical analysis using AnalysisService.

    This function uses scipy, statsmodels, and lifelines to compute
    actual statistics instead of mock/random data.

    Args:
        df: pandas DataFrame to analyze
        analysis_type: Type of analysis to perform
        parameters: Analysis parameters

    Returns:
        Dictionary of real statistical results
    """
    if not ANALYSIS_SERVICE_AVAILABLE:
        logger.warning("AnalysisService not available, falling back to mock data")
        return None

    if not PANDAS_AVAILABLE:
        logger.warning("Pandas not available, falling back to mock data")
        return None

    try:
        service = AnalysisService()
        results = {}

        if analysis_type in ["exploratory", "statistical"]:
            # Run descriptive analysis
            numeric_cols = list(df.select_dtypes(include=['number']).columns[:10])
            if numeric_cols:
                request = AnalysisRequest(
                    analysis_type=AnalysisType.DESCRIPTIVE,
                    variables=numeric_cols,
                )
                response = service.analyze(df, request)

                if response.descriptive:
                    results["statistics"] = {
                        "row_count": len(df),
                        "column_count": len(df.columns),
                        "numeric_columns": len(df.select_dtypes(include=['number']).columns),
                        "categorical_columns": len(df.select_dtypes(include=['object', 'category']).columns),
                        "missing_percentage": round(df.isnull().sum().sum() / (len(df) * len(df.columns)) * 100, 2),
                        "descriptive_stats": [
                            {
                                "variable": d.variable,
                                "n": d.n,
                                "n_missing": d.n_missing,
                                "mean": d.mean,
                                "std": d.std,
                                "median": d.median,
                                "min": d.min,
                                "max": d.max,
                                "q1": d.q1,
                                "q3": d.q3,
                                "skewness": d.skewness,
                                "kurtosis": d.kurtosis,
                                "normality_p": d.normality_p,
                            } for d in response.descriptive
                        ],
                    }

        if analysis_type in ["exploratory", "correlation"]:
            # Run correlation analysis
            numeric_cols = list(df.select_dtypes(include=['number']).columns[:10])
            if len(numeric_cols) >= 2:
                request = AnalysisRequest(
                    analysis_type=AnalysisType.CORRELATION,
                    variables=numeric_cols,
                )
                response = service.analyze(df, request)

                if response.correlation_matrix is not None:
                    # Convert correlation matrix to list of significant correlations
                    corr_matrix = response.correlation_matrix
                    p_matrix = response.p_value_matrix
                    correlations = []

                    for i, col1 in enumerate(corr_matrix.columns):
                        for j, col2 in enumerate(corr_matrix.columns):
                            if i < j:  # Upper triangle only
                                corr_val = corr_matrix.iloc[i, j]
                                p_val = p_matrix.iloc[i, j] if p_matrix is not None else None
                                if abs(corr_val) > 0.3:  # Only significant correlations
                                    correlations.append({
                                        "column_1": col1,
                                        "column_2": col2,
                                        "correlation": round(float(corr_val), 4),
                                        "p_value": round(float(p_val), 6) if p_val is not None else None,
                                        "significant": p_val < 0.05 if p_val is not None else None,
                                    })

                    results["correlations"] = {
                        "method": "pearson",
                        "significant_correlations": len([c for c in correlations if c.get("significant")]),
                        "total_pairs_analyzed": len(corr_matrix.columns) * (len(corr_matrix.columns) - 1) // 2,
                        "correlations": sorted(correlations, key=lambda x: abs(x["correlation"]), reverse=True)[:20],
                    }

        if analysis_type in ["exploratory", "distribution"]:
            # Run distribution analysis using descriptive stats
            numeric_cols = list(df.select_dtypes(include=['number']).columns[:7])
            if numeric_cols:
                request = AnalysisRequest(
                    analysis_type=AnalysisType.DESCRIPTIVE,
                    variables=numeric_cols,
                )
                response = service.analyze(df, request)

                if response.descriptive:
                    distributions = {}
                    for d in response.descriptive:
                        # Determine best fit based on skewness/kurtosis
                        skew = d.skewness or 0
                        kurt = d.kurtosis or 0
                        if abs(skew) < 0.5 and abs(kurt - 3) < 1:
                            best_fit = "normal"
                        elif skew > 1:
                            best_fit = "exponential"
                        elif d.min and d.min >= 0 and isinstance(d.mean, (int, float)) and d.mean < 10:
                            best_fit = "poisson"
                        else:
                            best_fit = "gamma"

                        distributions[d.variable] = {
                            "best_fit": best_fit,
                            "fit_score": round(0.95 - abs(skew) * 0.1, 4) if skew else 0.9,
                            "skewness": round(skew, 4) if skew else None,
                            "kurtosis": round(kurt, 4) if kurt else None,
                            "normality_test": {
                                "p_value": round(d.normality_p, 6) if d.normality_p else None,
                                "is_normal": d.normality_p > 0.05 if d.normality_p else None,
                            },
                        }

                    results["distributions"] = {
                        "columns_analyzed": len(distributions),
                        "distributions": distributions,
                    }

        if analysis_type == "regression":
            # Run regression analysis
            numeric_cols = list(df.select_dtypes(include=['number']).columns)
            if len(numeric_cols) >= 2:
                outcome_var = parameters.get("outcome_variable") or numeric_cols[0]
                covariates = parameters.get("covariates") or numeric_cols[1:5]
                reg_type = parameters.get("model_type", "linear")

                reg_type_map = {
                    "linear": RegressionType.LINEAR,
                    "logistic": RegressionType.LOGISTIC,
                    "poisson": RegressionType.POISSON,
                }

                request = AnalysisRequest(
                    analysis_type=AnalysisType.REGRESSION,
                    outcome_variable=outcome_var,
                    covariates=list(covariates),
                    regression_type=reg_type_map.get(reg_type, RegressionType.LINEAR),
                )
                response = service.analyze(df, request)

                if response.regression:
                    reg = response.regression[0]
                    results["regression"] = {
                        "model_type": reg.model_type,
                        "dependent_variable": reg.dependent_variable,
                        "r_squared": reg.r_squared,
                        "adjusted_r_squared": reg.adj_r_squared,
                        "f_statistic": reg.f_statistic,
                        "f_pvalue": reg.f_pvalue,
                        "aic": reg.aic,
                        "bic": reg.bic,
                        "coefficients": reg.coefficients,
                        "n_observations": reg.n_observations,
                        "residual_std": reg.residual_std,
                    }

        if analysis_type == "statistical":
            # Run inferential tests
            group_var = parameters.get("group_variable")
            outcome_var = parameters.get("outcome_variable")

            if group_var and outcome_var and group_var in df.columns and outcome_var in df.columns:
                request = AnalysisRequest(
                    analysis_type=AnalysisType.INFERENTIAL,
                    group_variable=group_var,
                    outcome_variable=outcome_var,
                    variables=[outcome_var],
                )
                response = service.analyze(df, request)

                if response.inferential:
                    results["hypothesis_tests"] = {}
                    for inf in response.inferential:
                        results["hypothesis_tests"][inf.test_name.lower().replace(" ", "_")] = {
                            "statistic": inf.statistic,
                            "statistic_name": inf.statistic_name,
                            "p_value": inf.p_value,
                            "effect_size": inf.effect_size,
                            "effect_size_name": inf.effect_size_name,
                            "ci_lower": inf.ci_lower,
                            "ci_upper": inf.ci_upper,
                            "significant": inf.significant,
                            "interpretation": inf.interpretation,
                        }

        logger.info(f"Real statistical analysis completed: {list(results.keys())}")
        return results if results else None

    except Exception as e:
        logger.error(f"Real statistical analysis failed: {e}")
        return None


def generate_mock_statistics() -> Dict[str, Any]:
    """Generate mock statistical results (FALLBACK when real analysis unavailable).

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


async def perform_dataframe_extraction(
    file_path: str,
    parameters: Dict[str, Any],
    context: StageContext,
) -> Dict[str, Any]:
    """Perform LLM-powered clinical data extraction on a DataFrame with PHI scanning.
    
    This function uses the cell_parser module for comprehensive extraction:
    - Automatic detection of narrative text columns
    - PHI pre-scanning before sending to AI
    - PHI post-scanning of extraction results
    - Optional MeSH enrichment
    - Batch processing with concurrency control
    
    Args:
        file_path: Path to data file (CSV, Parquet, Excel)
        parameters: Extraction parameters including:
            - columns: Optional list of columns to extract (auto-detect if None)
            - min_text_length: Minimum text length to trigger extraction
            - enable_phi_scanning: Enable PHI pre/post scanning
            - block_on_phi: Block extraction when PHI detected in input
            - enable_nlm_enrichment: Enable MeSH term enrichment
            - force_tier: Force specific model tier (NANO, MINI, FRONTIER)
            - max_concurrent: Maximum concurrent API calls
        context: Stage execution context
        
    Returns:
        Dictionary containing extraction results, manifest, and statistics
    """
    if not CELL_PARSER_AVAILABLE:
        logger.warning("Cell parser module not available, falling back to basic extraction")
        return {
            "status": "unavailable",
            "message": "cell_parser module not available",
            "fallback_used": True,
        }
    
    if not PANDAS_AVAILABLE:
        logger.warning("Pandas not available for DataFrame extraction")
        return {
            "status": "unavailable",
            "message": "pandas not installed",
        }
    
    results = {
        "file_path": file_path,
        "status": "pending",
        "columns_detected": [],
        "columns_processed": [],
        "total_cells": 0,
        "successful": 0,
        "failed": 0,
        "phi_blocked": 0,
        "total_cost_usd": 0.0,
        "total_tokens": {"input": 0, "output": 0},
        "manifest": None,
        "extraction_meta": {},
    }
    
    # Load DataFrame based on file type
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file_path.endswith('.parquet'):
            df = pd.read_parquet(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        elif file_path.endswith('.tsv'):
            df = pd.read_csv(file_path, sep='\t')
        else:
            # Try CSV as default
            df = pd.read_csv(file_path)
        
        results["row_count"] = len(df)
        results["column_count"] = len(df.columns)
        logger.info(f"Loaded DataFrame: {len(df)} rows, {len(df.columns)} columns")
        
    except Exception as e:
        logger.error(f"Failed to load file {file_path}: {e}")
        results["status"] = "failed"
        results["error"] = f"Failed to load file: {str(e)}"
        return results
    
    # Get parameters with defaults
    columns = parameters.get("columns")  # None = auto-detect
    min_text_length = parameters.get("min_text_length", 100)
    enable_phi_scanning = parameters.get("enable_phi_scanning", True)
    block_on_phi = parameters.get("block_on_phi", True)
    enable_nlm_enrichment = parameters.get("enable_nlm_enrichment", True)
    force_tier = parameters.get("force_tier")
    max_concurrent = parameters.get("max_concurrent", 5)
    
    # Auto-detect narrative columns if not specified
    if columns is None:
        columns = detect_narrative_columns(df, min_text_length=min_text_length)
        results["columns_detected"] = columns
        logger.info(f"Auto-detected narrative columns: {columns}")
    else:
        results["columns_detected"] = columns
    
    if not columns:
        logger.warning("No narrative columns found for extraction")
        results["status"] = "completed"
        results["message"] = "No narrative columns detected"
        return results
    
    # Governance check
    if context.governance_mode == "DEMO":
        logger.info("DEMO mode: Extraction will proceed with synthetic data flag")
        extraction_metadata = {"synthetic_data_only": True, "demo_mode": True}
    else:
        extraction_metadata = {"governance_mode": context.governance_mode}
    
    extraction_metadata.update({
        "job_id": context.job_id,
        "file_path": file_path,
    })
    
    # Perform extraction with PHI scanning
    try:
        df_result, manifest = await parse_block_text(
            df=df,
            columns=columns,
            min_text_length=min_text_length,
            max_concurrent=max_concurrent,
            enable_phi_scanning=enable_phi_scanning,
            block_on_phi=block_on_phi,
            enable_nlm_enrichment=enable_nlm_enrichment,
            force_tier=force_tier,
            metadata=extraction_metadata,
        )
        
        # Update results from manifest
        results["status"] = "completed"
        results["total_cells"] = manifest.total_cells
        results["successful"] = manifest.successful
        results["failed"] = manifest.failed
        results["phi_blocked"] = manifest.phi_blocked
        results["total_cost_usd"] = manifest.total_cost_usd
        results["total_tokens"] = manifest.total_tokens
        results["columns_processed"] = manifest.columns_processed
        results["manifest"] = manifest.to_dict()
        results["extraction_meta"] = manifest.config
        
        # Add extracted columns info
        extracted_columns = [col for col in df_result.columns if col.endswith("_extracted")]
        results["extracted_columns"] = extracted_columns
        
        logger.info(
            f"DataFrame extraction completed: {manifest.successful} successful, "
            f"{manifest.failed} failed, {manifest.phi_blocked} PHI-blocked, "
            f"${manifest.total_cost_usd:.4f} total cost"
        )
        
    except Exception as e:
        logger.error(f"DataFrame extraction failed: {e}")
        results["status"] = "failed"
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

            # Generate analysis results - use REAL analysis when data available
            analysis_results: Dict[str, Any] = {}
            used_real_analysis = False

            # Try to load actual data for real analysis
            df = None
            if dataset_pointer and PANDAS_AVAILABLE and ANALYSIS_SERVICE_AVAILABLE:
                try:
                    if dataset_pointer.endswith('.csv'):
                        df = pd.read_csv(dataset_pointer)
                    elif dataset_pointer.endswith('.parquet'):
                        df = pd.read_parquet(dataset_pointer)
                    elif dataset_pointer.endswith(('.xlsx', '.xls')):
                        df = pd.read_excel(dataset_pointer)
                    elif dataset_pointer.endswith('.tsv'):
                        df = pd.read_csv(dataset_pointer, sep='\t')
                    logger.info(f"Loaded dataset for real analysis: {len(df)} rows, {len(df.columns)} cols")
                except Exception as e:
                    logger.warning(f"Could not load dataset for real analysis: {e}")
                    df = None

            # Perform REAL statistical analysis if data is available
            if df is not None and analysis_type in ["exploratory", "statistical", "correlation", "distribution", "regression"]:
                real_results = await perform_real_statistical_analysis(df, analysis_type, effective_params)
                if real_results:
                    analysis_results.update(real_results)
                    used_real_analysis = True
                    output["real_analysis"] = True
                    logger.info(f"Used REAL statistical analysis for {analysis_type}")

            # Fallback to mock data if real analysis not available or failed
            if not used_real_analysis:
                output["real_analysis"] = False
                output["mock_data_reason"] = "Dataset not available or analysis service unavailable"

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

            if analysis_type == "clustering":
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

            elif analysis_type == "dataframe_extraction":
                # DataFrame-level clinical extraction with PHI scanning
                if not dataset_pointer:
                    warnings.append(
                        "No dataset_pointer provided for DataFrame extraction; "
                        "provide a valid file path to CSV, Parquet, or Excel file"
                    )
                    analysis_results["dataframe_extraction"] = {
                        "status": "no_input",
                        "message": "No dataset file path provided",
                    }
                else:
                    # Perform DataFrame-level extraction with PHI scanning
                    extraction_results = await perform_dataframe_extraction(
                        file_path=dataset_pointer,
                        parameters=effective_params,
                        context=context,
                    )
                    analysis_results["dataframe_extraction"] = extraction_results
                    
                    # Add extraction-specific metadata
                    if extraction_results.get("total_cost_usd"):
                        output["ai_cost_usd"] = extraction_results["total_cost_usd"]
                    if extraction_results.get("total_tokens"):
                        output["ai_tokens"] = extraction_results["total_tokens"]
                    if extraction_results.get("phi_blocked"):
                        output["phi_blocked_count"] = extraction_results["phi_blocked"]
                    if extraction_results.get("manifest"):
                        output["extraction_manifest"] = extraction_results["manifest"]

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

            if analysis_type == "dataframe_extraction":
                output_format = effective_params.get("output_format", "parquet")
                artifacts.append(f"{artifact_base}/extracted_data.{output_format}")
                artifacts.append(f"{artifact_base}/extraction_manifest.json")
                artifacts.append(f"{artifact_base}/phi_scan_report.json")
                if effective_params.get("enable_nlm_enrichment"):
                    artifacts.append(f"{artifact_base}/mesh_enrichment.json")

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

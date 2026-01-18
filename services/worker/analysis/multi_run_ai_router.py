#!/usr/bin/env python3
"""
Multi-Run AI Router Workflow

Executes the AI router demo workflow multiple times to:
1. Aggregate statistics across multiple runs
2. Test consistency of routing decisions
3. Generate comprehensive audit trails for oversight
4. Validate reproducibility of governance patterns

This script runs the same tasks N times (default: 5) and produces:
- Aggregated statistics (avg response length, task distribution)
- Combined audit log with all runs
- Summary report with consistency metrics

Supports multiple datasets:
- Heart disease sample (default): data/sample/heart_disease_sample.csv
- Thyroid dataset (restricted): data/restricted/thyroid_pilot/thyroid_dataset.csv
  Set environment variable DATASET_TYPE=thyroid to use thyroid data

All operations remain fully offline with no external API calls.
"""

import sys
import os
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
from collections import defaultdict

# Add project root to path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pandas as pd
from schemas.pandera.heart_disease_schema import HeartDiseaseSchema
from schemas.pandera.thyroid_schema import ThyroidDataSchema
from src.ai_router.stub import AIModelRouter


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{'=' * 80}")
    print(f"  {title}")
    print(f"{'=' * 80}\n")


def load_and_validate_sample_data() -> pd.DataFrame:
    """Load and validate dataset based on DATASET_TYPE environment variable."""
    dataset_type = os.environ.get("DATASET_TYPE", "heart_disease")

    if dataset_type == "thyroid":
        # Load restricted thyroid dataset (never committed to Git)
        sample_path = (
            project_root
            / "data"
            / "restricted"
            / "thyroid_pilot"
            / "thyroid_dataset.csv"
        )
        if not sample_path.exists():
            raise FileNotFoundError(
                f"Thyroid dataset not found: {sample_path}\n"
                "Place dataset manually before running thyroid workflow."
            )
        df = pd.read_csv(sample_path)
        validated_df = ThyroidDataSchema.validate(df)
        print(f"✓ Loaded thyroid dataset: {len(validated_df)} rows")
        return validated_df
    else:
        # Load heart disease sample (committed, safe for Git)
        sample_path = project_root / "data" / "sample" / "heart_disease_sample.csv"
        df = pd.read_csv(sample_path)
        validated_df = HeartDiseaseSchema.validate(df)
        print(f"✓ Loaded heart disease sample: {len(validated_df)} rows")
        return validated_df


def get_task_definitions(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Define task set based on dataset type."""
    dataset_type = os.environ.get("DATASET_TYPE", "heart_disease")

    if dataset_type == "thyroid":
        # Thyroid-specific tasks
        return [
            {
                "task": "summarize",
                "context": {
                    "description": "Summarize thyroid function panel characteristics",
                    "num_records": len(df),
                    "age_range": f"{df['age'].min()}-{df['age'].max()}",
                    "target_distribution": df["target_class"].value_counts().to_dict(),
                },
            },
            {
                "task": "analyze",
                "context": {
                    "description": "Identify correlations in thyroid hormone panel",
                    "variables": ["age", "TSH", "T3", "TT4", "FTI", "target_class"],
                    "num_records": len(df),
                },
            },
            {
                "task": "literature_screen",
                "context": {
                    "description": "Generate screening criteria for thyroid disease studies",
                    "focus": "thyroid function panel classification models",
                    "population": "adult cohort with thyroid dysfunction",
                },
            },
            {
                "task": "code_review",
                "context": {
                    "description": "Review a simple analysis snippet",
                    "code": "hyperthyroid = df[df['target_class'] == 'hyperthyroid'].groupby('age').size()",
                    "language": "python",
                },
            },
            {
                "task": "summarize",
                "context": {
                    "description": "Summarize thyroid hormone measurements across cohort",
                    "measurements": ["TSH", "T3", "TT4", "FTI"],
                    "stats": {
                        "TSH_mean": (
                            float(df["TSH"].mean()) if "TSH" in df.columns else None
                        ),
                        "T3_mean": (
                            float(df["T3"].mean()) if "T3" in df.columns else None
                        ),
                        "TT4_mean": (
                            float(df["TT4"].mean()) if "TT4" in df.columns else None
                        ),
                    },
                },
            },
        ]
    else:
        # Heart disease tasks (original)
        return [
            {
                "task": "summarize",
                "context": {
                    "description": "Summarize cohort characteristics and key risk factors",
                    "num_records": len(df),
                    "age_range": f"{df['age'].min()}-{df['age'].max()}",
                    "target_distribution": df["target"].value_counts().to_dict(),
                },
            },
            {
                "task": "analyze",
                "context": {
                    "description": "Identify potential correlations in cardiovascular risk factors",
                    "variables": ["age", "chol", "trestbps", "thalach", "target"],
                    "num_records": len(df),
                },
            },
            {
                "task": "literature_screen",
                "context": {
                    "description": "Generate screening criteria for heart disease prediction studies",
                    "focus": "machine learning models for cardiovascular risk assessment",
                    "population": "adult cohort with chest pain symptoms",
                },
            },
            {
                "task": "code_review",
                "context": {
                    "description": "Review a simple analysis snippet",
                    "code": "high_risk = df[df['target'] == 1].groupby('age').size()",
                    "language": "python",
                },
            },
            {
                "task": "summarize",
                "context": {
                    "description": "Summarize clinical measurements across the cohort",
                    "measurements": ["trestbps", "chol", "thalach"],
                    "stats": {
                        "trestbps_mean": float(df["trestbps"].mean()),
                        "chol_mean": float(df["chol"].mean()),
                        "thalach_mean": float(df["thalach"].mean()),
                    },
                },
            },
        ]


def execute_single_run(
    run_id: int, df: pd.DataFrame, tasks: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Execute one complete workflow run and collect statistics."""
    router = AIModelRouter()

    run_results = {
        "run_id": run_id,
        "timestamp": datetime.now().isoformat(),
        "tasks_executed": 0,
        "tasks_by_type": defaultdict(int),
        "models_used": defaultdict(int),
        "response_lengths": [],
        "phi_pii_detections": 0,
        "audit_entries": [],
    }

    for task_def in tasks:
        task_type = task_def["task"]
        context = task_def["context"]

        # Route task through AI router
        result = router.route(task_type, context)

        # Collect statistics
        run_results["tasks_executed"] += 1
        run_results["tasks_by_type"][task_type] += 1
        run_results["models_used"][result["model"]] += 1
        run_results["response_lengths"].append(len(result["response"]))

        # Store audit entry
        run_results["audit_entries"].append(
            {
                "run_id": run_id,
                "task_type": task_type,
                "backend": result["model"],
                "timestamp": result["timestamp"],
                "response_length": len(result["response"]),
                "context_keys": list(context.keys()),
            }
        )

    return run_results


def aggregate_multi_run_statistics(all_runs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate statistics across all runs."""
    total_tasks = sum(run["tasks_executed"] for run in all_runs)

    # Aggregate task counts
    all_tasks_by_type = defaultdict(int)
    for run in all_runs:
        for task_type, count in run["tasks_by_type"].items():
            all_tasks_by_type[task_type] += count

    # Aggregate model usage
    all_models_used = defaultdict(int)
    for run in all_runs:
        for model, count in run["models_used"].items():
            all_models_used[model] += count

    # Aggregate response lengths
    all_response_lengths = []
    for run in all_runs:
        all_response_lengths.extend(run["response_lengths"])

    # Calculate statistics
    avg_response_length = sum(all_response_lengths) / len(all_response_lengths)
    min_response_length = min(all_response_lengths)
    max_response_length = max(all_response_lengths)

    return {
        "summary": {
            "total_runs": len(all_runs),
            "total_tasks": total_tasks,
            "tasks_per_run": total_tasks / len(all_runs),
        },
        "task_distribution": dict(all_tasks_by_type),
        "model_distribution": dict(all_models_used),
        "response_statistics": {
            "avg_length": avg_response_length,
            "min_length": min_response_length,
            "max_length": max_response_length,
        },
        "consistency_metrics": {
            "task_type_variance": calculate_variance(
                [run["tasks_by_type"] for run in all_runs]
            ),
            "model_usage_consistent": check_model_consistency(all_runs),
        },
    }


def calculate_variance(distributions: List[Dict]) -> str:
    """Calculate variance in task distributions across runs."""
    # Simple consistency check: all runs should have same task distribution
    if not distributions:
        return "N/A"

    first_dist = distributions[0]
    all_same = all(d == first_dist for d in distributions)

    return "consistent" if all_same else "variable"


def check_model_consistency(all_runs: List[Dict[str, Any]]) -> bool:
    """Check if model selection is consistent across runs."""
    # Since our router is deterministic (stub), it should be consistent
    first_models = all_runs[0]["models_used"]
    return all(run["models_used"] == first_models for run in all_runs)


def export_multi_run_summary(
    all_runs: List[Dict[str, Any]], aggregated_stats: Dict[str, Any], output_path: Path
):
    """Export combined audit log and summary report."""
    # Collect all audit entries
    all_audit_entries = []
    for run in all_runs:
        all_audit_entries.extend(run["audit_entries"])

    # Build comprehensive report
    report = {
        "metadata": {
            "report_type": "multi_run_ai_router_summary",
            "generated_at": datetime.now().isoformat(),
            "project": "Research Operating System Template",
            "workflow": "Multi-Run AI Router Demo",
        },
        "aggregated_statistics": aggregated_stats,
        "individual_runs": [
            {
                "run_id": run["run_id"],
                "timestamp": run["timestamp"],
                "tasks_executed": run["tasks_executed"],
                "avg_response_length": sum(run["response_lengths"])
                / len(run["response_lengths"]),
            }
            for run in all_runs
        ],
        "complete_audit_log": all_audit_entries,
    }

    # Export to JSON
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"✓ Multi-run summary exported to: {output_path}")


def main():
    """Execute multi-run AI router workflow."""
    print_section("RESEARCH OPERATING SYSTEM - MULTI-RUN AI ROUTER DEMO")

    print("⚠️  OFFLINE DEMO MODE")
    print("All AI responses are mocks. No external API calls or network requests.")
    print(
        "This demonstrates governance patterns, routing consistency, and reproducibility.\n"
    )

    # Configuration
    num_runs = 5  # Default: 5 runs
    if len(sys.argv) > 1:
        try:
            num_runs = int(sys.argv[1])
        except ValueError:
            print(f"⚠️  Invalid number of runs: {sys.argv[1]}. Using default: 5")

    print(f"Configured to execute {num_runs} workflow runs\n")

    # Load and validate sample data once
    print_section("DATA VALIDATION")
    df = load_and_validate_sample_data()
    print(f"✓ Loaded and validated {len(df)} rows from heart disease sample")

    # Get task definitions
    tasks = get_task_definitions(df)
    print(f"✓ Prepared {len(tasks)} tasks for routing")

    # Execute multiple runs
    print_section(f"EXECUTING {num_runs} WORKFLOW RUNS")
    all_runs = []

    for run_id in range(1, num_runs + 1):
        print(f"[Run {run_id}/{num_runs}] Executing workflow...")
        run_results = execute_single_run(run_id, df, tasks)
        all_runs.append(run_results)
        print(f"  ✓ Completed {run_results['tasks_executed']} tasks")

    # Aggregate statistics
    print_section("AGGREGATED STATISTICS")
    aggregated_stats = aggregate_multi_run_statistics(all_runs)

    print(f"Total runs: {aggregated_stats['summary']['total_runs']}")
    print(f"Total tasks: {aggregated_stats['summary']['total_tasks']}")
    print(f"Tasks per run: {aggregated_stats['summary']['tasks_per_run']:.1f}")

    print(f"\nTask distribution:")
    for task_type, count in aggregated_stats["task_distribution"].items():
        print(f"  {task_type}: {count}")

    print(f"\nModel distribution:")
    for model, count in aggregated_stats["model_distribution"].items():
        print(f"  {model}: {count}")

    print(f"\nResponse statistics:")
    print(
        f"  Avg length: {aggregated_stats['response_statistics']['avg_length']:.1f} chars"
    )
    print(
        f"  Min length: {aggregated_stats['response_statistics']['min_length']} chars"
    )
    print(
        f"  Max length: {aggregated_stats['response_statistics']['max_length']} chars"
    )

    print(f"\nConsistency metrics:")
    print(
        f"  Task type variance: {aggregated_stats['consistency_metrics']['task_type_variance']}"
    )
    print(
        f"  Model usage consistent: {aggregated_stats['consistency_metrics']['model_usage_consistent']}"
    )

    # Export comprehensive report
    print_section("EXPORT MULTI-RUN SUMMARY")

    # Use dataset-specific output filename
    dataset_type = os.environ.get("DATASET_TYPE", "heart_disease")
    if dataset_type == "thyroid":
        output_filename = "multi_run_summary_thyroid.json"
    else:
        output_filename = "multi_run_summary.json"

    output_path = project_root / "reports" / "run_manifests" / output_filename
    output_path.parent.mkdir(parents=True, exist_ok=True)
    export_multi_run_summary(all_runs, aggregated_stats, output_path)

    print_section("✅ MULTI-RUN DEMO COMPLETE")
    print(
        f"Executed {num_runs} runs with {aggregated_stats['summary']['total_tasks']} total tasks."
    )
    print("All operations completed with governance compliance.")
    print("Comprehensive audit trail and statistics exported for oversight review.")


if __name__ == "__main__":
    main()

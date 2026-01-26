"""
Evaluation Harness

Runs prompt evaluations against gold-standard datasets.
Based on integrations_4.pdf specification.

Usage:
    python -m evals.run_evals                    # Run with active prompt
    python -m evals.run_evals --version v1.0.1   # Run with specific version
    python -m evals.run_evals --candidate 2025-01-23-abc123  # Run candidate
    
Environment Variables:
    OPENAI_API_KEY or ANTHROPIC_API_KEY: Required for LLM evaluation
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .metrics import set_f1, aggregate_metrics, calculate_regression

# Data paths
EVALS_DIR = Path(__file__).resolve().parent
DATASETS_DIR = EVALS_DIR / "datasets"
PROMPTS_DIR = EVALS_DIR.parent / "prompts" / "refiner"
RESULTS_DIR = EVALS_DIR / "results"


def load_gold_dataset(name: str) -> List[Dict[str, Any]]:
    """
    Load a gold-standard dataset.
    
    Args:
        name: Dataset name (e.g., 'icd_gold', 'extraction_gold')
        
    Returns:
        List of evaluation records
    """
    path = DATASETS_DIR / f"{name}.jsonl"
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    
    rows = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def load_prompt(version: Optional[str] = None) -> str:
    """
    Load a prompt version.
    
    Args:
        version: Version string (e.g., 'v1.0.0') or None for active
        
    Returns:
        Prompt text
    """
    if version is None:
        # Load active version from active.yaml
        import yaml
        active_yaml = PROMPTS_DIR / "active.yaml"
        if not active_yaml.exists():
            raise FileNotFoundError(f"active.yaml not found: {active_yaml}")
        with open(active_yaml) as f:
            config = yaml.safe_load(f)
        version = config["active_version"]
    
    prompt_file = PROMPTS_DIR / f"{version}.md"
    if not prompt_file.exists():
        raise FileNotFoundError(f"Prompt not found: {prompt_file}")
    
    return prompt_file.read_text()


def create_predict_fn(prompt: str) -> Callable[[str], Dict[str, Any]]:
    """
    Create a prediction function using the given prompt.
    
    This is a placeholder - in production, this would call your
    refiner LLM with the prompt and parse structured output.
    
    Args:
        prompt: The prompt text to use
        
    Returns:
        Function that takes note_text and returns extraction dict
    """
    def predict(note_text: str) -> Dict[str, Any]:
        # TODO: Implement actual LLM call
        # This should:
        # 1. Format the prompt with the note_text
        # 2. Call the refiner LLM (OpenAI/Anthropic)
        # 3. Parse the JSON response
        # 4. Return {"icd_codes": [...], ...}
        
        # Placeholder - returns empty for now
        return {"icd_codes": [], "diagnoses": [], "procedures": []}
    
    return predict


def run_icd_eval(
    predict_fn: Callable[[str], Dict[str, Any]],
    dataset_name: str = "icd_gold"
) -> Dict[str, Any]:
    """
    Run ICD code extraction evaluation.
    
    Args:
        predict_fn: Function that takes note text and returns extraction
        dataset_name: Name of the gold dataset to use
        
    Returns:
        Aggregated evaluation results
    """
    rows = load_gold_dataset(dataset_name)
    results = []
    
    for row in rows:
        note_text = row.get("note_text", "")
        gold_codes = row.get("gold_icd_codes", [])
        
        # Get prediction
        output = predict_fn(note_text)
        pred_codes = output.get("icd_codes", [])
        
        # Calculate metrics
        metrics = set_f1(pred_codes, gold_codes)
        results.append(metrics)
    
    # Aggregate
    aggregated = aggregate_metrics(results)
    return aggregated


def run_full_eval(
    prompt_version: Optional[str] = None,
    baseline_version: Optional[str] = None,
    save_results: bool = True
) -> Dict[str, Any]:
    """
    Run full evaluation suite.
    
    Args:
        prompt_version: Version to evaluate (None for active)
        baseline_version: Version to compare against (for regression)
        save_results: Whether to save results to file
        
    Returns:
        Complete evaluation report
    """
    # Load prompt
    prompt = load_prompt(prompt_version)
    predict_fn = create_predict_fn(prompt)
    
    # Run evaluations
    icd_results = run_icd_eval(predict_fn, "icd_gold")
    
    # Check for regression if baseline provided
    regression = None
    if baseline_version:
        baseline_prompt = load_prompt(baseline_version)
        baseline_fn = create_predict_fn(baseline_prompt)
        baseline_results = run_icd_eval(baseline_fn, "icd_gold")
        regression = calculate_regression(baseline_results, icd_results)
    
    # Build report
    report = {
        "prompt_version": prompt_version or "active",
        "baseline_version": baseline_version,
        "icd_metrics": icd_results,
        "regression_check": regression,
        "passed": regression["passed"] if regression else True
    }
    
    # Save results
    if save_results:
        RESULTS_DIR.mkdir(exist_ok=True)
        version_str = prompt_version or "active"
        result_file = RESULTS_DIR / f"eval_{version_str}.json"
        with open(result_file, "w") as f:
            json.dump(report, f, indent=2)
        print(f"Results saved to: {result_file}")
    
    return report


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Run prompt evaluations")
    parser.add_argument("--version", "-v", help="Prompt version to evaluate")
    parser.add_argument("--baseline", "-b", help="Baseline version for regression check")
    parser.add_argument("--candidate", "-c", help="Candidate prompt file to evaluate")
    parser.add_argument("--no-save", action="store_true", help="Don't save results")
    
    args = parser.parse_args()
    
    version = args.version
    if args.candidate:
        version = f"candidates/{args.candidate}"
    
    report = run_full_eval(
        prompt_version=version,
        baseline_version=args.baseline,
        save_results=not args.no_save
    )
    
    # Print summary
    print("
=== Evaluation Report ===")
    print(f"Prompt: {report['prompt_version']}")
    print(f"ICD F1: {report['icd_metrics']['avg_f1']}")
    print(f"ICD Precision: {report['icd_metrics']['avg_precision']}")
    print(f"ICD Recall: {report['icd_metrics']['avg_recall']}")
    
    if report['regression_check']:
        print(f"
Regression Check: {'PASSED' if report['passed'] else 'FAILED'}")
        if report['regression_check']['regressions']:
            print("  Regressions:")
            for r in report['regression_check']['regressions']:
                print(f"    - {r['metric']}: {r['baseline']} -> {r['current']} ({r['diff']:+.4f})")
        if report['regression_check']['improvements']:
            print("  Improvements:")
            for i in report['regression_check']['improvements']:
                print(f"    + {i['metric']}: {i['baseline']} -> {i['current']} ({i['diff']:+.4f})")
    
    # Exit code for CI
    sys.exit(0 if report['passed'] else 1)


if __name__ == "__main__":
    main()

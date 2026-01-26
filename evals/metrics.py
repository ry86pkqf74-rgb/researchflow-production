"""
Evaluation Metrics Module

Provides ICD accuracy metrics for prompt evaluation.
Based on integrations_4.pdf specification.

Usage:
    from evals.metrics import set_f1
    result = set_f1(predicted_codes, gold_codes)
    # Returns: {"precision": 0.8, "recall": 0.9, "f1": 0.85, "exact": 0.0}
"""

from __future__ import annotations
from typing import Dict, List


def set_f1(pred: List[str], gold: List[str]) -> Dict[str, float]:
    """
    Calculate set-based F1 score for ICD code predictions.
    
    Args:
        pred: List of predicted ICD codes
        gold: List of gold-standard ICD codes
        
    Returns:
        Dictionary with precision, recall, f1, and exact match score
        
    Example:
        >>> set_f1(["A01.0", "B02.1"], ["A01.0", "B02.1", "C03.2"])
        {'precision': 1.0, 'recall': 0.667, 'f1': 0.8, 'exact': 0.0}
    """
    # Normalize codes: strip whitespace, uppercase
    p = set(x.strip().upper() for x in pred if x.strip())
    g = set(x.strip().upper() for x in gold if x.strip())
    
    # Calculate true positives, false positives, false negatives
    tp = len(p & g)  # Intersection
    fp = len(p - g)  # Predicted but not in gold
    fn = len(g - p)  # In gold but not predicted
    
    # Calculate metrics
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    exact = 1.0 if p == g else 0.0
    
    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "exact": exact
    }


def aggregate_metrics(results: List[Dict[str, float]]) -> Dict[str, float]:
    """
    Aggregate metrics across multiple evaluations.
    
    Args:
        results: List of metric dictionaries from set_f1()
        
    Returns:
        Dictionary with averaged metrics and count
    """
    if not results:
        return {"count": 0, "avg_precision": 0.0, "avg_recall": 0.0, "avg_f1": 0.0, "avg_exact": 0.0}
    
    n = len(results)
    return {
        "count": n,
        "avg_precision": round(sum(r["precision"] for r in results) / n, 4),
        "avg_recall": round(sum(r["recall"] for r in results) / n, 4),
        "avg_f1": round(sum(r["f1"] for r in results) / n, 4),
        "avg_exact": round(sum(r["exact"] for r in results) / n, 4)
    }


def calculate_regression(
    baseline: Dict[str, float],
    current: Dict[str, float],
    threshold: float = 0.02
) -> Dict[str, any]:
    """
    Check for metric regression between baseline and current results.
    
    Args:
        baseline: Baseline metrics (e.g., from previous prompt version)
        current: Current metrics (e.g., from candidate prompt)
        threshold: Acceptable regression threshold (default 2%)
        
    Returns:
        Dictionary with regression analysis
    """
    regressions = []
    improvements = []
    
    for metric in ["avg_f1", "avg_precision", "avg_recall"]:
        if metric in baseline and metric in current:
            diff = current[metric] - baseline[metric]
            if diff < -threshold:
                regressions.append({
                    "metric": metric,
                    "baseline": baseline[metric],
                    "current": current[metric],
                    "diff": round(diff, 4)
                })
            elif diff > threshold:
                improvements.append({
                    "metric": metric,
                    "baseline": baseline[metric],
                    "current": current[metric],
                    "diff": round(diff, 4)
                })
    
    return {
        "passed": len(regressions) == 0,
        "regressions": regressions,
        "improvements": improvements
    }

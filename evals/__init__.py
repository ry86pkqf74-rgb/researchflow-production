"""
Evaluation Module

Provides metrics and evaluation harness for prompt testing.
"""

from .metrics import set_f1, aggregate_metrics, calculate_regression

__all__ = ["set_f1", "aggregate_metrics", "calculate_regression"]

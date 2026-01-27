"""
Statistical Analysis Service
============================

Provides real statistical analysis capabilities using scipy, statsmodels, and lifelines.
This service wraps analysis functions for API consumption.

Supported Analysis Types:
- Descriptive: Summary statistics, distributions
- Inferential: T-tests, ANOVA, Chi-square, Mann-Whitney, etc.
- Survival: Kaplan-Meier, Cox proportional hazards
- Regression: Linear, logistic, Poisson regression
- Correlation: Pearson, Spearman correlations
"""

from .service import AnalysisService
from .models import (
    AnalysisRequest,
    AnalysisResponse,
    AnalysisType,
    TestType,
    RegressionType,
    CorrectionMethod,
    DescriptiveResult,
    InferentialResult,
    SurvivalResult,
    RegressionResult,
)

__all__ = [
    "AnalysisService",
    "AnalysisRequest",
    "AnalysisResponse",
    "AnalysisType",
    "TestType",
    "RegressionType",
    "CorrectionMethod",
    "DescriptiveResult",
    "InferentialResult",
    "SurvivalResult",
    "RegressionResult",
]

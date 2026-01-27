"""
Data models for statistical analysis requests and responses.

These models define the structure of analysis requests and results,
ensuring type safety and clear interfaces.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum


class AnalysisType(str, Enum):
    """Types of statistical analysis available."""
    DESCRIPTIVE = "descriptive"
    INFERENTIAL = "inferential"
    SURVIVAL = "survival"
    REGRESSION = "regression"
    CORRELATION = "correlation"


class TestType(str, Enum):
    """Types of inferential statistical tests."""
    TTEST = "t_test"
    TTEST_PAIRED = "t_test_paired"
    ANOVA = "anova"
    CHI_SQUARE = "chi_square"
    MANN_WHITNEY = "mann_whitney"
    WILCOXON = "wilcoxon"
    KRUSKAL_WALLIS = "kruskal_wallis"
    FISHER_EXACT = "fisher_exact"
    PEARSON = "pearson_correlation"
    SPEARMAN = "spearman_correlation"


class RegressionType(str, Enum):
    """Types of regression models."""
    LINEAR = "linear"
    LOGISTIC = "logistic"
    POISSON = "poisson"
    COX = "cox_proportional_hazards"
    NEGATIVE_BINOMIAL = "negative_binomial"


class CorrectionMethod(str, Enum):
    """Methods for multiple testing correction."""
    NONE = "none"
    BONFERRONI = "bonferroni"
    HOLM = "holm"
    SIDAK = "sidak"
    FDR_BH = "fdr_bh"  # Benjamini-Hochberg
    FDR_BY = "fdr_by"  # Benjamini-Yekutieli


@dataclass
class AnalysisRequest:
    """Request for statistical analysis."""
    analysis_type: AnalysisType
    dataset_id: str
    dataset_path: Optional[str] = None
    variables: Dict[str, Any] = field(default_factory=dict)
    parameters: Dict[str, Any] = field(default_factory=dict)

    # For inferential tests
    test_type: Optional[TestType] = None
    group_variable: Optional[str] = None
    outcome_variable: Optional[str] = None
    covariates: Optional[List[str]] = None

    # For survival analysis
    time_variable: Optional[str] = None
    event_variable: Optional[str] = None
    strata_variable: Optional[str] = None

    # For regression
    regression_type: Optional[RegressionType] = None
    dependent_variable: Optional[str] = None
    independent_variables: Optional[List[str]] = None

    # Statistical parameters
    alpha: float = 0.05
    correction_method: CorrectionMethod = CorrectionMethod.NONE
    confidence_level: float = 0.95

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AnalysisRequest":
        """Create AnalysisRequest from dictionary."""
        # Convert string enums to enum instances
        analysis_type = data.get("analysis_type", "descriptive")
        if isinstance(analysis_type, str):
            analysis_type = AnalysisType(analysis_type)

        test_type = data.get("test_type")
        if test_type and isinstance(test_type, str):
            test_type = TestType(test_type)

        regression_type = data.get("regression_type")
        if regression_type and isinstance(regression_type, str):
            regression_type = RegressionType(regression_type)

        correction_method = data.get("correction_method", "none")
        if isinstance(correction_method, str):
            correction_method = CorrectionMethod(correction_method)

        return cls(
            analysis_type=analysis_type,
            dataset_id=data.get("dataset_id", ""),
            dataset_path=data.get("dataset_path"),
            variables=data.get("variables", {}),
            parameters=data.get("parameters", {}),
            test_type=test_type,
            group_variable=data.get("group_variable"),
            outcome_variable=data.get("outcome_variable"),
            covariates=data.get("covariates"),
            time_variable=data.get("time_variable"),
            event_variable=data.get("event_variable"),
            strata_variable=data.get("strata_variable"),
            regression_type=regression_type,
            dependent_variable=data.get("dependent_variable"),
            independent_variables=data.get("independent_variables"),
            alpha=data.get("alpha", 0.05),
            correction_method=correction_method,
            confidence_level=data.get("confidence_level", 0.95),
        )


@dataclass
class DescriptiveResult:
    """Result from descriptive analysis of a single variable."""
    variable: str
    n: int
    n_missing: int

    # Numeric statistics
    mean: Optional[float] = None
    std: Optional[float] = None
    median: Optional[float] = None
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    q1: Optional[float] = None
    q3: Optional[float] = None
    iqr: Optional[float] = None
    skewness: Optional[float] = None
    kurtosis: Optional[float] = None

    # Categorical statistics
    categories: Optional[Dict[str, int]] = None
    percentages: Optional[Dict[str, float]] = None
    mode: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "variable": self.variable,
            "n": self.n,
            "n_missing": self.n_missing,
        }

        if self.mean is not None:
            result.update({
                "mean": self.mean,
                "std": self.std,
                "median": self.median,
                "min": self.min_val,
                "max": self.max_val,
                "q1": self.q1,
                "q3": self.q3,
                "iqr": self.iqr,
                "skewness": self.skewness,
                "kurtosis": self.kurtosis,
            })

        if self.categories is not None:
            result.update({
                "categories": self.categories,
                "percentages": self.percentages,
                "mode": self.mode,
            })

        return result


@dataclass
class InferentialResult:
    """Result from an inferential statistical test."""
    test_name: str
    test_statistic: float
    p_value: float
    p_value_adjusted: Optional[float] = None
    effect_size: Optional[float] = None
    effect_size_name: Optional[str] = None
    confidence_interval: Optional[Tuple[float, float]] = None
    degrees_of_freedom: Optional[float] = None
    is_significant: bool = False
    interpretation: str = ""
    assumptions_met: Dict[str, bool] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    group_statistics: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "test_name": self.test_name,
            "test_statistic": self.test_statistic,
            "p_value": self.p_value,
            "is_significant": self.is_significant,
            "interpretation": self.interpretation,
        }

        if self.p_value_adjusted is not None:
            result["p_value_adjusted"] = self.p_value_adjusted
        if self.effect_size is not None:
            result["effect_size"] = self.effect_size
            result["effect_size_name"] = self.effect_size_name
        if self.confidence_interval is not None:
            result["confidence_interval"] = list(self.confidence_interval)
        if self.degrees_of_freedom is not None:
            result["degrees_of_freedom"] = self.degrees_of_freedom
        if self.assumptions_met:
            result["assumptions_met"] = self.assumptions_met
        if self.warnings:
            result["warnings"] = self.warnings
        if self.group_statistics:
            result["group_statistics"] = self.group_statistics

        return result


@dataclass
class SurvivalResult:
    """Result from survival analysis."""
    method: str = "kaplan_meier"
    n_observations: int = 0
    n_events: int = 0
    median_survival: Optional[float] = None
    median_ci_lower: Optional[float] = None
    median_ci_upper: Optional[float] = None
    survival_probabilities: Dict[float, float] = field(default_factory=dict)
    survival_ci_lower: Dict[float, float] = field(default_factory=dict)
    survival_ci_upper: Dict[float, float] = field(default_factory=dict)

    # For comparing groups
    log_rank_statistic: Optional[float] = None
    log_rank_p_value: Optional[float] = None
    hazard_ratio: Optional[float] = None
    hr_ci_lower: Optional[float] = None
    hr_ci_upper: Optional[float] = None

    # Cox model results
    cox_coefficients: Optional[Dict[str, float]] = None
    cox_hazard_ratios: Optional[Dict[str, float]] = None
    cox_p_values: Optional[Dict[str, float]] = None
    cox_concordance: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "method": self.method,
            "n_observations": self.n_observations,
            "n_events": self.n_events,
        }

        if self.median_survival is not None:
            result["median_survival"] = self.median_survival
            result["median_ci"] = [self.median_ci_lower, self.median_ci_upper]

        if self.survival_probabilities:
            result["survival_probabilities"] = self.survival_probabilities

        if self.log_rank_statistic is not None:
            result["log_rank_test"] = {
                "statistic": self.log_rank_statistic,
                "p_value": self.log_rank_p_value,
            }

        if self.hazard_ratio is not None:
            result["hazard_ratio"] = {
                "hr": self.hazard_ratio,
                "ci_lower": self.hr_ci_lower,
                "ci_upper": self.hr_ci_upper,
            }

        if self.cox_coefficients:
            result["cox_model"] = {
                "coefficients": self.cox_coefficients,
                "hazard_ratios": self.cox_hazard_ratios,
                "p_values": self.cox_p_values,
                "concordance": self.cox_concordance,
            }

        return result


@dataclass
class RegressionResult:
    """Result from regression analysis."""
    model_type: str
    formula: str = ""
    coefficients: Dict[str, float] = field(default_factory=dict)
    std_errors: Dict[str, float] = field(default_factory=dict)
    t_values: Dict[str, float] = field(default_factory=dict)
    p_values: Dict[str, float] = field(default_factory=dict)
    ci_lower: Dict[str, float] = field(default_factory=dict)
    ci_upper: Dict[str, float] = field(default_factory=dict)

    # Model fit statistics
    r_squared: Optional[float] = None
    adj_r_squared: Optional[float] = None
    f_statistic: Optional[float] = None
    f_p_value: Optional[float] = None
    log_likelihood: Optional[float] = None
    aic: Optional[float] = None
    bic: Optional[float] = None

    # For classification models
    pseudo_r_squared: Optional[float] = None
    concordance: Optional[float] = None

    n_observations: int = 0
    residual_std_error: Optional[float] = None

    # Diagnostics
    diagnostics: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "model_type": self.model_type,
            "formula": self.formula,
            "n_observations": self.n_observations,
            "coefficients": [],
        }

        # Build coefficients table
        for var in self.coefficients:
            coef_info = {
                "variable": var,
                "estimate": self.coefficients[var],
                "std_error": self.std_errors.get(var),
                "t_value": self.t_values.get(var),
                "p_value": self.p_values.get(var),
                "ci_lower": self.ci_lower.get(var),
                "ci_upper": self.ci_upper.get(var),
            }
            result["coefficients"].append(coef_info)

        # Fit statistics
        fit_stats = {}
        if self.r_squared is not None:
            fit_stats["r_squared"] = self.r_squared
            fit_stats["adj_r_squared"] = self.adj_r_squared
        if self.f_statistic is not None:
            fit_stats["f_statistic"] = self.f_statistic
            fit_stats["f_p_value"] = self.f_p_value
        if self.log_likelihood is not None:
            fit_stats["log_likelihood"] = self.log_likelihood
        if self.aic is not None:
            fit_stats["aic"] = self.aic
            fit_stats["bic"] = self.bic
        if self.pseudo_r_squared is not None:
            fit_stats["pseudo_r_squared"] = self.pseudo_r_squared
        if self.concordance is not None:
            fit_stats["concordance"] = self.concordance
        if self.residual_std_error is not None:
            fit_stats["residual_std_error"] = self.residual_std_error

        result["fit_statistics"] = fit_stats

        if self.diagnostics:
            result["diagnostics"] = self.diagnostics
        if self.warnings:
            result["warnings"] = self.warnings

        return result


@dataclass
class AnalysisResponse:
    """Complete analysis response."""
    success: bool
    analysis_type: str
    dataset_id: str
    run_id: str
    timestamp: str
    n_observations: int = 0

    descriptive_results: List[DescriptiveResult] = field(default_factory=list)
    inferential_results: List[InferentialResult] = field(default_factory=list)
    survival_results: Optional[SurvivalResult] = None
    regression_results: Optional[RegressionResult] = None

    artifacts: List[Dict[str, str]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "success": self.success,
            "analysis_type": self.analysis_type,
            "dataset_id": self.dataset_id,
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "n_observations": self.n_observations,
        }

        if self.descriptive_results:
            result["descriptive_results"] = [r.to_dict() for r in self.descriptive_results]

        if self.inferential_results:
            result["inferential_results"] = [r.to_dict() for r in self.inferential_results]

        if self.survival_results:
            result["survival_results"] = self.survival_results.to_dict()

        if self.regression_results:
            result["regression_results"] = self.regression_results.to_dict()

        if self.artifacts:
            result["artifacts"] = self.artifacts

        if self.errors:
            result["errors"] = self.errors

        if self.warnings:
            result["warnings"] = self.warnings

        return result

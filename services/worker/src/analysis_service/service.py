"""
Statistical Analysis Service Implementation
============================================

Provides real statistical analysis using scipy, statsmodels, and lifelines.
Replaces mock/placeholder implementations with actual statistical computations.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

import pandas as pd
import numpy as np

# Statistical libraries - with graceful degradation
try:
    from scipy import stats
    from scipy.stats import (
        ttest_ind, ttest_rel, mannwhitneyu, wilcoxon, kruskal,
        chi2_contingency, fisher_exact, pearsonr, spearmanr,
        shapiro, levene, f_oneway
    )
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

try:
    import statsmodels.api as sm
    from statsmodels.formula.api import ols, logit, poisson
    from statsmodels.stats.multitest import multipletests
    from statsmodels.stats.diagnostic import het_breuschpagan
    from statsmodels.stats.outliers_influence import variance_inflation_factor
    from statsmodels.stats.stattools import durbin_watson
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False

try:
    from lifelines import KaplanMeierFitter, CoxPHFitter
    from lifelines.statistics import logrank_test
    LIFELINES_AVAILABLE = True
except ImportError:
    LIFELINES_AVAILABLE = False

from .models import (
    AnalysisRequest, AnalysisResponse, AnalysisType, TestType,
    RegressionType, CorrectionMethod,
    DescriptiveResult, InferentialResult, SurvivalResult, RegressionResult,
)

logger = logging.getLogger(__name__)


class AnalysisService:
    """Service for performing real statistical analyses."""

    def __init__(
        self,
        data_dir: str = "/app/data",
        output_dir: str = "/app/outputs"
    ):
        """Initialize the analysis service.

        Args:
            data_dir: Directory where datasets are stored
            output_dir: Directory for analysis outputs
        """
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Log available libraries
        logger.info(f"scipy available: {SCIPY_AVAILABLE}")
        logger.info(f"statsmodels available: {STATSMODELS_AVAILABLE}")
        logger.info(f"lifelines available: {LIFELINES_AVAILABLE}")

    def load_dataset(
        self,
        dataset_id: str,
        dataset_path: Optional[str] = None
    ) -> pd.DataFrame:
        """Load dataset from ID or explicit path.

        Args:
            dataset_id: Dataset identifier
            dataset_path: Optional explicit file path

        Returns:
            Loaded DataFrame

        Raises:
            FileNotFoundError: If dataset cannot be found
        """
        if dataset_path:
            path = Path(dataset_path)
            if not path.exists():
                raise FileNotFoundError(f"Dataset not found at path: {dataset_path}")
        else:
            # Search for dataset in common locations
            possible_paths = [
                self.data_dir / f"{dataset_id}.csv",
                self.data_dir / f"{dataset_id}.parquet",
                self.data_dir / f"{dataset_id}.tsv",
                self.data_dir / "uploads" / f"{dataset_id}.csv",
                Path("/app/uploads") / f"{dataset_id}.csv",
                Path("/data") / f"{dataset_id}.csv",
                Path("/data/artifacts") / f"{dataset_id}.csv",
            ]

            path = None
            for p in possible_paths:
                if p.exists():
                    path = p
                    logger.info(f"Found dataset at: {path}")
                    break

            if not path:
                raise FileNotFoundError(
                    f"Dataset not found: {dataset_id}. "
                    f"Searched in: {[str(p) for p in possible_paths]}"
                )

        # Load based on extension
        ext = path.suffix.lower()
        if ext == ".csv":
            return pd.read_csv(path)
        elif ext == ".tsv":
            return pd.read_csv(path, sep="\t")
        elif ext == ".parquet":
            return pd.read_parquet(path)
        elif ext in [".xlsx", ".xls"]:
            return pd.read_excel(path)
        else:
            # Try CSV as default
            return pd.read_csv(path)

    def analyze(self, request: AnalysisRequest) -> AnalysisResponse:
        """Main entry point for analysis.

        Args:
            request: Analysis request with parameters

        Returns:
            AnalysisResponse with results
        """
        run_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now(timezone.utc).isoformat()

        try:
            # Load data
            df = self.load_dataset(request.dataset_id, request.dataset_path)
            n_observations = len(df)
            logger.info(f"Loaded dataset with {n_observations} rows, {len(df.columns)} columns")

            response = AnalysisResponse(
                success=True,
                analysis_type=request.analysis_type.value,
                dataset_id=request.dataset_id,
                run_id=run_id,
                timestamp=timestamp,
                n_observations=n_observations,
            )

            # Route to appropriate analysis
            if request.analysis_type == AnalysisType.DESCRIPTIVE:
                response.descriptive_results = self._descriptive_analysis(df, request)

            elif request.analysis_type == AnalysisType.INFERENTIAL:
                response.inferential_results = self._inferential_analysis(df, request)

            elif request.analysis_type == AnalysisType.SURVIVAL:
                response.survival_results = self._survival_analysis(df, request)

            elif request.analysis_type == AnalysisType.REGRESSION:
                response.regression_results = self._regression_analysis(df, request)

            elif request.analysis_type == AnalysisType.CORRELATION:
                response.inferential_results = self._correlation_analysis(df, request)

            logger.info(f"Analysis completed successfully: {request.analysis_type.value}")
            return response

        except FileNotFoundError as e:
            logger.error(f"Dataset not found: {e}")
            return AnalysisResponse(
                success=False,
                analysis_type=request.analysis_type.value,
                dataset_id=request.dataset_id,
                run_id=run_id,
                timestamp=timestamp,
                errors=[str(e)],
            )

        except Exception as e:
            logger.error(f"Analysis failed: {e}", exc_info=True)
            return AnalysisResponse(
                success=False,
                analysis_type=request.analysis_type.value,
                dataset_id=request.dataset_id,
                run_id=run_id,
                timestamp=timestamp,
                errors=[str(e)],
            )

    def _descriptive_analysis(
        self,
        df: pd.DataFrame,
        request: AnalysisRequest
    ) -> List[DescriptiveResult]:
        """Perform descriptive statistics on specified variables.

        Args:
            df: Input DataFrame
            request: Analysis request

        Returns:
            List of DescriptiveResult for each variable
        """
        results = []

        # Get columns to analyze
        columns = request.variables.get("columns", df.columns.tolist())
        if isinstance(columns, str):
            columns = [columns]

        for var in columns:
            if var not in df.columns:
                logger.warning(f"Column not found: {var}")
                continue

            col = df[var]
            n = len(col)
            n_missing = int(col.isna().sum())

            if pd.api.types.is_numeric_dtype(col):
                # Numeric variable
                valid = col.dropna()
                result = DescriptiveResult(
                    variable=var,
                    n=n,
                    n_missing=n_missing,
                    mean=float(valid.mean()) if len(valid) > 0 else None,
                    std=float(valid.std()) if len(valid) > 0 else None,
                    median=float(valid.median()) if len(valid) > 0 else None,
                    min_val=float(valid.min()) if len(valid) > 0 else None,
                    max_val=float(valid.max()) if len(valid) > 0 else None,
                    q1=float(valid.quantile(0.25)) if len(valid) > 0 else None,
                    q3=float(valid.quantile(0.75)) if len(valid) > 0 else None,
                    iqr=float(valid.quantile(0.75) - valid.quantile(0.25)) if len(valid) > 0 else None,
                    skewness=float(valid.skew()) if len(valid) > 2 else None,
                    kurtosis=float(valid.kurtosis()) if len(valid) > 3 else None,
                )
            else:
                # Categorical variable
                value_counts = col.value_counts()
                total = value_counts.sum()
                result = DescriptiveResult(
                    variable=var,
                    n=n,
                    n_missing=n_missing,
                    categories={str(k): int(v) for k, v in value_counts.items()},
                    percentages={str(k): round(float(v / total * 100), 2) for k, v in value_counts.items()},
                    mode=str(value_counts.index[0]) if len(value_counts) > 0 else None,
                )

            results.append(result)

        return results

    def _inferential_analysis(
        self,
        df: pd.DataFrame,
        request: AnalysisRequest
    ) -> List[InferentialResult]:
        """Perform inferential statistical tests.

        Args:
            df: Input DataFrame
            request: Analysis request

        Returns:
            List of InferentialResult
        """
        if not SCIPY_AVAILABLE:
            raise RuntimeError("scipy not available for statistical tests")

        results = []
        outcome = request.outcome_variable
        group = request.group_variable

        if not outcome or not group:
            raise ValueError("outcome_variable and group_variable required for inferential analysis")

        if outcome not in df.columns:
            raise ValueError(f"Outcome variable not found: {outcome}")
        if group not in df.columns:
            raise ValueError(f"Group variable not found: {group}")

        # Get unique groups
        groups = df[group].dropna().unique()
        n_groups = len(groups)

        # Auto-select test if not specified
        test_type = request.test_type
        if not test_type:
            outcome_is_numeric = pd.api.types.is_numeric_dtype(df[outcome])
            if outcome_is_numeric:
                test_type = TestType.TTEST if n_groups == 2 else TestType.ANOVA
            else:
                test_type = TestType.CHI_SQUARE

        # Execute test
        if test_type == TestType.TTEST:
            result = self._ttest(df, outcome, group, list(groups), request.alpha)
        elif test_type == TestType.TTEST_PAIRED:
            result = self._ttest_paired(df, outcome, group, list(groups), request.alpha)
        elif test_type == TestType.ANOVA:
            result = self._anova(df, outcome, group, request.alpha)
        elif test_type == TestType.CHI_SQUARE:
            result = self._chi_square(df, outcome, group, request.alpha)
        elif test_type == TestType.MANN_WHITNEY:
            result = self._mann_whitney(df, outcome, group, list(groups), request.alpha)
        elif test_type == TestType.KRUSKAL_WALLIS:
            result = self._kruskal_wallis(df, outcome, group, request.alpha)
        elif test_type == TestType.FISHER_EXACT:
            result = self._fisher_exact(df, outcome, group, request.alpha)
        else:
            raise ValueError(f"Unsupported test type: {test_type}")

        results.append(result)

        # Apply multiple testing correction if requested
        if request.correction_method != CorrectionMethod.NONE and len(results) > 1:
            p_values = [r.p_value for r in results]
            _, corrected, _, _ = multipletests(
                p_values,
                method=request.correction_method.value
            )
            for r, p_adj in zip(results, corrected):
                r.p_value_adjusted = float(p_adj)
                r.is_significant = p_adj < request.alpha

        return results

    def _ttest(
        self,
        df: pd.DataFrame,
        outcome: str,
        group: str,
        groups: List,
        alpha: float
    ) -> InferentialResult:
        """Independent samples t-test."""
        if len(groups) != 2:
            raise ValueError(f"T-test requires exactly 2 groups, got {len(groups)}")

        group1 = df[df[group] == groups[0]][outcome].dropna()
        group2 = df[df[group] == groups[1]][outcome].dropna()

        # Check assumptions
        assumptions = {}
        warnings = []

        # Normality (Shapiro-Wilk) - only for samples 3-5000
        for i, g in enumerate([group1, group2]):
            if 3 <= len(g) <= 5000:
                _, p_norm = shapiro(g)
                assumptions[f'normality_group{i+1}'] = p_norm > 0.05
                if p_norm <= 0.05:
                    warnings.append(f"Group {i+1} may not be normally distributed (p={p_norm:.4f})")

        # Homogeneity of variance (Levene's test)
        _, p_levene = levene(group1, group2)
        assumptions['homogeneity_of_variance'] = p_levene > 0.05
        use_welch = p_levene <= 0.05

        if use_welch:
            warnings.append("Unequal variances detected, using Welch's t-test")

        # Perform t-test
        stat, p_value = ttest_ind(group1, group2, equal_var=not use_welch)

        # Effect size (Cohen's d)
        n1, n2 = len(group1), len(group2)
        pooled_std = np.sqrt(((n1 - 1) * group1.std() ** 2 + (n2 - 1) * group2.std() ** 2) / (n1 + n2 - 2))
        cohens_d = (group1.mean() - group2.mean()) / pooled_std if pooled_std > 0 else 0

        # Confidence interval for mean difference
        mean_diff = group1.mean() - group2.mean()
        se_diff = np.sqrt(group1.var() / n1 + group2.var() / n2)
        t_crit = stats.t.ppf(1 - alpha / 2, n1 + n2 - 2)
        ci = (mean_diff - t_crit * se_diff, mean_diff + t_crit * se_diff)

        return InferentialResult(
            test_name="Independent Samples T-Test" + (" (Welch)" if use_welch else ""),
            test_statistic=float(stat),
            p_value=float(p_value),
            effect_size=float(cohens_d),
            effect_size_name="Cohen's d",
            degrees_of_freedom=float(n1 + n2 - 2),
            confidence_interval=ci,
            is_significant=p_value < alpha,
            assumptions_met=assumptions,
            warnings=warnings,
            interpretation=f"t({n1+n2-2}) = {stat:.3f}, p = {p_value:.4f}, d = {cohens_d:.3f}",
            group_statistics={
                str(groups[0]): {"n": n1, "mean": float(group1.mean()), "std": float(group1.std())},
                str(groups[1]): {"n": n2, "mean": float(group2.mean()), "std": float(group2.std())},
            },
        )

    def _ttest_paired(
        self,
        df: pd.DataFrame,
        outcome: str,
        group: str,
        groups: List,
        alpha: float
    ) -> InferentialResult:
        """Paired samples t-test."""
        if len(groups) != 2:
            raise ValueError(f"Paired t-test requires exactly 2 groups, got {len(groups)}")

        group1 = df[df[group] == groups[0]][outcome].dropna()
        group2 = df[df[group] == groups[1]][outcome].dropna()

        # For paired test, samples must be same length
        n = min(len(group1), len(group2))
        group1 = group1.iloc[:n]
        group2 = group2.iloc[:n]

        stat, p_value = ttest_rel(group1, group2)

        # Effect size (Cohen's d for paired samples)
        diff = group1.values - group2.values
        cohens_d = diff.mean() / diff.std() if diff.std() > 0 else 0

        return InferentialResult(
            test_name="Paired Samples T-Test",
            test_statistic=float(stat),
            p_value=float(p_value),
            effect_size=float(cohens_d),
            effect_size_name="Cohen's d (paired)",
            degrees_of_freedom=float(n - 1),
            is_significant=p_value < alpha,
            interpretation=f"t({n-1}) = {stat:.3f}, p = {p_value:.4f}, d = {cohens_d:.3f}",
        )

    def _anova(
        self,
        df: pd.DataFrame,
        outcome: str,
        group: str,
        alpha: float
    ) -> InferentialResult:
        """One-way ANOVA."""
        # Get group data
        groups_data = [grp[outcome].dropna().values for name, grp in df.groupby(group)]
        stat, p_value = f_oneway(*groups_data)

        # Effect size (eta-squared)
        all_data = df[outcome].dropna()
        grand_mean = all_data.mean()
        ss_between = sum(len(g) * (np.mean(g) - grand_mean) ** 2 for g in groups_data)
        ss_total = sum((x - grand_mean) ** 2 for x in all_data)
        eta_squared = ss_between / ss_total if ss_total > 0 else 0

        n_groups = len(groups_data)
        n_total = sum(len(g) for g in groups_data)

        return InferentialResult(
            test_name="One-way ANOVA",
            test_statistic=float(stat),
            p_value=float(p_value),
            effect_size=float(eta_squared),
            effect_size_name="η² (eta-squared)",
            degrees_of_freedom=float(n_groups - 1),
            is_significant=p_value < alpha,
            interpretation=f"F({n_groups-1}, {n_total-n_groups}) = {stat:.3f}, p = {p_value:.4f}, η² = {eta_squared:.3f}",
        )

    def _chi_square(
        self,
        df: pd.DataFrame,
        var1: str,
        var2: str,
        alpha: float
    ) -> InferentialResult:
        """Chi-square test of independence."""
        contingency = pd.crosstab(df[var1], df[var2])
        chi2, p_value, dof, expected = chi2_contingency(contingency)

        # Effect size (Cramér's V)
        n = contingency.sum().sum()
        min_dim = min(contingency.shape) - 1
        cramers_v = np.sqrt(chi2 / (n * min_dim)) if min_dim > 0 else 0

        warnings = []
        if (expected < 5).any().any():
            warnings.append("Some expected frequencies < 5; consider Fisher's exact test")

        return InferentialResult(
            test_name="Chi-Square Test of Independence",
            test_statistic=float(chi2),
            p_value=float(p_value),
            degrees_of_freedom=float(dof),
            effect_size=float(cramers_v),
            effect_size_name="Cramér's V",
            is_significant=p_value < alpha,
            warnings=warnings,
            interpretation=f"χ²({dof}) = {chi2:.3f}, p = {p_value:.4f}, V = {cramers_v:.3f}",
        )

    def _mann_whitney(
        self,
        df: pd.DataFrame,
        outcome: str,
        group: str,
        groups: List,
        alpha: float
    ) -> InferentialResult:
        """Mann-Whitney U test (non-parametric)."""
        if len(groups) != 2:
            raise ValueError(f"Mann-Whitney requires exactly 2 groups, got {len(groups)}")

        group1 = df[df[group] == groups[0]][outcome].dropna()
        group2 = df[df[group] == groups[1]][outcome].dropna()

        stat, p_value = mannwhitneyu(group1, group2, alternative='two-sided')

        # Effect size (rank-biserial correlation)
        n1, n2 = len(group1), len(group2)
        r = 1 - (2 * stat) / (n1 * n2)

        return InferentialResult(
            test_name="Mann-Whitney U Test",
            test_statistic=float(stat),
            p_value=float(p_value),
            effect_size=float(r),
            effect_size_name="Rank-biserial correlation",
            is_significant=p_value < alpha,
            interpretation=f"U = {stat:.1f}, p = {p_value:.4f}, r = {r:.3f}",
            group_statistics={
                str(groups[0]): {"n": n1, "median": float(group1.median())},
                str(groups[1]): {"n": n2, "median": float(group2.median())},
            },
        )

    def _kruskal_wallis(
        self,
        df: pd.DataFrame,
        outcome: str,
        group: str,
        alpha: float
    ) -> InferentialResult:
        """Kruskal-Wallis H test (non-parametric ANOVA)."""
        groups_data = [grp[outcome].dropna().values for name, grp in df.groupby(group)]
        stat, p_value = kruskal(*groups_data)

        return InferentialResult(
            test_name="Kruskal-Wallis H Test",
            test_statistic=float(stat),
            p_value=float(p_value),
            is_significant=p_value < alpha,
            interpretation=f"H = {stat:.3f}, p = {p_value:.4f}",
        )

    def _fisher_exact(
        self,
        df: pd.DataFrame,
        var1: str,
        var2: str,
        alpha: float
    ) -> InferentialResult:
        """Fisher's exact test for 2x2 tables."""
        contingency = pd.crosstab(df[var1], df[var2])

        if contingency.shape != (2, 2):
            raise ValueError(f"Fisher's exact test requires a 2x2 table, got {contingency.shape}")

        odds_ratio, p_value = fisher_exact(contingency)

        return InferentialResult(
            test_name="Fisher's Exact Test",
            test_statistic=float(odds_ratio),
            p_value=float(p_value),
            effect_size=float(odds_ratio),
            effect_size_name="Odds Ratio",
            is_significant=p_value < alpha,
            interpretation=f"OR = {odds_ratio:.3f}, p = {p_value:.4f}",
        )

    def _correlation_analysis(
        self,
        df: pd.DataFrame,
        request: AnalysisRequest
    ) -> List[InferentialResult]:
        """Perform correlation analysis."""
        results = []

        variables = request.variables.get("columns", [])
        if not variables:
            # Use all numeric columns
            variables = df.select_dtypes(include=[np.number]).columns.tolist()

        method = request.parameters.get("method", "pearson")

        for i, var1 in enumerate(variables):
            for var2 in variables[i + 1:]:
                if var1 not in df.columns or var2 not in df.columns:
                    continue

                # Get complete cases
                subset = df[[var1, var2]].dropna()
                if len(subset) < 3:
                    continue

                data1 = subset[var1]
                data2 = subset[var2]

                if method == "spearman":
                    corr, p_value = spearmanr(data1, data2)
                    test_name = "Spearman Correlation"
                else:
                    corr, p_value = pearsonr(data1, data2)
                    test_name = "Pearson Correlation"

                results.append(InferentialResult(
                    test_name=f"{test_name}: {var1} vs {var2}",
                    test_statistic=float(corr),
                    p_value=float(p_value),
                    effect_size=float(corr),
                    effect_size_name="Correlation coefficient (r)",
                    is_significant=p_value < request.alpha,
                    interpretation=f"r = {corr:.3f}, p = {p_value:.4f}",
                ))

        return results

    def _survival_analysis(
        self,
        df: pd.DataFrame,
        request: AnalysisRequest
    ) -> SurvivalResult:
        """Perform survival analysis."""
        if not LIFELINES_AVAILABLE:
            raise RuntimeError("lifelines not available for survival analysis")

        time_var = request.time_variable
        event_var = request.event_variable
        strata_var = request.strata_variable

        if not time_var or not event_var:
            raise ValueError("time_variable and event_variable required for survival analysis")

        if time_var not in df.columns:
            raise ValueError(f"Time variable not found: {time_var}")
        if event_var not in df.columns:
            raise ValueError(f"Event variable not found: {event_var}")

        # Clean data
        subset = df[[time_var, event_var]].dropna()
        if strata_var and strata_var in df.columns:
            subset = df[[time_var, event_var, strata_var]].dropna()

        result = SurvivalResult(
            method="kaplan_meier",
            n_observations=len(subset),
            n_events=int(subset[event_var].sum()),
        )

        # Fit Kaplan-Meier
        kmf = KaplanMeierFitter()
        kmf.fit(subset[time_var], subset[event_var])

        # Extract survival probabilities at key timepoints
        timepoints = [30, 90, 180, 365, 730]  # Days
        for t in timepoints:
            if t <= subset[time_var].max():
                prob = kmf.predict(t)
                result.survival_probabilities[t] = float(prob)

        # Median survival
        if kmf.median_survival_time_ is not None and not np.isinf(kmf.median_survival_time_):
            result.median_survival = float(kmf.median_survival_time_)
            ci = kmf.confidence_interval_median_survival_time_
            if ci is not None:
                result.median_ci_lower = float(ci.iloc[0, 0]) if not np.isinf(ci.iloc[0, 0]) else None
                result.median_ci_upper = float(ci.iloc[0, 1]) if not np.isinf(ci.iloc[0, 1]) else None

        # Stratified analysis / log-rank test
        if strata_var and strata_var in subset.columns:
            groups = subset[strata_var].unique()
            if len(groups) == 2:
                g1 = subset[subset[strata_var] == groups[0]]
                g2 = subset[subset[strata_var] == groups[1]]

                lr_result = logrank_test(
                    g1[time_var], g2[time_var],
                    g1[event_var], g2[event_var]
                )

                result.log_rank_statistic = float(lr_result.test_statistic)
                result.log_rank_p_value = float(lr_result.p_value)

        # Cox model if covariates specified
        if request.independent_variables and STATSMODELS_AVAILABLE:
            cox_vars = [time_var, event_var] + request.independent_variables
            cox_subset = df[cox_vars].dropna()

            if len(cox_subset) >= 10:
                try:
                    cph = CoxPHFitter()
                    cph.fit(cox_subset, duration_col=time_var, event_col=event_var)

                    result.method = "cox_proportional_hazards"
                    result.cox_coefficients = {str(k): float(v) for k, v in cph.params_.items()}
                    result.cox_hazard_ratios = {str(k): float(np.exp(v)) for k, v in cph.params_.items()}
                    result.cox_p_values = {str(k): float(v) for k, v in cph.summary['p'].items()}
                    result.cox_concordance = float(cph.concordance_index_)
                except Exception as e:
                    logger.warning(f"Cox model fitting failed: {e}")

        return result

    def _regression_analysis(
        self,
        df: pd.DataFrame,
        request: AnalysisRequest
    ) -> RegressionResult:
        """Perform regression analysis."""
        if not STATSMODELS_AVAILABLE:
            raise RuntimeError("statsmodels not available for regression")

        dependent = request.dependent_variable
        independent = request.independent_variables or []
        reg_type = request.regression_type or RegressionType.LINEAR

        if not dependent:
            raise ValueError("dependent_variable required for regression")
        if not independent:
            raise ValueError("independent_variables required for regression")

        # Build formula
        formula = f"{dependent} ~ " + " + ".join(independent)

        # Clean data
        all_vars = [dependent] + independent
        subset = df[all_vars].dropna()

        if len(subset) < len(independent) + 2:
            raise ValueError(f"Insufficient observations ({len(subset)}) for {len(independent)} predictors")

        result = RegressionResult(
            model_type=reg_type.value,
            formula=formula,
            n_observations=len(subset),
        )

        if reg_type == RegressionType.LINEAR:
            model = ols(formula, data=subset).fit()

            result.r_squared = float(model.rsquared)
            result.adj_r_squared = float(model.rsquared_adj)
            result.f_statistic = float(model.fvalue)
            result.f_p_value = float(model.f_pvalue)
            result.residual_std_error = float(np.sqrt(model.mse_resid))

        elif reg_type == RegressionType.LOGISTIC:
            model = logit(formula, data=subset).fit(disp=0)

            result.log_likelihood = float(model.llf)
            result.pseudo_r_squared = float(model.prsquared)

        elif reg_type == RegressionType.POISSON:
            model = poisson(formula, data=subset).fit(disp=0)

            result.log_likelihood = float(model.llf)
            result.pseudo_r_squared = float(model.prsquared)

        else:
            raise ValueError(f"Unsupported regression type: {reg_type}")

        # Extract coefficients
        result.coefficients = {str(k): float(v) for k, v in model.params.items()}
        result.std_errors = {str(k): float(v) for k, v in model.bse.items()}
        result.t_values = {str(k): float(v) for k, v in model.tvalues.items()}
        result.p_values = {str(k): float(v) for k, v in model.pvalues.items()}

        # Confidence intervals
        ci = model.conf_int()
        result.ci_lower = {str(k): float(ci.loc[k, 0]) for k in ci.index}
        result.ci_upper = {str(k): float(ci.loc[k, 1]) for k in ci.index}

        # AIC/BIC
        result.aic = float(model.aic)
        result.bic = float(model.bic)

        # Diagnostics for linear regression
        if reg_type == RegressionType.LINEAR:
            diagnostics = {}

            # Durbin-Watson (autocorrelation)
            dw = durbin_watson(model.resid)
            diagnostics["durbin_watson"] = {
                "statistic": float(dw),
                "interpretation": "No autocorrelation" if 1.5 < dw < 2.5 else "Possible autocorrelation"
            }

            # Breusch-Pagan (heteroscedasticity)
            try:
                bp_stat, bp_pvalue, _, _ = het_breuschpagan(model.resid, model.model.exog)
                diagnostics["breusch_pagan"] = {
                    "statistic": float(bp_stat),
                    "p_value": float(bp_pvalue),
                    "interpretation": "Homoscedastic" if bp_pvalue > 0.05 else "Heteroscedastic"
                }
            except Exception:
                pass

            # VIF (multicollinearity)
            try:
                X = subset[independent]
                X_with_const = sm.add_constant(X)
                vifs = {}
                for i, col in enumerate(X_with_const.columns):
                    if col != "const":
                        vifs[col] = float(variance_inflation_factor(X_with_const.values, i))
                diagnostics["vif"] = vifs
                if any(v > 5 for v in vifs.values()):
                    result.warnings.append("High VIF detected - potential multicollinearity")
            except Exception:
                pass

            result.diagnostics = diagnostics

        return result

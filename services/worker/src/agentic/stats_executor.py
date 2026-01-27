"""
Statistical Executor

Executes statistical analyses with assumption validation.
"""

import logging
from typing import Dict, Any, Optional, List, Tuple
import pandas as pd
import numpy as np

# Statistical libraries
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
    from statsmodels.formula.api import ols, logit
    from statsmodels.stats.diagnostic import het_breuschpagan
    from statsmodels.stats.outliers_influence import variance_inflation_factor
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
    StatisticalMethod, AnalysisResult, AssumptionCheck
)

logger = logging.getLogger(__name__)


class StatsExecutor:
    """
    Executes statistical analyses with assumption checking.
    """

    def __init__(self, alpha: float = 0.05):
        """
        Initialize executor.

        Args:
            alpha: Significance level (default 0.05)
        """
        self.alpha = alpha
        logger.info(f"scipy available: {SCIPY_AVAILABLE}")
        logger.info(f"statsmodels available: {STATSMODELS_AVAILABLE}")
        logger.info(f"lifelines available: {LIFELINES_AVAILABLE}")

    def execute(
        self,
        method: StatisticalMethod,
        df: pd.DataFrame
    ) -> AnalysisResult:
        """
        Execute a statistical method.

        Args:
            method: StatisticalMethod to execute
            df: Data frame with data

        Returns:
            AnalysisResult with findings
        """
        method_name = method.method.lower()

        try:
            # Route to appropriate method
            if method_name == "independent_t_test":
                return self._run_ttest(df, method)
            elif method_name == "mann_whitney_u":
                return self._run_mann_whitney(df, method)
            elif method_name == "one_way_anova":
                return self._run_anova(df, method)
            elif method_name == "kruskal_wallis":
                return self._run_kruskal(df, method)
            elif method_name == "chi_square":
                return self._run_chi_square(df, method)
            elif method_name == "fisher_exact":
                return self._run_fisher(df, method)
            elif method_name == "pearson_correlation":
                return self._run_pearson(df, method)
            elif method_name == "spearman_correlation":
                return self._run_spearman(df, method)
            elif method_name == "linear_regression":
                return self._run_linear_regression(df, method)
            elif method_name == "logistic_regression":
                return self._run_logistic_regression(df, method)
            elif method_name == "kaplan_meier":
                return self._run_kaplan_meier(df, method)
            elif method_name == "log_rank_test":
                return self._run_log_rank(df, method)
            elif method_name == "cox_regression":
                return self._run_cox(df, method)
            elif method_name == "descriptive_statistics":
                return self._run_descriptive(df, method)
            else:
                return AnalysisResult(
                    method=method_name,
                    success=False,
                    interpretation=f"Unknown method: {method_name}"
                )
        except Exception as e:
            logger.error(f"Error executing {method_name}: {e}")
            return AnalysisResult(
                method=method_name,
                success=False,
                interpretation=f"Execution error: {str(e)}"
            )

    def _run_ttest(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Independent samples t-test."""
        if not SCIPY_AVAILABLE:
            return AnalysisResult(method="t_test", success=False, interpretation="scipy not available")

        dep = method.variables.get("dependent")
        group_col = method.variables.get("grouping")

        groups = df[group_col].dropna().unique()
        if len(groups) != 2:
            return AnalysisResult(
                method="t_test", success=False,
                interpretation=f"Expected 2 groups, found {len(groups)}"
            )

        group1 = df[df[group_col] == groups[0]][dep].dropna()
        group2 = df[df[group_col] == groups[1]][dep].dropna()

        # Assumption checks
        assumptions = []

        # Normality check
        if len(group1) >= 3 and len(group2) >= 3:
            _, p1 = shapiro(group1[:5000])  # Shapiro limited to 5000
            _, p2 = shapiro(group2[:5000])
            assumptions.append(AssumptionCheck(
                assumption="normality",
                test_name="Shapiro-Wilk",
                passed=p1 > 0.05 and p2 > 0.05,
                p_value=min(p1, p2),
                details=f"Group 1 p={p1:.4f}, Group 2 p={p2:.4f}"
            ))

        # Levene's test for equal variances
        _, lev_p = levene(group1, group2)
        assumptions.append(AssumptionCheck(
            assumption="equal_variances",
            test_name="Levene's test",
            passed=lev_p > 0.05,
            p_value=lev_p
        ))

        # Run t-test (Welch's if variances unequal)
        equal_var = lev_p > 0.05
        stat, p_value = ttest_ind(group1, group2, equal_var=equal_var)

        # Effect size (Cohen's d)
        pooled_std = np.sqrt(((len(group1)-1)*group1.std()**2 + (len(group2)-1)*group2.std()**2) / (len(group1)+len(group2)-2))
        cohens_d = (group1.mean() - group2.mean()) / pooled_std if pooled_std > 0 else 0

        return AnalysisResult(
            method="independent_t_test",
            success=True,
            statistic=float(stat),
            p_value=float(p_value),
            effect_size=float(cohens_d),
            interpretation=f"{'Significant' if p_value < self.alpha else 'No significant'} difference between groups (t={stat:.3f}, p={p_value:.4f}, Cohen's d={cohens_d:.3f})",
            assumption_checks=assumptions,
            raw_output={
                "t_statistic": float(stat),
                "p_value": float(p_value),
                "cohens_d": float(cohens_d),
                "group1_mean": float(group1.mean()),
                "group2_mean": float(group2.mean()),
                "group1_n": len(group1),
                "group2_n": len(group2),
                "welch_correction": not equal_var
            }
        )

    def _run_mann_whitney(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Mann-Whitney U test."""
        if not SCIPY_AVAILABLE:
            return AnalysisResult(method="mann_whitney", success=False, interpretation="scipy not available")

        dep = method.variables.get("dependent")
        group_col = method.variables.get("grouping")

        groups = df[group_col].dropna().unique()
        group1 = df[df[group_col] == groups[0]][dep].dropna()
        group2 = df[df[group_col] == groups[1]][dep].dropna()

        stat, p_value = mannwhitneyu(group1, group2, alternative='two-sided')

        # Effect size (rank-biserial correlation)
        n1, n2 = len(group1), len(group2)
        r = 1 - (2*stat)/(n1*n2)

        return AnalysisResult(
            method="mann_whitney_u",
            success=True,
            statistic=float(stat),
            p_value=float(p_value),
            effect_size=float(r),
            interpretation=f"{'Significant' if p_value < self.alpha else 'No significant'} difference (U={stat:.0f}, p={p_value:.4f}, r={r:.3f})",
            raw_output={
                "u_statistic": float(stat),
                "p_value": float(p_value),
                "rank_biserial_r": float(r)
            }
        )

    def _run_anova(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """One-way ANOVA."""
        if not SCIPY_AVAILABLE:
            return AnalysisResult(method="anova", success=False, interpretation="scipy not available")

        dep = method.variables.get("dependent")
        group_col = method.variables.get("grouping")

        groups = [df[df[group_col] == g][dep].dropna() for g in df[group_col].dropna().unique()]
        groups = [g for g in groups if len(g) > 0]

        stat, p_value = f_oneway(*groups)

        # Effect size (eta squared)
        all_data = pd.concat(groups)
        ss_between = sum(len(g) * (g.mean() - all_data.mean())**2 for g in groups)
        ss_total = sum((all_data - all_data.mean())**2)
        eta_sq = ss_between / ss_total if ss_total > 0 else 0

        return AnalysisResult(
            method="one_way_anova",
            success=True,
            statistic=float(stat),
            p_value=float(p_value),
            effect_size=float(eta_sq),
            interpretation=f"{'Significant' if p_value < self.alpha else 'No significant'} effect (F={stat:.3f}, p={p_value:.4f}, η²={eta_sq:.3f})",
            raw_output={
                "f_statistic": float(stat),
                "p_value": float(p_value),
                "eta_squared": float(eta_sq),
                "n_groups": len(groups)
            }
        )

    def _run_kruskal(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Kruskal-Wallis H test."""
        if not SCIPY_AVAILABLE:
            return AnalysisResult(method="kruskal", success=False, interpretation="scipy not available")

        dep = method.variables.get("dependent")
        group_col = method.variables.get("grouping")

        groups = [df[df[group_col] == g][dep].dropna() for g in df[group_col].dropna().unique()]
        groups = [g for g in groups if len(g) > 0]

        stat, p_value = kruskal(*groups)

        return AnalysisResult(
            method="kruskal_wallis",
            success=True,
            statistic=float(stat),
            p_value=float(p_value),
            interpretation=f"{'Significant' if p_value < self.alpha else 'No significant'} effect (H={stat:.3f}, p={p_value:.4f})",
            raw_output={
                "h_statistic": float(stat),
                "p_value": float(p_value),
                "n_groups": len(groups)
            }
        )

    def _run_chi_square(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Chi-square test of independence."""
        if not SCIPY_AVAILABLE:
            return AnalysisResult(method="chi_square", success=False, interpretation="scipy not available")

        outcome = method.variables.get("outcome")
        exposure = method.variables.get("exposure")

        contingency = pd.crosstab(df[outcome], df[exposure])
        chi2, p_value, dof, expected = chi2_contingency(contingency)

        # Cramér's V
        n = contingency.sum().sum()
        min_dim = min(contingency.shape) - 1
        cramers_v = np.sqrt(chi2 / (n * min_dim)) if min_dim > 0 else 0

        # Check expected cell counts
        min_expected = expected.min()
        assumptions = [AssumptionCheck(
            assumption="expected_cell_count",
            test_name="Min expected count",
            passed=min_expected >= 5,
            statistic=float(min_expected),
            details=f"Minimum expected count: {min_expected:.1f}"
        )]

        return AnalysisResult(
            method="chi_square",
            success=True,
            statistic=float(chi2),
            p_value=float(p_value),
            effect_size=float(cramers_v),
            interpretation=f"{'Significant' if p_value < self.alpha else 'No significant'} association (χ²={chi2:.3f}, p={p_value:.4f}, Cramér's V={cramers_v:.3f})",
            assumption_checks=assumptions,
            raw_output={
                "chi2": float(chi2),
                "p_value": float(p_value),
                "degrees_of_freedom": int(dof),
                "cramers_v": float(cramers_v)
            }
        )

    def _run_fisher(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Fisher's exact test."""
        if not SCIPY_AVAILABLE:
            return AnalysisResult(method="fisher", success=False, interpretation="scipy not available")

        outcome = method.variables.get("outcome")
        exposure = method.variables.get("exposure")

        contingency = pd.crosstab(df[outcome], df[exposure])

        if contingency.shape != (2, 2):
            return AnalysisResult(
                method="fisher_exact",
                success=False,
                interpretation="Fisher's exact test requires a 2x2 table"
            )

        odds_ratio, p_value = fisher_exact(contingency)

        return AnalysisResult(
            method="fisher_exact",
            success=True,
            statistic=float(odds_ratio),
            p_value=float(p_value),
            effect_size=float(odds_ratio),
            interpretation=f"{'Significant' if p_value < self.alpha else 'No significant'} association (OR={odds_ratio:.3f}, p={p_value:.4f})",
            raw_output={
                "odds_ratio": float(odds_ratio),
                "p_value": float(p_value)
            }
        )

    def _run_pearson(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Pearson correlation."""
        if not SCIPY_AVAILABLE:
            return AnalysisResult(method="pearson", success=False, interpretation="scipy not available")

        variables = method.variables.get("variables", [])
        if len(variables) < 2:
            return AnalysisResult(method="pearson", success=False, interpretation="Need at least 2 variables")

        x = df[variables[0]].dropna()
        y = df[variables[1]].dropna()

        # Align data
        common_idx = x.index.intersection(y.index)
        x, y = x[common_idx], y[common_idx]

        r, p_value = pearsonr(x, y)

        return AnalysisResult(
            method="pearson_correlation",
            success=True,
            statistic=float(r),
            p_value=float(p_value),
            effect_size=float(r**2),
            interpretation=f"{'Significant' if p_value < self.alpha else 'No significant'} correlation (r={r:.3f}, p={p_value:.4f}, R²={r**2:.3f})",
            raw_output={
                "r": float(r),
                "p_value": float(p_value),
                "r_squared": float(r**2)
            }
        )

    def _run_spearman(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Spearman correlation."""
        if not SCIPY_AVAILABLE:
            return AnalysisResult(method="spearman", success=False, interpretation="scipy not available")

        variables = method.variables.get("variables", [])
        if len(variables) < 2:
            return AnalysisResult(method="spearman", success=False, interpretation="Need at least 2 variables")

        x = df[variables[0]].dropna()
        y = df[variables[1]].dropna()

        common_idx = x.index.intersection(y.index)
        x, y = x[common_idx], y[common_idx]

        rho, p_value = spearmanr(x, y)

        return AnalysisResult(
            method="spearman_correlation",
            success=True,
            statistic=float(rho),
            p_value=float(p_value),
            interpretation=f"{'Significant' if p_value < self.alpha else 'No significant'} correlation (ρ={rho:.3f}, p={p_value:.4f})",
            raw_output={
                "rho": float(rho),
                "p_value": float(p_value)
            }
        )

    def _run_linear_regression(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Linear regression."""
        if not STATSMODELS_AVAILABLE:
            return AnalysisResult(method="linear_regression", success=False, interpretation="statsmodels not available")

        dep = method.variables.get("dependent")
        indeps = method.variables.get("independent", [])

        # Prepare data
        data = df[[dep] + indeps].dropna()
        y = data[dep]
        X = sm.add_constant(data[indeps])

        model = sm.OLS(y, X).fit()

        return AnalysisResult(
            method="linear_regression",
            success=True,
            statistic=float(model.fvalue) if model.fvalue else None,
            p_value=float(model.f_pvalue) if model.f_pvalue else None,
            effect_size=float(model.rsquared),
            interpretation=f"R²={model.rsquared:.3f}, Adjusted R²={model.rsquared_adj:.3f}",
            raw_output={
                "r_squared": float(model.rsquared),
                "adj_r_squared": float(model.rsquared_adj),
                "f_statistic": float(model.fvalue) if model.fvalue else None,
                "f_pvalue": float(model.f_pvalue) if model.f_pvalue else None,
                "coefficients": {k: float(v) for k, v in model.params.items()},
                "p_values": {k: float(v) for k, v in model.pvalues.items()},
                "aic": float(model.aic),
                "bic": float(model.bic)
            }
        )

    def _run_logistic_regression(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Logistic regression."""
        if not STATSMODELS_AVAILABLE:
            return AnalysisResult(method="logistic_regression", success=False, interpretation="statsmodels not available")

        dep = method.variables.get("dependent")
        indeps = method.variables.get("independent", [])

        data = df[[dep] + indeps].dropna()

        # Encode binary outcome
        y = pd.get_dummies(data[dep], drop_first=True).iloc[:, 0]
        X = sm.add_constant(data[indeps])

        model = sm.Logit(y, X).fit(disp=0)

        # Odds ratios
        odds_ratios = np.exp(model.params)

        return AnalysisResult(
            method="logistic_regression",
            success=True,
            interpretation=f"Pseudo R²={model.prsquared:.3f}",
            raw_output={
                "pseudo_r_squared": float(model.prsquared),
                "log_likelihood": float(model.llf),
                "coefficients": {k: float(v) for k, v in model.params.items()},
                "odds_ratios": {k: float(v) for k, v in odds_ratios.items()},
                "p_values": {k: float(v) for k, v in model.pvalues.items()},
                "aic": float(model.aic),
                "bic": float(model.bic)
            }
        )

    def _run_kaplan_meier(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Kaplan-Meier survival analysis."""
        if not LIFELINES_AVAILABLE:
            return AnalysisResult(method="kaplan_meier", success=False, interpretation="lifelines not available")

        time_col = method.variables.get("time")
        event_col = method.variables.get("event")

        data = df[[time_col, event_col]].dropna()
        T = data[time_col]
        E = data[event_col]

        kmf = KaplanMeierFitter()
        kmf.fit(T, E)

        return AnalysisResult(
            method="kaplan_meier",
            success=True,
            interpretation=f"Median survival: {kmf.median_survival_time_:.2f}" if kmf.median_survival_time_ else "Median not reached",
            raw_output={
                "median_survival": float(kmf.median_survival_time_) if kmf.median_survival_time_ else None,
                "n_observations": len(T),
                "n_events": int(E.sum()),
                "survival_probabilities": kmf.survival_function_.to_dict()
            }
        )

    def _run_log_rank(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Log-rank test."""
        if not LIFELINES_AVAILABLE:
            return AnalysisResult(method="log_rank", success=False, interpretation="lifelines not available")

        time_col = method.variables.get("time")
        event_col = method.variables.get("event")
        group_col = method.variables.get("group")

        data = df[[time_col, event_col, group_col]].dropna()
        groups = data[group_col].unique()

        if len(groups) != 2:
            return AnalysisResult(method="log_rank", success=False, interpretation="Log-rank requires exactly 2 groups")

        g1 = data[data[group_col] == groups[0]]
        g2 = data[data[group_col] == groups[1]]

        result = logrank_test(
            g1[time_col], g2[time_col],
            g1[event_col], g2[event_col]
        )

        return AnalysisResult(
            method="log_rank_test",
            success=True,
            statistic=float(result.test_statistic),
            p_value=float(result.p_value),
            interpretation=f"{'Significant' if result.p_value < self.alpha else 'No significant'} difference (χ²={result.test_statistic:.3f}, p={result.p_value:.4f})",
            raw_output={
                "test_statistic": float(result.test_statistic),
                "p_value": float(result.p_value)
            }
        )

    def _run_cox(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Cox proportional hazards regression."""
        if not LIFELINES_AVAILABLE:
            return AnalysisResult(method="cox", success=False, interpretation="lifelines not available")

        time_col = method.variables.get("time")
        event_col = method.variables.get("event")
        covariates = method.variables.get("covariates", [])

        cols = [time_col, event_col] + covariates
        data = df[cols].dropna()

        cph = CoxPHFitter()
        cph.fit(data, duration_col=time_col, event_col=event_col)

        return AnalysisResult(
            method="cox_regression",
            success=True,
            interpretation=f"Concordance: {cph.concordance_index_:.3f}",
            raw_output={
                "concordance_index": float(cph.concordance_index_),
                "hazard_ratios": cph.hazard_ratios_.to_dict(),
                "coefficients": cph.params_.to_dict(),
                "p_values": cph.summary["p"].to_dict(),
                "log_likelihood": float(cph.log_likelihood_)
            }
        )

    def _run_descriptive(
        self,
        df: pd.DataFrame,
        method: StatisticalMethod
    ) -> AnalysisResult:
        """Descriptive statistics."""
        numeric_cols = method.variables.get("numeric_columns", [])

        if not numeric_cols:
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        stats_dict = {}
        for col in numeric_cols:
            if col in df.columns:
                series = df[col].dropna()
                stats_dict[col] = {
                    "count": int(series.count()),
                    "mean": float(series.mean()) if len(series) > 0 else None,
                    "std": float(series.std()) if len(series) > 0 else None,
                    "min": float(series.min()) if len(series) > 0 else None,
                    "25%": float(series.quantile(0.25)) if len(series) > 0 else None,
                    "50%": float(series.median()) if len(series) > 0 else None,
                    "75%": float(series.quantile(0.75)) if len(series) > 0 else None,
                    "max": float(series.max()) if len(series) > 0 else None
                }

        return AnalysisResult(
            method="descriptive_statistics",
            success=True,
            interpretation=f"Computed descriptive statistics for {len(numeric_cols)} variables",
            raw_output={"statistics": stats_dict}
        )


# Singleton instance
stats_executor = StatsExecutor()

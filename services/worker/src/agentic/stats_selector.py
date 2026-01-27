"""
Statistical Method Selector

Selects appropriate statistical methods based on:
- Data types (numeric, categorical, etc.)
- Research question type
- Sample sizes
- Distribution characteristics
"""

import logging
from typing import List, Dict, Any, Optional
from .models import ColumnProfile, DatasetProfile, ColumnType, StatisticalMethod

logger = logging.getLogger(__name__)


class StatsSelector:
    """
    Selects appropriate statistical methods for analysis.

    Selection criteria:
    - Variable types (categorical, continuous)
    - Number of groups
    - Sample size
    - Distribution assumptions
    """

    # Minimum sample sizes for various tests
    MIN_SAMPLES = {
        "parametric": 30,
        "chi_square": 5,  # Expected cell count
        "correlation": 10,
        "regression": 20,
    }

    def suggest_methods(
        self,
        profile: DatasetProfile,
        research_goal: str,
        dependent_var: Optional[str] = None,
        independent_vars: Optional[List[str]] = None
    ) -> List[StatisticalMethod]:
        """
        Suggest statistical methods based on data profile and goal.

        Args:
            profile: Dataset profile
            research_goal: Type of research (comparison, correlation, prediction, etc.)
            dependent_var: Dependent variable name
            independent_vars: Independent variable names

        Returns:
            List of suggested statistical methods
        """
        methods = []
        column_map = {col.name: col for col in profile.columns}

        # Get variable types
        dep_profile = column_map.get(dependent_var) if dependent_var else None
        indep_profiles = [
            column_map.get(v) for v in (independent_vars or [])
            if v in column_map
        ]

        if research_goal == "comparison" or research_goal == "difference":
            methods.extend(self._suggest_comparison_methods(
                dep_profile, indep_profiles, profile.row_count
            ))
        elif research_goal == "correlation" or research_goal == "association":
            methods.extend(self._suggest_correlation_methods(
                dep_profile, indep_profiles, profile.row_count
            ))
        elif research_goal == "prediction" or research_goal == "regression":
            methods.extend(self._suggest_regression_methods(
                dep_profile, indep_profiles, profile.row_count
            ))
        elif research_goal == "survival":
            methods.extend(self._suggest_survival_methods(
                dep_profile, indep_profiles
            ))
        else:
            # Default: suggest descriptive + exploratory
            methods.extend(self._suggest_descriptive_methods(profile))

        return methods

    def _suggest_comparison_methods(
        self,
        dependent: Optional[ColumnProfile],
        independents: List[Optional[ColumnProfile]],
        n_samples: int
    ) -> List[StatisticalMethod]:
        """Suggest methods for comparing groups."""
        methods = []

        if not dependent:
            return methods

        # Get grouping variable (first categorical independent)
        group_var = next(
            (v for v in independents if v and v.column_type == ColumnType.CATEGORICAL),
            None
        )

        if not group_var:
            return methods

        n_groups = group_var.unique_count

        if dependent.column_type == ColumnType.NUMERIC:
            # Continuous outcome
            if n_groups == 2:
                # Two groups: t-test or Mann-Whitney
                if n_samples >= self.MIN_SAMPLES["parametric"]:
                    methods.append(StatisticalMethod(
                        method="independent_t_test",
                        rationale="Comparing means between 2 groups with continuous outcome",
                        assumptions=["normality", "equal_variances", "independence"],
                        variables={
                            "dependent": dependent.name,
                            "grouping": group_var.name
                        }
                    ))
                methods.append(StatisticalMethod(
                    method="mann_whitney_u",
                    rationale="Non-parametric alternative for 2-group comparison",
                    assumptions=["independence", "ordinal_or_continuous"],
                    variables={
                        "dependent": dependent.name,
                        "grouping": group_var.name
                    }
                ))
            elif n_groups > 2:
                # Multiple groups: ANOVA or Kruskal-Wallis
                if n_samples >= self.MIN_SAMPLES["parametric"]:
                    methods.append(StatisticalMethod(
                        method="one_way_anova",
                        rationale=f"Comparing means across {n_groups} groups",
                        assumptions=["normality", "homogeneity_of_variance", "independence"],
                        variables={
                            "dependent": dependent.name,
                            "grouping": group_var.name
                        }
                    ))
                methods.append(StatisticalMethod(
                    method="kruskal_wallis",
                    rationale="Non-parametric alternative for multi-group comparison",
                    assumptions=["independence", "similar_distributions"],
                    variables={
                        "dependent": dependent.name,
                        "grouping": group_var.name
                    }
                ))

        elif dependent.column_type == ColumnType.CATEGORICAL:
            # Categorical outcome: Chi-square or Fisher's exact
            if dependent.unique_count == 2 and n_groups == 2:
                methods.append(StatisticalMethod(
                    method="fisher_exact",
                    rationale="Testing association in 2x2 table",
                    assumptions=["independence"],
                    variables={
                        "outcome": dependent.name,
                        "exposure": group_var.name
                    }
                ))
            methods.append(StatisticalMethod(
                method="chi_square",
                rationale="Testing independence between categorical variables",
                assumptions=["independence", "expected_cell_count_>=_5"],
                variables={
                    "outcome": dependent.name,
                    "exposure": group_var.name
                }
            ))

        return methods

    def _suggest_correlation_methods(
        self,
        dependent: Optional[ColumnProfile],
        independents: List[Optional[ColumnProfile]],
        n_samples: int
    ) -> List[StatisticalMethod]:
        """Suggest methods for correlation/association."""
        methods = []

        numeric_vars = [
            v for v in [dependent, *independents]
            if v and v.column_type == ColumnType.NUMERIC
        ]

        if len(numeric_vars) >= 2:
            methods.append(StatisticalMethod(
                method="pearson_correlation",
                rationale="Measuring linear relationship between continuous variables",
                assumptions=["linearity", "normality", "no_outliers"],
                variables={
                    "variables": [v.name for v in numeric_vars[:2]]
                }
            ))
            methods.append(StatisticalMethod(
                method="spearman_correlation",
                rationale="Non-parametric correlation (monotonic relationship)",
                assumptions=["monotonic_relationship"],
                variables={
                    "variables": [v.name for v in numeric_vars[:2]]
                }
            ))

        return methods

    def _suggest_regression_methods(
        self,
        dependent: Optional[ColumnProfile],
        independents: List[Optional[ColumnProfile]],
        n_samples: int
    ) -> List[StatisticalMethod]:
        """Suggest regression methods."""
        methods = []

        if not dependent or not independents:
            return methods

        indep_names = [v.name for v in independents if v]

        if dependent.column_type == ColumnType.NUMERIC:
            # Continuous outcome: linear regression
            if n_samples >= self.MIN_SAMPLES["regression"]:
                methods.append(StatisticalMethod(
                    method="linear_regression",
                    rationale="Predicting continuous outcome from predictors",
                    assumptions=["linearity", "normality_of_residuals", "homoscedasticity", "independence"],
                    variables={
                        "dependent": dependent.name,
                        "independent": indep_names
                    }
                ))

        elif dependent.column_type == ColumnType.CATEGORICAL:
            if dependent.unique_count == 2:
                # Binary outcome: logistic regression
                methods.append(StatisticalMethod(
                    method="logistic_regression",
                    rationale="Predicting binary outcome from predictors",
                    assumptions=["independence", "no_multicollinearity", "linearity_in_logit"],
                    variables={
                        "dependent": dependent.name,
                        "independent": indep_names
                    }
                ))
            else:
                # Multinomial
                methods.append(StatisticalMethod(
                    method="multinomial_regression",
                    rationale="Predicting multi-category outcome from predictors",
                    assumptions=["independence_of_irrelevant_alternatives"],
                    variables={
                        "dependent": dependent.name,
                        "independent": indep_names
                    }
                ))

        return methods

    def _suggest_survival_methods(
        self,
        dependent: Optional[ColumnProfile],
        independents: List[Optional[ColumnProfile]]
    ) -> List[StatisticalMethod]:
        """Suggest survival analysis methods."""
        methods = []

        methods.append(StatisticalMethod(
            method="kaplan_meier",
            rationale="Estimating survival function",
            assumptions=["non_informative_censoring"],
            variables={
                "time": dependent.name if dependent else "time",
                "event": "event"
            }
        ))

        if independents:
            methods.append(StatisticalMethod(
                method="log_rank_test",
                rationale="Comparing survival between groups",
                assumptions=["proportional_hazards", "non_informative_censoring"],
                variables={
                    "time": dependent.name if dependent else "time",
                    "event": "event",
                    "group": independents[0].name if independents[0] else "group"
                }
            ))
            methods.append(StatisticalMethod(
                method="cox_regression",
                rationale="Modeling hazard with covariates",
                assumptions=["proportional_hazards", "non_informative_censoring"],
                variables={
                    "time": dependent.name if dependent else "time",
                    "event": "event",
                    "covariates": [v.name for v in independents if v]
                }
            ))

        return methods

    def _suggest_descriptive_methods(
        self,
        profile: DatasetProfile
    ) -> List[StatisticalMethod]:
        """Suggest descriptive statistics methods."""
        methods = []

        numeric_cols = [c for c in profile.columns if c.column_type == ColumnType.NUMERIC]
        cat_cols = [c for c in profile.columns if c.column_type == ColumnType.CATEGORICAL]

        if numeric_cols:
            methods.append(StatisticalMethod(
                method="descriptive_statistics",
                rationale="Summarizing numeric variables",
                assumptions=[],
                variables={
                    "numeric_columns": [c.name for c in numeric_cols]
                }
            ))

        if cat_cols:
            methods.append(StatisticalMethod(
                method="frequency_tables",
                rationale="Summarizing categorical variables",
                assumptions=[],
                variables={
                    "categorical_columns": [c.name for c in cat_cols]
                }
            ))

        return methods


# Singleton instance
stats_selector = StatsSelector()

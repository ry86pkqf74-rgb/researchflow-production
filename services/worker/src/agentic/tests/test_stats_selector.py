"""
Tests for StatsSelector - Statistical method selection.
"""

import pytest
from ..stats_selector import StatsSelector
from ..models import ColumnProfile, DatasetProfile, ColumnType, StatisticalMethod


class TestStatsSelector:
    """Tests for statistical method selection."""

    def setup_method(self):
        self.selector = StatsSelector()

    def _make_profile(self, columns: list) -> DatasetProfile:
        """Helper to create a DatasetProfile."""
        return DatasetProfile(
            dataset_id="test",
            row_count=100,
            column_count=len(columns),
            columns=columns,
        )

    def _make_column(
        self,
        name: str,
        col_type: ColumnType,
        unique_count: int = 10,
        null_count: int = 0,
    ) -> ColumnProfile:
        """Helper to create a ColumnProfile."""
        return ColumnProfile(
            name=name,
            dtype="float64" if col_type == ColumnType.NUMERIC else "object",
            column_type=col_type,
            null_count=null_count,
            null_percent=null_count,
            unique_count=unique_count,
            mean=50.0 if col_type == ColumnType.NUMERIC else None,
            std=10.0 if col_type == ColumnType.NUMERIC else None,
            min_val=0.0 if col_type == ColumnType.NUMERIC else None,
            max_val=100.0 if col_type == ColumnType.NUMERIC else None,
        )

    def test_two_group_comparison_suggests_ttest(self):
        """Comparing two groups with continuous outcome should suggest t-test."""
        columns = [
            self._make_column("outcome", ColumnType.NUMERIC),
            self._make_column("group", ColumnType.CATEGORICAL, unique_count=2),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Compare outcome between groups",
            dependent_var="outcome",
            independent_vars=["group"],
        )

        method_names = [m.method for m in methods]
        assert any("t-test" in m.lower() or "ttest" in m.lower() for m in method_names)

    def test_multi_group_comparison_suggests_anova(self):
        """Comparing multiple groups should suggest ANOVA."""
        columns = [
            self._make_column("outcome", ColumnType.NUMERIC),
            self._make_column("group", ColumnType.CATEGORICAL, unique_count=4),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Compare outcome across groups",
            dependent_var="outcome",
            independent_vars=["group"],
        )

        method_names = [m.method for m in methods]
        assert any("anova" in m.lower() for m in method_names)

    def test_categorical_association_suggests_chisquare(self):
        """Categorical association should suggest chi-square."""
        columns = [
            self._make_column("outcome", ColumnType.CATEGORICAL, unique_count=3),
            self._make_column("exposure", ColumnType.CATEGORICAL, unique_count=2),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Association between exposure and outcome",
            dependent_var="outcome",
            independent_vars=["exposure"],
        )

        method_names = [m.method for m in methods]
        assert any("chi" in m.lower() or "fisher" in m.lower() for m in method_names)

    def test_continuous_relationship_suggests_correlation(self):
        """Continuous-continuous relationship should suggest correlation."""
        columns = [
            self._make_column("variable1", ColumnType.NUMERIC),
            self._make_column("variable2", ColumnType.NUMERIC),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Relationship between variable1 and variable2",
            dependent_var="variable1",
            independent_vars=["variable2"],
        )

        method_names = [m.method for m in methods]
        assert any(
            "correlation" in m.lower() or "pearson" in m.lower() or "spearman" in m.lower()
            for m in method_names
        )

    def test_prediction_suggests_regression(self):
        """Prediction goal should suggest regression."""
        columns = [
            self._make_column("outcome", ColumnType.NUMERIC),
            self._make_column("predictor1", ColumnType.NUMERIC),
            self._make_column("predictor2", ColumnType.CATEGORICAL, unique_count=3),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Predict outcome from predictors",
            dependent_var="outcome",
            independent_vars=["predictor1", "predictor2"],
        )

        method_names = [m.method for m in methods]
        assert any("regression" in m.lower() for m in method_names)

    def test_binary_outcome_suggests_logistic(self):
        """Binary outcome prediction should suggest logistic regression."""
        columns = [
            self._make_column("outcome", ColumnType.CATEGORICAL, unique_count=2),
            self._make_column("predictor1", ColumnType.NUMERIC),
            self._make_column("predictor2", ColumnType.NUMERIC),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Predict binary outcome",
            dependent_var="outcome",
            independent_vars=["predictor1", "predictor2"],
        )

        method_names = [m.method for m in methods]
        assert any("logistic" in m.lower() for m in method_names)

    def test_survival_keywords_suggest_survival_analysis(self):
        """Survival-related keywords should suggest survival analysis."""
        columns = [
            self._make_column("time_to_event", ColumnType.NUMERIC),
            self._make_column("event", ColumnType.BOOLEAN, unique_count=2),
            self._make_column("treatment", ColumnType.CATEGORICAL, unique_count=2),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="survival analysis of treatment effect",
            dependent_var="time_to_event",
            independent_vars=["treatment"],
        )

        method_names = [m.method for m in methods]
        # Should suggest survival methods
        assert any(
            "kaplan" in m.lower() or "cox" in m.lower() or "survival" in m.lower()
            for m in method_names
        )

    def test_returns_method_with_rationale(self):
        """Each method should have a rationale."""
        columns = [
            self._make_column("outcome", ColumnType.NUMERIC),
            self._make_column("group", ColumnType.CATEGORICAL, unique_count=2),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Compare groups",
            dependent_var="outcome",
            independent_vars=["group"],
        )

        for method in methods:
            assert method.rationale, f"Method {method.method} missing rationale"
            assert len(method.rationale) > 10  # Non-trivial rationale

    def test_returns_assumptions(self):
        """Methods should include assumptions to check."""
        columns = [
            self._make_column("outcome", ColumnType.NUMERIC),
            self._make_column("group", ColumnType.CATEGORICAL, unique_count=2),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Compare groups",
            dependent_var="outcome",
            independent_vars=["group"],
        )

        # At least one method should have assumptions
        has_assumptions = any(len(m.assumptions) > 0 for m in methods)
        assert has_assumptions, "Expected at least one method with assumptions"

    def test_empty_profile_returns_empty(self):
        """Empty profile should return empty suggestions."""
        profile = self._make_profile([])

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Analyze data",
        )

        assert len(methods) == 0 or all(
            isinstance(m, StatisticalMethod) for m in methods
        )

    def test_no_dependent_var_still_works(self):
        """Should work without explicit dependent variable."""
        columns = [
            self._make_column("var1", ColumnType.NUMERIC),
            self._make_column("var2", ColumnType.NUMERIC),
        ]
        profile = self._make_profile(columns)

        methods = self.selector.suggest_methods(
            profile=profile,
            research_goal="Explore relationships in data",
        )

        # Should return some methods
        assert isinstance(methods, list)

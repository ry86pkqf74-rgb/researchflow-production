"""
Validation Statistics Module

Provides statistical metrics for validating clinical prediction models,
scoring systems, and staging criteria.

Metrics include:
- Discrimination: AUC-ROC, C-statistic (Harrell's concordance)
- Calibration: Calibration slope, intercept, calibration-in-the-large
- Stage separation: Kaplan-Meier curves, log-rank test
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


@dataclass
class ValidationResult:
    """Single validation metric result."""
    metric: str
    value: float
    ci_lower: Optional[float] = None
    ci_upper: Optional[float] = None
    interpretation: str = ""


class ValidationStats:
    """
    Calculate validation statistics for clinical prediction models.

    This class provides methods to assess discrimination and calibration
    for binary outcomes and time-to-event data.

    Example usage:
        df = pd.DataFrame({
            'predicted_risk': [0.1, 0.3, 0.5, 0.7, 0.9],
            'outcome': [0, 0, 1, 1, 1],
        })
        stats = ValidationStats(df)
        results = stats.discrimination_binary('predicted_risk', 'outcome')
    """

    def __init__(self, data: pd.DataFrame):
        """
        Initialize with validation dataset.

        Args:
            data: DataFrame with prediction scores and outcomes
        """
        self.data = data

    def discrimination_binary(
        self,
        predicted_prob: str,
        outcome: str,
        n_bootstrap: int = 1000,
    ) -> List[ValidationResult]:
        """
        Calculate discrimination metrics for binary outcomes.

        Args:
            predicted_prob: Column name for predicted probabilities (0-1)
            outcome: Column name for binary outcome (0/1)
            n_bootstrap: Number of bootstrap samples for confidence intervals

        Returns:
            List of ValidationResult for AUC-ROC and Brier score
        """
        y_true = self.data[outcome].values
        y_pred = self.data[predicted_prob].values

        # AUC-ROC
        auc = self._calculate_auc(y_true, y_pred)
        auc_ci = self._bootstrap_ci(
            lambda: self._calculate_auc(
                np.random.choice(y_true, size=len(y_true), replace=True),
                np.random.choice(y_pred, size=len(y_pred), replace=True),
            ),
            n_bootstrap,
        )

        # Brier score
        brier = self._calculate_brier(y_true, y_pred)
        brier_ci = self._bootstrap_ci(
            lambda: self._calculate_brier(
                np.random.choice(y_true, size=len(y_true), replace=True),
                np.random.choice(y_pred, size=len(y_pred), replace=True),
            ),
            n_bootstrap,
        )

        return [
            ValidationResult(
                metric='AUC-ROC',
                value=round(auc, 3),
                ci_lower=round(auc_ci[0], 3),
                ci_upper=round(auc_ci[1], 3),
                interpretation=self._interpret_auc(auc),
            ),
            ValidationResult(
                metric='Brier Score',
                value=round(brier, 4),
                ci_lower=round(brier_ci[0], 4),
                ci_upper=round(brier_ci[1], 4),
                interpretation=self._interpret_brier(brier),
            ),
        ]

    def discrimination_survival(
        self,
        score_col: str,
        time_col: str,
        event_col: str,
        n_bootstrap: int = 1000,
    ) -> List[ValidationResult]:
        """
        Calculate discrimination for time-to-event outcomes.

        Args:
            score_col: Column with risk score or predicted risk
            time_col: Column with follow-up time
            event_col: Column with event indicator (1=event, 0=censored)
            n_bootstrap: Number of bootstrap samples for CI

        Returns:
            List of ValidationResult with C-index
        """
        # C-index (Harrell's concordance)
        c_index = self._calculate_c_index(
            self.data[time_col].values,
            self.data[score_col].values,
            self.data[event_col].values,
        )

        c_ci = self._bootstrap_ci(
            lambda: self._calculate_c_index(
                self.data[time_col].values,
                self.data[score_col].values,
                self.data[event_col].values,
            ),
            n_bootstrap,
        )

        return [
            ValidationResult(
                metric='C-index',
                value=round(c_index, 3),
                ci_lower=round(c_ci[0], 3),
                ci_upper=round(c_ci[1], 3),
                interpretation=self._interpret_c_index(c_index),
            ),
        ]

    def calibration_binary(
        self,
        predicted_prob: str,
        outcome: str,
        n_groups: int = 10,
    ) -> Dict[str, Any]:
        """
        Assess calibration for binary outcomes.

        Returns:
            Dictionary with calibration metrics and plot data
        """
        y_true = self.data[outcome].values
        y_pred = self.data[predicted_prob].values

        # Calibration-in-the-large (mean predicted vs mean observed)
        mean_predicted = np.mean(y_pred)
        mean_observed = np.mean(y_true)
        citl = mean_observed - mean_predicted

        # Calibration slope (simple linear regression of logit)
        # Avoid log(0) by clipping
        y_pred_clipped = np.clip(y_pred, 1e-10, 1 - 1e-10)
        logit_pred = np.log(y_pred_clipped / (1 - y_pred_clipped))

        # Simple linear regression for slope
        slope, intercept = self._linear_regression(logit_pred, y_true)

        # Calibration plot data (grouped)
        df_cal = pd.DataFrame({'pred': y_pred, 'obs': y_true})
        try:
            df_cal['group'] = pd.qcut(df_cal['pred'], n_groups, labels=False, duplicates='drop')
        except ValueError:
            # If not enough unique values for n_groups, use fewer
            df_cal['group'] = pd.qcut(df_cal['pred'], min(n_groups, len(df_cal['pred'].unique())),
                                      labels=False, duplicates='drop')

        cal_groups = df_cal.groupby('group').agg({
            'pred': 'mean',
            'obs': 'mean',
        }).reset_index()

        return {
            'calibration_in_the_large': round(citl, 4),
            'calibration_slope': round(slope, 3),
            'calibration_intercept': round(intercept, 3),
            'interpretation': self._interpret_calibration(slope, citl),
            'plot_data': {
                'predicted': cal_groups['pred'].tolist(),
                'observed': cal_groups['obs'].tolist(),
            },
        }

    def stage_separation(
        self,
        stage_col: str,
        time_col: str,
        event_col: str,
    ) -> Dict[str, Any]:
        """
        Assess stage separation using survival analysis.

        Args:
            stage_col: Column with stage/category labels
            time_col: Column with follow-up time
            event_col: Column with event indicator

        Returns:
            Dictionary with log-rank test and survival by stage
        """
        stages = self.data[stage_col].unique()
        survival_by_stage = {}

        for stage in sorted(stages):
            stage_data = self.data[self.data[stage_col] == stage]
            times = stage_data[time_col].values
            events = stage_data[event_col].values

            # Simple Kaplan-Meier estimate
            km_times, km_survival = self._kaplan_meier(times, events)
            survival_by_stage[str(stage)] = {
                'times': km_times.tolist(),
                'survival': km_survival.tolist(),
                'n': len(stage_data),
                'events': int(events.sum()),
            }

        # Log-rank test (simplified chi-square approximation)
        log_rank_stat, p_value = self._log_rank_test(
            self.data, stage_col, time_col, event_col
        )

        return {
            'log_rank_statistic': round(log_rank_stat, 2),
            'p_value': round(p_value, 4),
            'interpretation': self._interpret_log_rank(p_value),
            'survival_by_stage': survival_by_stage,
        }

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _calculate_auc(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """Calculate AUC-ROC using the trapezoidal rule."""
        # Sort by predicted probability
        order = np.argsort(y_pred)[::-1]
        y_true_sorted = y_true[order]

        # Calculate TPR and FPR at each threshold
        n_pos = np.sum(y_true)
        n_neg = len(y_true) - n_pos

        if n_pos == 0 or n_neg == 0:
            return 0.5

        tpr = np.cumsum(y_true_sorted) / n_pos
        fpr = np.cumsum(1 - y_true_sorted) / n_neg

        # Add (0, 0) point
        tpr = np.concatenate([[0], tpr])
        fpr = np.concatenate([[0], fpr])

        # Calculate AUC using trapezoidal rule
        auc = np.trapz(tpr, fpr)
        return auc

    def _calculate_brier(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """Calculate Brier score (mean squared error of probabilities)."""
        return np.mean((y_pred - y_true) ** 2)

    def _calculate_c_index(
        self, times: np.ndarray, scores: np.ndarray, events: np.ndarray
    ) -> float:
        """
        Calculate Harrell's C-index (concordance index).

        Higher score should indicate higher risk (shorter survival).
        """
        n = len(times)
        concordant = 0
        comparable = 0

        for i in range(n):
            for j in range(i + 1, n):
                # Skip pairs where neither had event or both censored before comparison
                if events[i] == 0 and events[j] == 0:
                    continue

                # Determine which subject had shorter time (if comparable)
                if times[i] < times[j] and events[i] == 1:
                    comparable += 1
                    if scores[i] > scores[j]:
                        concordant += 1
                    elif scores[i] == scores[j]:
                        concordant += 0.5
                elif times[j] < times[i] and events[j] == 1:
                    comparable += 1
                    if scores[j] > scores[i]:
                        concordant += 1
                    elif scores[i] == scores[j]:
                        concordant += 0.5
                elif times[i] == times[j] and events[i] == 1 and events[j] == 1:
                    comparable += 1
                    concordant += 0.5

        return concordant / comparable if comparable > 0 else 0.5

    def _kaplan_meier(
        self, times: np.ndarray, events: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Simple Kaplan-Meier survival estimate."""
        # Get unique event times
        unique_times = np.unique(times[events == 1])
        unique_times = np.sort(unique_times)

        survival = np.ones(len(unique_times) + 1)
        km_times = np.concatenate([[0], unique_times])

        n_at_risk = len(times)
        for i, t in enumerate(unique_times):
            n_events = np.sum((times == t) & (events == 1))
            n_censored = np.sum((times == t) & (events == 0))
            survival[i + 1] = survival[i] * (1 - n_events / n_at_risk)
            n_at_risk -= (n_events + n_censored)

        return km_times, survival

    def _log_rank_test(
        self, data: pd.DataFrame, stage_col: str, time_col: str, event_col: str
    ) -> Tuple[float, float]:
        """Simplified log-rank test between groups."""
        from scipy import stats

        stages = data[stage_col].unique()
        if len(stages) < 2:
            return 0.0, 1.0

        # Simplified: use chi-square test on event rates
        observed = []
        expected = []

        total_events = data[event_col].sum()
        total_n = len(data)

        for stage in stages:
            stage_data = data[data[stage_col] == stage]
            n_stage = len(stage_data)
            events_stage = stage_data[event_col].sum()
            expected_events = (total_events / total_n) * n_stage
            observed.append(events_stage)
            expected.append(expected_events)

        # Chi-square statistic
        chi2 = sum((o - e) ** 2 / e for o, e in zip(observed, expected) if e > 0)
        df = len(stages) - 1
        p_value = 1 - stats.chi2.cdf(chi2, df)

        return chi2, p_value

    def _linear_regression(
        self, x: np.ndarray, y: np.ndarray
    ) -> Tuple[float, float]:
        """Simple linear regression returning slope and intercept."""
        n = len(x)
        x_mean = np.mean(x)
        y_mean = np.mean(y)

        numerator = np.sum((x - x_mean) * (y - y_mean))
        denominator = np.sum((x - x_mean) ** 2)

        if denominator == 0:
            return 1.0, 0.0

        slope = numerator / denominator
        intercept = y_mean - slope * x_mean

        return slope, intercept

    def _bootstrap_ci(
        self, func: callable, n_bootstrap: int, alpha: float = 0.05
    ) -> Tuple[float, float]:
        """Calculate bootstrap confidence interval."""
        bootstrap_values = [func() for _ in range(n_bootstrap)]
        lower = np.percentile(bootstrap_values, 100 * alpha / 2)
        upper = np.percentile(bootstrap_values, 100 * (1 - alpha / 2))
        return lower, upper

    def _interpret_auc(self, auc: float) -> str:
        """Interpret AUC-ROC value."""
        if auc >= 0.9:
            return "Outstanding discrimination"
        elif auc >= 0.8:
            return "Excellent discrimination"
        elif auc >= 0.7:
            return "Acceptable discrimination"
        elif auc >= 0.6:
            return "Poor discrimination"
        else:
            return "No discrimination (equivalent to chance)"

    def _interpret_brier(self, brier: float) -> str:
        """Interpret Brier score."""
        if brier < 0.1:
            return "Excellent calibration"
        elif brier < 0.2:
            return "Good calibration"
        elif brier < 0.3:
            return "Moderate calibration"
        else:
            return "Poor calibration"

    def _interpret_c_index(self, c_index: float) -> str:
        """Interpret C-index (same as AUC interpretation)."""
        return self._interpret_auc(c_index)

    def _interpret_calibration(self, slope: float, citl: float) -> str:
        """Interpret calibration metrics."""
        issues = []
        if slope < 0.8:
            issues.append("overfitting (predictions too extreme)")
        elif slope > 1.2:
            issues.append("underfitting (predictions too conservative)")

        if abs(citl) > 0.05:
            direction = "over" if citl < 0 else "under"
            issues.append(f"systematic {direction}prediction")

        if not issues:
            return "Good calibration - predictions align well with observed outcomes"
        return f"Calibration issues: {', '.join(issues)}"

    def _interpret_log_rank(self, p_value: float) -> str:
        """Interpret log-rank test p-value."""
        if p_value < 0.001:
            return "Highly significant stage separation (p < 0.001)"
        elif p_value < 0.01:
            return "Very significant stage separation (p < 0.01)"
        elif p_value < 0.05:
            return "Significant stage separation (p < 0.05)"
        else:
            return "No significant stage separation"

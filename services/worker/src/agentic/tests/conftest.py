"""
Pytest configuration and fixtures for agentic tests.
"""

import pytest
import pandas as pd
import numpy as np


@pytest.fixture
def sample_numeric_df():
    """Sample dataframe with numeric columns."""
    np.random.seed(42)
    return pd.DataFrame({
        "age": np.random.randint(18, 80, 100),
        "weight": np.random.normal(70, 15, 100),
        "height": np.random.normal(170, 10, 100),
        "bmi": np.random.normal(25, 5, 100),
    })


@pytest.fixture
def sample_categorical_df():
    """Sample dataframe with categorical columns."""
    np.random.seed(42)
    return pd.DataFrame({
        "gender": np.random.choice(["M", "F"], 100),
        "status": np.random.choice(["active", "inactive", "pending"], 100),
        "group": np.random.choice(["A", "B", "C", "D"], 100),
    })


@pytest.fixture
def sample_mixed_df():
    """Sample dataframe with mixed column types."""
    np.random.seed(42)
    return pd.DataFrame({
        "patient_id": range(100),
        "age": np.random.randint(18, 80, 100),
        "gender": np.random.choice(["M", "F"], 100),
        "treatment": np.random.choice(["drug", "placebo"], 100),
        "outcome": np.random.normal(50, 10, 100),
        "recovered": np.random.choice([True, False], 100),
        "visit_date": pd.date_range("2020-01-01", periods=100),
    })


@pytest.fixture
def sample_clinical_df():
    """Sample clinical trial-like dataframe."""
    np.random.seed(42)
    n = 200
    treatment = np.random.choice(["active", "control"], n)

    # Simulate treatment effect
    base_outcome = np.random.normal(100, 15, n)
    treatment_effect = np.where(treatment == "active", -10, 0)
    outcome = base_outcome + treatment_effect + np.random.normal(0, 5, n)

    return pd.DataFrame({
        "subject_id": range(n),
        "treatment": treatment,
        "baseline": np.random.normal(100, 15, n),
        "outcome": outcome,
        "age": np.random.randint(30, 70, n),
        "gender": np.random.choice(["M", "F"], n),
        "site": np.random.choice(["A", "B", "C"], n),
    })


@pytest.fixture
def sample_survival_df():
    """Sample survival analysis dataframe."""
    np.random.seed(42)
    n = 150

    # Generate survival times with treatment effect
    treatment = np.random.choice(["treatment", "control"], n)
    base_time = np.random.exponential(365, n)  # Days
    treatment_effect = np.where(treatment == "treatment", 1.5, 1.0)
    time = base_time * treatment_effect

    # Some censoring
    censored = np.random.random(n) > 0.7
    event = ~censored

    return pd.DataFrame({
        "subject_id": range(n),
        "treatment": treatment,
        "time_days": time.astype(int),
        "event": event,
        "age": np.random.randint(40, 80, n),
        "stage": np.random.choice(["I", "II", "III", "IV"], n),
    })


@pytest.fixture
def sample_df_with_nulls():
    """Sample dataframe with missing values."""
    np.random.seed(42)
    df = pd.DataFrame({
        "complete": range(100),
        "some_missing": np.random.choice([1, 2, 3, None], 100),
        "many_missing": np.random.choice([1, None, None, None], 100),
        "all_null": [None] * 100,
    })
    return df

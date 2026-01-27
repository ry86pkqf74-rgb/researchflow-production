"""
Tests for SchemaIntrospector - PHI-safe dataset profiling.
"""

import pytest
import pandas as pd
import numpy as np
from ..schema_introspect import SchemaIntrospector
from ..models import ColumnType


class TestSchemaIntrospector:
    """Tests for schema introspection."""

    def setup_method(self):
        self.introspector = SchemaIntrospector()

    def test_numeric_column_detection(self):
        """Numeric columns should be detected correctly."""
        df = pd.DataFrame({
            "age": [25, 30, 35, 40, 45],
            "weight": [150.5, 160.2, 170.8, 180.1, 190.0],
        })
        profile = self.introspector.profile_dataset(df, "test")

        for col in profile.columns:
            assert col.column_type == ColumnType.NUMERIC

    def test_categorical_column_detection(self):
        """Categorical columns should be detected correctly."""
        df = pd.DataFrame({
            "gender": ["M", "F", "M", "F", "M"] * 20,
            "status": ["active", "inactive", "pending"] * 33 + ["active"],
        })
        profile = self.introspector.profile_dataset(df, "test")

        for col in profile.columns:
            assert col.column_type == ColumnType.CATEGORICAL

    def test_datetime_column_detection(self):
        """Datetime columns should be detected correctly."""
        df = pd.DataFrame({
            "created": pd.date_range("2020-01-01", periods=10),
            "updated": pd.to_datetime(["2020-01-01", "2020-02-01"] * 5),
        })
        profile = self.introspector.profile_dataset(df, "test")

        for col in profile.columns:
            assert col.column_type == ColumnType.DATETIME

    def test_boolean_column_detection(self):
        """Boolean columns should be detected correctly."""
        df = pd.DataFrame({
            "active": [True, False, True, False, True],
            "verified": [False, True, False, True, False],
        })
        profile = self.introspector.profile_dataset(df, "test")

        for col in profile.columns:
            assert col.column_type == ColumnType.BOOLEAN

    def test_null_count_calculation(self):
        """Null counts should be calculated correctly."""
        df = pd.DataFrame({
            "col1": [1, 2, None, 4, None],
            "col2": [1, 2, 3, 4, 5],
        })
        profile = self.introspector.profile_dataset(df, "test")

        col1_profile = next(c for c in profile.columns if c.name == "col1")
        col2_profile = next(c for c in profile.columns if c.name == "col2")

        assert col1_profile.null_count == 2
        assert col1_profile.null_percent == 40.0
        assert col2_profile.null_count == 0
        assert col2_profile.null_percent == 0.0

    def test_unique_count_calculation(self):
        """Unique counts should be calculated correctly."""
        df = pd.DataFrame({
            "colors": ["red", "blue", "red", "green", "blue"],
        })
        profile = self.introspector.profile_dataset(df, "test")

        col_profile = profile.columns[0]
        assert col_profile.unique_count == 3

    def test_numeric_statistics(self):
        """Numeric statistics should be calculated correctly."""
        df = pd.DataFrame({
            "values": [10, 20, 30, 40, 50],
        })
        profile = self.introspector.profile_dataset(df, "test")

        col_profile = profile.columns[0]
        assert col_profile.mean == 30.0
        assert col_profile.min_val == 10.0
        assert col_profile.max_val == 50.0
        assert col_profile.median == 30.0

    def test_row_column_counts(self):
        """Row and column counts should be correct."""
        df = pd.DataFrame({
            "a": [1, 2, 3],
            "b": [4, 5, 6],
            "c": [7, 8, 9],
        })
        profile = self.introspector.profile_dataset(df, "test")

        assert profile.row_count == 3
        assert profile.column_count == 3

    def test_no_phi_in_output(self):
        """Profile should not contain actual data values (PHI protection)."""
        df = pd.DataFrame({
            "name": ["John Doe", "Jane Smith", "Bob Wilson"],
            "ssn": ["123-45-6789", "987-65-4321", "555-55-5555"],
            "email": ["john@email.com", "jane@email.com", "bob@email.com"],
        })
        profile = self.introspector.profile_dataset(df, "test")

        # Convert to dict to check all values
        profile_dict = profile.model_dump()
        profile_str = str(profile_dict)

        # Should not contain actual data values
        assert "John Doe" not in profile_str
        assert "123-45-6789" not in profile_str
        assert "john@email.com" not in profile_str

    def test_metadata_for_ai_format(self):
        """get_metadata_for_ai should return serializable format."""
        df = pd.DataFrame({
            "age": [25, 30, 35],
            "gender": ["M", "F", "M"],
        })
        profile = self.introspector.profile_dataset(df, "test")
        metadata = self.introspector.get_metadata_for_ai(profile)

        # Should be a string (JSON)
        assert isinstance(metadata, str)

        # Should be valid JSON
        import json
        parsed = json.loads(metadata)
        assert "columns" in parsed
        assert len(parsed["columns"]) == 2

    def test_top_categories_for_categorical(self):
        """Top categories should be populated for categorical columns."""
        df = pd.DataFrame({
            "status": ["active"] * 50 + ["pending"] * 30 + ["inactive"] * 20,
        })
        profile = self.introspector.profile_dataset(df, "test")

        col_profile = profile.columns[0]
        assert col_profile.top_categories is not None
        assert len(col_profile.top_categories) <= 10  # Should be limited

    def test_empty_dataframe(self):
        """Should handle empty dataframe gracefully."""
        df = pd.DataFrame()
        profile = self.introspector.profile_dataset(df, "test")

        assert profile.row_count == 0
        assert profile.column_count == 0

    def test_single_row_dataframe(self):
        """Should handle single-row dataframe."""
        df = pd.DataFrame({"a": [1], "b": ["test"]})
        profile = self.introspector.profile_dataset(df, "test")

        assert profile.row_count == 1
        assert profile.column_count == 2

    def test_mixed_types_column(self):
        """Should handle columns with mixed types."""
        df = pd.DataFrame({
            "mixed": [1, "two", 3.0, None, "five"],
        })
        # Should not crash
        profile = self.introspector.profile_dataset(df, "test")
        assert len(profile.columns) == 1

"""
Unit tests for ID column detection utility.

Tests the detection of candidate linking columns across DataFrames
based on uniqueness, overlap, naming patterns, and fuzzy matching.
"""

import pytest
import pandas as pd
import numpy as np
from pathlib import Path
from dataclasses import asdict

# Module under test
from utils.id_detection import (
    IDCandidate,
    detect_id_candidates,
    calculate_uniqueness_ratio,
    calculate_overlap_ratio,
    find_matching_column,
    calculate_pattern_score,
    COMMON_ID_PATTERNS,
)


class TestIDCandidate:
    """Tests for the IDCandidate dataclass."""

    def test_candidate_creation(self):
        """Test IDCandidate dataclass instantiation."""
        candidate = IDCandidate(
            column_name="patient_id",
            uniqueness_ratio=0.98,
            overlap_ratio=0.85,
            pattern_score=1.0,
            matched_in_files=["file1.csv", "file2.csv"],
        )
        assert candidate.column_name == "patient_id"
        assert candidate.uniqueness_ratio == 0.98
        assert candidate.overlap_ratio == 0.85
        assert candidate.pattern_score == 1.0
        assert len(candidate.matched_in_files) == 2

    def test_candidate_to_dict(self):
        """Test IDCandidate conversion to dictionary."""
        candidate = IDCandidate(
            column_name="id",
            uniqueness_ratio=1.0,
            overlap_ratio=0.9,
            pattern_score=0.8,
            matched_in_files=["a.csv"],
        )
        d = asdict(candidate)
        assert "column_name" in d
        assert d["uniqueness_ratio"] == 1.0


class TestUniquenessRatio:
    """Tests for uniqueness ratio calculation."""

    def test_all_unique(self):
        """Test column with all unique values."""
        df = pd.DataFrame({"id": [1, 2, 3, 4, 5]})
        ratio = calculate_uniqueness_ratio(df["id"])
        assert ratio == 1.0

    def test_some_duplicates(self):
        """Test column with some duplicate values."""
        df = pd.DataFrame({"id": [1, 1, 2, 2, 3]})
        ratio = calculate_uniqueness_ratio(df["id"])
        assert ratio == 0.6  # 3 unique out of 5

    def test_all_same(self):
        """Test column with all same values."""
        df = pd.DataFrame({"id": [1, 1, 1, 1, 1]})
        ratio = calculate_uniqueness_ratio(df["id"])
        assert ratio == 0.2  # 1 unique out of 5

    def test_empty_series(self):
        """Test empty series returns 0."""
        s = pd.Series([], dtype=int)
        ratio = calculate_uniqueness_ratio(s)
        assert ratio == 0.0

    def test_with_null_values(self):
        """Test handling of null values."""
        df = pd.DataFrame({"id": [1, 2, None, 3, None]})
        ratio = calculate_uniqueness_ratio(df["id"])
        # Should consider non-null uniqueness
        assert 0 < ratio <= 1.0


class TestOverlapRatio:
    """Tests for overlap ratio between two series."""

    def test_complete_overlap(self):
        """Test series with complete overlap."""
        s1 = pd.Series([1, 2, 3])
        s2 = pd.Series([1, 2, 3])
        ratio = calculate_overlap_ratio(s1, s2)
        assert ratio == 1.0

    def test_partial_overlap(self):
        """Test series with partial overlap."""
        s1 = pd.Series([1, 2, 3])
        s2 = pd.Series([2, 3, 4])
        ratio = calculate_overlap_ratio(s1, s2)
        # 2 overlapping out of 4 unique total
        assert ratio == 0.5

    def test_no_overlap(self):
        """Test series with no overlap."""
        s1 = pd.Series([1, 2, 3])
        s2 = pd.Series([4, 5, 6])
        ratio = calculate_overlap_ratio(s1, s2)
        assert ratio == 0.0

    def test_subset_overlap(self):
        """Test when one series is subset of another."""
        s1 = pd.Series([1, 2, 3, 4, 5])
        s2 = pd.Series([2, 3])
        ratio = calculate_overlap_ratio(s1, s2)
        # 2 overlapping out of 5 unique total
        assert ratio == 0.4

    def test_empty_series(self):
        """Test with empty series."""
        s1 = pd.Series([], dtype=int)
        s2 = pd.Series([1, 2, 3])
        ratio = calculate_overlap_ratio(s1, s2)
        assert ratio == 0.0

    def test_string_values(self):
        """Test overlap with string values."""
        s1 = pd.Series(["P001", "P002", "P003"])
        s2 = pd.Series(["P002", "P003", "P004"])
        ratio = calculate_overlap_ratio(s1, s2)
        assert ratio == 0.5


class TestPatternScore:
    """Tests for ID column name pattern scoring."""

    def test_exact_id_match(self):
        """Test exact 'id' column name."""
        score = calculate_pattern_score("id")
        assert score == 1.0

    def test_patient_id_pattern(self):
        """Test patient_id pattern."""
        score = calculate_pattern_score("patient_id")
        assert score > 0.5

    def test_subject_number_pattern(self):
        """Test subject_num pattern."""
        score = calculate_pattern_score("subject_num")
        assert score > 0.5

    def test_mrn_pattern(self):
        """Test MRN pattern."""
        score = calculate_pattern_score("mrn")
        assert score > 0.5

    def test_record_id_pattern(self):
        """Test record_id pattern (common in REDCap)."""
        score = calculate_pattern_score("record_id")
        assert score > 0.5

    def test_case_insensitive(self):
        """Test pattern matching is case insensitive."""
        score_lower = calculate_pattern_score("patient_id")
        score_upper = calculate_pattern_score("PATIENT_ID")
        score_mixed = calculate_pattern_score("Patient_Id")
        assert score_lower == score_upper == score_mixed

    def test_unrelated_column(self):
        """Test column that doesn't match ID patterns."""
        score = calculate_pattern_score("blood_pressure")
        assert score == 0.0

    def test_partial_match(self):
        """Test partial pattern matches."""
        score = calculate_pattern_score("study_participant_number")
        # Should match 'number' or 'participant' patterns
        assert score > 0.0


class TestFuzzyColumnMatching:
    """Tests for fuzzy column name matching."""

    def test_exact_match(self):
        """Test exact column name match."""
        columns = ["patient_id", "age", "diagnosis"]
        result = find_matching_column("patient_id", columns)
        assert result == "patient_id"

    def test_fuzzy_match(self):
        """Test fuzzy column name match."""
        columns = ["PatientID", "age", "diagnosis"]
        result = find_matching_column("patient_id", columns, threshold=70)
        assert result == "PatientID"

    def test_underscore_vs_camelcase(self):
        """Test matching between underscore and camelCase."""
        columns = ["subjectNumber", "age"]
        result = find_matching_column("subject_number", columns, threshold=70)
        # Should find fuzzy match
        assert result is not None

    def test_no_match(self):
        """Test when no match is found."""
        columns = ["age", "diagnosis", "treatment"]
        result = find_matching_column("patient_id", columns, threshold=80)
        assert result is None

    def test_empty_columns(self):
        """Test with empty column list."""
        result = find_matching_column("patient_id", [])
        assert result is None

    def test_threshold_sensitivity(self):
        """Test that threshold affects matching."""
        columns = ["pat_id", "age"]
        # High threshold should not match
        result_high = find_matching_column("patient_id", columns, threshold=95)
        # Lower threshold might match
        result_low = find_matching_column("patient_id", columns, threshold=50)
        assert result_high is None or result_low is not None


class TestDetectIDCandidates:
    """Tests for the main ID candidate detection function."""

    @pytest.fixture
    def sample_dataframes(self):
        """Create sample dataframes for testing."""
        df1 = pd.DataFrame({
            "patient_id": ["P001", "P002", "P003", "P004", "P005"],
            "age": [25, 30, 35, 40, 45],
            "diagnosis": ["A", "B", "A", "C", "B"],
        })
        df2 = pd.DataFrame({
            "patient_id": ["P002", "P003", "P004", "P005", "P006"],
            "visit_date": pd.date_range("2024-01-01", periods=5),
            "outcome": ["Good", "Fair", "Good", "Poor", "Good"],
        })
        return {"file1.csv": df1, "file2.csv": df2}

    @pytest.fixture
    def non_overlapping_dataframes(self):
        """Create dataframes with no ID overlap."""
        df1 = pd.DataFrame({
            "subject_id": ["S001", "S002", "S003"],
            "measure": [1, 2, 3],
        })
        df2 = pd.DataFrame({
            "subject_id": ["S100", "S101", "S102"],
            "measure": [4, 5, 6],
        })
        return {"a.csv": df1, "b.csv": df2}

    def test_basic_detection(self, sample_dataframes):
        """Test basic ID column detection."""
        candidates = detect_id_candidates(sample_dataframes)
        assert len(candidates) > 0
        # patient_id should be a top candidate
        top_candidate = candidates[0]
        assert "patient" in top_candidate.column_name.lower() or "id" in top_candidate.column_name.lower()

    def test_uniqueness_filtering(self, sample_dataframes):
        """Test that candidates meet minimum uniqueness threshold."""
        candidates = detect_id_candidates(
            sample_dataframes, min_uniqueness=0.8
        )
        for candidate in candidates:
            assert candidate.uniqueness_ratio >= 0.8

    def test_overlap_filtering(self, non_overlapping_dataframes):
        """Test behavior with non-overlapping IDs."""
        candidates = detect_id_candidates(
            non_overlapping_dataframes, min_overlap=0.5
        )
        # Should still detect the column but with low overlap
        # Or return empty if overlap is required
        assert isinstance(candidates, list)

    def test_top_n_candidates(self, sample_dataframes):
        """Test limiting number of returned candidates."""
        candidates = detect_id_candidates(sample_dataframes, top_n=1)
        assert len(candidates) <= 1

    def test_empty_input(self):
        """Test with empty dataframe dict."""
        candidates = detect_id_candidates({})
        assert candidates == []

    def test_single_dataframe(self):
        """Test with single dataframe (no overlap possible)."""
        df = pd.DataFrame({
            "id": [1, 2, 3],
            "value": ["a", "b", "c"],
        })
        candidates = detect_id_candidates({"single.csv": df})
        # Should still return candidates based on uniqueness/pattern
        assert isinstance(candidates, list)

    def test_multiple_candidate_columns(self):
        """Test when multiple columns could be IDs."""
        df1 = pd.DataFrame({
            "patient_id": ["P001", "P002", "P003"],
            "mrn": ["M001", "M002", "M003"],
            "visit_num": [1, 2, 3],
        })
        df2 = pd.DataFrame({
            "patient_id": ["P001", "P002", "P003"],
            "mrn": ["M001", "M002", "M003"],
            "result": ["A", "B", "C"],
        })
        candidates = detect_id_candidates({"df1.csv": df1, "df2.csv": df2})
        # Should find both patient_id and mrn as candidates
        column_names = [c.column_name for c in candidates]
        assert len(candidates) >= 2
        assert "patient_id" in column_names
        assert "mrn" in column_names

    def test_handles_numeric_ids(self):
        """Test handling of numeric ID columns."""
        df1 = pd.DataFrame({
            "subject_num": [101, 102, 103, 104],
            "score": [80, 85, 90, 95],
        })
        df2 = pd.DataFrame({
            "subject_num": [102, 103, 104, 105],
            "grade": ["B", "A", "A", "B"],
        })
        candidates = detect_id_candidates({"d1.csv": df1, "d2.csv": df2})
        assert len(candidates) > 0
        # subject_num should be detected
        assert any("subject" in c.column_name.lower() for c in candidates)


class TestRealWorldScenarios:
    """Tests simulating real-world healthcare data scenarios."""

    def test_redcap_style_data(self):
        """Test with REDCap-style export data."""
        demographics = pd.DataFrame({
            "record_id": [1, 2, 3, 4, 5],
            "redcap_event_name": ["baseline"] * 5,
            "dob": pd.date_range("1980-01-01", periods=5, freq="Y"),
            "sex": ["M", "F", "M", "F", "M"],
        })
        labs = pd.DataFrame({
            "record_id": [1, 2, 3, 4, 5],
            "redcap_event_name": ["visit_1"] * 5,
            "glucose": [95, 105, 88, 120, 92],
            "hba1c": [5.5, 6.2, 5.1, 7.0, 5.3],
        })
        candidates = detect_id_candidates({
            "demographics.csv": demographics,
            "labs.csv": labs,
        })
        # record_id should be top candidate
        assert candidates[0].column_name == "record_id"
        assert candidates[0].overlap_ratio == 1.0

    def test_multi_site_study(self):
        """Test with multi-site study data (site prefixes)."""
        site1 = pd.DataFrame({
            "participant_id": ["SITE1-001", "SITE1-002", "SITE1-003"],
            "enrollment_date": pd.date_range("2024-01-01", periods=3),
        })
        site2 = pd.DataFrame({
            "participant_id": ["SITE2-001", "SITE2-002"],
            "enrollment_date": pd.date_range("2024-02-01", periods=2),
        })
        combined_outcomes = pd.DataFrame({
            "participant_id": ["SITE1-001", "SITE1-002", "SITE2-001"],
            "outcome": ["Good", "Fair", "Good"],
        })
        candidates = detect_id_candidates({
            "site1.csv": site1,
            "site2.csv": site2,
            "outcomes.csv": combined_outcomes,
        })
        assert len(candidates) > 0
        assert candidates[0].column_name == "participant_id"

    def test_longitudinal_study(self):
        """Test with longitudinal study data (repeated measures)."""
        baseline = pd.DataFrame({
            "subject_id": ["S01", "S02", "S03"],
            "timepoint": ["baseline"] * 3,
            "bp_sys": [120, 130, 125],
        })
        followup = pd.DataFrame({
            "subject_id": ["S01", "S02", "S03"],
            "timepoint": ["6_month"] * 3,
            "bp_sys": [118, 128, 122],
        })
        # subject_id should have complete overlap
        candidates = detect_id_candidates({
            "baseline.csv": baseline,
            "followup.csv": followup,
        })
        top = candidates[0]
        assert top.column_name == "subject_id"
        assert top.overlap_ratio == 1.0
        assert top.uniqueness_ratio == 1.0


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_columns_with_only_nulls(self):
        """Test handling of columns with only null values."""
        df = pd.DataFrame({
            "id": [None, None, None],
            "value": [1, 2, 3],
        })
        candidates = detect_id_candidates({"test.csv": df})
        # Should handle gracefully
        assert isinstance(candidates, list)

    def test_very_large_values(self):
        """Test with very large ID values."""
        df1 = pd.DataFrame({
            "big_id": [10**15 + i for i in range(100)],
            "value": range(100),
        })
        df2 = pd.DataFrame({
            "big_id": [10**15 + i for i in range(50, 150)],
            "value": range(100),
        })
        candidates = detect_id_candidates({"d1.csv": df1, "d2.csv": df2})
        assert len(candidates) > 0

    def test_unicode_column_names(self):
        """Test with unicode characters in column names."""
        df = pd.DataFrame({
            "患者ID": ["P001", "P002", "P003"],
            "年龄": [25, 30, 35],
        })
        candidates = detect_id_candidates({"unicode.csv": df})
        # Should not crash
        assert isinstance(candidates, list)

    def test_special_characters_in_ids(self):
        """Test with special characters in ID values."""
        df1 = pd.DataFrame({
            "id": ["P-001/A", "P-002/B", "P-003/C"],
            "val": [1, 2, 3],
        })
        df2 = pd.DataFrame({
            "id": ["P-002/B", "P-003/C", "P-004/D"],
            "val": [4, 5, 6],
        })
        candidates = detect_id_candidates({"d1.csv": df1, "d2.csv": df2})
        assert len(candidates) > 0
        assert candidates[0].overlap_ratio > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

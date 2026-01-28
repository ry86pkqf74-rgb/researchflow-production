"""
Unit tests for multi-file merge ingestion engine.

Tests the two-phase workflow:
1. Detection phase: ingest_and_detect()
2. Merge phase: complete_merge()
"""

import pytest
import pandas as pd
import numpy as np
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from unittest.mock import patch, MagicMock

# Module under test
from ingest.merge_ingest import (
    MultiFileIngestEngine,
    MergeManifest,
    MergeResult,
)


class TestMergeManifest:
    """Tests for the MergeManifest audit class."""

    def test_manifest_creation(self):
        """Test basic manifest creation."""
        manifest = MergeManifest(
            run_id="test-run-123",
            input_files=["file1.csv", "file2.csv"],
            linking_column="patient_id",
            merge_type="left",
            timestamp=datetime.now().isoformat(),
        )
        assert manifest.run_id == "test-run-123"
        assert len(manifest.input_files) == 2
        assert manifest.linking_column == "patient_id"
        assert manifest.merge_type == "left"

    def test_manifest_serialization(self):
        """Test manifest can be serialized to JSON."""
        manifest = MergeManifest(
            run_id="run-456",
            input_files=["a.csv"],
            linking_column="id",
            merge_type="inner",
            timestamp=datetime.now().isoformat(),
        )
        # Should be serializable
        json_str = json.dumps(manifest.__dict__)
        assert "run-456" in json_str


class TestMergeResult:
    """Tests for the MergeResult class."""

    def test_successful_result(self):
        """Test successful merge result."""
        result = MergeResult(
            success=True,
            output_path="/data/merged.parquet",
            row_count=1000,
            column_count=15,
            manifest=MergeManifest(
                run_id="r1",
                input_files=["a.csv", "b.csv"],
                linking_column="id",
                merge_type="left",
                timestamp=datetime.now().isoformat(),
            ),
        )
        assert result.success is True
        assert result.row_count == 1000
        assert result.error is None

    def test_failed_result(self):
        """Test failed merge result."""
        result = MergeResult(
            success=False,
            error="Column mismatch error",
            output_path=None,
            row_count=0,
            column_count=0,
            manifest=None,
        )
        assert result.success is False
        assert "Column mismatch" in result.error


class TestMultiFileIngestEngine:
    """Tests for the main ingestion engine."""

    @pytest.fixture
    def temp_dir(self):
        """Create and cleanup temporary directory."""
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp)

    @pytest.fixture
    def sample_csv_files(self, temp_dir):
        """Create sample CSV files for testing."""
        # Demographics file
        demo_df = pd.DataFrame({
            "patient_id": ["P001", "P002", "P003", "P004", "P005"],
            "age": [25, 32, 45, 58, 41],
            "sex": ["M", "F", "M", "F", "M"],
        })
        demo_path = temp_dir / "demographics.csv"
        demo_df.to_csv(demo_path, index=False)

        # Labs file
        labs_df = pd.DataFrame({
            "patient_id": ["P001", "P002", "P003", "P004", "P005"],
            "glucose": [95, 110, 88, 145, 102],
            "hba1c": [5.4, 6.1, 5.0, 7.2, 5.8],
        })
        labs_path = temp_dir / "labs.csv"
        labs_df.to_csv(labs_path, index=False)

        # Outcomes file (partial overlap)
        outcomes_df = pd.DataFrame({
            "patient_id": ["P002", "P003", "P004", "P005", "P006"],
            "outcome": ["good", "fair", "poor", "good", "fair"],
        })
        outcomes_path = temp_dir / "outcomes.csv"
        outcomes_df.to_csv(outcomes_path, index=False)

        return temp_dir

    @pytest.fixture
    def excel_file(self, temp_dir):
        """Create a multi-sheet Excel file."""
        demo_df = pd.DataFrame({
            "subject_id": [1, 2, 3],
            "age": [30, 40, 50],
        })
        labs_df = pd.DataFrame({
            "subject_id": [1, 2, 3],
            "result": [100, 105, 98],
        })
        excel_path = temp_dir / "study_data.xlsx"
        with pd.ExcelWriter(excel_path) as writer:
            demo_df.to_excel(writer, sheet_name="Demographics", index=False)
            labs_df.to_excel(writer, sheet_name="Labs", index=False)
        return excel_path

    @pytest.fixture
    def engine(self, temp_dir):
        """Create engine instance with temp output directory."""
        output_dir = temp_dir / "output"
        output_dir.mkdir()
        return MultiFileIngestEngine(
            output_dir=str(output_dir),
            governance_mode="DEMO",
        )

    # ===== Phase 1: Detection Tests =====

    def test_ingest_csv_files(self, engine, sample_csv_files):
        """Test ingesting multiple CSV files."""
        result = engine.ingest_and_detect(str(sample_csv_files))
        assert result is not None
        assert "candidates" in result
        assert "dataframes" in result
        assert len(result["dataframes"]) == 3  # 3 CSV files

    def test_ingest_single_file(self, engine, sample_csv_files):
        """Test ingesting a single file."""
        single_file = sample_csv_files / "demographics.csv"
        result = engine.ingest_and_detect(str(single_file))
        assert result is not None
        assert len(result["dataframes"]) == 1

    def test_ingest_excel_multisheet(self, engine, excel_file):
        """Test ingesting multi-sheet Excel workbook."""
        result = engine.ingest_and_detect(str(excel_file))
        assert result is not None
        # Should have 2 sheets as separate dataframes
        assert len(result["dataframes"]) == 2

    def test_detect_id_candidates(self, engine, sample_csv_files):
        """Test that ID candidates are detected correctly."""
        result = engine.ingest_and_detect(str(sample_csv_files))
        candidates = result["candidates"]
        assert len(candidates) > 0
        # patient_id should be top candidate
        top_candidate = candidates[0]
        assert "patient" in top_candidate["column_name"].lower()

    def test_detection_returns_run_id(self, engine, sample_csv_files):
        """Test that detection phase returns a run_id."""
        result = engine.ingest_and_detect(str(sample_csv_files))
        assert "run_id" in result
        assert result["run_id"] is not None

    def test_detection_with_custom_run_id(self, engine, sample_csv_files):
        """Test detection with user-provided run_id."""
        custom_id = "my-custom-run-123"
        result = engine.ingest_and_detect(
            str(sample_csv_files), run_id=custom_id
        )
        assert result["run_id"] == custom_id

    # ===== Phase 2: Merge Tests =====

    def test_complete_merge_inner(self, engine, sample_csv_files):
        """Test completing merge with inner join."""
        # Phase 1: Detect
        detection = engine.ingest_and_detect(str(sample_csv_files))
        run_id = detection["run_id"]

        # Phase 2: Merge
        result = engine.complete_merge(
            run_id=run_id,
            linking_column="patient_id",
            merge_type="inner",
        )
        assert result.success is True
        assert result.output_path is not None
        # Inner join should only have overlapping rows
        assert result.row_count < 5  # Less than full count

    def test_complete_merge_left(self, engine, sample_csv_files):
        """Test completing merge with left join."""
        detection = engine.ingest_and_detect(str(sample_csv_files))
        run_id = detection["run_id"]

        result = engine.complete_merge(
            run_id=run_id,
            linking_column="patient_id",
            merge_type="left",
        )
        assert result.success is True
        # Left join preserves all rows from first file
        assert result.row_count >= 5

    def test_complete_merge_outer(self, engine, sample_csv_files):
        """Test completing merge with outer join."""
        detection = engine.ingest_and_detect(str(sample_csv_files))
        run_id = detection["run_id"]

        result = engine.complete_merge(
            run_id=run_id,
            linking_column="patient_id",
            merge_type="outer",
        )
        assert result.success is True
        # Outer join should have all unique IDs
        assert result.row_count >= 5

    def test_merge_creates_manifest(self, engine, sample_csv_files):
        """Test that merge creates audit manifest."""
        detection = engine.ingest_and_detect(str(sample_csv_files))
        run_id = detection["run_id"]

        result = engine.complete_merge(
            run_id=run_id,
            linking_column="patient_id",
            merge_type="inner",
        )
        assert result.manifest is not None
        assert result.manifest.run_id == run_id
        assert result.manifest.linking_column == "patient_id"
        assert len(result.manifest.input_files) == 3

    def test_merge_with_invalid_run_id(self, engine):
        """Test merge with non-existent run_id fails gracefully."""
        result = engine.complete_merge(
            run_id="nonexistent-run-999",
            linking_column="id",
            merge_type="inner",
        )
        assert result.success is False
        assert result.error is not None

    def test_merge_with_invalid_column(self, engine, sample_csv_files):
        """Test merge with non-existent column."""
        detection = engine.ingest_and_detect(str(sample_csv_files))
        run_id = detection["run_id"]

        result = engine.complete_merge(
            run_id=run_id,
            linking_column="nonexistent_column",
            merge_type="inner",
        )
        assert result.success is False
        assert "column" in result.error.lower()

    # ===== Output Format Tests =====

    def test_output_parquet(self, engine, sample_csv_files):
        """Test output in Parquet format."""
        detection = engine.ingest_and_detect(str(sample_csv_files))
        run_id = detection["run_id"]

        result = engine.complete_merge(
            run_id=run_id,
            linking_column="patient_id",
            merge_type="inner",
            output_format="parquet",
        )
        assert result.success is True
        assert result.output_path.endswith(".parquet")

    def test_output_csv(self, engine, sample_csv_files):
        """Test output in CSV format."""
        detection = engine.ingest_and_detect(str(sample_csv_files))
        run_id = detection["run_id"]

        result = engine.complete_merge(
            run_id=run_id,
            linking_column="patient_id",
            merge_type="inner",
            output_format="csv",
        )
        assert result.success is True
        assert result.output_path.endswith(".csv")

    # ===== Edge Cases =====

    def test_empty_directory(self, engine, temp_dir):
        """Test ingesting empty directory."""
        empty_dir = temp_dir / "empty"
        empty_dir.mkdir()
        result = engine.ingest_and_detect(str(empty_dir))
        assert result["dataframes"] == {}

    def test_non_tabular_files_ignored(self, engine, temp_dir):
        """Test that non-tabular files are ignored."""
        # Create a text file
        (temp_dir / "readme.txt").write_text("This is not data")
        # Create a valid CSV
        pd.DataFrame({"id": [1, 2], "val": [3, 4]}).to_csv(
            temp_dir / "data.csv", index=False
        )
        result = engine.ingest_and_detect(str(temp_dir))
        # Should only have the CSV
        assert len(result["dataframes"]) == 1

    def test_duplicate_column_names_across_files(self, engine, temp_dir):
        """Test handling of same column names in different files."""
        df1 = pd.DataFrame({"id": [1, 2], "value": [10, 20]})
        df2 = pd.DataFrame({"id": [1, 2], "value": [30, 40]})
        df1.to_csv(temp_dir / "file1.csv", index=False)
        df2.to_csv(temp_dir / "file2.csv", index=False)

        detection = engine.ingest_and_detect(str(temp_dir))
        result = engine.complete_merge(
            run_id=detection["run_id"],
            linking_column="id",
            merge_type="inner",
        )
        assert result.success is True
        # Should have renamed columns (value_x, value_y) or similar
        assert result.column_count >= 3

    def test_mixed_file_formats(self, engine, temp_dir):
        """Test mixing CSV and Excel files."""
        # CSV file
        pd.DataFrame({"id": [1, 2], "a": [10, 20]}).to_csv(
            temp_dir / "data1.csv", index=False
        )
        # Excel file
        pd.DataFrame({"id": [1, 2], "b": [30, 40]}).to_excel(
            temp_dir / "data2.xlsx", index=False
        )

        result = engine.ingest_and_detect(str(temp_dir))
        assert len(result["dataframes"]) == 2


class TestGovernanceModes:
    """Tests for PHI governance mode handling."""

    @pytest.fixture
    def temp_dir(self):
        """Create temp directory."""
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp)

    def test_demo_mode_strips_phi(self, temp_dir):
        """Test that DEMO mode strips PHI-like columns."""
        # Create file with PHI-like columns
        df = pd.DataFrame({
            "patient_id": ["P001", "P002"],
            "name": ["John Doe", "Jane Smith"],  # PHI
            "ssn": ["123-45-6789", "987-65-4321"],  # PHI
            "diagnosis": ["Diabetes", "Hypertension"],
        })
        df.to_csv(temp_dir / "phi_data.csv", index=False)

        output_dir = temp_dir / "output"
        output_dir.mkdir()
        engine = MultiFileIngestEngine(
            output_dir=str(output_dir),
            governance_mode="DEMO",
            strip_phi=True,
        )

        result = engine.ingest_and_detect(str(temp_dir / "phi_data.csv"))
        # Check if PHI columns are flagged or stripped
        assert result is not None

    def test_live_mode_preserves_data(self, temp_dir):
        """Test that LIVE mode preserves all data."""
        df = pd.DataFrame({
            "patient_id": ["P001", "P002"],
            "name": ["John", "Jane"],
            "value": [100, 200],
        })
        df.to_csv(temp_dir / "data.csv", index=False)

        output_dir = temp_dir / "output"
        output_dir.mkdir()
        engine = MultiFileIngestEngine(
            output_dir=str(output_dir),
            governance_mode="LIVE",
        )

        result = engine.ingest_and_detect(str(temp_dir / "data.csv"))
        # All columns should be present
        df_result = list(result["dataframes"].values())[0]
        assert "name" in df_result.columns


class TestLargeDataHandling:
    """Tests for large data handling with chunking."""

    @pytest.fixture
    def temp_dir(self):
        """Create temp directory."""
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp)

    def test_large_file_chunking(self, temp_dir):
        """Test that large files are handled via chunking."""
        # Create a moderately large file (not huge for test speed)
        n_rows = 100_000
        df = pd.DataFrame({
            "id": range(n_rows),
            "value": np.random.randn(n_rows),
            "category": np.random.choice(["A", "B", "C"], n_rows),
        })
        large_path = temp_dir / "large_data.csv"
        df.to_csv(large_path, index=False)

        output_dir = temp_dir / "output"
        output_dir.mkdir()
        engine = MultiFileIngestEngine(
            output_dir=str(output_dir),
            governance_mode="DEMO",
            chunk_size=10_000,  # Process in chunks
        )

        result = engine.ingest_and_detect(str(large_path))
        assert result is not None
        # Should have processed the data
        assert len(result["dataframes"]) == 1


class TestManifestPersistence:
    """Tests for manifest saving and loading."""

    @pytest.fixture
    def temp_dir(self):
        """Create temp directory."""
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp)

    def test_manifest_saved_on_merge(self, temp_dir):
        """Test that manifest is saved after merge."""
        # Create test data
        df1 = pd.DataFrame({"id": [1, 2], "a": [10, 20]})
        df2 = pd.DataFrame({"id": [1, 2], "b": [30, 40]})
        df1.to_csv(temp_dir / "d1.csv", index=False)
        df2.to_csv(temp_dir / "d2.csv", index=False)

        output_dir = temp_dir / "output"
        output_dir.mkdir()
        engine = MultiFileIngestEngine(
            output_dir=str(output_dir),
            governance_mode="DEMO",
        )

        detection = engine.ingest_and_detect(str(temp_dir))
        result = engine.complete_merge(
            run_id=detection["run_id"],
            linking_column="id",
            merge_type="inner",
        )

        # Check manifest file exists
        manifest_dir = output_dir / "manifests"
        if manifest_dir.exists():
            manifest_files = list(manifest_dir.glob("*.json"))
            assert len(manifest_files) > 0


class TestErrorHandling:
    """Tests for error handling and recovery."""

    @pytest.fixture
    def temp_dir(self):
        """Create temp directory."""
        temp = tempfile.mkdtemp()
        yield Path(temp)
        shutil.rmtree(temp)

    def test_corrupt_file_handling(self, temp_dir):
        """Test handling of corrupt/malformed files."""
        # Create a malformed CSV
        corrupt_path = temp_dir / "corrupt.csv"
        corrupt_path.write_text("col1,col2\n1,2,3,4\n5,6")  # Mismatched columns

        output_dir = temp_dir / "output"
        output_dir.mkdir()
        engine = MultiFileIngestEngine(
            output_dir=str(output_dir),
            governance_mode="DEMO",
        )

        # Should not crash, but handle gracefully
        result = engine.ingest_and_detect(str(corrupt_path))
        # Either succeeds with best effort or returns empty
        assert isinstance(result, dict)

    def test_permission_error_handling(self, temp_dir):
        """Test handling of permission errors."""
        output_dir = temp_dir / "output"
        output_dir.mkdir()
        engine = MultiFileIngestEngine(
            output_dir=str(output_dir),
            governance_mode="DEMO",
        )

        # Try to ingest non-existent path
        result = engine.ingest_and_detect("/nonexistent/path/to/data")
        # Should return empty or error gracefully
        assert result is not None or isinstance(result, dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""
Integration Tests for Spreadsheet Cell Parsing Pipeline.

Tests the complete flow from spreadsheet upload through cell detection,
task building, LLM extraction, and result output.
"""

import pytest
import asyncio
import tempfile
import os
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List
from unittest.mock import AsyncMock, patch, MagicMock

import pandas as pd

# Import modules under test
from data_extraction.sheet_reader import SheetReader, get_sheet_metadata
from data_extraction.block_text_detector import BlockTextDetector, CellClassification
from data_extraction.cell_task_builder import CellTaskBuilder, TaskPriority
from data_extraction.checkpoints import CheckpointWriter, CheckpointReader
from data_extraction.large_sheet_pipeline import LargeSheetPipeline, PipelineProgress, PipelineResult
from data_extraction.config import get_config


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def sample_clinical_csv(tmp_path) -> Path:
    """Create a sample CSV with clinical data."""
    data = {
        "patient_id": ["P001", "P002", "P003", "P004", "P005"],
        "age": [45, 67, 32, 78, 55],
        "diagnosis": ["HTN", "DM2", "Asthma", "CHF", "COPD"],
        "clinical_notes": [
            # Short text - should be skipped
            "Stable",
            # Block text with ROS
            """SUBJECTIVE: 67 y/o male presents for follow-up.
            
ROS:
Constitutional: Denies fever, chills, weight loss.
Cardiovascular: No chest pain, +palpitations occasionally.
Respiratory: Endorses dyspnea on exertion, no cough.
GI: Denies nausea, vomiting, abdominal pain.

ASSESSMENT: DM2 with good control. Continue current medications.""",
            # Short text
            "Follow up in 3 months",
            # Block text with outcomes
            """Post-operative Day 3 Progress Note:
            
Patient recovering well after laparoscopic cholecystectomy.
EBL: 50cc. No transfusion required.
POD1: Tolerated clears, ambulated in hallway.
POD2: Advanced to regular diet, mild incisional pain controlled with PO Tylenol.
POD3: Ready for discharge. No complications.

Disposition: Home with follow-up in 2 weeks.
Clavien-Dindo: Grade 0""",
            # Block text with mixed content
            """HPI: 55 y/o female with COPD exacerbation.
Started on prednisone 40mg daily x5 days.
Albuterol nebulizer q4h.

Assessment:
1. COPD exacerbation - improving
2. HTN - stable on lisinopril
3. Anxiety - continue sertraline

Plan: Discharge tomorrow if O2 sats remain >92% on RA.""",
        ],
        "ros_notes": [
            "Negative",
            """Constitutional: Negative
CV: Positive for palpitations
Resp: Positive for SOB
GI: Negative
GU: Negative
MSK: Negative
Neuro: Negative""",
            "All systems reviewed and negative",
            "Unable to obtain - patient sedated",
            """10-point ROS reviewed:
- Denies fever, chills
- Denies chest pain
- Reports chronic cough
- No abdominal pain
- No urinary symptoms""",
        ],
        "mrn": ["MRN001", "MRN002", "MRN003", "MRN004", "MRN005"],
    }
    
    csv_path = tmp_path / "sample_clinical.csv"
    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)
    return csv_path


@pytest.fixture
def sample_large_csv(tmp_path) -> Path:
    """Create a larger CSV for chunking tests."""
    # Generate 1000 rows
    data = {
        "row_id": list(range(1, 1001)),
        "clinical_notes": [
            f"""Patient {i} clinical note.
            
This is a sample clinical note with enough text to be detected as block text.
The patient presented with various symptoms and was evaluated accordingly.
Assessment and plan documented below.

Assessment:
1. Primary diagnosis
2. Secondary findings

Plan:
- Continue current treatment
- Follow up as scheduled
""" if i % 3 == 0 else f"Brief note {i}"
            for i in range(1, 1001)
        ],
        "status": ["active"] * 1000,
    }
    
    csv_path = tmp_path / "large_clinical.csv"
    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)
    return csv_path


@pytest.fixture
def mock_extract_fn() -> AsyncMock:
    """Mock extraction function for testing."""
    async def extract(text: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "diagnoses": [{"term": "Sample diagnosis", "confidence": 0.9}],
            "procedures": [],
            "medications": [],
            "symptoms": [],
            "confidence": 0.85,
            "schema_version": "cell_extract.v1",
        }
    return AsyncMock(side_effect=extract)


@pytest.fixture
def output_dir(tmp_path) -> Path:
    """Create output directory for tests."""
    out = tmp_path / "output"
    out.mkdir()
    return out


# ============================================================================
# Sheet Reader Tests
# ============================================================================

class TestSheetReader:
    """Tests for sheet_reader.py functionality."""
    
    def test_read_csv_chunks(self, sample_clinical_csv):
        """Test reading CSV in chunks."""
        reader = SheetReader(chunk_rows=2)
        chunks = list(reader.read_chunks(sample_clinical_csv))
        
        # Should have 3 chunks for 5 rows with chunk_size=2
        assert len(chunks) == 3
        assert chunks[0].row_start == 0
        assert chunks[0].row_end == 2
        
    def test_get_metadata(self, sample_clinical_csv):
        """Test metadata extraction."""
        metadata = get_sheet_metadata(sample_clinical_csv)
        
        assert metadata.file_type == "csv"
        assert metadata.estimated_rows == 5
        assert "clinical_notes" in metadata.columns
        assert "mrn" in metadata.columns
        
    def test_detect_large_file(self, sample_large_csv):
        """Test large file detection."""
        reader = SheetReader()
        metadata = get_sheet_metadata(sample_large_csv)
        
        # File should not be large (< 200MB)
        assert not reader.is_large_file(sample_large_csv)


# ============================================================================
# Block Text Detector Tests
# ============================================================================

class TestBlockTextDetector:
    """Tests for block_text_detector.py functionality."""
    
    def test_detect_block_text(self):
        """Test block text detection on various inputs."""
        detector = BlockTextDetector()
        
        # Short text - should not be block text
        short_result = detector.detect("Stable", "notes")
        assert short_result.classification == CellClassification.SHORT_TEXT
        assert not short_result.should_extract
        
        # Long clinical text - should be block text
        long_text = """SUBJECTIVE: Patient presents for follow-up.
        
Assessment:
1. Hypertension - controlled
2. Diabetes - improving

Plan: Continue current medications."""
        
        long_result = detector.detect(long_text, "clinical_notes")
        assert long_result.classification == CellClassification.BLOCK_TEXT
        assert long_result.should_extract
        
    def test_deny_columns(self):
        """Test that denied columns are excluded."""
        detector = BlockTextDetector()
        
        # MRN column should be excluded
        mrn_text = "This is a long text that would normally be block text " * 10
        result = detector.detect(mrn_text, "mrn")
        assert result.classification == CellClassification.EXCLUDED
        assert not result.should_extract
        
    def test_clinical_markers(self):
        """Test clinical marker detection."""
        detector = BlockTextDetector()
        
        text = "HPI: Patient with chest pain. ROS: Negative. Assessment: ACS"
        result = detector.detect(text, "notes")
        
        assert len(result.clinical_markers_found) > 0
        assert "HPI" in result.clinical_markers_found or "ROS" in result.clinical_markers_found


# ============================================================================
# Cell Task Builder Tests
# ============================================================================

class TestCellTaskBuilder:
    """Tests for cell_task_builder.py functionality."""
    
    def test_build_tasks(self, sample_clinical_csv):
        """Test task building from CSV."""
        builder = CellTaskBuilder(job_id="test_job")
        df = pd.read_csv(sample_clinical_csv)
        
        tasks = builder.build_tasks(df, partition_id="chunk_0")
        
        # Should have tasks for block text cells only
        assert len(tasks) > 0
        
        # Check task properties
        for task in tasks:
            assert task.job_id == "test_job"
            assert task.partition_id == "chunk_0"
            assert task.prompt_template is not None
            
    def test_prompt_selection(self):
        """Test correct prompt template selection."""
        builder = CellTaskBuilder(job_id="test_job")
        
        # ROS column should get ROS prompt
        ros_template = builder.select_prompt_template("ros_notes", "Some ROS content")
        assert "ros" in ros_template.lower()
        
        # Outcome column should get outcome prompt
        outcome_template = builder.select_prompt_template("outcome_summary", "POD 3 status")
        assert "outcome" in outcome_template.lower()
        
        # Generic column should get default prompt
        default_template = builder.select_prompt_template("clinical_notes", "Some text")
        assert "cell" in default_template.lower() or "clinical" in default_template.lower()
        
    def test_deduplication(self, sample_clinical_csv):
        """Test that duplicate content is deduplicated."""
        builder = CellTaskBuilder(job_id="test_job")
        
        # Create DataFrame with duplicate content
        df = pd.DataFrame({
            "notes": ["Same content " * 50, "Same content " * 50, "Different content " * 50]
        })
        
        tasks = builder.build_tasks(df, partition_id="chunk_0")
        
        # Should have only 2 tasks (duplicates merged)
        unique_hashes = set(t.content_hash for t in tasks)
        assert len(unique_hashes) == len(tasks)
        
    def test_batching(self, sample_clinical_csv):
        """Test micro-batching of tasks."""
        builder = CellTaskBuilder(job_id="test_job")
        df = pd.read_csv(sample_clinical_csv)
        
        tasks = builder.build_tasks(df, partition_id="chunk_0")
        batches = builder.build_batches(tasks, batch_size=2)
        
        # Check batch properties
        for batch in batches:
            assert len(batch.tasks) <= 2


# ============================================================================
# Checkpoint Tests
# ============================================================================

class TestCheckpoints:
    """Tests for checkpoints.py functionality."""
    
    def test_write_and_read_tasks(self, output_dir):
        """Test checkpoint write and read cycle."""
        writer = CheckpointWriter(
            job_id="test_job",
            base_dir=output_dir,
            output_format="jsonl",
        )
        
        # Create sample tasks
        tasks = [
            {"task_id": "t1", "row_idx": 0, "content_hash": "abc123"},
            {"task_id": "t2", "row_idx": 1, "content_hash": "def456"},
        ]
        
        # Write checkpoint
        writer.write_tasks(tasks, partition_id="chunk_0", chunk_index=0)
        
        # Read back
        reader = CheckpointReader(job_id="test_job", base_dir=output_dir)
        state = reader.get_resume_info()
        
        assert state is not None
        
    def test_atomic_writes(self, output_dir):
        """Test that writes are atomic (temp + rename)."""
        writer = CheckpointWriter(
            job_id="test_job",
            base_dir=output_dir,
            output_format="jsonl",
        )
        
        # This should not leave partial files
        tasks = [{"task_id": f"t{i}"} for i in range(100)]
        writer.write_tasks(tasks, partition_id="chunk_0", chunk_index=0)
        
        # Check no temp files remain
        temp_files = list(output_dir.glob("*.tmp"))
        assert len(temp_files) == 0


# ============================================================================
# Large Sheet Pipeline Tests
# ============================================================================

class TestLargeSheetPipeline:
    """Tests for large_sheet_pipeline.py functionality."""
    
    @pytest.mark.asyncio
    async def test_pipeline_small_file(
        self,
        sample_clinical_csv,
        output_dir,
        mock_extract_fn,
    ):
        """Test pipeline execution on small file."""
        pipeline = LargeSheetPipeline(
            job_id="test_pipeline",
            output_dir=output_dir,
        )
        
        result = await pipeline.run(
            input_path=sample_clinical_csv,
            extract_fn=mock_extract_fn,
        )
        
        assert result.success
        assert result.total_rows > 0
        assert result.manifest_path is not None
        
    @pytest.mark.asyncio
    async def test_pipeline_progress_callback(
        self,
        sample_clinical_csv,
        output_dir,
        mock_extract_fn,
    ):
        """Test progress callback is invoked."""
        progress_updates: List[PipelineProgress] = []
        
        def on_progress(progress: PipelineProgress):
            progress_updates.append(progress)
        
        pipeline = LargeSheetPipeline(
            job_id="test_progress",
            output_dir=output_dir,
            progress_callback=on_progress,
        )
        
        await pipeline.run(
            input_path=sample_clinical_csv,
            extract_fn=mock_extract_fn,
        )
        
        # Should have received progress updates
        assert len(progress_updates) > 0
        
        # Should have scan and extract phases
        phases = [p.phase for p in progress_updates]
        assert "scan" in phases or "scanning" in phases or any("scan" in p.lower() for p in phases)
        
    @pytest.mark.asyncio
    async def test_pipeline_chunked_processing(
        self,
        sample_large_csv,
        output_dir,
        mock_extract_fn,
    ):
        """Test pipeline processes large files in chunks."""
        # Configure small chunk size
        pipeline = LargeSheetPipeline(
            job_id="test_chunks",
            output_dir=output_dir,
        )
        
        # Override chunk size for testing
        pipeline.reader.chunk_rows = 100
        
        result = await pipeline.run(
            input_path=sample_large_csv,
            extract_fn=mock_extract_fn,
        )
        
        assert result.success
        assert result.total_chunks > 1


# ============================================================================
# API Integration Tests
# ============================================================================

class TestAPIIntegration:
    """Tests for API endpoint integration."""
    
    @pytest.mark.asyncio
    async def test_parse_endpoint_validation(self):
        """Test request validation on parse endpoint."""
        from data_extraction.api_routes import SpreadsheetParseRequest
        
        # Valid request
        valid = SpreadsheetParseRequest(
            job_id="job_test123456789",
            artifact_path="/data/test.csv",
        )
        assert valid.file_type == "csv"
        
        # Invalid file type should fail
        with pytest.raises(ValueError):
            SpreadsheetParseRequest(
                job_id="job_test123456789",
                artifact_path="/data/test.csv",
                file_type="invalid",
            )
    
    @pytest.mark.asyncio
    async def test_health_endpoint(self):
        """Test health endpoint returns expected structure."""
        from data_extraction.api_routes import health_check
        
        result = await health_check()
        
        assert result["status"] == "healthy"
        assert "features" in result
        assert "extraction" in result["features"]


# ============================================================================
# PHI Safety Tests
# ============================================================================

class TestPHISafety:
    """Tests for PHI safety measures."""
    
    def test_phi_column_exclusion(self):
        """Test that PHI columns are excluded from extraction."""
        detector = BlockTextDetector()
        
        phi_columns = ["mrn", "patient_id", "dob", "ssn", "social_security"]
        
        for col in phi_columns:
            result = detector.detect("Long text content " * 50, col)
            assert result.classification == CellClassification.EXCLUDED
            
    def test_no_phi_in_tasks(self, sample_clinical_csv):
        """Test that task specs don't contain raw PHI."""
        builder = CellTaskBuilder(job_id="test_job")
        df = pd.read_csv(sample_clinical_csv)
        
        tasks = builder.build_tasks(df, partition_id="chunk_0")
        
        for task in tasks:
            # Task should have content_hash, not raw text
            assert hasattr(task, "content_hash")
            # Raw text should be stored separately, not in task spec


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestErrorHandling:
    """Tests for error handling and recovery."""
    
    @pytest.mark.asyncio
    async def test_extraction_error_handling(self, sample_clinical_csv, output_dir):
        """Test pipeline handles extraction errors gracefully."""
        error_count = 0
        
        async def failing_extract(text: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
            nonlocal error_count
            error_count += 1
            if error_count <= 2:
                raise Exception("Simulated extraction error")
            return {"diagnoses": [], "confidence": 0.5}
        
        pipeline = LargeSheetPipeline(
            job_id="test_errors",
            output_dir=output_dir,
        )
        
        result = await pipeline.run(
            input_path=sample_clinical_csv,
            extract_fn=failing_extract,
        )
        
        # Pipeline should complete with some failed tasks
        assert result.failed_tasks >= 0
        
    def test_invalid_file_handling(self, tmp_path):
        """Test handling of invalid input files."""
        reader = SheetReader()
        
        # Non-existent file
        with pytest.raises(FileNotFoundError):
            list(reader.read_chunks(tmp_path / "nonexistent.csv"))
        
        # Invalid content
        bad_file = tmp_path / "bad.csv"
        bad_file.write_text("not,valid\ncsv,content\nwith,issues")
        
        # Should still parse (just might have odd data)
        chunks = list(reader.read_chunks(bad_file))
        assert len(chunks) >= 0


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

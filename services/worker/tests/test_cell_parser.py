"""
Unit tests for the cell_parser module.

Tests DataFrame-level extraction, PHI scanning, and batch processing.
"""

import pytest
import pandas as pd
from unittest.mock import AsyncMock, patch, MagicMock
import sys

# Add src to path
sys.path.insert(0, '../src')

from data_extraction.cell_parser import (
    detect_narrative_columns,
    identify_extraction_targets,
    CellTarget,
    PHIScanner,
    PHIScanResult,
    CellExtractionResult,
    BatchExtractionManifest,
    NARRATIVE_COLUMN_PATTERNS,
    DEFAULT_MIN_TEXT_LENGTH,
)


class TestDetectNarrativeColumns:
    """Test narrative column detection."""
    
    def test_detect_by_column_name(self):
        """Columns with narrative-like names should be detected."""
        df = pd.DataFrame({
            "patient_id": [1, 2, 3],
            "notes": ["Short note", "Another note", "Third note"],
            "age": [25, 30, 35],
        })
        # Even short text should match if column name matches
        cols = detect_narrative_columns(df, min_text_length=5, min_narrative_ratio=0.1)
        assert "notes" in cols
        assert "patient_id" not in cols
        assert "age" not in cols
    
    def test_detect_by_text_length(self):
        """Columns with long text should be detected regardless of name."""
        long_text = "A" * 150  # Over default threshold
        df = pd.DataFrame({
            "custom_field": [long_text, long_text, long_text],
            "short_field": ["a", "b", "c"],
        })
        cols = detect_narrative_columns(df)
        assert "custom_field" in cols
        assert "short_field" not in cols
    
    def test_detect_empty_dataframe(self):
        """Empty DataFrame should return empty list."""
        df = pd.DataFrame()
        cols = detect_narrative_columns(df)
        assert cols == []
    
    def test_detect_numeric_only(self):
        """DataFrame with only numeric columns should return empty list."""
        df = pd.DataFrame({
            "a": [1, 2, 3],
            "b": [4.0, 5.0, 6.0],
        })
        cols = detect_narrative_columns(df)
        assert cols == []
    
    def test_narrative_patterns_coverage(self):
        """All expected patterns should be in the pattern list."""
        expected = ["note", "comment", "description", "history", "findings"]
        for pattern in expected:
            assert pattern in NARRATIVE_COLUMN_PATTERNS


class TestIdentifyExtractionTargets:
    """Test extraction target identification."""
    
    def test_identify_long_text_cells(self):
        """Cells with text over threshold should be identified."""
        long_text = "A" * 150
        short_text = "B" * 50
        df = pd.DataFrame({
            "notes": [long_text, short_text, long_text],
        })
        targets = identify_extraction_targets(df, columns=["notes"])
        assert len(targets) == 2  # Only the two long text cells
        assert all(isinstance(t, CellTarget) for t in targets)
        assert targets[0].row_idx == 0
        assert targets[1].row_idx == 2
    
    def test_identify_with_custom_threshold(self):
        """Custom threshold should be respected."""
        df = pd.DataFrame({
            "notes": ["Short", "A" * 50, "A" * 100],
        })
        targets = identify_extraction_targets(df, columns=["notes"], min_text_length=50)
        assert len(targets) == 2
    
    def test_identify_skips_non_string(self):
        """Non-string values should be skipped."""
        df = pd.DataFrame({
            "notes": ["A" * 150, None, 123, "B" * 150],
        })
        targets = identify_extraction_targets(df, columns=["notes"])
        assert len(targets) == 2
    
    def test_cell_target_properties(self):
        """CellTarget should have correct properties."""
        text = "This is a test. Another sentence! Question?"
        df = pd.DataFrame({"notes": [text]})
        targets = identify_extraction_targets(df, columns=["notes"], min_text_length=10)
        assert len(targets) == 1
        target = targets[0]
        assert target.text == text
        assert target.text_length == len(text)
        assert target.sentence_count == 3  # ., !, ?
        assert target.col_name == "notes"


class TestPHIScanner:
    """Test PHI scanner wrapper."""
    
    def test_scanner_init(self):
        """Scanner should initialize without errors."""
        scanner = PHIScanner()
        assert scanner.include_medium is False
        assert scanner.include_low is False
    
    def test_scanner_with_options(self):
        """Scanner should accept severity options."""
        scanner = PHIScanner(include_medium=True, include_low=True)
        assert scanner.include_medium is True
        assert scanner.include_low is True
    
    def test_scan_text_no_detector(self):
        """Scanner should handle missing PHI detector gracefully."""
        scanner = PHIScanner()
        scanner._detector = False  # Simulate unavailable detector
        result = scanner.scan_text("Some text with SSN 123-45-6789")
        assert isinstance(result, PHIScanResult)
        assert result.has_phi is False
        assert "unavailable" in result.scan_notes[0].lower()
    
    def test_scan_dict(self):
        """Scanner should handle dictionary input."""
        scanner = PHIScanner()
        scanner._detector = False  # Simulate unavailable
        result = scanner.scan_dict({"key": "value", "nested": {"inner": "data"}})
        assert isinstance(result, PHIScanResult)


class TestCellExtractionResult:
    """Test extraction result data class."""
    
    def test_successful_result(self):
        """Successful result should serialize correctly."""
        from data_extraction.schemas import ClinicalExtraction
        
        extraction = ClinicalExtraction(confidence=0.9)
        result = CellExtractionResult(
            row_idx=0,
            col_name="notes",
            success=True,
            extraction=extraction,
        )
        
        d = result.to_dict()
        assert d["row_idx"] == 0
        assert d["col_name"] == "notes"
        assert d["success"] is True
        assert d["extraction"]["confidence"] == 0.9
    
    def test_failed_result(self):
        """Failed result should serialize with error."""
        result = CellExtractionResult(
            row_idx=5,
            col_name="history",
            success=False,
            error="API timeout",
        )
        
        d = result.to_dict()
        assert d["success"] is False
        assert d["error"] == "API timeout"
        assert d["extraction"] is None


class TestBatchExtractionManifest:
    """Test batch manifest data class."""
    
    def test_manifest_creation(self):
        """Manifest should store all metrics."""
        manifest = BatchExtractionManifest(
            timestamp="2025-01-23T12:00:00Z",
            total_cells=10,
            successful=8,
            failed=1,
            phi_blocked=1,
            total_cost_usd=0.05,
            total_tokens={"input": 1000, "output": 500},
            results=[],
            columns_processed=["notes", "history"],
            config={"min_text_length": 100},
        )
        
        d = manifest.to_dict()
        assert d["total_cells"] == 10
        assert d["successful"] == 8
        assert d["phi_blocked"] == 1
        assert d["total_cost_usd"] == 0.05
        assert len(d["columns_processed"]) == 2


class TestParseBlockTextIntegration:
    """Integration tests for parse_block_text (mocked)."""
    
    @pytest.fixture
    def sample_df(self):
        """Create sample DataFrame with narrative columns."""
        return pd.DataFrame({
            "patient_id": [1, 2, 3],
            "notes": [
                "A" * 150 + " Patient underwent surgery for appendicitis.",
                "B" * 150 + " Follow-up visit showed improvement.",
                "C" * 50,  # Too short
            ],
            "age": [25, 30, 35],
        })
    
    @pytest.mark.asyncio
    async def test_parse_block_text_identifies_targets(self, sample_df):
        """parse_block_text should identify correct targets."""
        from data_extraction.cell_parser import parse_block_text
        
        with patch('data_extraction.cell_parser.extract_cell_with_phi_guard') as mock_extract:
            # Mock returns success for all
            mock_extract.return_value = CellExtractionResult(
                row_idx=0,
                col_name="notes",
                success=True,
                extraction=None,
            )
            
            df_result, manifest = await parse_block_text(
                sample_df,
                columns=["notes"],
                min_text_length=100,
                enable_phi_scanning=False,
            )
            
            # Should have called extract for 2 cells (3rd is too short)
            assert mock_extract.call_count == 2
    
    @pytest.mark.asyncio
    async def test_parse_block_text_empty_df(self):
        """parse_block_text should handle empty DataFrame."""
        from data_extraction.cell_parser import parse_block_text
        
        df = pd.DataFrame({"notes": []})
        df_result, manifest = await parse_block_text(df, columns=["notes"])
        
        assert manifest.total_cells == 0
        assert manifest.successful == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

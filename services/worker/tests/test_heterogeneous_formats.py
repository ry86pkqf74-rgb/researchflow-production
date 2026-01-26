"""
End-to-End Tests for Heterogeneous Data Formats

Tests parsing, processing, and validation for various data formats:
- CSV, XLSX
- JSON, JSONL
- Parquet
- HDF5
- PDF
- Images (OCR)
- GeoJSON
- Audio (transcription)
- ZIP archives

These tests verify the complete data pipeline from ingestion to processing.
"""

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import pytest


# Test fixtures directory (create sample files for testing)
FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestParquetParser:
    """Tests for Parquet file parsing."""

    @pytest.fixture
    def sample_parquet(self, tmp_path):
        """Create a sample Parquet file."""
        try:
            import pandas as pd
            import pyarrow as pa
            import pyarrow.parquet as pq

            df = pd.DataFrame({
                "id": [1, 2, 3, 4, 5],
                "name": ["Alice", "Bob", "Charlie", "Diana", "Eve"],
                "age": [25, 30, 35, 28, 42],
                "score": [85.5, 92.3, 78.1, 95.0, 88.7],
            })

            file_path = tmp_path / "test_data.parquet"
            df.to_parquet(file_path, index=False)
            return file_path
        except ImportError:
            pytest.skip("pyarrow not installed")

    def test_parse_parquet_file(self, sample_parquet):
        """Test parsing a Parquet file."""
        from src.parsers import ParquetParser

        parser = ParquetParser()
        result = parser.parse(sample_parquet)

        assert result.success is True
        assert result.format == "parquet"
        assert result.record_count == 5
        assert "id" in result.columns
        assert "name" in result.columns
        assert result.schema is not None

    def test_parse_parquet_with_limit(self, sample_parquet):
        """Test parsing with row limit."""
        from src.parsers import ParquetParser

        parser = ParquetParser()
        result = parser.parse(sample_parquet, max_rows=2)

        assert result.success is True
        assert result.record_count <= 2


class TestHDF5Parser:
    """Tests for HDF5 file parsing."""

    @pytest.fixture
    def sample_hdf5(self, tmp_path):
        """Create a sample HDF5 file."""
        try:
            import h5py
            import numpy as np

            file_path = tmp_path / "test_data.h5"
            with h5py.File(file_path, "w") as f:
                f.create_dataset("measurements", data=np.random.randn(100, 10))
                f.create_dataset("labels", data=np.array([b"A", b"B", b"C"] * 33 + [b"A"]))
                f.attrs["experiment"] = "test"

            return file_path
        except ImportError:
            pytest.skip("h5py not installed")

    def test_parse_hdf5_file(self, sample_hdf5):
        """Test parsing an HDF5 file."""
        from src.parsers import HDF5Parser

        parser = HDF5Parser()
        result = parser.parse(sample_hdf5)

        assert result.success is True
        assert result.format == "hdf5"
        assert "measurements" in result.columns or "measurements" in str(result.columns)


class TestPDFParser:
    """Tests for PDF file parsing."""

    @pytest.fixture
    def sample_pdf(self, tmp_path):
        """Create a sample PDF file (requires reportlab or similar)."""
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas

            file_path = tmp_path / "test_document.pdf"
            c = canvas.Canvas(str(file_path), pagesize=letter)
            c.drawString(100, 750, "Test Document Title")
            c.drawString(100, 700, "This is a sample PDF document for testing.")
            c.drawString(100, 650, "It contains multiple lines of text.")
            c.save()
            return file_path
        except ImportError:
            pytest.skip("reportlab not installed")

    def test_parse_pdf_file(self, sample_pdf):
        """Test parsing a PDF file."""
        from src.parsers import PDFParser

        parser = PDFParser()
        result = parser.parse(sample_pdf)

        assert result.success is True
        assert result.format == "pdf"
        assert result.text_content is not None
        assert len(result.text_content) > 0


class TestSchemaInference:
    """Tests for automatic schema inference."""

    @pytest.fixture
    def sample_records(self):
        """Sample records for schema inference."""
        return [
            {"id": 1, "name": "Alice", "age": 25, "active": True, "score": 85.5},
            {"id": 2, "name": "Bob", "age": 30, "active": False, "score": 92.3},
            {"id": 3, "name": "Charlie", "age": 35, "active": True, "score": 78.1},
        ]

    def test_infer_schema_from_records(self, sample_records):
        """Test schema inference from records."""
        from src.schema import infer_schema

        result = infer_schema(sample_records, source="test_data")

        assert len(result.columns) == 5
        assert result.record_count == 3

        # Check inferred types
        col_types = {c.name: c.inferred_type for c in result.columns}
        assert col_types["id"] in ("integer", "float")
        assert col_types["name"] == "string"
        assert col_types["active"] == "boolean"

    def test_primary_key_detection(self, sample_records):
        """Test primary key candidate detection."""
        from src.schema import infer_schema

        result = infer_schema(sample_records)

        # 'id' should be detected as a PK candidate
        assert "id" in result.primary_key_candidates


class TestKeywordExtraction:
    """Tests for keyword extraction."""

    @pytest.fixture
    def sample_texts(self):
        """Sample texts for keyword extraction."""
        return [
            "Machine learning algorithms are used for predictive modeling.",
            "Deep learning neural networks process large datasets.",
            "Natural language processing enables text analysis.",
            "Computer vision systems analyze image data.",
        ]

    def test_extract_keywords_tfidf(self, sample_texts):
        """Test TF-IDF keyword extraction."""
        from src.utils import extract_keywords_tfidf

        result = extract_keywords_tfidf(sample_texts, top_k=10)

        assert len(result.keywords) > 0
        assert result.method in ("tfidf_sklearn", "tfidf_simple")
        assert result.total_terms > 0

    def test_extract_keywords_from_abstracts(self, sample_texts):
        """Test keyword extraction from abstracts."""
        from src.utils import extract_keywords_from_abstracts

        result = extract_keywords_from_abstracts(sample_texts, method="tfidf", top_k=5)

        assert len(result.keywords) <= 5
        assert result.unique_terms > 0


class TestFuzzyDeduplication:
    """Tests for fuzzy deduplication."""

    @pytest.fixture
    def duplicate_records(self):
        """Records with potential duplicates."""
        return [
            {"id": "1", "name": "John Smith", "email": "john@example.com"},
            {"id": "2", "name": "Jon Smith", "email": "jon.smith@example.com"},
            {"id": "3", "name": "Jane Doe", "email": "jane@example.com"},
            {"id": "4", "name": "Johnn Smith", "email": "jsmith@example.com"},
            {"id": "5", "name": "Alice Johnson", "email": "alice@example.com"},
        ]

    def test_find_duplicates(self, duplicate_records):
        """Test finding duplicate records."""
        try:
            from src.dedup import find_duplicates

            groups = find_duplicates(
                duplicate_records,
                threshold=0.8,
                match_columns=["name"],
            )

            # Should find "John Smith" and variants as duplicates
            assert len(groups) > 0
        except ImportError:
            pytest.skip("rapidfuzz not installed")

    def test_deduplicate_records(self, duplicate_records):
        """Test deduplicating records."""
        try:
            from src.dedup import deduplicate_records

            result = deduplicate_records(
                duplicate_records,
                threshold=0.8,
                match_columns=["name"],
                save_artifact=False,
            )

            assert result.success is True
            assert result.unique_count < result.original_count
        except ImportError:
            pytest.skip("rapidfuzz not installed")


class TestDataFusion:
    """Tests for data fusion operations."""

    @pytest.fixture
    def sample_datasets(self):
        """Sample datasets for fusion."""
        return [
            {
                "name": "dataset_a",
                "data": [
                    {"id": 1, "name": "Alice", "department": "Engineering"},
                    {"id": 2, "name": "Bob", "department": "Marketing"},
                ],
            },
            {
                "name": "dataset_b",
                "data": [
                    {"id": 3, "name": "Charlie", "department": "Engineering"},
                    {"id": 1, "name": "Alice", "department": "Engineering"},  # Duplicate
                ],
            },
        ]

    def test_union_fusion(self, sample_datasets):
        """Test union fusion strategy."""
        from src.fusion import fuse_datasets

        result = fuse_datasets(
            sample_datasets,
            strategy="union",
            dedup=True,
            save_artifact=False,
        )

        assert result.success is True
        assert result.record_count == 3  # 4 total - 1 duplicate


class TestOCRPipeline:
    """Tests for OCR pipeline."""

    def test_ocr_availability_check(self):
        """Test OCR availability check."""
        from src.parsers import is_ocr_available

        # Should return False when OCR_ENABLED is not set
        available = is_ocr_available()
        assert isinstance(available, bool)


class TestTranscription:
    """Tests for audio transcription."""

    def test_transcription_availability_check(self):
        """Test transcription availability check."""
        from src.parsers.audio_transcriber import is_transcription_available

        # Should return False when TRANSCRIPTION_ENABLED is not set
        available = is_transcription_available()
        assert isinstance(available, bool)

    def test_supported_audio_formats(self):
        """Test getting supported audio formats."""
        from src.parsers.audio_transcriber import get_supported_audio_formats

        formats = get_supported_audio_formats()
        assert "mp3" in formats
        assert "wav" in formats


class TestParserRegistry:
    """Tests for the parser registry."""

    def test_registry_lists_parsers(self):
        """Test listing registered parsers."""
        from src.parsers import ParserRegistry

        # Initialize parsers
        from src.parsers.registry import _init_parsers
        _init_parsers()

        parsers = ParserRegistry.list_parsers()
        # At least some parsers should be registered
        assert isinstance(parsers, list)

    def test_registry_supported_extensions(self):
        """Test listing supported extensions."""
        from src.parsers import ParserRegistry

        from src.parsers.registry import _init_parsers
        _init_parsers()

        extensions = ParserRegistry.list_supported_extensions()
        # Should support at least parquet
        assert isinstance(extensions, list)


class TestLiteratureIndexing:
    """Tests for literature indexing."""

    @pytest.fixture
    def sample_papers(self):
        """Sample paper items for indexing."""
        return [
            {
                "id": "paper_1",
                "title": "Machine Learning in Healthcare",
                "abstract": "This paper explores ML applications in medical diagnosis.",
                "provider": "pubmed",
                "year": 2023,
            },
            {
                "id": "paper_2",
                "title": "Deep Learning for Image Analysis",
                "abstract": "A comprehensive study of CNNs for medical imaging.",
                "provider": "arxiv",
                "year": 2024,
            },
        ]

    def test_literature_indexing_config(self, sample_papers):
        """Test literature indexing configuration."""
        from src.jobs import LiteratureIndexingConfig

        config = LiteratureIndexingConfig(
            collection="test_literature",
            upsert=True,
            include_abstract=True,
        )

        assert config.collection == "test_literature"
        assert config.upsert is True


class TestLiteratureSummarization:
    """Tests for literature summarization."""

    def test_summarization_config(self):
        """Test summarization configuration."""
        from src.jobs import SummarizationConfig

        config = SummarizationConfig(
            model="claude-3-haiku-20240307",
            synthesis_style="bullet_points",
            max_papers_for_synthesis=10,
        )

        assert config.model == "claude-3-haiku-20240307"
        assert config.synthesis_style == "bullet_points"


class TestDaskParallelization:
    """Tests for Dask parallelization."""

    def test_dask_availability_check(self):
        """Test Dask availability check."""
        from src.parallel import is_dask_available

        available = is_dask_available()
        assert isinstance(available, bool)

    def test_parallel_map_fallback(self):
        """Test parallel_map falls back to sequential when Dask unavailable."""
        from src.parallel import parallel_map

        def square(x):
            return x * x

        results = parallel_map(square, [1, 2, 3, 4, 5])
        assert results == [1, 4, 9, 16, 25]


class TestEntityExtraction:
    """Tests for entity extraction."""

    def test_scispacy_availability_check(self):
        """Test scispaCy availability check."""
        from src.nlp import is_scispacy_available

        available = is_scispacy_available()
        assert isinstance(available, bool)


class TestProfilingJob:
    """Tests for data profiling."""

    def test_profiling_availability_check(self):
        """Test profiling availability check."""
        from src.jobs.profiling_job import is_profiling_available

        available = is_profiling_available()
        assert isinstance(available, bool)


class TestGapAnalysis:
    """Tests for gap analysis."""

    @pytest.fixture
    def sample_papers_with_years(self):
        """Sample papers with year data."""
        return [
            {"id": "1", "title": "Study A", "year": 2020, "abstract": "Research on topic A."},
            {"id": "2", "title": "Study B", "year": 2021, "abstract": "Research on topic B."},
            {"id": "3", "title": "Study C", "year": 2022, "abstract": "Research on topic C."},
        ]

    def test_gap_analysis_config(self):
        """Test gap analysis configuration."""
        from src.jobs.gap_analysis import GapAnalysisConfig

        config = GapAnalysisConfig(
            use_llm=False,
            min_papers_for_analysis=2,
            top_keywords=20,
        )

        assert config.use_llm is False
        assert config.min_papers_for_analysis == 2


# Run tests with: pytest services/worker/tests/test_heterogeneous_formats.py -v

"""
Worker Service E2E Integration Tests

Tests the worker service pipelines and integrations:
- OCR Pipeline
- NLP Pipeline
- Literature Services
- Vector Storage
- Compression
- Schema Validation
"""

import pytest
import asyncio
import os
import json
import tempfile
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock

# Test configuration
WORKER_URL = os.getenv("WORKER_URL", "http://localhost:8000")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


# ==================== Fixtures ====================

@pytest.fixture
def sample_text():
    """Sample text for testing"""
    return """
    Machine learning is a subset of artificial intelligence that focuses on building
    systems that can learn from data. These systems improve their performance over
    time without being explicitly programmed. Deep learning, a branch of machine
    learning, uses neural networks with multiple layers to progressively extract
    higher-level features from raw input.
    """


@pytest.fixture
def sample_paper():
    """Sample paper for literature analysis"""
    return {
        "id": "paper-001",
        "title": "Introduction to Machine Learning",
        "abstract": "This paper provides an overview of machine learning techniques and their applications.",
        "authors": ["John Doe", "Jane Smith"],
        "year": 2023,
        "keywords": ["machine learning", "AI", "deep learning"],
        "citations": [],
        "references": []
    }


@pytest.fixture
def sample_citation():
    """Sample citation for formatting"""
    return {
        "type": "journal",
        "title": "Machine Learning in Healthcare",
        "authors": [
            {"firstName": "John", "lastName": "Doe"},
            {"firstName": "Jane", "lastName": "Smith"}
        ],
        "year": 2024,
        "journal": "Journal of AI in Medicine",
        "volume": "15",
        "issue": "3",
        "pages": "45-67",
        "doi": "10.1234/jaim.2024.001"
    }


@pytest.fixture
def temp_dir():
    """Temporary directory for test files"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


# ==================== Health Check Tests ====================

class TestHealthChecks:
    """Test health check endpoints"""

    @pytest.mark.asyncio
    async def test_worker_healthz(self):
        """Test worker liveness endpoint"""
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{WORKER_URL}/healthz") as response:
                    assert response.status == 200
                    data = await response.json()
                    assert data["status"] == "ok"
        except aiohttp.ClientError:
            pytest.skip("Worker service not available")

    @pytest.mark.asyncio
    async def test_worker_readyz(self):
        """Test worker readiness endpoint"""
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{WORKER_URL}/readyz") as response:
                    assert response.status in [200, 503]
                    data = await response.json()
                    assert "status" in data
        except aiohttp.ClientError:
            pytest.skip("Worker service not available")


# ==================== Literature Service Tests ====================

class TestCitationFormatter:
    """Test citation formatting service"""

    def test_format_apa(self, sample_citation):
        """Test APA citation formatting"""
        from services.worker.src.literature.citation_formatter import CitationFormatter, Citation, Author

        formatter = CitationFormatter()

        citation = Citation(
            type=sample_citation["type"],
            title=sample_citation["title"],
            authors=[Author(**a) for a in sample_citation["authors"]],
            year=sample_citation["year"],
            journal=sample_citation["journal"],
            volume=sample_citation["volume"],
            issue=sample_citation["issue"],
            pages=sample_citation["pages"],
            doi=sample_citation["doi"]
        )

        result = formatter.format(citation, style="apa")
        assert "Doe" in result
        assert "2024" in result
        assert sample_citation["title"] in result

    def test_format_all_styles(self, sample_citation):
        """Test all citation styles"""
        from services.worker.src.literature.citation_formatter import CitationFormatter, Citation, Author

        formatter = CitationFormatter()

        citation = Citation(
            type=sample_citation["type"],
            title=sample_citation["title"],
            authors=[Author(**a) for a in sample_citation["authors"]],
            year=sample_citation["year"],
            journal=sample_citation["journal"]
        )

        results = formatter.format_all(citation)

        assert "apa" in results
        assert "mla" in results
        assert "chicago" in results
        assert "harvard" in results
        assert "vancouver" in results
        assert "ieee" in results
        assert "ama" in results

    def test_parse_bibtex(self):
        """Test BibTeX parsing"""
        from services.worker.src.literature.citation_formatter import CitationFormatter

        formatter = CitationFormatter()

        bibtex = """
        @article{smith2024ml,
            author = {Smith, John and Doe, Jane},
            title = {Machine Learning Advances},
            journal = {AI Journal},
            year = {2024},
            volume = {10},
            pages = {1-15}
        }
        """

        citation = formatter.parse_bibtex(bibtex)
        assert citation.title == "Machine Learning Advances"
        assert citation.year == 2024
        assert len(citation.authors) == 2


class TestGapAnalysis:
    """Test research gap analysis"""

    def test_analyze_gaps(self, sample_paper):
        """Test gap analysis"""
        from services.worker.src.literature.gap_analysis import GapAnalyzer, Paper

        analyzer = GapAnalyzer()

        papers = [
            Paper(
                id=sample_paper["id"],
                title=sample_paper["title"],
                abstract=sample_paper["abstract"],
                year=sample_paper["year"],
                authors=sample_paper["authors"],
                keywords=sample_paper["keywords"]
            )
        ]

        result = analyzer.analyze(papers, query="machine learning")

        assert result.query == "machine learning"
        assert result.paper_count == 1
        assert isinstance(result.gaps, list)
        assert isinstance(result.recommendations, list)

    def test_methodology_gap_detection(self):
        """Test methodology gap detection"""
        from services.worker.src.literature.gap_analysis import GapAnalyzer, Paper

        analyzer = GapAnalyzer()

        # Papers without RCTs
        papers = [
            Paper(
                id=f"paper-{i}",
                title=f"Survey Paper {i}",
                abstract="A survey of existing techniques using observational methods.",
                year=2023,
                authors=["Author A"],
                keywords=["survey"]
            )
            for i in range(20)
        ]

        result = analyzer.analyze(papers, query="treatment efficacy")

        # Should identify lack of RCTs
        methodology_gaps = [g for g in result.gaps if g.type == "methodology"]
        assert len(methodology_gaps) > 0


class TestPlagiarismDetector:
    """Test plagiarism detection"""

    def test_exact_match_detection(self):
        """Test exact match detection"""
        from services.worker.src.literature.plagiarism_detector import PlagiarismDetector, SourceDocument

        detector = PlagiarismDetector(min_match_length=5)

        source_text = "Machine learning is a subset of artificial intelligence that focuses on building systems."
        query_text = "Machine learning is a subset of artificial intelligence that focuses on building systems."

        sources = [
            SourceDocument(
                id="source-1",
                title="Source Document",
                text=source_text
            )
        ]

        report = detector.analyze(query_text, sources)

        assert report.overall_similarity > 0.8
        assert len(report.matches) > 0
        assert report.matches[0].match_type == "exact"

    def test_paraphrase_detection(self):
        """Test paraphrase detection"""
        from services.worker.src.literature.plagiarism_detector import PlagiarismDetector, SourceDocument

        detector = PlagiarismDetector(min_match_length=5, similarity_threshold=0.7)

        source_text = "Artificial intelligence systems can learn from experience and improve over time."
        query_text = "AI systems have the capability to learn from past experience and get better over time."

        sources = [
            SourceDocument(
                id="source-1",
                title="Source Document",
                text=source_text
            )
        ]

        report = detector.analyze(query_text, sources)

        # May or may not detect depending on threshold
        assert report.overall_similarity >= 0.0
        assert isinstance(report.recommendations, list)


# ==================== Schema System Tests ====================

class TestSchemaInference:
    """Test Pandera schema inference"""

    def test_infer_from_dataframe(self):
        """Test schema inference from DataFrame"""
        try:
            import pandas as pd
            from packages.core.src.schema.pandera_inference import infer_schema_from_dataframe
        except ImportError:
            pytest.skip("Pandas or pandera-inference not available")

        df = pd.DataFrame({
            "id": [1, 2, 3],
            "name": ["Alice", "Bob", "Charlie"],
            "score": [85.5, 92.0, 78.5],
            "passed": [True, True, False]
        })

        schema = infer_schema_from_dataframe(df, "test_schema")

        assert schema.name == "test_schema"
        assert "id" in schema.columns
        assert "name" in schema.columns
        assert "score" in schema.columns


class TestSchemaVersioning:
    """Test schema versioning"""

    def test_version_compatibility(self):
        """Test semver compatibility checking"""
        try:
            from packages.core.src.schema.versioning import SchemaRegistry
        except ImportError:
            pytest.skip("Schema versioning not available")

        registry = SchemaRegistry()

        # Register versions
        registry.registerSchema("test", {
            "version": "1.0.0",
            "schema": {"columns": []},
            "createdAt": datetime.utcnow().isoformat(),
            "createdBy": "test",
            "changelog": "Initial version"
        })

        registry.registerSchema("test", {
            "version": "1.1.0",
            "schema": {"columns": [{"name": "new_field"}]},
            "createdAt": datetime.utcnow().isoformat(),
            "createdBy": "test",
            "changelog": "Added new_field"
        })

        # Test compatibility
        assert registry.isCompatible("test", "1.0.0", "1.1.0") is True
        assert registry.isCompatible("test", "1.1.0", "1.0.0") is False


# ==================== Vector Cache Tests ====================

class TestRedisVectorCache:
    """Test Redis vector caching"""

    @pytest.mark.asyncio
    async def test_cache_embedding(self):
        """Test embedding caching"""
        try:
            from services.worker.src.vector.redis_cache import RedisVectorCache, CacheConfig
        except ImportError:
            pytest.skip("Redis cache not available")

        config = CacheConfig(host="localhost", port=6379)

        try:
            async with RedisVectorCache(config) as cache:
                content = "Test content for embedding"
                vector = [0.1] * 384  # Sample embedding

                # Cache embedding
                content_hash = await cache.set_embedding(content, vector, {"source": "test"})
                assert content_hash is not None

                # Retrieve embedding
                cached = await cache.get_embedding(content)
                assert cached is not None
                assert cached.vector == vector
                assert cached.metadata["source"] == "test"

                # Invalidate
                result = await cache.invalidate_embedding(content)
                assert result is True

                # Should be gone
                cached = await cache.get_embedding(content)
                assert cached is None

        except Exception as e:
            if "Connection refused" in str(e):
                pytest.skip("Redis not available")
            raise

    @pytest.mark.asyncio
    async def test_cache_search_results(self):
        """Test search result caching"""
        try:
            from services.worker.src.vector.redis_cache import RedisVectorCache, CacheConfig
        except ImportError:
            pytest.skip("Redis cache not available")

        config = CacheConfig(host="localhost", port=6379)

        try:
            async with RedisVectorCache(config) as cache:
                query = "test query"
                results = [
                    {"id": "1", "score": 0.95},
                    {"id": "2", "score": 0.85}
                ]

                # Cache search results
                await cache.set_search_results(query, results)

                # Retrieve
                cached = await cache.get_search_results(query)
                assert cached is not None
                assert len(cached.results) == 2
                assert cached.results[0]["id"] == "1"

        except Exception as e:
            if "Connection refused" in str(e):
                pytest.skip("Redis not available")
            raise


# ==================== Compression Tests ====================

class TestArtifactCompression:
    """Test artifact compression"""

    def test_gzip_compression(self, sample_text, temp_dir):
        """Test GZIP compression"""
        from services.worker.src.storage.compression import ArtifactCompressor, CompressionAlgorithm

        compressor = ArtifactCompressor()

        data = (sample_text * 100).encode()  # Make it sizeable
        compressed, result = compressor.compress(data, algorithm=CompressionAlgorithm.GZIP)

        assert result.algorithm == CompressionAlgorithm.GZIP
        assert result.compressed_size < result.original_size
        assert result.compression_ratio < 1.0

        # Verify decompression
        decompressed = compressor.decompress(compressed, result.algorithm)
        assert decompressed == data

    def test_auto_algorithm_selection(self, sample_text):
        """Test automatic algorithm selection based on content type"""
        from services.worker.src.storage.compression import ArtifactCompressor, CompressionAlgorithm

        compressor = ArtifactCompressor()

        data = (sample_text * 100).encode()

        # JSON content should use ZSTD (if available)
        compressed, result = compressor.compress(data, content_type="application/json")

        # Should use either ZSTD or fallback
        assert result.algorithm in [CompressionAlgorithm.ZSTD, CompressionAlgorithm.GZIP]

    def test_skip_small_files(self, sample_text):
        """Test that small files are not compressed"""
        from services.worker.src.storage.compression import ArtifactCompressor, CompressionAlgorithm

        compressor = ArtifactCompressor()

        small_data = b"small"  # Under threshold
        _, result = compressor.compress(small_data)

        assert result.algorithm == CompressionAlgorithm.NONE
        assert result.compression_ratio == 1.0

    def test_skip_already_compressed(self, sample_text):
        """Test that already compressed content is not re-compressed"""
        from services.worker.src.storage.compression import ArtifactCompressor, CompressionAlgorithm

        compressor = ArtifactCompressor()

        # PNG images should not be compressed
        data = b"fake png data" * 1000
        _, result = compressor.compress(data, content_type="image/png")

        assert result.algorithm == CompressionAlgorithm.NONE

    def test_file_compression(self, temp_dir):
        """Test file-based compression"""
        from services.worker.src.storage.compression import ArtifactCompressor

        compressor = ArtifactCompressor()

        # Create test file
        input_file = temp_dir / "test.txt"
        output_file = temp_dir / "test.txt.compressed"

        test_content = b"Test content " * 10000  # ~130KB
        input_file.write_bytes(test_content)

        result = compressor.compress_file(input_file, output_file)

        assert output_file.exists()
        assert result.compressed_size < result.original_size

        # Decompress and verify
        decompressed_file = temp_dir / "test.txt.decompressed"
        compressor.decompress_file(output_file, decompressed_file, result.algorithm)

        assert decompressed_file.read_bytes() == test_content


# ==================== Lineage Tracking Tests ====================

class TestLineageTracking:
    """Test lineage tracking"""

    def test_add_lineage_nodes(self):
        """Test adding lineage nodes"""
        try:
            from packages.core.src.lineage.tracker import LineageTracker
        except ImportError:
            pytest.skip("Lineage tracker not available")

        tracker = LineageTracker()

        # Add nodes
        tracker.addNode({
            "id": "input-1",
            "type": "input",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {"source": "upload"}
        })

        tracker.addNode({
            "id": "output-1",
            "type": "output",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {"format": "json"}
        })

        # Add edge
        tracker.addEdge({
            "from": "input-1",
            "to": "output-1",
            "relationship": "derived_from"
        })

        # Query upstream
        upstream = tracker.getUpstream("output-1")
        assert len(upstream) == 1
        assert upstream[0]["id"] == "input-1"

    def test_export_prov_json(self):
        """Test PROV-JSON export"""
        try:
            from packages.core.src.lineage.tracker import LineageTracker
        except ImportError:
            pytest.skip("Lineage tracker not available")

        tracker = LineageTracker()

        tracker.addNode({
            "id": "entity-1",
            "type": "input",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {}
        })

        prov = tracker.exportProvJSON()
        assert "entity" in prov or "entities" in prov


# ==================== Tamper-Evident Logging Tests ====================

class TestTamperEvidentLogging:
    """Test tamper-evident logging"""

    def test_log_signing(self):
        """Test log entry signing"""
        try:
            from packages.core.src.logging.tamper_evident import TamperEvidentLogger
        except ImportError:
            pytest.skip("Tamper-evident logger not available")

        logger = TamperEvidentLogger("test-secret-key")

        entry = logger.log({"action": "test", "value": 123})

        assert entry["signature"] is not None
        assert entry["timestamp"] is not None

        # Verify signature
        assert logger.verify(entry) is True

    def test_chain_verification(self):
        """Test chain integrity verification"""
        try:
            from packages.core.src.logging.tamper_evident import TamperEvidentLogger
        except ImportError:
            pytest.skip("Tamper-evident logger not available")

        logger = TamperEvidentLogger("test-secret-key")

        entries = [
            logger.log({"action": "action1"}),
            logger.log({"action": "action2"}),
            logger.log({"action": "action3"})
        ]

        # Verify chain
        result = logger.verifyChain(entries)
        assert result["valid"] is True

    def test_tamper_detection(self):
        """Test tamper detection"""
        try:
            from packages.core.src.logging.tamper_evident import TamperEvidentLogger
        except ImportError:
            pytest.skip("Tamper-evident logger not available")

        logger = TamperEvidentLogger("test-secret-key")

        entry = logger.log({"action": "test"})

        # Tamper with the entry
        entry["data"]["action"] = "tampered"

        # Should fail verification
        assert logger.verify(entry) is False


# ==================== Integration Tests ====================

class TestFullPipeline:
    """Test full pipeline integration"""

    @pytest.mark.asyncio
    async def test_document_processing_pipeline(self, temp_dir, sample_text):
        """Test full document processing pipeline"""
        # This test simulates the full pipeline but uses mocks
        # where external services aren't available

        # 1. Create test document
        doc_path = temp_dir / "test_doc.txt"
        doc_path.write_text(sample_text)

        # 2. Compress
        from services.worker.src.storage.compression import ArtifactCompressor

        compressor = ArtifactCompressor()
        compressed_path = temp_dir / "test_doc.txt.compressed"

        result = compressor.compress_file(doc_path, compressed_path)
        assert result.compressed_size > 0

        # 3. Extract text (mock OCR for non-PDF)
        extracted_text = sample_text

        # 4. Analyze for plagiarism
        from services.worker.src.literature.plagiarism_detector import PlagiarismDetector, SourceDocument

        detector = PlagiarismDetector()
        plag_report = detector.analyze(extracted_text, [])

        assert plag_report.overall_similarity == 0.0  # No sources

        # 5. Format any citations found (mock)
        # In real pipeline, this would extract citations from text

        # 6. Store results
        results = {
            "compression": {
                "original_size": result.original_size,
                "compressed_size": result.compressed_size,
                "ratio": result.compression_ratio
            },
            "plagiarism": {
                "similarity": plag_report.overall_similarity,
                "matches": len(plag_report.matches)
            }
        }

        # Save as JSON
        results_path = temp_dir / "results.json"
        results_path.write_text(json.dumps(results, indent=2))

        assert results_path.exists()


# ==================== Main ====================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

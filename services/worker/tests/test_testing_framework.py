"""
Tests for the data extraction testing framework.

Tests cover:
- Synthetic data generation
- Ground truth structure
- Benchmark runner
- Metrics calculation
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import sys
import asyncio

sys.path.insert(0, '../src')

from data_extraction.testing import (
    SyntheticNoteGenerator,
    SyntheticNote,
    GroundTruth,
    NoteType,
    generate_synthetic_note,
    generate_test_batch,
    get_gold_standard_cases,
    BenchmarkRunner,
    BenchmarkResult,
    MetricsCalculator,
    ExtractionMetrics,
)


class TestSyntheticNoteGenerator:
    """Tests for SyntheticNoteGenerator."""
    
    @pytest.fixture
    def generator(self):
        return SyntheticNoteGenerator(seed=42)
    
    def test_init_with_seed(self, generator):
        """Should initialize with seed for reproducibility."""
        assert generator.rng is not None
        assert generator._note_counter == 0
    
    def test_generate_operative_note(self, generator):
        """Should generate a valid operative note."""
        note = generator.generate_operative_note()
        
        assert isinstance(note, SyntheticNote)
        assert note.text
        assert note.ground_truth
        assert note.note_id.startswith("SYN-")
        assert note.ground_truth.note_type == "operative_note"
    
    def test_operative_note_has_required_fields(self, generator):
        """Operative note ground truth should have required fields."""
        note = generator.generate_operative_note()
        gt = note.ground_truth
        
        # Should have at least one diagnosis and procedure
        assert len(gt.diagnoses) >= 1
        assert len(gt.procedures) >= 1
        
        # Should have study fields
        assert "asa_class" in gt.study_fields
        assert "bmi" in gt.study_fields
        assert "estimated_blood_loss_ml" in gt.study_fields
        assert "operative_time_minutes" in gt.study_fields
    
    def test_generate_discharge_summary(self, generator):
        """Should generate a valid discharge summary."""
        note = generator.generate_discharge_summary()
        
        assert isinstance(note, SyntheticNote)
        assert note.ground_truth.note_type == "discharge_summary"
        assert len(note.ground_truth.medications) >= 1
    
    def test_generate_with_complications(self, generator):
        """Should include complications when requested."""
        note = generator.generate_operative_note(include_complications=True)
        
        assert len(note.ground_truth.complications) >= 1
        assert "COMPLICATIONS:" in note.text
    
    def test_generate_with_phi(self, generator):
        """Should include PHI when requested."""
        note = generator.generate_operative_note(include_phi=True)
        
        assert note.has_phi
        assert len(note.phi_locations) >= 1
        assert "SSN:" in note.text or "MRN:" in note.text
    
    def test_generate_batch(self, generator):
        """Should generate a batch of notes."""
        notes = generator.generate_batch(count=5)
        
        assert len(notes) == 5
        assert all(isinstance(n, SyntheticNote) for n in notes)
    
    def test_generate_batch_with_complexity_distribution(self, generator):
        """Should respect complexity distribution."""
        notes = generator.generate_batch(
            count=100,
            complexity_distribution={"simple": 0.5, "moderate": 0.3, "complex": 0.2}
        )
        
        complexities = [n.complexity for n in notes]
        # With 100 notes, distribution should be roughly correct
        assert complexities.count("simple") >= 30  # Allow variance
    
    def test_gold_standard_cases_deterministic(self, generator):
        """Gold standard cases should be deterministic."""
        cases1 = generator.generate_gold_standard_cases()
        cases2 = generator.generate_gold_standard_cases()
        
        assert len(cases1) == len(cases2)
        assert cases1[0].note_id == cases2[0].note_id
        assert cases1[0].text == cases2[0].text
    
    def test_gold_standard_has_expected_cases(self, generator):
        """Gold standard should have expected test cases."""
        cases = generator.generate_gold_standard_cases()
        
        note_ids = [c.note_id for c in cases]
        assert "GOLD-001" in note_ids
        assert "GOLD-002" in note_ids
        assert any("PHI" in nid for nid in note_ids)
    
    def test_reproducibility_with_same_seed(self):
        """Same seed should produce same notes."""
        gen1 = SyntheticNoteGenerator(seed=12345)
        gen2 = SyntheticNoteGenerator(seed=12345)
        
        note1 = gen1.generate_operative_note()
        note2 = gen2.generate_operative_note()
        
        assert note1.ground_truth.diagnoses == note2.ground_truth.diagnoses
        assert note1.ground_truth.procedures == note2.ground_truth.procedures


class TestGroundTruth:
    """Tests for GroundTruth dataclass."""
    
    def test_to_dict(self):
        """Should convert to dictionary."""
        gt = GroundTruth(
            note_type="operative_note",
            diagnoses=[{"text": "appendicitis"}],
            procedures=[{"text": "appendectomy"}],
            study_fields={"asa_class": "II"},
        )
        
        d = gt.to_dict()
        
        assert d["note_type"] == "operative_note"
        assert len(d["diagnoses"]) == 1
        assert len(d["procedures"]) == 1
        assert d["study_fields"]["asa_class"] == "II"


class TestSyntheticNote:
    """Tests for SyntheticNote dataclass."""
    
    def test_to_dict(self):
        """Should convert to dictionary."""
        gt = GroundTruth(note_type="operative_note")
        note = SyntheticNote(
            text="Test note",
            ground_truth=gt,
            note_id="TEST-001",
            complexity="simple",
        )
        
        d = note.to_dict()
        
        assert d["note_id"] == "TEST-001"
        assert d["text"] == "Test note"
        assert d["complexity"] == "simple"
        assert "ground_truth" in d


class TestExtractionMetrics:
    """Tests for ExtractionMetrics dataclass."""
    
    def test_precision_calculation(self):
        """Should calculate precision correctly."""
        metrics = ExtractionMetrics(
            category="diagnoses",
            true_positives=8,
            false_positives=2,
            false_negatives=1,
        )
        
        assert metrics.precision == 0.8  # 8 / (8 + 2)
    
    def test_recall_calculation(self):
        """Should calculate recall correctly."""
        metrics = ExtractionMetrics(
            category="diagnoses",
            true_positives=8,
            false_positives=2,
            false_negatives=2,
        )
        
        assert metrics.recall == 0.8  # 8 / (8 + 2)
    
    def test_f1_calculation(self):
        """Should calculate F1 correctly."""
        metrics = ExtractionMetrics(
            category="diagnoses",
            true_positives=8,
            false_positives=2,
            false_negatives=2,
        )
        
        # P = 0.8, R = 0.8, F1 = 2*0.8*0.8 / (0.8+0.8) = 0.8
        assert abs(metrics.f1 - 0.8) < 0.001
    
    def test_zero_division_handling(self):
        """Should handle zero division gracefully."""
        metrics = ExtractionMetrics(
            category="diagnoses",
            true_positives=0,
            false_positives=0,
            false_negatives=0,
        )
        
        assert metrics.precision == 0.0
        assert metrics.recall == 0.0
        assert metrics.f1 == 0.0


class TestMetricsCalculator:
    """Tests for MetricsCalculator."""
    
    @pytest.fixture
    def calculator(self):
        return MetricsCalculator()
    
    def test_fuzzy_match_exact(self, calculator):
        """Should match exact strings."""
        assert calculator._fuzzy_match("appendicitis", "appendicitis")
    
    def test_fuzzy_match_case_insensitive(self, calculator):
        """Should match regardless of case."""
        assert calculator._fuzzy_match("Appendicitis", "appendicitis")
    
    def test_fuzzy_match_substring(self, calculator):
        """Should match substrings."""
        assert calculator._fuzzy_match("acute appendicitis", "appendicitis")
    
    def test_fuzzy_match_word_overlap(self, calculator):
        """Should match with high word overlap."""
        assert calculator._fuzzy_match(
            "laparoscopic appendectomy",
            "laparoscopic appendectomy procedure"
        )
    
    def test_compare_category_perfect_match(self, calculator):
        """Should calculate perfect match correctly."""
        extracted = [{"text": "appendicitis"}, {"text": "diabetes"}]
        ground_truth = [{"text": "appendicitis"}, {"text": "diabetes"}]
        
        metrics = calculator.compare_category(extracted, ground_truth, "diagnoses")
        
        assert metrics.true_positives == 2
        assert metrics.false_positives == 0
        assert metrics.false_negatives == 0
        assert metrics.f1 == 1.0
    
    def test_compare_category_partial_match(self, calculator):
        """Should handle partial matches."""
        extracted = [{"text": "appendicitis"}]
        ground_truth = [{"text": "appendicitis"}, {"text": "diabetes"}]
        
        metrics = calculator.compare_category(extracted, ground_truth, "diagnoses")
        
        assert metrics.true_positives == 1
        assert metrics.false_positives == 0
        assert metrics.false_negatives == 1
    
    def test_compare_category_with_false_positives(self, calculator):
        """Should detect false positives."""
        extracted = [{"text": "appendicitis"}, {"text": "spurious finding"}]
        ground_truth = [{"text": "appendicitis"}]
        
        metrics = calculator.compare_category(extracted, ground_truth, "diagnoses")
        
        assert metrics.true_positives == 1
        assert metrics.false_positives == 1
        assert metrics.false_negatives == 0
    
    def test_compare_study_fields_numeric(self, calculator):
        """Should compare numeric study fields."""
        extracted = {"bmi": 24.5, "asa_class": "II"}
        ground_truth = {"bmi": 24.5, "asa_class": "II"}
        
        result = calculator.compare_study_fields(extracted, ground_truth)
        
        assert result["bmi"]["match"]
        assert result["asa_class"]["match"]
    
    def test_compare_study_fields_tolerance(self, calculator):
        """Should allow tolerance for numeric fields."""
        extracted = {"operative_time_minutes": 42}
        ground_truth = {"operative_time_minutes": 40}  # Within 10%
        
        result = calculator.compare_study_fields(extracted, ground_truth)
        
        assert result["operative_time_minutes"]["match"]


class TestBenchmarkRunner:
    """Tests for BenchmarkRunner."""
    
    @pytest.fixture
    def runner(self):
        return BenchmarkRunner()
    
    @pytest.fixture
    def sample_notes(self):
        generator = SyntheticNoteGenerator(seed=42)
        return generator.generate_batch(count=3)
    
    @pytest.mark.asyncio
    async def test_run_single_mock(self, runner, sample_notes):
        """Should run single extraction with mock."""
        note = sample_notes[0]
        
        result = await runner.run_single(note, tier="MINI", use_mock=True)
        
        assert result["note_id"] == note.note_id
        assert result["tier"] == "MINI"
        assert "latency_ms" in result
        assert "category_metrics" in result
    
    @pytest.mark.asyncio
    async def test_run_benchmark_mock(self, runner, sample_notes):
        """Should run benchmark with mock extraction."""
        result = await runner.run_benchmark(
            sample_notes,
            tier="MINI",
            use_mock=True,
        )
        
        assert isinstance(result, BenchmarkResult)
        assert result.total_notes == len(sample_notes)
        assert result.successful > 0
        assert result.tier == "MINI"
    
    @pytest.mark.asyncio
    async def test_benchmark_result_metrics(self, runner, sample_notes):
        """Benchmark result should have aggregate metrics."""
        result = await runner.run_benchmark(
            sample_notes,
            tier="MINI",
            use_mock=True,
        )
        
        # Check accuracy metrics
        assert 0 <= result.overall_precision <= 1
        assert 0 <= result.overall_recall <= 1
        assert 0 <= result.overall_f1 <= 1
        
        # Check performance metrics
        assert result.avg_latency_ms > 0
    
    @pytest.mark.asyncio
    async def test_benchmark_result_summary(self, runner, sample_notes):
        """Should generate readable summary."""
        result = await runner.run_benchmark(
            sample_notes,
            tier="MINI",
            use_mock=True,
        )
        
        summary = result.summary()
        
        assert "BENCHMARK RESULTS" in summary
        assert "Precision" in summary
        assert "Recall" in summary
        assert "F1" in summary
    
    @pytest.mark.asyncio
    async def test_benchmark_result_to_dict(self, runner, sample_notes):
        """Should convert to dictionary."""
        result = await runner.run_benchmark(
            sample_notes,
            tier="MINI",
            use_mock=True,
        )
        
        d = result.to_dict()
        
        assert "benchmark_id" in d
        assert "accuracy" in d
        assert "performance" in d
        assert "cost" in d


class TestConvenienceFunctions:
    """Tests for module-level convenience functions."""
    
    def test_generate_synthetic_note(self):
        """Should generate single note."""
        note = generate_synthetic_note(seed=42)
        
        assert isinstance(note, SyntheticNote)
    
    def test_generate_test_batch(self):
        """Should generate batch of notes."""
        notes = generate_test_batch(count=5, seed=42)
        
        assert len(notes) == 5
    
    def test_get_gold_standard_cases(self):
        """Should return gold standard cases."""
        cases = get_gold_standard_cases()
        
        assert len(cases) >= 4
        assert all(isinstance(c, SyntheticNote) for c in cases)


class TestPHIInSyntheticData:
    """Tests for PHI handling in synthetic data."""
    
    def test_phi_locations_populated(self):
        """PHI notes should have location info."""
        generator = SyntheticNoteGenerator(seed=42)
        note = generator.generate_operative_note(include_phi=True)
        
        assert note.has_phi
        assert len(note.phi_locations) >= 1
        
        for loc in note.phi_locations:
            assert "type" in loc
    
    def test_phi_types_present(self):
        """Should generate multiple PHI types."""
        generator = SyntheticNoteGenerator(seed=42)
        note = generator.generate_operative_note(include_phi=True)
        
        phi_types = {loc["type"] for loc in note.phi_locations}
        
        # Should have at least SSN, MRN, and phone
        assert "ssn" in phi_types
        assert "mrn" in phi_types


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

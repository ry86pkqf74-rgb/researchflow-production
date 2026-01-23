"""
Data Extraction Testing Framework

This module provides tools for testing the clinical data extraction pipeline:

1. **Synthetic Data Generation**: Generate realistic clinical notes with known ground truth
2. **Benchmark Runner**: Measure extraction accuracy, latency, and cost
3. **Metrics Calculator**: Calculate precision, recall, F1 for each extraction category
4. **Tier Comparison**: Compare performance across NANO, MINI, and FRONTIER tiers

Usage:
    from data_extraction.testing import (
        SyntheticNoteGenerator,
        BenchmarkRunner,
        get_gold_standard_cases,
    )
    
    # Generate synthetic data
    generator = SyntheticNoteGenerator(seed=42)
    notes = generator.generate_batch(count=100)
    
    # Run benchmark
    runner = BenchmarkRunner()
    results = await runner.run_benchmark(notes, tier="MINI")
    print(results.summary())
    
    # Compare tiers
    comparison = await runner.compare_tiers(notes)
    print(runner.print_tier_comparison(comparison))
"""

from .synthetic_data import (
    SyntheticNoteGenerator,
    SyntheticNote,
    GroundTruth,
    NoteType,
    generate_synthetic_note,
    generate_test_batch,
    get_gold_standard_cases,
)

from .benchmark import (
    BenchmarkRunner,
    BenchmarkResult,
    MetricsCalculator,
    ExtractionMetrics,
    run_quick_benchmark,
    run_gold_standard_benchmark,
)

__all__ = [
    # Synthetic Data
    "SyntheticNoteGenerator",
    "SyntheticNote",
    "GroundTruth",
    "NoteType",
    "generate_synthetic_note",
    "generate_test_batch",
    "get_gold_standard_cases",
    # Benchmark
    "BenchmarkRunner",
    "BenchmarkResult",
    "MetricsCalculator",
    "ExtractionMetrics",
    "run_quick_benchmark",
    "run_gold_standard_benchmark",
]

__version__ = "1.0.0"

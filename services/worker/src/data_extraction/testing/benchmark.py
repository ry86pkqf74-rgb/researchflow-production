"""
Extraction Benchmark Runner - Measure extraction accuracy, speed, and cost.

This module provides tools for benchmarking the clinical extraction pipeline:
- Accuracy metrics (precision, recall, F1)
- Performance metrics (latency, throughput)
- Cost tracking
- Tier comparison

Usage:
    from data_extraction.testing import BenchmarkRunner
    
    runner = BenchmarkRunner()
    results = await runner.run_benchmark(gold_cases, tier="MINI")
    print(results.summary())
"""

import asyncio
import time
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from collections import defaultdict

from .synthetic_data import SyntheticNote, GroundTruth

logger = logging.getLogger(__name__)


@dataclass
class ExtractionMetrics:
    """Metrics for a single extraction category."""
    category: str
    true_positives: int = 0
    false_positives: int = 0
    false_negatives: int = 0
    
    @property
    def precision(self) -> float:
        """Calculate precision."""
        if self.true_positives + self.false_positives == 0:
            return 0.0
        return self.true_positives / (self.true_positives + self.false_positives)
    
    @property
    def recall(self) -> float:
        """Calculate recall."""
        if self.true_positives + self.false_negatives == 0:
            return 0.0
        return self.true_positives / (self.true_positives + self.false_negatives)
    
    @property
    def f1(self) -> float:
        """Calculate F1 score."""
        if self.precision + self.recall == 0:
            return 0.0
        return 2 * (self.precision * self.recall) / (self.precision + self.recall)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category,
            "true_positives": self.true_positives,
            "false_positives": self.false_positives,
            "false_negatives": self.false_negatives,
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1": round(self.f1, 4),
        }


@dataclass
class BenchmarkResult:
    """Results from a benchmark run."""
    benchmark_id: str
    tier: str
    started_at: str
    completed_at: str
    total_notes: int
    successful: int
    failed: int
    
    # Accuracy metrics by category
    category_metrics: Dict[str, ExtractionMetrics] = field(default_factory=dict)
    
    # Performance metrics
    total_latency_ms: float = 0.0
    avg_latency_ms: float = 0.0
    min_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    
    # Cost metrics
    total_cost_usd: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    
    # Individual results
    individual_results: List[Dict[str, Any]] = field(default_factory=list)
    
    @property
    def overall_precision(self) -> float:
        """Calculate macro-averaged precision."""
        if not self.category_metrics:
            return 0.0
        return sum(m.precision for m in self.category_metrics.values()) / len(self.category_metrics)
    
    @property
    def overall_recall(self) -> float:
        """Calculate macro-averaged recall."""
        if not self.category_metrics:
            return 0.0
        return sum(m.recall for m in self.category_metrics.values()) / len(self.category_metrics)
    
    @property
    def overall_f1(self) -> float:
        """Calculate macro-averaged F1."""
        if not self.category_metrics:
            return 0.0
        return sum(m.f1 for m in self.category_metrics.values()) / len(self.category_metrics)
    
    def summary(self) -> str:
        """Generate human-readable summary."""
        lines = [
            f"═══════════════════════════════════════════════════════════",
            f"  BENCHMARK RESULTS: {self.benchmark_id}",
            f"  Tier: {self.tier}",
            f"═══════════════════════════════════════════════════════════",
            f"",
            f"  COVERAGE",
            f"  ─────────────────────────────────────────────────────────",
            f"    Notes Processed:    {self.successful}/{self.total_notes}",
            f"    Success Rate:       {self.successful/self.total_notes*100:.1f}%",
            f"",
            f"  ACCURACY (Macro-Averaged)",
            f"  ─────────────────────────────────────────────────────────",
            f"    Precision:          {self.overall_precision:.3f}",
            f"    Recall:             {self.overall_recall:.3f}",
            f"    F1 Score:           {self.overall_f1:.3f}",
            f"",
            f"  ACCURACY BY CATEGORY",
            f"  ─────────────────────────────────────────────────────────",
        ]
        
        for cat, metrics in sorted(self.category_metrics.items()):
            lines.append(f"    {cat:20s}  P={metrics.precision:.3f}  R={metrics.recall:.3f}  F1={metrics.f1:.3f}")
        
        lines.extend([
            f"",
            f"  PERFORMANCE",
            f"  ─────────────────────────────────────────────────────────",
            f"    Avg Latency:        {self.avg_latency_ms:.0f} ms",
            f"    P95 Latency:        {self.p95_latency_ms:.0f} ms",
            f"    Min/Max Latency:    {self.min_latency_ms:.0f} / {self.max_latency_ms:.0f} ms",
            f"",
            f"  COST",
            f"  ─────────────────────────────────────────────────────────",
            f"    Total Cost:         ${self.total_cost_usd:.4f}",
            f"    Cost per Note:      ${self.total_cost_usd/max(self.successful,1):.4f}",
            f"    Total Tokens:       {self.total_input_tokens + self.total_output_tokens:,}",
            f"",
            f"═══════════════════════════════════════════════════════════",
        ])
        
        return "\n".join(lines)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "benchmark_id": self.benchmark_id,
            "tier": self.tier,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "total_notes": self.total_notes,
            "successful": self.successful,
            "failed": self.failed,
            "accuracy": {
                "overall_precision": round(self.overall_precision, 4),
                "overall_recall": round(self.overall_recall, 4),
                "overall_f1": round(self.overall_f1, 4),
                "by_category": {k: v.to_dict() for k, v in self.category_metrics.items()},
            },
            "performance": {
                "total_latency_ms": round(self.total_latency_ms, 2),
                "avg_latency_ms": round(self.avg_latency_ms, 2),
                "min_latency_ms": round(self.min_latency_ms, 2),
                "max_latency_ms": round(self.max_latency_ms, 2),
                "p95_latency_ms": round(self.p95_latency_ms, 2),
            },
            "cost": {
                "total_cost_usd": round(self.total_cost_usd, 6),
                "cost_per_note": round(self.total_cost_usd / max(self.successful, 1), 6),
                "total_input_tokens": self.total_input_tokens,
                "total_output_tokens": self.total_output_tokens,
            },
        }


class MetricsCalculator:
    """
    Calculate extraction accuracy metrics by comparing extractions to ground truth.
    """
    
    # Categories to evaluate
    CATEGORIES = [
        "diagnoses",
        "procedures",
        "medications",
        "outcomes",
        "complications",
    ]
    
    def __init__(self, fuzzy_match_threshold: float = 0.8):
        """
        Initialize calculator.
        
        Args:
            fuzzy_match_threshold: Minimum similarity for fuzzy text matching
        """
        self.fuzzy_threshold = fuzzy_match_threshold
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for comparison."""
        return text.lower().strip()
    
    def _fuzzy_match(self, text1: str, text2: str) -> bool:
        """Check if two texts are fuzzy matches."""
        t1 = self._normalize_text(text1)
        t2 = self._normalize_text(text2)
        
        # Exact match
        if t1 == t2:
            return True
        
        # Substring match
        if t1 in t2 or t2 in t1:
            return True
        
        # Word overlap (Jaccard-like)
        words1 = set(t1.split())
        words2 = set(t2.split())
        if words1 and words2:
            overlap = len(words1 & words2) / len(words1 | words2)
            if overlap >= self.fuzzy_threshold:
                return True
        
        return False
    
    def _extract_text_values(self, items: List[Dict[str, Any]], key: str = "text") -> List[str]:
        """Extract text values from a list of items."""
        texts = []
        for item in items:
            if isinstance(item, dict):
                text = item.get(key) or item.get("name") or item.get("text")
                if text:
                    texts.append(str(text))
            elif isinstance(item, str):
                texts.append(item)
        return texts
    
    def compare_category(
        self,
        extracted: List[Any],
        ground_truth: List[Any],
        category: str,
    ) -> ExtractionMetrics:
        """
        Compare extracted items to ground truth for a single category.
        
        Args:
            extracted: List of extracted items
            ground_truth: List of ground truth items
            category: Category name
        
        Returns:
            ExtractionMetrics for the category
        """
        metrics = ExtractionMetrics(category=category)
        
        # Get text values for comparison
        extracted_texts = self._extract_text_values(extracted)
        gt_texts = self._extract_text_values(ground_truth)
        
        # Track which ground truth items have been matched
        matched_gt = set()
        
        # Check each extracted item
        for ext_text in extracted_texts:
            found_match = False
            for i, gt_text in enumerate(gt_texts):
                if i not in matched_gt and self._fuzzy_match(ext_text, gt_text):
                    metrics.true_positives += 1
                    matched_gt.add(i)
                    found_match = True
                    break
            
            if not found_match:
                metrics.false_positives += 1
        
        # Count missed ground truth items
        metrics.false_negatives = len(gt_texts) - len(matched_gt)
        
        return metrics
    
    def compare_extraction(
        self,
        extracted: Dict[str, Any],
        ground_truth: GroundTruth,
    ) -> Dict[str, ExtractionMetrics]:
        """
        Compare a full extraction to ground truth.
        
        Args:
            extracted: Extraction result dictionary
            ground_truth: GroundTruth object
        
        Returns:
            Dictionary of metrics by category
        """
        gt_dict = ground_truth.to_dict()
        metrics = {}
        
        for category in self.CATEGORIES:
            extracted_items = extracted.get(category, [])
            gt_items = gt_dict.get(category, [])
            
            metrics[category] = self.compare_category(
                extracted_items,
                gt_items,
                category,
            )
        
        return metrics
    
    def compare_study_fields(
        self,
        extracted: Dict[str, Any],
        ground_truth: Dict[str, Any],
    ) -> Dict[str, Dict[str, Any]]:
        """
        Compare extracted study fields to ground truth.
        
        Args:
            extracted: Extracted study_fields dict
            ground_truth: Ground truth study_fields dict
        
        Returns:
            Dictionary with comparison for each field
        """
        results = {}
        
        all_fields = set(extracted.keys()) | set(ground_truth.keys())
        
        for field in all_fields:
            ext_val = extracted.get(field)
            gt_val = ground_truth.get(field)
            
            # Determine if match
            if gt_val is None:
                match = ext_val is None
            elif isinstance(gt_val, (int, float)) and isinstance(ext_val, (int, float)):
                # Numeric comparison with tolerance
                if gt_val == 0:
                    match = ext_val == 0
                else:
                    match = abs(ext_val - gt_val) / abs(gt_val) <= 0.1  # 10% tolerance
            elif isinstance(gt_val, bool):
                match = ext_val == gt_val
            else:
                match = str(ext_val).lower() == str(gt_val).lower()
            
            results[field] = {
                "extracted": ext_val,
                "ground_truth": gt_val,
                "match": match,
            }
        
        return results


class BenchmarkRunner:
    """
    Run extraction benchmarks against synthetic or gold standard data.
    """
    
    def __init__(
        self,
        extraction_func: Optional[callable] = None,
        metrics_calculator: Optional[MetricsCalculator] = None,
    ):
        """
        Initialize benchmark runner.
        
        Args:
            extraction_func: Async function to perform extraction
            metrics_calculator: Custom metrics calculator
        """
        self._extraction_func = extraction_func
        self.metrics = metrics_calculator or MetricsCalculator()
        self._benchmark_counter = 0
    
    def _generate_benchmark_id(self) -> str:
        """Generate unique benchmark ID."""
        self._benchmark_counter += 1
        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        return f"BENCH-{timestamp}-{self._benchmark_counter:03d}"
    
    async def _default_extraction(
        self,
        text: str,
        tier: str,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Default extraction function using the extraction module.
        
        Returns tuple of (extraction_dict, metadata).
        """
        try:
            from ..extract_from_cells import extract_clinical_from_cell
            
            result = await extract_clinical_from_cell(
                cell_text=text,
                force_tier=tier,
                skip_classification=True,
            )
            
            extraction_dict = result.extraction.model_dump() if result.extraction else {}
            metadata = {
                "tier_used": result.tier_used,
                "model": result.model,
                "cost_usd": result.cost_usd,
                "tokens": result.tokens,
                "processing_time_ms": result.processing_time_ms,
            }
            
            return extraction_dict, metadata
            
        except Exception as e:
            logger.warning(f"Extraction failed: {e}")
            return {}, {"error": str(e)}
    
    async def _mock_extraction(
        self,
        text: str,
        tier: str,
        ground_truth: GroundTruth,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Mock extraction that returns ground truth with some noise.
        
        Used for testing the benchmark framework itself.
        """
        import random
        
        # Simulate latency
        await asyncio.sleep(random.uniform(0.05, 0.2))
        
        # Return ground truth with occasional errors
        extraction = ground_truth.to_dict()
        
        # Randomly drop some items to simulate imperfect extraction
        for category in ["diagnoses", "procedures", "medications"]:
            if extraction.get(category) and random.random() < 0.2:
                # Remove one item
                extraction[category] = extraction[category][:-1]
        
        # Randomly add false positives
        if random.random() < 0.1:
            extraction.setdefault("diagnoses", []).append({"text": "spurious finding"})
        
        metadata = {
            "tier_used": tier,
            "model": "mock-model",
            "cost_usd": random.uniform(0.001, 0.01),
            "tokens": {"input": random.randint(500, 2000), "output": random.randint(200, 800)},
            "processing_time_ms": random.uniform(50, 200),
        }
        
        return extraction, metadata
    
    async def run_single(
        self,
        note: SyntheticNote,
        tier: str = "MINI",
        use_mock: bool = False,
    ) -> Dict[str, Any]:
        """
        Run extraction on a single note.
        
        Args:
            note: SyntheticNote to process
            tier: Model tier
            use_mock: Use mock extraction for testing
        
        Returns:
            Dictionary with extraction results and metrics
        """
        start_time = time.time()
        
        if use_mock:
            extraction, metadata = await self._mock_extraction(
                note.text, tier, note.ground_truth
            )
        elif self._extraction_func:
            extraction, metadata = await self._extraction_func(note.text, tier)
        else:
            extraction, metadata = await self._default_extraction(note.text, tier)
        
        latency_ms = (time.time() - start_time) * 1000
        
        # Calculate metrics against ground truth
        category_metrics = self.metrics.compare_extraction(
            extraction, note.ground_truth
        )
        
        # Compare study fields
        study_field_comparison = self.metrics.compare_study_fields(
            extraction.get("study_fields", {}),
            note.ground_truth.study_fields,
        )
        
        return {
            "note_id": note.note_id,
            "complexity": note.complexity,
            "tier": tier,
            "latency_ms": latency_ms,
            "extraction": extraction,
            "metadata": metadata,
            "category_metrics": {k: v.to_dict() for k, v in category_metrics.items()},
            "study_field_comparison": study_field_comparison,
            "success": "error" not in metadata,
        }
    
    async def run_benchmark(
        self,
        notes: List[SyntheticNote],
        tier: str = "MINI",
        concurrency: int = 5,
        use_mock: bool = False,
    ) -> BenchmarkResult:
        """
        Run benchmark on a batch of notes.
        
        Args:
            notes: List of SyntheticNote objects
            tier: Model tier to use
            concurrency: Maximum concurrent extractions
            use_mock: Use mock extraction for testing
        
        Returns:
            BenchmarkResult with aggregate metrics
        """
        benchmark_id = self._generate_benchmark_id()
        started_at = datetime.utcnow().isoformat() + "Z"
        
        logger.info(f"Starting benchmark {benchmark_id}: {len(notes)} notes, tier={tier}")
        
        # Run extractions with concurrency control
        semaphore = asyncio.Semaphore(concurrency)
        
        async def run_with_semaphore(note: SyntheticNote):
            async with semaphore:
                return await self.run_single(note, tier=tier, use_mock=use_mock)
        
        tasks = [run_with_semaphore(note) for note in notes]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        completed_at = datetime.utcnow().isoformat() + "Z"
        
        # Aggregate results
        successful = 0
        failed = 0
        latencies = []
        total_cost = 0.0
        total_input_tokens = 0
        total_output_tokens = 0
        
        # Aggregate category metrics
        aggregated_metrics: Dict[str, ExtractionMetrics] = {}
        for category in MetricsCalculator.CATEGORIES:
            aggregated_metrics[category] = ExtractionMetrics(category=category)
        
        individual_results = []
        
        for result in results:
            if isinstance(result, Exception):
                failed += 1
                individual_results.append({"error": str(result)})
                continue
            
            if result.get("success", False):
                successful += 1
                latencies.append(result["latency_ms"])
                
                # Aggregate cost
                metadata = result.get("metadata", {})
                total_cost += metadata.get("cost_usd", 0.0)
                tokens = metadata.get("tokens", {})
                total_input_tokens += tokens.get("input", 0)
                total_output_tokens += tokens.get("output", 0)
                
                # Aggregate category metrics
                for cat, metrics_dict in result.get("category_metrics", {}).items():
                    if cat in aggregated_metrics:
                        aggregated_metrics[cat].true_positives += metrics_dict.get("true_positives", 0)
                        aggregated_metrics[cat].false_positives += metrics_dict.get("false_positives", 0)
                        aggregated_metrics[cat].false_negatives += metrics_dict.get("false_negatives", 0)
            else:
                failed += 1
            
            individual_results.append(result)
        
        # Calculate latency statistics
        latencies.sort()
        total_latency = sum(latencies) if latencies else 0
        avg_latency = total_latency / len(latencies) if latencies else 0
        min_latency = latencies[0] if latencies else 0
        max_latency = latencies[-1] if latencies else 0
        p95_index = int(len(latencies) * 0.95) if latencies else 0
        p95_latency = latencies[p95_index] if latencies else 0
        
        return BenchmarkResult(
            benchmark_id=benchmark_id,
            tier=tier,
            started_at=started_at,
            completed_at=completed_at,
            total_notes=len(notes),
            successful=successful,
            failed=failed,
            category_metrics=aggregated_metrics,
            total_latency_ms=total_latency,
            avg_latency_ms=avg_latency,
            min_latency_ms=min_latency,
            max_latency_ms=max_latency,
            p95_latency_ms=p95_latency,
            total_cost_usd=total_cost,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            individual_results=individual_results,
        )
    
    async def compare_tiers(
        self,
        notes: List[SyntheticNote],
        tiers: List[str] = None,
        use_mock: bool = False,
    ) -> Dict[str, BenchmarkResult]:
        """
        Compare extraction performance across tiers.
        
        Args:
            notes: List of notes to benchmark
            tiers: List of tiers to compare (default: NANO, MINI, FRONTIER)
            use_mock: Use mock extraction
        
        Returns:
            Dictionary of BenchmarkResult by tier
        """
        tiers = tiers or ["NANO", "MINI", "FRONTIER"]
        results = {}
        
        for tier in tiers:
            logger.info(f"Running benchmark for tier: {tier}")
            results[tier] = await self.run_benchmark(
                notes, tier=tier, use_mock=use_mock
            )
        
        return results
    
    def print_tier_comparison(self, results: Dict[str, BenchmarkResult]) -> str:
        """Generate comparison report for tier benchmarks."""
        lines = [
            "═══════════════════════════════════════════════════════════════════════════",
            "                        TIER COMPARISON REPORT                              ",
            "═══════════════════════════════════════════════════════════════════════════",
            "",
            f"{'Tier':<12} {'F1 Score':<12} {'Precision':<12} {'Recall':<12} {'Avg Latency':<14} {'Cost/Note':<12}",
            "─" * 75,
        ]
        
        for tier, result in sorted(results.items()):
            lines.append(
                f"{tier:<12} "
                f"{result.overall_f1:<12.3f} "
                f"{result.overall_precision:<12.3f} "
                f"{result.overall_recall:<12.3f} "
                f"{result.avg_latency_ms:<14.0f}ms "
                f"${result.total_cost_usd/max(result.successful,1):<12.4f}"
            )
        
        lines.extend([
            "",
            "═══════════════════════════════════════════════════════════════════════════",
        ])
        
        return "\n".join(lines)


# Convenience functions
async def run_quick_benchmark(
    note_count: int = 10,
    tier: str = "MINI",
    seed: int = 42,
) -> BenchmarkResult:
    """Run a quick benchmark with synthetic data."""
    from .synthetic_data import SyntheticNoteGenerator
    
    generator = SyntheticNoteGenerator(seed=seed)
    notes = generator.generate_batch(count=note_count)
    
    runner = BenchmarkRunner()
    return await runner.run_benchmark(notes, tier=tier, use_mock=True)


async def run_gold_standard_benchmark(
    tier: str = "MINI",
    use_mock: bool = True,
) -> BenchmarkResult:
    """Run benchmark against gold standard cases."""
    from .synthetic_data import get_gold_standard_cases
    
    gold_cases = get_gold_standard_cases()
    runner = BenchmarkRunner()
    return await runner.run_benchmark(gold_cases, tier=tier, use_mock=use_mock)


__all__ = [
    "BenchmarkRunner",
    "BenchmarkResult",
    "MetricsCalculator",
    "ExtractionMetrics",
    "run_quick_benchmark",
    "run_gold_standard_benchmark",
]

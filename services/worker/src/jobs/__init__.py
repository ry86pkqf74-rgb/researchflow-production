"""
Worker Jobs Module for Phase C

Provides job handlers for literature processing, data parsing, and analysis.
"""

from .literature_indexing import (
    index_literature,
    search_literature,
    LiteratureIndexingConfig,
)
from .literature_summarization import summarize_literature, SummarizationConfig
from .literature_matrix import build_literature_matrix, LiteratureMatrixConfig
from .gap_analysis import run_gap_analysis, GapAnalysisConfig

__all__ = [
    # Literature indexing and search
    "index_literature",
    "search_literature",
    "LiteratureIndexingConfig",
    # Literature summarization
    "summarize_literature",
    "SummarizationConfig",
    # Literature matrix
    "build_literature_matrix",
    "LiteratureMatrixConfig",
    # Gap analysis
    "run_gap_analysis",
    "GapAnalysisConfig",
]

"""
Data Fusion Module

Provides merge/join logic for heterogeneous datasets.
"""

from .fusion_engine import FusionEngine, FusionConfig, FusionResult

__all__ = [
    'FusionEngine',
    'FusionConfig',
    'FusionResult',
]

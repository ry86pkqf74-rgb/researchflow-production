"""
Data Lineage Module

Tracks data dependencies and generates lineage graphs.
"""

from .dependency_graph import DependencyGraph, generate_lineage_graph, LineageNode

__all__ = [
    'DependencyGraph',
    'generate_lineage_graph',
    'LineageNode',
]

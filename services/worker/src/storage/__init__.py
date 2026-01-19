"""
Storage Module

Provides storage-related utilities for the worker service:
- Artifact compression
- File handling
- Storage backend abstraction
"""

from .compression import (
    ArtifactCompressor,
    CompressionAlgorithm,
    CompressionConfig,
    CompressionResult,
    create_compressor,
)

__all__ = [
    "ArtifactCompressor",
    "CompressionAlgorithm",
    "CompressionConfig",
    "CompressionResult",
    "create_compressor",
]

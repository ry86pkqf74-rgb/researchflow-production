"""
Execution Module

Distributed per-chunk LLM processing with Ray.

Based on document_pdf.pdf specification (pages 14-17).

The execution backend can be switched via environment variable:
    EXECUTION_BACKEND=ray|local

Usage:
    from execution.ray_llm_executor import map_chunks_with_ray

    if os.getenv("EXECUTION_BACKEND") == "ray":
        results = map_chunks_with_ray(
            chunks,
            context_builder=lambda i, c: {"chunk_index": i},
        )
    else:
        results = [extract_one(chunk) for chunk in chunks]

Notes:
    - Ray actors keep model clients warm, reducing repeated init
    - Backpressure using ray.wait() to pipeline results
    - Feature-flagged so it can be turned on per deployment
"""

from .ray_llm_executor import (
    RayExecutionConfig,
    LLMParseActor,
    map_chunks_with_ray,
)

__all__ = [
    "RayExecutionConfig",
    "LLMParseActor",
    "map_chunks_with_ray",
]

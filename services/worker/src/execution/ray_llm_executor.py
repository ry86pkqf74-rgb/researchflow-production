"""
Ray LLM Executor

Distributed per-chunk LLM processing using Ray actors.

Based on document_pdf.pdf specification (pages 14-17).

Environment Variables:
    EXECUTION_BACKEND: "ray" or "local" (default: local)
    RAY_ADDRESS: Ray cluster address (optional)
    RAY_NUM_ACTORS: Number of parallel actors (default: 8)
    RAY_MAX_IN_FLIGHT: Max concurrent tasks (default: 64)
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)

_ray_available = False
try:
    import ray
    _ray_available = True
except ImportError:
    ray = None


@dataclass(frozen=True)
class RayExecutionConfig:
    address: Optional[str] = None
    num_actors: int = 8
    max_in_flight: int = 64

    @classmethod
    def from_env(cls) -> "RayExecutionConfig":
        return cls(
            address=os.getenv("RAY_ADDRESS"),
            num_actors=int(os.getenv("RAY_NUM_ACTORS", "8")),
            max_in_flight=int(os.getenv("RAY_MAX_IN_FLIGHT", "64")),
        )


def _check_ray_available() -> None:
    if not _ray_available:
        raise ImportError("Ray not installed. Install: pip install ray[default]")


if _ray_available:
    @ray.remote
    class LLMParseActor:
        def __init__(self) -> None:
            self.llm = None
            logger.info("LLMParseActor initialized")

        def parse(self, chunk: str, context: Dict[str, Any]) -> Dict[str, Any]:
            if self.llm is None:
                return {"chunk_preview": chunk[:80], "context": context, "extracted": {}}
            raise NotImplementedError("Wire to your actual LLM client.")
else:
    class LLMParseActor:
        pass


def map_chunks_with_ray(
    chunks: Iterable[str],
    *,
    context_builder: Callable[[int, str], Dict[str, Any]],
    cfg: Optional[RayExecutionConfig] = None,
) -> List[Dict[str, Any]]:
    _check_ray_available()
    cfg = cfg or RayExecutionConfig.from_env()

    if not ray.is_initialized():
        ray.init(address=cfg.address, ignore_reinit_error=True)

    actors = [LLMParseActor.remote() for _ in range(cfg.num_actors)]
    in_flight: List[ray.ObjectRef] = []
    results: List[Dict[str, Any]] = []
    actor_idx = 0

    for i, chunk in enumerate(chunks):
        ctx = context_builder(i, chunk)
        ref = actors[actor_idx].parse.remote(chunk, ctx)
        in_flight.append(ref)
        actor_idx = (actor_idx + 1) % len(actors)

        if len(in_flight) >= cfg.max_in_flight:
            done, in_flight = ray.wait(in_flight, num_returns=1)
            results.append(ray.get(done[0]))

    while in_flight:
        done, in_flight = ray.wait(in_flight, num_returns=1)
        results.append(ray.get(done[0]))

    return results


def map_chunks_local(
    chunks: Iterable[str],
    *,
    extract_fn: Callable[[str, Dict[str, Any]], Dict[str, Any]],
    context_builder: Callable[[int, str], Dict[str, Any]],
) -> List[Dict[str, Any]]:
    results = []
    for i, chunk in enumerate(chunks):
        ctx = context_builder(i, chunk)
        result = extract_fn(chunk, ctx)
        results.append(result)
    return results


def map_chunks(
    chunks: Iterable[str],
    *,
    extract_fn: Callable[[str, Dict[str, Any]], Dict[str, Any]],
    context_builder: Callable[[int, str], Dict[str, Any]],
    cfg: Optional[RayExecutionConfig] = None,
) -> List[Dict[str, Any]]:
    backend = os.getenv("EXECUTION_BACKEND", "local").lower()
    if backend == "ray" and _ray_available:
        return map_chunks_with_ray(chunks, context_builder=context_builder, cfg=cfg)
    return map_chunks_local(chunks, extract_fn=extract_fn, context_builder=context_builder)

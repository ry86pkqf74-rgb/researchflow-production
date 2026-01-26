"""
Prometheus Metrics Module

Exposes /metrics endpoint for Prometheus scraping.
Phase 08: Observability + Worker Parallelism

See docs/architecture/perf-optimization-roadmap.md
"""

from __future__ import annotations

import os
import time
import logging
from functools import wraps
from typing import Callable, TypeVar, ParamSpec
from dataclasses import dataclass, field
from collections import defaultdict

logger = logging.getLogger(__name__)

P = ParamSpec("P")
R = TypeVar("R")


def _parse_bool(value: str | None, default: bool) -> bool:
    """Parse boolean from environment variable."""
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


# Configuration
METRICS_ENABLED = _parse_bool(os.getenv("METRICS_ENABLED"), True)


@dataclass
class MetricValue:
    """Container for a metric value with labels."""
    value: float = 0.0
    labels: dict[str, str] = field(default_factory=dict)


@dataclass
class Counter:
    """Prometheus counter metric."""
    name: str
    help: str
    values: dict[str, float] = field(default_factory=lambda: defaultdict(float))

    def inc(self, amount: float = 1.0, **labels: str) -> None:
        """Increment counter."""
        key = self._labels_key(labels)
        self.values[key] += amount

    def _labels_key(self, labels: dict[str, str]) -> str:
        """Create a string key from labels."""
        if not labels:
            return ""
        sorted_items = sorted(labels.items())
        return ",".join(f'{k}="{v}"' for k, v in sorted_items)

    def format(self) -> str:
        """Format as Prometheus text."""
        lines = [
            f"# HELP {self.name} {self.help}",
            f"# TYPE {self.name} counter",
        ]
        if not self.values:
            lines.append(f"{self.name} 0")
        else:
            for labels_key, value in self.values.items():
                if labels_key:
                    lines.append(f"{self.name}{{{labels_key}}} {value}")
                else:
                    lines.append(f"{self.name} {value}")
        return "\n".join(lines)


@dataclass
class Gauge:
    """Prometheus gauge metric."""
    name: str
    help: str
    values: dict[str, float] = field(default_factory=lambda: defaultdict(float))

    def set(self, value: float, **labels: str) -> None:
        """Set gauge value."""
        key = self._labels_key(labels)
        self.values[key] = value

    def inc(self, amount: float = 1.0, **labels: str) -> None:
        """Increment gauge."""
        key = self._labels_key(labels)
        self.values[key] += amount

    def dec(self, amount: float = 1.0, **labels: str) -> None:
        """Decrement gauge."""
        key = self._labels_key(labels)
        self.values[key] -= amount

    def _labels_key(self, labels: dict[str, str]) -> str:
        if not labels:
            return ""
        sorted_items = sorted(labels.items())
        return ",".join(f'{k}="{v}"' for k, v in sorted_items)

    def format(self) -> str:
        """Format as Prometheus text."""
        lines = [
            f"# HELP {self.name} {self.help}",
            f"# TYPE {self.name} gauge",
        ]
        if not self.values:
            lines.append(f"{self.name} 0")
        else:
            for labels_key, value in self.values.items():
                if labels_key:
                    lines.append(f"{self.name}{{{labels_key}}} {value}")
                else:
                    lines.append(f"{self.name} {value}")
        return "\n".join(lines)


@dataclass
class Histogram:
    """Prometheus histogram metric."""
    name: str
    help: str
    buckets: tuple[float, ...] = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
    observations: dict[str, list[float]] = field(default_factory=lambda: defaultdict(list))

    def observe(self, value: float, **labels: str) -> None:
        """Record an observation."""
        key = self._labels_key(labels)
        self.observations[key].append(value)

    def _labels_key(self, labels: dict[str, str]) -> str:
        if not labels:
            return ""
        sorted_items = sorted(labels.items())
        return ",".join(f'{k}="{v}"' for k, v in sorted_items)

    def format(self) -> str:
        """Format as Prometheus text."""
        lines = [
            f"# HELP {self.name} {self.help}",
            f"# TYPE {self.name} histogram",
        ]

        for labels_key, obs in self.observations.items():
            label_prefix = f"{{{labels_key}," if labels_key else "{"
            label_suffix = "}" if labels_key else ""

            # Calculate bucket counts
            bucket_counts = {b: 0 for b in self.buckets}
            bucket_counts[float("inf")] = 0

            for v in obs:
                for bucket in self.buckets:
                    if v <= bucket:
                        bucket_counts[bucket] += 1
                bucket_counts[float("inf")] += 1

            # Output buckets
            cumulative = 0
            for bucket in self.buckets:
                cumulative += bucket_counts[bucket]
                if labels_key:
                    lines.append(f'{self.name}_bucket{{{labels_key},le="{bucket}"}} {cumulative}')
                else:
                    lines.append(f'{self.name}_bucket{{le="{bucket}"}} {cumulative}')

            cumulative += bucket_counts[float("inf")] - cumulative
            if labels_key:
                lines.append(f'{self.name}_bucket{{{labels_key},le="+Inf"}} {len(obs)}')
                lines.append(f"{self.name}_sum{{{labels_key[:-1]}}} {sum(obs)}")
                lines.append(f"{self.name}_count{{{labels_key[:-1]}}} {len(obs)}")
            else:
                lines.append(f'{self.name}_bucket{{le="+Inf"}} {len(obs)}')
                lines.append(f"{self.name}_sum {sum(obs)}")
                lines.append(f"{self.name}_count {len(obs)}")

        if not self.observations:
            for bucket in self.buckets:
                lines.append(f'{self.name}_bucket{{le="{bucket}"}} 0')
            lines.append(f'{self.name}_bucket{{le="+Inf"}} 0')
            lines.append(f"{self.name}_sum 0")
            lines.append(f"{self.name}_count 0")

        return "\n".join(lines)


# Define metrics
REQUEST_COUNT = Counter(
    name="researchflow_worker_requests_total",
    help="Total number of requests by route and status",
)

REQUEST_LATENCY = Histogram(
    name="researchflow_worker_request_duration_seconds",
    help="Request latency in seconds by route",
)

CACHE_HITS = Counter(
    name="researchflow_worker_cache_hits_total",
    help="Total cache hits by cache type",
)

CACHE_MISSES = Counter(
    name="researchflow_worker_cache_misses_total",
    help="Total cache misses by cache type",
)

ACTIVE_REQUESTS = Gauge(
    name="researchflow_worker_active_requests",
    help="Number of currently active requests",
)

AI_INVOCATIONS = Counter(
    name="researchflow_worker_ai_invocations_total",
    help="Total AI invocations by provider and status",
)

PHI_SCANS = Counter(
    name="researchflow_worker_phi_scans_total",
    help="Total PHI scans by result",
)


def track_request(route: str) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """
    Decorator to track request metrics.

    Usage:
        @track_request("/api/ros/literature/search")
        async def search_literature(...):
            ...
    """
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @wraps(func)
        async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            if not METRICS_ENABLED:
                return await func(*args, **kwargs)

            ACTIVE_REQUESTS.inc(route=route)
            start = time.perf_counter()
            status = "success"

            try:
                result = await func(*args, **kwargs)
                return result
            except Exception:
                status = "error"
                raise
            finally:
                duration = time.perf_counter() - start
                REQUEST_COUNT.inc(route=route, status=status)
                REQUEST_LATENCY.observe(duration, route=route)
                ACTIVE_REQUESTS.dec(route=route)

        @wraps(func)
        def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            if not METRICS_ENABLED:
                return func(*args, **kwargs)

            ACTIVE_REQUESTS.inc(route=route)
            start = time.perf_counter()
            status = "success"

            try:
                result = func(*args, **kwargs)
                return result
            except Exception:
                status = "error"
                raise
            finally:
                duration = time.perf_counter() - start
                REQUEST_COUNT.inc(route=route, status=status)
                REQUEST_LATENCY.observe(duration, route=route)
                ACTIVE_REQUESTS.dec(route=route)

        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def track_cache(cache_type: str, hit: bool) -> None:
    """Track cache hit/miss."""
    if not METRICS_ENABLED:
        return
    if hit:
        CACHE_HITS.inc(cache_type=cache_type)
    else:
        CACHE_MISSES.inc(cache_type=cache_type)


def track_ai_invocation(provider: str, status: str) -> None:
    """Track AI invocation."""
    if not METRICS_ENABLED:
        return
    AI_INVOCATIONS.inc(provider=provider, status=status)


def track_phi_scan(has_phi: bool) -> None:
    """Track PHI scan result."""
    if not METRICS_ENABLED:
        return
    result = "phi_detected" if has_phi else "clean"
    PHI_SCANS.inc(result=result)


def get_metrics_text() -> str:
    """
    Generate Prometheus metrics text output.

    Returns:
        Prometheus text format metrics
    """
    if not METRICS_ENABLED:
        return "# Metrics disabled\n"

    sections = [
        REQUEST_COUNT.format(),
        REQUEST_LATENCY.format(),
        CACHE_HITS.format(),
        CACHE_MISSES.format(),
        ACTIVE_REQUESTS.format(),
        AI_INVOCATIONS.format(),
        PHI_SCANS.format(),
    ]

    # Add process metrics
    try:
        import resource
        rusage = resource.getrusage(resource.RUSAGE_SELF)

        sections.append(f"""# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total {rusage.ru_utime + rusage.ru_stime}""")

        sections.append(f"""# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes {rusage.ru_maxrss * 1024}""")

    except ImportError:
        pass

    return "\n\n".join(sections) + "\n"

"""
Health Check Routes

Kubernetes-style health endpoints:
- /healthz: Liveness probe (is the process alive?)
- /readyz: Readiness probe (can accept work?)
- /health: Legacy endpoint for backwards compatibility

Phase A - Task 31: Healthcheck Endpoints + K8s Probes
"""

import os
import sys
import time
import psutil
from fastapi import APIRouter, Response
from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime

router = APIRouter()

# Track startup time
_startup_time = time.time()


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: str
    service: str
    checks: Optional[Dict[str, str]] = None
    error: Optional[str] = None


class DetailedHealthResponse(BaseModel):
    """Detailed health response model"""
    status: str
    timestamp: str
    service: str
    version: str
    environment: str
    uptime: Dict[str, any]
    memory: Dict[str, str]
    cpu: Dict[str, any]
    process: Dict[str, any]
    checks: Dict[str, str]


@router.get("/healthz", response_model=HealthResponse)
async def liveness():
    """
    Liveness Probe
    Returns 200 if the process is alive and can accept requests
    Should NOT check external dependencies
    """
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow().isoformat(),
        service="worker"
    )


@router.get("/readyz", response_model=HealthResponse)
async def readiness(response: Response):
    """
    Readiness Probe
    Returns 200 if the service is ready to accept work
    Should check critical dependencies (Redis, etc.)
    """
    checks = {}
    ready = True

    # TODO: Add Redis connection check
    # Example:
    # try:
    #     redis_client = redis.from_url(os.getenv("REDIS_URL"))
    #     await redis_client.ping()
    #     checks["redis"] = "ok"
    # except Exception as e:
    #     checks["redis"] = "error"
    #     ready = False

    # For now, always ready
    checks["system"] = "ok"

    if ready:
        return HealthResponse(
            status="ready",
            timestamp=datetime.utcnow().isoformat(),
            service="worker",
            checks=checks
        )
    else:
        response.status_code = 503
        return HealthResponse(
            status="not ready",
            timestamp=datetime.utcnow().isoformat(),
            service="worker",
            checks=checks
        )


@router.get("/health", response_model=HealthResponse)
async def health():
    """
    Legacy Health Endpoint
    Maintained for backwards compatibility
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="worker",
        checks={"system": "ok"}
    )


@router.get("/health/detailed", response_model=DetailedHealthResponse)
async def detailed_health():
    """
    Detailed Health Status (for monitoring/debugging)
    Returns detailed information about the service
    """
    try:
        # Get process info
        process = psutil.Process(os.getpid())
        uptime_seconds = time.time() - _startup_time

        # Memory info
        memory_info = process.memory_info()

        # CPU info
        cpu_percent = process.cpu_percent(interval=0.1)

        return DetailedHealthResponse(
            status="healthy",
            timestamp=datetime.utcnow().isoformat(),
            service="worker",
            version=os.getenv("VERSION", "unknown"),
            environment=os.getenv("WORKER_ENV", "development"),
            uptime={
                "seconds": uptime_seconds,
                "formatted": format_uptime(uptime_seconds)
            },
            memory={
                "rss": f"{memory_info.rss / 1024 / 1024:.2f} MB",
                "vms": f"{memory_info.vms / 1024 / 1024:.2f} MB",
                "percent": f"{process.memory_percent():.2f}%"
            },
            cpu={
                "percent": f"{cpu_percent:.2f}%",
                "count": psutil.cpu_count()
            },
            process={
                "pid": os.getpid(),
                "python_version": sys.version.split()[0],
                "platform": sys.platform
            },
            checks={
                "system": "ok"
            }
        )
    except Exception as e:
        return DetailedHealthResponse(
            status="error",
            timestamp=datetime.utcnow().isoformat(),
            service="worker",
            version="unknown",
            environment="unknown",
            uptime={"seconds": 0, "formatted": "0s"},
            memory={},
            cpu={},
            process={},
            checks={},
            error=str(e)
        )


def format_uptime(seconds: float) -> str:
    """Format uptime in human-readable format"""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")

    return " ".join(parts)

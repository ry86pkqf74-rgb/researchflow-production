# ============================================
# ResearchFlow Worker - Python Compute Service
# ============================================
# Build context: services/worker/
# Stages: base → deps → development | production
#
# Usage:
#   Development: docker build --target development -t worker:dev .
#   Production:  docker build --target production -t worker:prod .

# Base stage
FROM python:3.11-slim AS base

# OCI Image Labels
LABEL org.opencontainers.image.title="ResearchFlow Worker"
LABEL org.opencontainers.image.description="Python FastAPI compute service for AI/ML processing"
LABEL org.opencontainers.image.vendor="ResearchFlow"
LABEL org.opencontainers.image.source="https://github.com/ry86pkqf74-rgb/researchflow-production"

# Install system dependencies (including libgit2 for pygit2 version control)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libpq-dev \
    libgit2-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Set default Git config (will be overridden per-user in version control service)
RUN git config --global user.name "ResearchFlow System" && \
    git config --global user.email "system@researchflow.local" && \
    git config --global init.defaultBranch main

WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Development stage
FROM base AS development
WORKDIR /app

COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY . .

ENV PYTHONPATH=/app/src:/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "api_server.py"]

# Production stage
FROM python:3.11-slim AS production

# Install minimal runtime dependencies (including git and libgit2 for version control)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    git \
    libgit2-1.1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -r worker && useradd -r -g worker worker

# Copy dependencies and application
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY . .

# Create data directories (including projects for version control)
RUN mkdir -p /data/artifacts /data/logs /data/manifests /data/projects && \
    chown -R worker:worker /data /app

USER worker

ENV PYTHONPATH=/app/src:/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Uvicorn workers can be configured via UVICORN_WORKERS env var (default: 1)
ENV UVICORN_WORKERS=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run via uvicorn for production with configurable workers
# Override UVICORN_WORKERS at runtime for scaling
CMD ["python", "api_server.py"]

# ============================================
# ResearchFlow Worker - Python Compute Service
# ============================================

# Base stage
FROM python:3.11-slim AS base

# Install system dependencies (including ML/NLP deps for PR3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libpq-dev \
    # PR3: OCR and document processing
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY services/worker/requirements.txt services/worker/pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# PR3: Download spaCy model at build time (deterministic version)
RUN python -m spacy download en_core_web_sm-3.7.1 --direct

# Development stage
FROM base AS development
WORKDIR /app

COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY services/worker/ .

ENV PYTHONPATH=/app/src:/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "api_server.py"]

# Production stage
FROM python:3.11-slim AS production

# Install minimal runtime dependencies (including ML/NLP runtime deps for PR3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    # PR3: OCR and document processing (runtime only)
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -r worker && useradd -r -g worker worker

# Copy dependencies and application
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY services/worker/ .

# Create data directories
RUN mkdir -p /data/artifacts /data/logs /data/manifests && \
    chown -R worker:worker /data /app

USER worker

ENV PYTHONPATH=/app/src:/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Note: HEALTHCHECK removed in favor of Kubernetes liveness/readiness probes
# See infrastructure/kubernetes/base/worker-deployment.yaml for probe configuration

CMD ["python", "api_server.py"]

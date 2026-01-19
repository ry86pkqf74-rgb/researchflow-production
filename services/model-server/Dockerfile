# Model Server for Hugging Face Models (BioBERT)
# Phase A - Task 7: Host Hugging Face Models Locally

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install --no-cache-dir \
    torch==2.2.0 --index-url https://download.pytorch.org/whl/cpu \
    transformers==4.37.2 \
    fastapi==0.109.2 \
    uvicorn[standard]==0.27.1 \
    pydantic==2.6.1

WORKDIR /app

# Download BioBERT model at build time (deterministic, cached in layer)
RUN python -c "from transformers import AutoTokenizer, AutoModelForTokenClassification; \
    AutoTokenizer.from_pretrained('dmis-lab/biobert-base-cased-v1.1'); \
    AutoModelForTokenClassification.from_pretrained('dmis-lab/biobert-base-cased-v1.1')"

# Copy application code
COPY app.py .
COPY requirements.txt .

# Run as non-root user
RUN useradd -m -u 1000 modelserver && chown -R modelserver:modelserver /app
USER modelserver

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

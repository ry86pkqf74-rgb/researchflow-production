#!/bin/bash
# ResearchFlow Production - Local Development Setup Script
# Run this once to initialize the local development environment

set -e

echo "=========================================="
echo "  ResearchFlow Production - Local Setup"
echo "=========================================="

# Create data directories
mkdir -p data/{logs,postgres,redis,artifacts,manifests,uploads}

# Copy environment template if .env doesn't exist
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "[INFO] Created .env from .env.example"
        echo "[WARN] Please update .env with your development/production values!"
        echo "       - Set ANTHROPIC_API_KEY"
        echo "       - Set JWT_SECRET to a strong random value"
        echo "       - Configure database credentials if using external DB"
    fi
fi

# Install Node.js dependencies
echo ""
echo "[INFO] Installing Node.js dependencies..."
npm ci --production=false

# Install Python dependencies
echo ""
echo "[INFO] Installing Python dependencies..."
if [ -f services/worker/requirements.txt ]; then
    pip install -r services/worker/requirements.txt
fi

# Build web frontend
echo ""
echo "[INFO] Building web frontend..."
if [ -d services/web ]; then
    cd services/web
    npm ci --production=false
    npm run build || echo "[WARN] Web build failed - will run in dev mode"
    cd ../..
fi

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Update .env with your secrets"
echo "  2. Run 'npm run local:start' to start all services"
echo "  3. Or use 'npm run dev' for Docker-based development"
echo ""

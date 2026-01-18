#!/bin/bash
# ResearchFlow Production - Replit Setup Script
# Run this once to initialize the environment

set -e

echo "=========================================="
echo "  ResearchFlow Production - Setup"
echo "=========================================="

# Create data directories
mkdir -p data/{logs,postgres,redis,artifacts,manifests,uploads}

# Copy environment template if .env doesn't exist
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "[INFO] Created .env from .env.example"
        echo "[WARN] Please update .env with your production values!"
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
echo "  1. Update .env with your production secrets"
echo "  2. Add secrets to Replit Secrets Manager"
echo "  3. Click 'Run' to start the application"
echo ""

#!/bin/bash
set -e

echo "🐳 Building ResearchFlow Docker images..."

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Build images
echo "📦 Building worker image..."
docker-compose build worker

echo "📦 Building orchestrator image..."
docker-compose build orchestrator

echo "📦 Building web image..."
docker-compose build web

echo "✅ All images built successfully!"
docker images | grep researchflow

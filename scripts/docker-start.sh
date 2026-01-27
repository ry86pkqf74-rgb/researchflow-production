#!/bin/bash
set -e

MODE=${1:-demo}
echo "🚀 Starting ResearchFlow in $MODE mode..."

# Set mode
export APP_MODE=$MODE

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Override mode
export APP_MODE=$MODE

# Start services
docker-compose up -d

# Wait for health
echo "⏳ Waiting for services to start..."
sleep 5

# Check health
docker-compose ps

echo ""
echo "✅ ResearchFlow started!"
echo "   Web UI:       http://localhost:${WEB_PORT:-3000}"
echo "   API:          http://localhost:${ORCHESTRATOR_PORT:-3001}"
echo "   Worker:       http://localhost:${WORKER_PORT:-8001}"
echo "   Mode:         $MODE"

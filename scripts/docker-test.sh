#!/bin/bash
set -e

echo "🧪 Running Docker integration tests..."

# Start services
./scripts/docker-start.sh demo

# Wait for services
sleep 10

# Test health endpoints
echo "Testing health endpoints..."

echo -n "Worker: "
curl -sf http://localhost:8001/health && echo "✅" || echo "❌"

echo -n "Orchestrator: "
curl -sf http://localhost:3001/health && echo "✅" || echo "❌"

echo -n "Web: "
curl -sf http://localhost:3000/api/health && echo "✅" || echo "❌"

# Test analysis endpoint
echo ""
echo "Testing analysis endpoint..."
RESULT=$(curl -sf -X POST http://localhost:3001/api/analysis/run \
  -H "Content-Type: application/json" \
  -H "X-App-Mode: demo" \
  -d '{"analysis_type":"descriptive","dataset_id":"test-clinical"}' | jq -r '.success // "error"')

if [ "$RESULT" = "true" ]; then
    echo "Analysis endpoint: ✅"
else
    echo "Analysis endpoint: ❌ (may need test data)"
fi

echo ""
echo "🧪 Tests complete!"

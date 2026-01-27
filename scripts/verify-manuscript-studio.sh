#!/bin/bash
# =============================================================================
# Manuscript Studio Verification Script
# Track M Phase M8 - Final Compose Check
# =============================================================================

set -e

echo "=============================================="
echo "  Manuscript Studio Verification"
echo "  Track M Phase M8"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:5173}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

# Track results
PASSED=0
FAILED=0

check() {
    local name=$1
    local result=$2
    if [ "$result" -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $name"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $name"
        ((FAILED++))
    fi
}

echo "1. Validating docker-compose..."
echo "----------------------------------------"
docker compose -f "$COMPOSE_FILE" config --quiet 2>/dev/null
check "Docker compose syntax valid" $?

echo ""
echo "2. Checking services are running..."
echo "----------------------------------------"
if docker compose -f "$COMPOSE_FILE" ps | grep -q "orchestrator.*running"; then
    check "Orchestrator service running" 0
else
    check "Orchestrator service running" 1
fi

if docker compose -f "$COMPOSE_FILE" ps | grep -q "web.*running"; then
    check "Web service running" 0
else
    check "Web service running" 1
fi

if docker compose -f "$COMPOSE_FILE" ps | grep -q "postgres.*running"; then
    check "Postgres service running" 0
else
    check "Postgres service running" 1
fi

if docker compose -f "$COMPOSE_FILE" ps | grep -q "redis.*running"; then
    check "Redis service running" 0
else
    check "Redis service running" 1
fi

echo ""
echo "3. Checking health endpoints..."
echo "----------------------------------------"

# Orchestrator health
if curl -sf "$API_URL/health" > /dev/null 2>&1; then
    check "Orchestrator /health endpoint" 0
else
    check "Orchestrator /health endpoint" 1
fi

# Manuscript ping
PING_RESPONSE=$(curl -sf "$API_URL/api/manuscripts/ping" 2>/dev/null || echo "")
if echo "$PING_RESPONSE" | grep -q '"status":"ok"'; then
    check "Manuscript /api/manuscripts/ping endpoint" 0
    echo "    Response: $PING_RESPONSE"
else
    check "Manuscript /api/manuscripts/ping endpoint" 1
fi

# Web health
if curl -sf "$WEB_URL/health" > /dev/null 2>&1 || curl -sf "$WEB_URL" > /dev/null 2>&1; then
    check "Web service accessible" 0
else
    check "Web service accessible" 1
fi

echo ""
echo "4. Checking manuscript routes mounted..."
echo "----------------------------------------"

# Test manuscript list endpoint (may return 401 for auth)
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/api/manuscripts" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "401" ]; then
    check "GET /api/manuscripts route mounted (HTTP $HTTP_CODE)" 0
else
    check "GET /api/manuscripts route mounted (HTTP $HTTP_CODE)" 1
fi

# Test manuscript sections endpoint
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/api/manuscripts/test-id/sections" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "404" ] || [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "200" ]; then
    check "GET /api/manuscripts/:id/sections route mounted (HTTP $HTTP_CODE)" 0
else
    check "GET /api/manuscripts/:id/sections route mounted (HTTP $HTTP_CODE)" 1
fi

# Test manuscript comments endpoint
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/api/manuscripts/test-id/comments" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "404" ] || [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "200" ]; then
    check "GET /api/manuscripts/:id/comments route mounted (HTTP $HTTP_CODE)" 0
else
    check "GET /api/manuscripts/:id/comments route mounted (HTTP $HTTP_CODE)" 1
fi

# Test manuscript doc endpoint
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/api/manuscripts/test-id/doc" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "404" ] || [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "200" ]; then
    check "GET /api/manuscripts/:id/doc route mounted (HTTP $HTTP_CODE)" 0
else
    check "GET /api/manuscripts/:id/doc route mounted (HTTP $HTTP_CODE)" 1
fi

# Test manuscript events endpoint
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/api/manuscripts/test-id/events" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "404" ] || [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "200" ]; then
    check "GET /api/manuscripts/:id/events route mounted (HTTP $HTTP_CODE)" 0
else
    check "GET /api/manuscripts/:id/events route mounted (HTTP $HTTP_CODE)" 1
fi

echo ""
echo "5. Checking collab WebSocket (if enabled)..."
echo "----------------------------------------"
COLLAB_URL="${COLLAB_URL:-http://localhost:1235}"
if curl -sf "$COLLAB_URL/health" > /dev/null 2>&1; then
    check "Collab health endpoint" 0
else
    echo -e "${YELLOW}⚠️  SKIP${NC}: Collab service not running (optional)"
fi

echo ""
echo "6. Checking governance mode..."
echo "----------------------------------------"
HEALTH_RESPONSE=$(curl -sf "$API_URL/health" 2>/dev/null || echo "{}")
GOVERNANCE_MODE=$(echo "$HEALTH_RESPONSE" | grep -o '"governanceMode":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
echo "    Governance Mode: $GOVERNANCE_MODE"
if [ "$GOVERNANCE_MODE" == "LIVE" ] || [ "$GOVERNANCE_MODE" == "DEMO" ]; then
    check "Governance mode configured" 0
else
    check "Governance mode configured" 1
fi

echo ""
echo "=============================================="
echo "  VERIFICATION SUMMARY"
echo "=============================================="
echo -e "  ${GREEN}Passed${NC}: $PASSED"
echo -e "  ${RED}Failed${NC}: $FAILED"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo "   Manuscript Studio is ready."
    exit 0
else
    echo -e "${RED}❌ Some checks failed.${NC}"
    echo "   Please review the failures above."
    exit 1
fi

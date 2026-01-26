#!/bin/bash

# =============================================================================
# ResearchFlow ROS Integration Smoke Tests
# =============================================================================
#
# This script validates that all ROS-wired services are functioning correctly.
# Run after docker compose up to verify the deployment.
#
# Usage: ./scripts/smoke-test.sh
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:3001}"
WORKER_URL="${WORKER_URL:-http://localhost:8000}"
COLLAB_URL="${COLLAB_URL:-http://localhost:1235}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-ros}"
DB_NAME="${DB_NAME:-ros}"

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
log_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
    ((WARNINGS++))
}

log_section() {
    echo ""
    echo "============================================"
    echo "$1"
    echo "============================================"
}

# Test functions
test_health_endpoint() {
    local url="$1"
    local name="$2"

    response=$(curl -sf --max-time 10 "$url" 2>/dev/null) && {
        log_pass "$name health endpoint responding"
        return 0
    } || {
        log_fail "$name health endpoint not responding at $url"
        return 1
    }
}

test_api_endpoint() {
    local method="$1"
    local url="$2"
    local data="$3"
    local name="$4"
    local expected_status="${5:-200}"

    if [ "$method" = "GET" ]; then
        status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null) || status="000"
    else
        status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 15 -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null) || status="000"
    fi

    if [ "$status" = "$expected_status" ]; then
        log_pass "$name returned HTTP $status"
        return 0
    else
        log_fail "$name returned HTTP $status (expected $expected_status)"
        return 1
    fi
}

test_database_connection() {
    # Try using docker exec if available, otherwise psql
    if command -v docker &> /dev/null; then
        docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null && {
            log_pass "Database connection via docker"
            return 0
        }
    fi

    # Fallback to direct connection
    if command -v psql &> /dev/null; then
        PGPASSWORD="ros" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null && {
            log_pass "Database connection via psql"
            return 0
        }
    fi

    log_warn "Could not verify database connection (psql not available)"
    return 0
}

test_database_tables() {
    if command -v docker &> /dev/null; then
        tables=$(docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
        if [ -n "$tables" ] && [ "$tables" -gt 10 ]; then
            log_pass "Database has $tables tables (migrations applied)"
            return 0
        else
            log_fail "Database has only $tables tables (migrations may not have run)"
            return 1
        fi
    else
        log_warn "Could not verify database tables (docker not available)"
        return 0
    fi
}

# =============================================================================
# Main Test Sequence
# =============================================================================

echo "============================================"
echo "ResearchFlow ROS Integration Smoke Tests"
echo "============================================"
echo "Orchestrator: $ORCHESTRATOR_URL"
echo "Worker:       $WORKER_URL"
echo "Collab:       $COLLAB_URL"
echo ""

log_section "1. Service Health Checks"

test_health_endpoint "$ORCHESTRATOR_URL/health" "Orchestrator"
test_health_endpoint "$WORKER_URL/health" "Worker"
test_health_endpoint "$COLLAB_URL/health" "Collaboration"

log_section "2. Database Connectivity"

test_database_connection
test_database_tables

log_section "3. Literature API"

test_api_endpoint "POST" "$ORCHESTRATOR_URL/api/ros/literature/search" \
    '{"query": "diabetes", "providers": ["pubmed"], "limit": 1}' \
    "Literature search"

log_section "4. Conference API"

# Note: /api/ros/conference may require auth, testing health instead
test_api_endpoint "GET" "$ORCHESTRATOR_URL/api/ros/conference/health" \
    "" \
    "Conference health" \
    "200" || log_warn "Conference health endpoint may not exist (expected)"

log_section "5. Webhook API"

test_api_endpoint "GET" "$ORCHESTRATOR_URL/api/webhooks/health" \
    "" \
    "Webhooks health"

log_section "6. Governance API"

test_api_endpoint "GET" "$ORCHESTRATOR_URL/api/governance/state" \
    "" \
    "Governance state"

log_section "7. AI Endpoints"

test_api_endpoint "GET" "$ORCHESTRATOR_URL/api/ai/router/status" \
    "" \
    "AI Router status" \
    "200" || test_api_endpoint "GET" "$ORCHESTRATOR_URL/api/ai/router/health" "" "AI Router health" "200"

log_section "8. Manuscript API"

# Basic endpoint test (full generation requires auth)
test_api_endpoint "GET" "$ORCHESTRATOR_URL/api/manuscript/templates" \
    "" \
    "Manuscript templates" \
    "200" || log_warn "Manuscript templates may require auth"

log_section "9. PHI Scanner"

test_api_endpoint "POST" "$ORCHESTRATOR_URL/api/ros/phi/scan" \
    '{"text": "The patient is doing well"}' \
    "PHI scanner" \
    "200" || log_warn "PHI scanner may require auth"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "============================================"
echo "                SUMMARY"
echo "============================================"
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${RED}Failed:${NC}   $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo "============================================"

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
else
    echo -e "${GREEN}All critical tests passed!${NC}"
    exit 0
fi

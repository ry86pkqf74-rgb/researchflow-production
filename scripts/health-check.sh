#!/bin/bash
# ==============================================================================
# ResearchFlow Health Check Script
# ==============================================================================
# Usage: ./scripts/health-check.sh [--verbose]
#
# Checks health of all ResearchFlow services
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERBOSE=false
if [ "$1" = "--verbose" ] || [ "$1" = "-v" ]; then
    VERBOSE=true
fi

# Configuration
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:3001}"
WORKER_URL="${WORKER_URL:-http://localhost:8000}"
GUIDELINE_URL="${GUIDELINE_URL:-http://localhost:8001}"
COLLAB_URL="${COLLAB_URL:-http://localhost:1235}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# Results tracking
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
check_service() {
    local name=$1
    local url=$2
    local endpoint=$3

    printf "%-20s" "$name"

    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url$endpoint" 2>/dev/null || echo "000")

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ Healthy${NC}"
        PASSED=$((PASSED + 1))
        return 0
    elif [ "$response" = "000" ]; then
        echo -e "${RED}✗ Unreachable${NC}"
        FAILED=$((FAILED + 1))
        return 1
    else
        echo -e "${YELLOW}⚠ HTTP $response${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 0
    fi
}

check_redis() {
    printf "%-20s" "Redis"

    if command -v redis-cli &> /dev/null; then
        result=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null || echo "FAIL")
        if [ "$result" = "PONG" ]; then
            echo -e "${GREEN}✓ Healthy${NC}"
            PASSED=$((PASSED + 1))
            return 0
        fi
    fi

    # Try via Docker
    result=$(docker exec researchflow-redis-1 redis-cli ping 2>/dev/null || echo "FAIL")
    if [ "$result" = "PONG" ]; then
        echo -e "${GREEN}✓ Healthy (Docker)${NC}"
        PASSED=$((PASSED + 1))
        return 0
    fi

    echo -e "${RED}✗ Unreachable${NC}"
    FAILED=$((FAILED + 1))
    return 1
}

check_postgres() {
    printf "%-20s" "PostgreSQL"

    # Try via Docker
    result=$(docker exec researchflow-postgres-1 pg_isready -U ros -d ros 2>/dev/null || echo "FAIL")
    if [[ "$result" == *"accepting connections"* ]]; then
        echo -e "${GREEN}✓ Healthy${NC}"
        PASSED=$((PASSED + 1))
        return 0
    fi

    echo -e "${RED}✗ Unreachable${NC}"
    FAILED=$((FAILED + 1))
    return 1
}

check_docker_service() {
    local name=$1
    local container_pattern=$2

    printf "%-20s" "$name"

    # Check if container is running
    status=$(docker ps --filter "name=$container_pattern" --format "{{.Status}}" 2>/dev/null | head -1)

    if [ -z "$status" ]; then
        echo -e "${RED}✗ Not Running${NC}"
        FAILED=$((FAILED + 1))
        return 1
    elif [[ "$status" == *"healthy"* ]]; then
        echo -e "${GREEN}✓ Running (healthy)${NC}"
        PASSED=$((PASSED + 1))
        return 0
    elif [[ "$status" == *"Up"* ]]; then
        echo -e "${YELLOW}⚠ Running (no healthcheck)${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 0
    else
        echo -e "${RED}✗ $status${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Main
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          ResearchFlow Health Check                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}=== Docker Containers ===${NC}"
echo ""
check_docker_service "Orchestrator" "orchestrator"
check_docker_service "Worker" "worker"
check_docker_service "Web" "web"
check_docker_service "Collab" "collab"
check_docker_service "Guideline Engine" "guideline-engine"
check_docker_service "PostgreSQL" "postgres"
check_docker_service "Redis" "redis"
echo ""

echo -e "${BLUE}=== Service Endpoints ===${NC}"
echo ""
check_service "Orchestrator API" "$ORCHESTRATOR_URL" "/api/health"
check_service "Worker API" "$WORKER_URL" "/health"
check_service "Guideline Engine" "$GUIDELINE_URL" "/health"
check_service "Collab Server" "$COLLAB_URL" "/health"
echo ""

echo -e "${BLUE}=== Data Stores ===${NC}"
echo ""
check_redis
check_postgres
echo ""

# Verbose mode: Show additional info
if [ "$VERBOSE" = true ]; then
    echo -e "${BLUE}=== Additional Info ===${NC}"
    echo ""

    echo "Docker containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | grep -E "researchflow|NAME" || true
    echo ""

    echo "Resource usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep -E "researchflow|NAME" || true
    echo ""
fi

# Summary
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Summary: ${GREEN}$PASSED passed${NC}, ${YELLOW}$WARNINGS warnings${NC}, ${RED}$FAILED failed${NC}"
echo ""

# Exit code
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some services are unhealthy!${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}All services running with warnings${NC}"
    exit 0
else
    echo -e "${GREEN}All services healthy!${NC}"
    exit 0
fi

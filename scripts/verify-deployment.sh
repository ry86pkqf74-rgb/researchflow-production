#!/bin/bash
# ============================================
# ResearchFlow Deployment Verification Script
# ============================================
# Verifies all services are running and healthy
#
# Usage:
#   ./scripts/verify-deployment.sh [dev|prod]
#
# Examples:
#   ./scripts/verify-deployment.sh dev
#   ./scripts/verify-deployment.sh prod

set -e

MODE=${1:-dev}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "========================================"
echo "  ResearchFlow Deployment Verification"
echo "========================================"
echo "Mode: ${MODE}"
echo ""

if [ "$MODE" = "prod" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.yml"
fi

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}✗ Error: ${COMPOSE_FILE} not found${NC}"
    exit 1
fi

echo -e "${BLUE}=== Docker Services Status ===${NC}"
if [ "$MODE" = "prod" ]; then
    docker-compose -f docker-compose.prod.yml ps
else
    docker-compose ps
fi

echo ""
echo -e "${BLUE}=== Health Check Verification ===${NC}"

# Function to check service health
check_service() {
    local service=$1
    local url=$2

    echo -n "Checking ${service}... "

    if curl -sf "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Unhealthy${NC}"
        return 1
    fi
}

# Check services based on mode
if [ "$MODE" = "prod" ]; then
    check_service "Nginx HTTP" "http://localhost/health"
    check_service "Nginx HTTPS" "https://localhost/health" || echo -e "  ${YELLOW}Note: HTTPS may require accepting self-signed cert${NC}"
    check_service "Orchestrator (via proxy)" "http://localhost/api/health"
else
    check_service "Orchestrator" "http://localhost:3001/api/health"
    check_service "Worker" "http://localhost:8000/health"
    check_service "Web" "http://localhost:5173/health"
    check_service "Collab" "http://localhost:1235/health"
fi

echo ""
echo -e "${BLUE}=== Container Health Status ===${NC}"

if [ "$MODE" = "prod" ]; then
    SERVICES="nginx orchestrator worker web collab postgres redis"
    for service in $SERVICES; do
        echo -n "Checking ${service} container... "
        health=$(docker-compose -f docker-compose.prod.yml ps -q $service | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "no health check")
        if [ "$health" = "healthy" ]; then
            echo -e "${GREEN}✓ Healthy${NC}"
        elif [ "$health" = "no health check" ]; then
            status=$(docker-compose -f docker-compose.prod.yml ps -q $service | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
            if [ "$status" = "running" ]; then
                echo -e "${YELLOW}⚠ Running (no health check)${NC}"
            else
                echo -e "${RED}✗ ${status}${NC}"
            fi
        else
            echo -e "${RED}✗ ${health}${NC}"
        fi
    done
else
    SERVICES="orchestrator worker web collab postgres redis"
    for service in $SERVICES; do
        echo -n "Checking ${service} container... "
        health=$(docker-compose ps -q $service | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "no health check")
        if [ "$health" = "healthy" ]; then
            echo -e "${GREEN}✓ Healthy${NC}"
        elif [ "$health" = "no health check" ]; then
            status=$(docker-compose ps -q $service | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
            if [ "$status" = "running" ]; then
                echo -e "${YELLOW}⚠ Running (no health check)${NC}"
            else
                echo -e "${RED}✗ ${status}${NC}"
            fi
        else
            echo -e "${RED}✗ ${health}${NC}"
        fi
    done
fi

echo ""
echo -e "${BLUE}=== Volume Status ===${NC}"
if [ "$MODE" = "prod" ]; then
    docker-compose -f docker-compose.prod.yml exec -T postgres du -sh /var/lib/postgresql/data 2>/dev/null && echo -e "${GREEN}✓ PostgreSQL data volume mounted${NC}" || echo -e "${RED}✗ PostgreSQL volume check failed${NC}"
    docker-compose -f docker-compose.prod.yml exec -T redis ls -lh /data 2>/dev/null | grep -q appendonly && echo -e "${GREEN}✓ Redis AOF enabled${NC}" || echo -e "${YELLOW}⚠ Redis AOF status unknown${NC}"
else
    docker-compose exec -T postgres du -sh /var/lib/postgresql/data 2>/dev/null && echo -e "${GREEN}✓ PostgreSQL data volume mounted${NC}" || echo -e "${RED}✗ PostgreSQL volume check failed${NC}"
    docker-compose exec -T redis ls -lh /data 2>/dev/null | grep -q appendonly && echo -e "${GREEN}✓ Redis AOF enabled${NC}" || echo -e "${YELLOW}⚠ Redis AOF status unknown${NC}"
fi

echo ""
echo -e "${BLUE}=== Log Configuration ===${NC}"
if [ "$MODE" = "prod" ]; then
    for service in nginx orchestrator worker web collab postgres redis; do
        log_driver=$(docker inspect $(docker-compose -f docker-compose.prod.yml ps -q $service 2>/dev/null) --format='{{.HostConfig.LogConfig.Type}}' 2>/dev/null || echo "unknown")
        if [ "$log_driver" = "json-file" ]; then
            echo -e "${GREEN}✓ ${service}: json-file logging${NC}"
        else
            echo -e "${YELLOW}⚠ ${service}: ${log_driver}${NC}"
        fi
    done
else
    for service in orchestrator worker web collab postgres redis; do
        log_driver=$(docker inspect $(docker-compose ps -q $service 2>/dev/null) --format='{{.HostConfig.LogConfig.Type}}' 2>/dev/null || echo "unknown")
        if [ "$log_driver" = "json-file" ]; then
            echo -e "${GREEN}✓ ${service}: json-file logging${NC}"
        else
            echo -e "${YELLOW}⚠ ${service}: ${log_driver}${NC}"
        fi
    done
fi

echo ""
echo -e "${BLUE}=== Environment Configuration ===${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"

    # Check critical env vars
    if grep -q "POSTGRES_PASSWORD=" .env && ! grep -q "POSTGRES_PASSWORD=ros" .env; then
        echo -e "${GREEN}✓ Database password configured (not default)${NC}"
    else
        echo -e "${YELLOW}⚠ Using default database password${NC}"
    fi

    if grep -q "JWT_SECRET=" .env && ! grep -q "JWT_SECRET=development-secret" .env; then
        echo -e "${GREEN}✓ JWT secret configured (not default)${NC}"
    else
        echo -e "${YELLOW}⚠ Using default JWT secret${NC}"
    fi

    if grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
        echo -e "${GREEN}✓ Anthropic API key configured${NC}"
    else
        echo -e "${YELLOW}⚠ Anthropic API key not configured${NC}"
    fi
else
    echo -e "${RED}✗ .env file not found (using defaults from .env.example)${NC}"
fi

echo ""
echo -e "${BLUE}=== SSL Configuration ===${NC}"
if [ -f infrastructure/docker/nginx/ssl/cert.pem ] && [ -f infrastructure/docker/nginx/ssl/key.pem ]; then
    echo -e "${GREEN}✓ SSL certificates present${NC}"

    # Check certificate validity
    cert_expiry=$(openssl x509 -in infrastructure/docker/nginx/ssl/cert.pem -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$cert_expiry" ]; then
        echo "  Certificate expires: $cert_expiry"
    fi
else
    echo -e "${YELLOW}⚠ SSL certificates not found${NC}"
fi

echo ""
echo "========================================"
echo "  Deployment Verification Complete"
echo "========================================"
echo ""

# Run quick API test if script exists
if [ -f scripts/test-api-endpoints.sh ]; then
    echo -e "${BLUE}Run full API endpoint tests:${NC}"
    if [ "$MODE" = "prod" ]; then
        echo "  ./scripts/test-api-endpoints.sh https localhost 443"
    else
        echo "  ./scripts/test-api-endpoints.sh http localhost 80"
    fi
    echo ""
fi

echo -e "${GREEN}✓ Verification complete!${NC}"
echo ""

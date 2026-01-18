#!/bin/bash
# ResearchFlow Docker Stop Script
# ================================
# Clean shutdown of all Docker services

set -e

# Colors for output
BLUE='\033[34m'
GREEN='\033[32m'
YELLOW='\033[33m'
NC='\033[0m'

# Navigate to project root
cd "$(dirname "$0")/../.."

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  ResearchFlow Docker Shutdown${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if any containers are running
if ! docker compose ps -q 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}No ResearchFlow containers are currently running.${NC}"
    exit 0
fi

# Show current status before stopping
echo -e "${BLUE}Current running containers:${NC}"
docker compose ps
echo ""

# Stop all services
echo -e "${YELLOW}Stopping all services...${NC}"
docker compose down

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All Services Stopped${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "To remove volumes and clean up completely, run:"
echo "  docker compose down -v"
echo ""

#!/bin/bash
# ResearchFlow Docker Launch Script
# ==================================
# One-command startup for Docker-based deployment

set -e

# Colors for output
BLUE='\033[34m'
GREEN='\033[32m'
YELLOW='\033[33m'
NC='\033[0m'

# Navigate to project root
cd "$(dirname "$0")/../.."

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  ResearchFlow Docker Launch${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Build and start all services in detached mode
echo -e "${BLUE}Building and starting Docker containers...${NC}"
docker compose up --build -d

# Wait a moment for services to initialize
echo -e "${YELLOW}Waiting for services to initialize...${NC}"
sleep 3

# Show status
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Services Started Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Web UI:        ${GREEN}http://localhost:5173${NC}"
echo -e "  API:           ${GREEN}http://localhost:3001${NC}"
echo -e "  PostgreSQL:    localhost:5432"
echo -e "  Redis:         localhost:6379"
echo ""
echo -e "${BLUE}Following web service logs (Ctrl+C to exit)...${NC}"
echo ""

# Follow web service logs
docker compose logs -f web

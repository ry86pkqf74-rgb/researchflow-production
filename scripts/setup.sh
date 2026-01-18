#!/bin/bash
# ResearchFlow Production - Initial Setup Script
# ===============================================

set -e

BLUE='\033[34m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
NC='\033[0m'

echo -e "${BLUE}ResearchFlow Production Setup${NC}"
echo "=============================="
echo ""

# Check prerequisites
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} $1 found"
}

echo "Checking prerequisites..."
check_command docker
check_command docker-compose
check_command node
check_command npm
check_command python3
check_command make

echo ""
echo "Checking versions..."
echo "  Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo "  Node.js: $(node --version)"
echo "  Python: $(python3 --version | cut -d' ' -f2)"

# Create required directories
echo ""
echo "Creating directories..."
mkdir -p backups
mkdir -p data/{artifacts,logs,manifests,uploads}

# Copy environment file if not exists
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}Please edit .env with your configuration${NC}"
else
    echo ".env already exists, skipping..."
fi

# Install Node.js dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Docker is not running. Please start Docker and run this script again.${NC}"
    exit 1
fi

# Pull base images
echo ""
echo "Pulling base Docker images..."
docker pull node:20-alpine
docker pull python:3.11-slim
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker pull nginx:alpine

# Build development images
echo ""
echo "Building development images..."
docker-compose build

# Initialize database
echo ""
echo "Initializing database..."
docker-compose up -d postgres redis
sleep 5

# Wait for postgres
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U ros -d ros &> /dev/null; then
        echo -e "${GREEN}PostgreSQL is ready${NC}"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 1
done

# Run migrations
echo "Running database migrations..."
docker-compose exec -T postgres psql -U ros -d ros -f /docker-entrypoint-initdb.d/init.sql

# Stop services
echo ""
echo "Stopping services..."
docker-compose down

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your configuration (especially ANTHROPIC_API_KEY)"
echo "  2. Run 'make dev' to start the development environment"
echo "  3. Access the application at http://localhost:5173"
echo ""

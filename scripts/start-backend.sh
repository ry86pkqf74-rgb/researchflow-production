#!/bin/bash

# ============================================
# ResearchFlow - Backend-Only Startup Script
# ============================================
# This script starts the backend services only (without frontend)
# Usage: ./scripts/start-backend.sh [command]
#
# Commands:
#   up          - Start services in foreground (default)
#   start       - Start services in background with logs
#   down        - Stop services
#   logs        - Show logs from all services
#   health      - Check health of all services
#   ps          - List running services
#

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Docker compose file
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.backend.yml"
COMPOSE_CMD="docker-compose -f ${COMPOSE_FILE}"

# Default command
COMMAND="${1:-up}"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker and docker-compose are available
check_prerequisites() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    log_success "Docker and Docker Compose are available"
}

# Check if .env file exists
check_env_file() {
    if [ ! -f "${PROJECT_DIR}/.env" ]; then
        log_warning ".env file not found. Creating from .env.example..."
        if [ -f "${PROJECT_DIR}/.env.example" ]; then
            cp "${PROJECT_DIR}/.env.example" "${PROJECT_DIR}/.env"
            log_success ".env file created. Please configure it with your settings."
        else
            log_error ".env.example file not found"
            exit 1
        fi
    fi
}

# Start services
start_services() {
    log_info "Starting backend services..."
    log_info "Using compose file: ${COMPOSE_FILE}"

    $COMPOSE_CMD up -d

    log_success "Services started in background"
    log_info "Waiting for services to be healthy..."
    sleep 5

    show_health_status
}

# Start services in foreground
start_foreground() {
    log_info "Starting backend services in foreground..."
    log_info "Press Ctrl+C to stop"

    $COMPOSE_CMD up
}

# Stop services
stop_services() {
    log_info "Stopping backend services..."
    $COMPOSE_CMD down
    log_success "Services stopped"
}

# Show service logs
show_logs() {
    if [ -z "$2" ]; then
        log_info "Showing logs from all services (Press Ctrl+C to exit)..."
        $COMPOSE_CMD logs -f
    else
        log_info "Showing logs from $2 (Press Ctrl+C to exit)..."
        $COMPOSE_CMD logs -f "$2"
    fi
}

# Check health status
show_health_status() {
    log_info "Checking service health..."
    echo ""

    # Services to check
    services=("postgres" "redis" "orchestrator" "worker" "guideline-engine")

    for service in "${services[@]}"; do
        if $COMPOSE_CMD exec -T "$service" true &> /dev/null; then
            log_success "$service: Running"
        else
            log_warning "$service: Not ready yet"
        fi
    done

    echo ""
    log_info "Service endpoints:"
    echo "  - Orchestrator API:     http://localhost:3001"
    echo "  - Worker API:           http://localhost:8000"
    echo "  - Guideline Engine:     http://localhost:8001"
    echo "  - Redis:                localhost:6379 (with authentication)"
    echo "  - PostgreSQL:           localhost:5432 (not exposed by default)"
}

# List running services
list_services() {
    log_info "Running services:"
    $COMPOSE_CMD ps
}

# Wait for services to be healthy
wait_for_services() {
    log_info "Waiting for services to be healthy..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:3001/health > /dev/null 2>&1 && \
           curl -s http://localhost:8000/health > /dev/null 2>&1 && \
           curl -s http://localhost:8001/health > /dev/null 2>&1; then
            log_success "All services are healthy!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    log_warning "Services did not become healthy within timeout"
    log_info "Run './scripts/start-backend.sh health' to check individual service status"
    return 1
}

# Validate docker-compose file
validate_compose_file() {
    log_info "Validating docker-compose configuration..."

    if $COMPOSE_CMD config > /dev/null 2>&1; then
        log_success "Docker Compose configuration is valid"
    else
        log_error "Docker Compose configuration is invalid"
        exit 1
    fi
}

# Main command handler
case "$COMMAND" in
    up)
        check_prerequisites
        check_env_file
        validate_compose_file
        start_foreground
        ;;
    start)
        check_prerequisites
        check_env_file
        validate_compose_file
        start_services
        wait_for_services
        ;;
    down|stop)
        stop_services
        ;;
    logs)
        show_logs "$@"
        ;;
    health|status)
        show_health_status
        ;;
    ps|list)
        list_services
        ;;
    validate)
        check_prerequisites
        validate_compose_file
        ;;
    help|--help|-h)
        echo "ResearchFlow Backend-Only Startup Script"
        echo ""
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  up               - Start services in foreground (default, press Ctrl+C to stop)"
        echo "  start            - Start services in background with automatic health checks"
        echo "  down             - Stop all services"
        echo "  logs [SERVICE]   - Show service logs (all services if SERVICE not specified)"
        echo "  health           - Check health status of all services"
        echo "  ps               - List running services"
        echo "  validate         - Validate docker-compose configuration"
        echo "  help             - Show this help message"
        echo ""
        echo "Environment:"
        echo "  .env file must exist in project root (will be created from .env.example if missing)"
        echo ""
        echo "Service Ports:"
        echo "  - Orchestrator API:   http://localhost:3001"
        echo "  - Worker API:         http://localhost:8000"
        echo "  - Guideline Engine:   http://localhost:8001"
        echo "  - Redis:              localhost:6379"
        echo ""
        echo "Notes:"
        echo "  - This script starts backend services only (no frontend)"
        echo "  - Redis has authentication enabled via REDIS_PASSWORD env variable"
        echo "  - All services have health checks configured"
        echo "  - Use 'docker-compose -f docker-compose.backend.yml' for direct access"
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac

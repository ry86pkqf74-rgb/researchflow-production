#!/bin/bash
# ResearchFlow Production - Local Development Startup Script
# This script starts all services locally without Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
export NODE_ENV=production
export GOVERNANCE_MODE=${GOVERNANCE_MODE:-LIVE}
export PORT=${PORT:-3001}
export WORKER_PORT=${WORKER_PORT:-8000}
export WEB_PORT=${WEB_PORT:-5173}

# Data directories
DATA_DIR="${PROJECT_ROOT:-$(pwd)}/data"
LOGS_DIR="$DATA_DIR/logs"
PG_DATA="$DATA_DIR/postgres"
REDIS_DATA="$DATA_DIR/redis"
PIDS_DIR="$DATA_DIR/pids"

mkdir -p "$LOGS_DIR" "$PG_DATA" "$REDIS_DATA" "$PIDS_DIR"

log "=========================================="
log "  ResearchFlow Production Startup"
log "=========================================="
log "Environment: $NODE_ENV"
log "Governance Mode: $GOVERNANCE_MODE"
log ""

# Cleanup function
cleanup() {
    log "Shutting down services..."

    # Kill background processes
    if [ -f "$PIDS_DIR/orchestrator.pid" ]; then
        kill $(cat "$PIDS_DIR/orchestrator.pid") 2>/dev/null || true
    fi
    if [ -f "$PIDS_DIR/worker.pid" ]; then
        kill $(cat "$PIDS_DIR/worker.pid") 2>/dev/null || true
    fi
    if [ -f "$PIDS_DIR/web.pid" ]; then
        kill $(cat "$PIDS_DIR/web.pid") 2>/dev/null || true
    fi
    if [ -f "$PIDS_DIR/postgres.pid" ]; then
        pg_ctl -D "$PG_DATA" stop -m fast 2>/dev/null || true
    fi
    if [ -f "$PIDS_DIR/redis.pid" ]; then
        kill $(cat "$PIDS_DIR/redis.pid") 2>/dev/null || true
    fi

    success "All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ==========================================
# Step 1: Start PostgreSQL
# ==========================================
start_postgres() {
    log "Starting PostgreSQL..."

    if [ ! -f "$PG_DATA/PG_VERSION" ]; then
        log "Initializing PostgreSQL database..."
        initdb -D "$PG_DATA" --no-locale --encoding=UTF8

        # Configure for connections
        echo "listen_addresses = 'localhost'" >> "$PG_DATA/postgresql.conf"
        echo "port = 5432" >> "$PG_DATA/postgresql.conf"
        echo "host all all 127.0.0.1/32 trust" >> "$PG_DATA/pg_hba.conf"
    fi

    pg_ctl -D "$PG_DATA" -l "$LOGS_DIR/postgres.log" start
    sleep 2

    # Create database if not exists
    psql -h localhost -p 5432 -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'ros'" | grep -q 1 || \
        createdb -h localhost -p 5432 ros

    # Run init script if exists
    if [ -f "infrastructure/docker/postgres/init.sql" ]; then
        psql -h localhost -p 5432 -d ros -f infrastructure/docker/postgres/init.sql 2>/dev/null || true
    fi

    export DATABASE_URL="postgresql://$(whoami)@localhost:5432/ros"
    success "PostgreSQL started on port 5432"
}

# ==========================================
# Step 2: Start Redis
# ==========================================
start_redis() {
    log "Starting Redis..."

    redis-server --daemonize yes \
        --dir "$REDIS_DATA" \
        --pidfile "$PIDS_DIR/redis.pid" \
        --logfile "$LOGS_DIR/redis.log" \
        --port 6379 \
        --maxmemory 256mb \
        --maxmemory-policy allkeys-lru

    sleep 1
    export REDIS_URL="redis://localhost:6379"
    success "Redis started on port 6379"
}

# ==========================================
# Step 3: Install Dependencies
# ==========================================
install_deps() {
    log "Installing dependencies..."

    # Node.js dependencies
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        log "Installing Node.js dependencies..."
        npm ci --production=false 2>&1 | tail -5
    fi

    # Python dependencies
    if [ -f "services/worker/requirements.txt" ]; then
        log "Installing Python dependencies..."
        pip install -q -r services/worker/requirements.txt 2>&1 | tail -3
    fi

    success "Dependencies installed"
}

# ==========================================
# Step 4: Build Web Frontend
# ==========================================
build_web() {
    log "Building web frontend for production..."

    if [ -d "services/web" ]; then
        cd services/web

        if [ ! -d "node_modules" ]; then
            npm ci --production=false 2>&1 | tail -3
        fi

        # Build for production
        if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
            npm run build 2>&1 | tail -5
        fi

        cd ../..
    fi

    success "Web frontend built"
}

# ==========================================
# Step 5: Start Orchestrator (Node.js API)
# ==========================================
start_orchestrator() {
    log "Starting Orchestrator (Node.js API) on port $PORT..."

    cd services/orchestrator

    # Set environment
    export PORT=$PORT
    export DATABASE_URL="${DATABASE_URL}"
    export REDIS_URL="${REDIS_URL}"
    export WORKER_CALLBACK_URL="http://localhost:$WORKER_PORT"
    export JWT_SECRET="${JWT_SECRET:-researchflow-production-secret-$(date +%s)}"

    # Start in background
    node index.ts > "$LOGS_DIR/orchestrator.log" 2>&1 &
    echo $! > "$PIDS_DIR/orchestrator.pid"

    cd ../..

    # Wait for startup
    for i in {1..30}; do
        if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
            success "Orchestrator started on port $PORT"
            return 0
        fi
        sleep 1
    done

    error "Orchestrator failed to start. Check $LOGS_DIR/orchestrator.log"
    return 1
}

# ==========================================
# Step 6: Start Worker (Python)
# ==========================================
start_worker() {
    log "Starting Worker (Python) on port $WORKER_PORT..."

    cd services/worker

    export DATABASE_URL="${DATABASE_URL}"
    export REDIS_URL="${REDIS_URL}"
    export ARTIFACT_PATH="$DATA_DIR/artifacts"
    export LOG_PATH="$LOGS_DIR"

    mkdir -p "$DATA_DIR/artifacts"

    # Start with uvicorn in production mode
    python -m uvicorn api_server:app \
        --host 0.0.0.0 \
        --port $WORKER_PORT \
        --workers 2 \
        --log-level warning \
        > "$LOGS_DIR/worker.log" 2>&1 &
    echo $! > "$PIDS_DIR/worker.pid"

    cd ../..

    # Wait for startup
    for i in {1..30}; do
        if curl -sf "http://localhost:$WORKER_PORT/health" > /dev/null 2>&1; then
            success "Worker started on port $WORKER_PORT"
            return 0
        fi
        sleep 1
    done

    warn "Worker health check not responding (may still be starting)"
    return 0
}

# ==========================================
# Step 7: Serve Web Frontend
# ==========================================
start_web() {
    log "Starting Web Frontend on port $WEB_PORT..."

    cd services/web

    if [ -d "dist" ]; then
        # Serve built frontend
        npx serve -s dist -l $WEB_PORT > "$LOGS_DIR/web.log" 2>&1 &
        echo $! > "$PIDS_DIR/web.pid"
    else
        warn "No dist folder found, running in dev mode"
        npm run dev -- --port $WEB_PORT --host > "$LOGS_DIR/web.log" 2>&1 &
        echo $! > "$PIDS_DIR/web.pid"
    fi

    cd ../..

    sleep 2
    success "Web Frontend started on port $WEB_PORT"
}

# ==========================================
# Step 8: Health Check
# ==========================================
health_check() {
    log ""
    log "=========================================="
    log "  Health Check"
    log "=========================================="

    echo ""
    echo "Service Status:"
    echo "---------------"

    # PostgreSQL
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo -e "  PostgreSQL:   ${GREEN}✓ Running${NC} (port 5432)"
    else
        echo -e "  PostgreSQL:   ${RED}✗ Not Running${NC}"
    fi

    # Redis
    if redis-cli ping > /dev/null 2>&1; then
        echo -e "  Redis:        ${GREEN}✓ Running${NC} (port 6379)"
    else
        echo -e "  Redis:        ${RED}✗ Not Running${NC}"
    fi

    # Orchestrator
    if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
        echo -e "  Orchestrator: ${GREEN}✓ Running${NC} (port $PORT)"
    else
        echo -e "  Orchestrator: ${RED}✗ Not Running${NC}"
    fi

    # Worker
    if curl -sf "http://localhost:$WORKER_PORT/health" > /dev/null 2>&1; then
        echo -e "  Worker:       ${GREEN}✓ Running${NC} (port $WORKER_PORT)"
    else
        echo -e "  Worker:       ${YELLOW}? Starting${NC} (port $WORKER_PORT)"
    fi

    # Web
    if curl -sf "http://localhost:$WEB_PORT" > /dev/null 2>&1; then
        echo -e "  Web Frontend: ${GREEN}✓ Running${NC} (port $WEB_PORT)"
    else
        echo -e "  Web Frontend: ${YELLOW}? Starting${NC} (port $WEB_PORT)"
    fi

    echo ""
}

# ==========================================
# Main Execution
# ==========================================
main() {
    log "Starting ResearchFlow Production..."

    # Start services
    start_postgres
    start_redis
    install_deps
    build_web
    start_orchestrator
    start_worker
    start_web

    # Health check
    health_check

    log "=========================================="
    log "  ResearchFlow Production is LIVE!"
    log "=========================================="
    echo ""
    echo "Access Points:"
    echo "--------------"
    echo "  Web UI:      http://localhost:$WEB_PORT"
    echo "  API:         http://localhost:$PORT/api"
    echo "  API Health:  http://localhost:$PORT/health"
    echo ""
    echo "Logs are in: $LOGS_DIR/"
    echo ""
    log "Press Ctrl+C to stop all services"
    echo ""

    # Keep script running
    while true; do
        sleep 60
        # Periodic health check
        if ! curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
            warn "Orchestrator not responding, checking logs..."
            tail -5 "$LOGS_DIR/orchestrator.log" 2>/dev/null
        fi
    done
}

# Run main
main "$@"

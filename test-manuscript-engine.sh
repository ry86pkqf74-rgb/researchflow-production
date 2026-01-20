#!/bin/bash
# Manuscript Engine Test Runner (Containerized with Auto-Approve)
# Phase B E2E Test Entry Point

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_usage() {
    cat << EOF
Manuscript Engine Test Runner (Phase B Closeout)

Usage: $0 [COMMAND]

Commands:
  test              Run all unit tests once (default)
  smoke             Run Phase B smoke E2E tests
  e2e               Run Playwright E2E tests
  watch             Run tests in watch mode
  coverage          Generate coverage report
  build             Build the container
  rebuild           Rebuild container from scratch
  shell             Open interactive shell
  clean             Clean up containers and volumes

Examples:
  $0 test           # Run unit tests
  $0 smoke          # Run Phase B smoke E2E (fast)
  $0 e2e            # Run Playwright UI E2E
  $0 coverage       # Coverage report
  $0 shell          # Debug in container

Auto-Approve: Tests run automatically without prompts
Container: Isolated environment with all dependencies

EOF
}

COMPOSE_FILE="docker-compose.manuscript-test.yml"
COMMAND=${1:-test}

case $COMMAND in
    test)
        print_info "Running manuscript-engine tests in container..."
        docker-compose -f $COMPOSE_FILE run --rm manuscript-engine-test
        print_success "Tests completed!"
        ;;

    smoke)
        print_info "Running Phase B smoke E2E tests..."
        print_info "This tests manuscript creation, generation, export, and governance gates."
        ./scripts/test-phase-b-smoke.sh
        print_success "Smoke E2E tests completed!"
        ;;

    e2e)
        print_info "Running Playwright E2E tests..."
        print_info "Ensure services are running: docker-compose up -d"
        npx playwright test tests/e2e/manuscripts.spec.ts
        print_success "Playwright E2E tests completed!"
        ;;

    watch)
        print_info "Starting test watcher..."
        print_warning "Press Ctrl+C to stop"
        docker-compose -f $COMPOSE_FILE run --rm manuscript-engine-watch
        ;;

    coverage)
        print_info "Generating coverage report..."
        docker-compose -f $COMPOSE_FILE run --rm manuscript-engine-coverage
        print_success "Coverage report generated in packages/manuscript-engine/coverage/"
        print_info "View report: open packages/manuscript-engine/coverage/index.html"
        ;;

    build)
        print_info "Building container..."
        docker-compose -f $COMPOSE_FILE build
        print_success "Container built! ✓"
        ;;

    rebuild)
        print_info "Rebuilding container from scratch..."
        docker-compose -f $COMPOSE_FILE build --no-cache
        print_success "Container rebuilt! ✓"
        ;;

    shell)
        print_info "Opening shell in container..."
        docker-compose -f $COMPOSE_FILE run --rm manuscript-engine-shell
        ;;

    clean)
        print_warning "Cleaning up containers and volumes..."
        docker-compose -f $COMPOSE_FILE down -v
        print_success "Cleanup complete! ✓"
        ;;

    help|--help|-h)
        show_usage
        ;;

    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        show_usage
        exit 1
        ;;
esac

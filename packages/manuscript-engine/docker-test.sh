#!/bin/bash
# Containerized test runner for manuscript-engine

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
show_usage() {
    cat << EOF
Manuscript Engine Docker Test Runner

Usage: $0 [COMMAND]

Commands:
  test              Run all tests once
  test-watch        Run tests in watch mode
  coverage          Run tests with coverage report
  build             Build the test container
  rebuild           Rebuild the test container from scratch
  shell             Open a shell in the test container
  clean             Clean up containers and volumes
  logs              Show container logs

Examples:
  $0 test           # Run tests once
  $0 test-watch     # Run tests in watch mode
  $0 coverage       # Generate coverage report
  $0 shell          # Open interactive shell in container

EOF
}

# Parse command
COMMAND=${1:-test}

case $COMMAND in
    test)
        print_info "Running tests in container..."
        docker-compose -f docker-compose.test.yml run --rm manuscript-engine-test
        print_success "Tests completed!"
        ;;

    test-watch)
        print_info "Starting test watcher in container..."
        print_warning "Press Ctrl+C to stop"
        docker-compose -f docker-compose.test.yml run --rm manuscript-engine-dev
        ;;

    coverage)
        print_info "Running tests with coverage..."
        docker-compose -f docker-compose.test.yml run --rm manuscript-engine-coverage
        print_success "Coverage report generated in ./coverage"
        ;;

    build)
        print_info "Building test container..."
        docker-compose -f docker-compose.test.yml build
        print_success "Container built!"
        ;;

    rebuild)
        print_info "Rebuilding test container from scratch..."
        docker-compose -f docker-compose.test.yml build --no-cache
        print_success "Container rebuilt!"
        ;;

    shell)
        print_info "Opening shell in test container..."
        docker-compose -f docker-compose.test.yml run --rm manuscript-engine-test /bin/sh
        ;;

    clean)
        print_warning "Cleaning up containers and volumes..."
        docker-compose -f docker-compose.test.yml down -v
        print_success "Cleanup complete!"
        ;;

    logs)
        print_info "Showing container logs..."
        docker-compose -f docker-compose.test.yml logs -f
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

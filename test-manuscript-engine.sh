#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

CONTAINER_NAME="manuscript-engine-test"
IMAGE_NAME="manuscript-engine-test:latest"

function print_usage() {
    echo -e "${BLUE}Usage: ./test-manuscript-engine.sh [command]${NC}"
    echo ""
    echo "Commands:"
    echo "  build    - Build the test container"
    echo "  test     - Run all tests once"
    echo "  watch    - Run tests in watch mode"
    echo "  coverage - Generate coverage report"
    echo "  shell    - Open interactive shell in container"
    echo "  clean    - Remove container and image"
    echo ""
}

function build_container() {
    echo -e "${BLUE}Building test container...${NC}"
    docker build -f packages/manuscript-engine/Dockerfile.test -t $IMAGE_NAME .
    echo -e "${GREEN}✓ Container built successfully${NC}"
}

function run_tests() {
    echo -e "${BLUE}Running tests in container...${NC}"
    docker run --rm \
        -v $(pwd)/packages/manuscript-engine:/app \
        -v $(pwd)/packages/core:/workspace/packages/core \
        -v $(pwd)/packages/ai-router:/workspace/packages/ai-router \
        -w /app \
        $IMAGE_NAME \
        npm test
}

function run_watch() {
    echo -e "${BLUE}Running tests in watch mode...${NC}"
    docker run --rm -it \
        -v $(pwd)/packages/manuscript-engine:/app \
        -v $(pwd)/packages/core:/workspace/packages/core \
        -v $(pwd)/packages/ai-router:/workspace/packages/ai-router \
        -w /app \
        $IMAGE_NAME \
        npm run test:watch
}

function run_coverage() {
    echo -e "${BLUE}Generating coverage report...${NC}"
    docker run --rm \
        -v $(pwd)/packages/manuscript-engine:/app \
        -v $(pwd)/packages/core:/workspace/packages/core \
        -v $(pwd)/packages/ai-router:/workspace/packages/ai-router \
        -w /app \
        $IMAGE_NAME \
        npm run test:coverage
    
    echo -e "${GREEN}✓ Coverage report generated at packages/manuscript-engine/coverage/index.html${NC}"
}

function open_shell() {
    echo -e "${BLUE}Opening interactive shell...${NC}"
    docker run --rm -it \
        -v $(pwd)/packages/manuscript-engine:/app \
        -v $(pwd)/packages/core:/workspace/packages/core \
        -v $(pwd)/packages/ai-router:/workspace/packages/ai-router \
        -w /app \
        $IMAGE_NAME \
        /bin/sh
}

function clean_container() {
    echo -e "${BLUE}Cleaning up...${NC}"
    docker rmi $IMAGE_NAME 2>/dev/null || true
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Main command router
case "${1:-test}" in
    build)
        build_container
        ;;
    test)
        run_tests
        ;;
    watch)
        run_watch
        ;;
    coverage)
        run_coverage
        ;;
    shell)
        open_shell
        ;;
    clean)
        clean_container
        ;;
    help|--help|-h)
        print_usage
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        print_usage
        exit 1
        ;;
esac

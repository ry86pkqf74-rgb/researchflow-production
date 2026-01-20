#!/usr/bin/env bash
# check-updates.sh - Check for dependency updates across the monorepo
# Task 177: Update checker script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  ResearchFlow Dependency Update Check  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check Node.js dependencies
check_npm_updates() {
    echo -e "${YELLOW}Checking Node.js dependencies...${NC}"

    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm not found. Skipping Node.js check.${NC}"
        return
    fi

    cd "$ROOT_DIR"

    echo -e "\n${BLUE}Root package:${NC}"
    npm outdated 2>/dev/null || true

    # Check workspaces
    for pkg in packages/*/; do
        if [ -f "${pkg}package.json" ]; then
            echo -e "\n${BLUE}${pkg}:${NC}"
            (cd "$pkg" && npm outdated 2>/dev/null || true)
        fi
    done

    for svc in services/*/; do
        if [ -f "${svc}package.json" ]; then
            echo -e "\n${BLUE}${svc}:${NC}"
            (cd "$svc" && npm outdated 2>/dev/null || true)
        fi
    done
}

# Check Python dependencies
check_pip_updates() {
    echo -e "\n${YELLOW}Checking Python dependencies...${NC}"

    if ! command -v pip &> /dev/null; then
        echo -e "${RED}pip not found. Skipping Python check.${NC}"
        return
    fi

    WORKER_DIR="$ROOT_DIR/services/worker"

    if [ -f "$WORKER_DIR/requirements.txt" ]; then
        echo -e "\n${BLUE}services/worker:${NC}"
        cd "$WORKER_DIR"
        pip list --outdated 2>/dev/null | head -20 || true
    fi
}

# Check Docker base images
check_docker_updates() {
    echo -e "\n${YELLOW}Checking Docker base images...${NC}"

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}docker not found. Skipping Docker check.${NC}"
        return
    fi

    # Extract base images from Dockerfiles
    for dockerfile in "$ROOT_DIR"/Dockerfile* "$ROOT_DIR"/services/*/Dockerfile* 2>/dev/null; do
        if [ -f "$dockerfile" ]; then
            base_image=$(grep -m1 "^FROM" "$dockerfile" | awk '{print $2}' || true)
            if [ -n "$base_image" ]; then
                echo -e "${BLUE}$(basename "$dockerfile"):${NC} $base_image"
            fi
        fi
    done
}

# Security vulnerability check
check_security() {
    echo -e "\n${YELLOW}Checking for security vulnerabilities...${NC}"

    cd "$ROOT_DIR"

    if command -v npm &> /dev/null; then
        echo -e "\n${BLUE}npm audit:${NC}"
        npm audit --audit-level=moderate 2>/dev/null || true
    fi

    if command -v pip-audit &> /dev/null; then
        echo -e "\n${BLUE}pip-audit:${NC}"
        pip-audit 2>/dev/null || true
    fi
}

# Generate summary report
generate_report() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}           Update Check Complete         ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "To update dependencies:"
    echo "  npm: npm update / npm install <package>@latest"
    echo "  pip: pip install --upgrade <package>"
    echo ""
    echo "Run 'make test' after updating to verify compatibility."
}

# Main execution
main() {
    check_npm_updates
    check_pip_updates
    check_docker_updates
    check_security
    generate_report
}

main "$@"

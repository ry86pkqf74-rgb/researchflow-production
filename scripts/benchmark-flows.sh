#!/usr/bin/env bash
# benchmark-flows.sh - Benchmark research workflow performance
# Task 188: Benchmark script for workflow performance

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
ITERATIONS=${ITERATIONS:-5}
OUTPUT_DIR="${ROOT_DIR}/benchmark-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="${OUTPUT_DIR}/benchmark_${TIMESTAMP}.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ResearchFlow Workflow Benchmark      ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Iterations: $ITERATIONS"
echo "Output: $RESULTS_FILE"
echo ""

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Initialize results
init_results() {
    cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "iterations": $ITERATIONS,
  "benchmarks": []
}
EOF
}

# Benchmark helper function
benchmark() {
    local name="$1"
    local command="$2"
    local times=()

    echo -e "${YELLOW}Benchmarking: $name${NC}"

    for i in $(seq 1 "$ITERATIONS"); do
        echo -n "  Run $i/$ITERATIONS... "

        start_time=$(date +%s%N)
        eval "$command" > /dev/null 2>&1 || true
        end_time=$(date +%s%N)

        duration_ms=$(( (end_time - start_time) / 1000000 ))
        times+=("$duration_ms")

        echo "${duration_ms}ms"
    done

    # Calculate statistics
    local sum=0
    local min=${times[0]}
    local max=${times[0]}

    for t in "${times[@]}"; do
        sum=$((sum + t))
        if [ "$t" -lt "$min" ]; then min=$t; fi
        if [ "$t" -gt "$max" ]; then max=$t; fi
    done

    local avg=$((sum / ITERATIONS))

    echo -e "  ${GREEN}Avg: ${avg}ms, Min: ${min}ms, Max: ${max}ms${NC}"

    # Append to results JSON
    local tmp_file=$(mktemp)
    jq --arg name "$name" \
       --argjson avg "$avg" \
       --argjson min "$min" \
       --argjson max "$max" \
       --argjson times "$(printf '%s\n' "${times[@]}" | jq -s '.')" \
       '.benchmarks += [{"name": $name, "avg_ms": $avg, "min_ms": $min, "max_ms": $max, "runs": $times}]' \
       "$RESULTS_FILE" > "$tmp_file" && mv "$tmp_file" "$RESULTS_FILE"

    echo ""
}

# Benchmark: TypeScript compilation
benchmark_typescript() {
    echo -e "${BLUE}--- TypeScript Compilation ---${NC}"

    benchmark "tsc:packages/core" "cd $ROOT_DIR/packages/core && npx tsc --noEmit"
    benchmark "tsc:packages/ai-router" "cd $ROOT_DIR/packages/ai-router && npx tsc --noEmit"
    benchmark "tsc:packages/phi-engine" "cd $ROOT_DIR/packages/phi-engine && npx tsc --noEmit"
}

# Benchmark: Test suites
benchmark_tests() {
    echo -e "${BLUE}--- Test Suite Performance ---${NC}"

    benchmark "vitest:unit" "cd $ROOT_DIR && npm run test -- --run 2>/dev/null"
}

# Benchmark: Build process
benchmark_build() {
    echo -e "${BLUE}--- Build Performance ---${NC}"

    if [ -f "$ROOT_DIR/services/web/package.json" ]; then
        benchmark "vite:build:web" "cd $ROOT_DIR/services/web && npm run build 2>/dev/null"
    fi
}

# Benchmark: Linting
benchmark_lint() {
    echo -e "${BLUE}--- Lint Performance ---${NC}"

    benchmark "eslint:full" "cd $ROOT_DIR && npm run lint 2>/dev/null"
}

# Benchmark: Docker builds (if docker available)
benchmark_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}Docker not available, skipping container benchmarks${NC}"
        return
    fi

    echo -e "${BLUE}--- Docker Build Performance ---${NC}"

    # Only benchmark if Dockerfile exists
    if [ -f "$ROOT_DIR/services/orchestrator/Dockerfile" ]; then
        benchmark "docker:orchestrator" "docker build -t rf-bench-orch $ROOT_DIR/services/orchestrator --no-cache -q"
    fi
}

# Generate summary
generate_summary() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}         Benchmark Complete             ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Results saved to: $RESULTS_FILE"
    echo ""
    echo "Summary:"
    jq -r '.benchmarks[] | "  \(.name): \(.avg_ms)ms avg"' "$RESULTS_FILE"
}

# Main execution
main() {
    init_results

    # Run all benchmarks
    benchmark_typescript
    benchmark_lint
    benchmark_tests
    benchmark_build
    # benchmark_docker  # Uncomment to include Docker benchmarks

    generate_summary
}

# Handle arguments
case "${1:-all}" in
    ts|typescript)
        init_results
        benchmark_typescript
        ;;
    test|tests)
        init_results
        benchmark_tests
        ;;
    build)
        init_results
        benchmark_build
        ;;
    lint)
        init_results
        benchmark_lint
        ;;
    docker)
        init_results
        benchmark_docker
        ;;
    all|*)
        main
        ;;
esac

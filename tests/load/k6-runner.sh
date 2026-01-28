#!/bin/bash

###############################################################################
# K6 Load Testing Runner Script
#
# This script provides convenient commands to run various load testing scenarios
# for ResearchFlow API endpoints.
#
# Usage:
#   ./tests/load/k6-runner.sh [scenario] [options]
#
# Scenarios:
#   full       - Full load test (default)
#   auth       - Authentication endpoint only
#   projects   - Projects endpoint only
#   governance - Governance endpoint only
#   workflow   - Realistic user workflow
#   stress     - Stress test (rapid requests)
#   spike      - Spike test (sudden traffic)
#
# Options:
#   --url=<url>  - Base URL (default: http://localhost:3001)
#   --vus=<n>    - Virtual users (default: 100)
#   --duration=<time> - Test duration (default: 5m)
###############################################################################

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K6_CONFIG="${SCRIPT_DIR}/k6-config.js"
BASE_URL="${BASE_URL:-http://localhost:3001}"
SCENARIO="${1:-full}"
REPORT_DIR="${SCRIPT_DIR}/reports"

# Create report directory
mkdir -p "${REPORT_DIR}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
  echo -e "${GREEN}✓ ${1}${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠ ${1}${NC}"
}

log_error() {
  echo -e "${RED}✗ ${1}${NC}"
}

check_k6() {
  if ! command -v k6 &> /dev/null; then
    log_error "k6 is not installed. Please install from https://k6.io/docs/getting-started/installation/"
    exit 1
  fi
  log_success "k6 found: $(k6 version)"
}

check_api_health() {
  log_info "Checking API health at ${BASE_URL}..."
  if curl -s -f "${BASE_URL}/health" > /dev/null 2>&1 || curl -s -f "${BASE_URL}/api/health" > /dev/null 2>&1; then
    log_success "API is healthy"
  else
    log_warning "API health check failed - proceeding anyway"
  fi
}

run_full_test() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local report_file="${REPORT_DIR}/report_${timestamp}.json"

  log_info "Running full load test..."
  log_info "Configuration:"
  log_info "  - Base URL: ${BASE_URL}"
  log_info "  - Target VUs: 100"
  log_info "  - Duration: 25 minutes"
  log_info "  - Report: ${report_file}"

  k6 run "${K6_CONFIG}" \
    --out json="${report_file}" \
    -e BASE_URL="${BASE_URL}" \
    2>&1 | tee "${REPORT_DIR}/output_${timestamp}.log"

  log_success "Full load test completed"
  log_info "Results saved to ${report_file}"
}

run_auth_test() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local report_file="${REPORT_DIR}/auth_report_${timestamp}.json"

  log_info "Running authentication endpoint load test..."

  k6 run --stage 1m:50 --stage 5m:100 --stage 1m:0 "${K6_CONFIG}" \
    --out json="${report_file}" \
    -e BASE_URL="${BASE_URL}" \
    -e SCENARIO="auth" \
    2>&1 | tee "${REPORT_DIR}/auth_output_${timestamp}.log"

  log_success "Auth load test completed"
}

run_projects_test() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local report_file="${REPORT_DIR}/projects_report_${timestamp}.json"

  log_info "Running projects endpoint load test..."

  k6 run --stage 1m:50 --stage 5m:100 --stage 1m:0 "${K6_CONFIG}" \
    --out json="${report_file}" \
    -e BASE_URL="${BASE_URL}" \
    -e SCENARIO="projects" \
    2>&1 | tee "${REPORT_DIR}/projects_output_${timestamp}.log"

  log_success "Projects load test completed"
}

run_governance_test() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local report_file="${REPORT_DIR}/governance_report_${timestamp}.json"

  log_info "Running governance endpoint load test..."

  k6 run --stage 1m:50 --stage 5m:100 --stage 1m:0 "${K6_CONFIG}" \
    --out json="${report_file}" \
    -e BASE_URL="${BASE_URL}" \
    -e SCENARIO="governance" \
    2>&1 | tee "${REPORT_DIR}/governance_output_${timestamp}.log"

  log_success "Governance load test completed"
}

run_workflow_test() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local report_file="${REPORT_DIR}/workflow_report_${timestamp}.json"

  log_info "Running realistic workflow test..."

  k6 run --stage 1m:30 --stage 5m:75 --stage 1m:0 "${K6_CONFIG}" \
    --out json="${report_file}" \
    -e BASE_URL="${BASE_URL}" \
    -e SCENARIO="workflow" \
    2>&1 | tee "${REPORT_DIR}/workflow_output_${timestamp}.log"

  log_success "Workflow test completed"
}

run_stress_test() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local report_file="${REPORT_DIR}/stress_report_${timestamp}.json"

  log_warning "Running stress test - this will push the system to breaking point"
  read -p "Continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Stress test cancelled"
    return
  fi

  k6 run --stage 1m:100 --stage 10m:200 --stage 1m:0 "${K6_CONFIG}" \
    --out json="${report_file}" \
    -e BASE_URL="${BASE_URL}" \
    -e SCENARIO="stress" \
    2>&1 | tee "${REPORT_DIR}/stress_output_${timestamp}.log"

  log_success "Stress test completed"
}

run_spike_test() {
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local report_file="${REPORT_DIR}/spike_report_${timestamp}.json"

  log_warning "Running spike test - simulating sudden traffic spike"

  k6 run \
    --stage 1m:10 \
    --stage 30s:100 \
    --stage 5m:100 \
    --stage 30s:10 \
    --stage 1m:0 \
    "${K6_CONFIG}" \
    --out json="${report_file}" \
    -e BASE_URL="${BASE_URL}" \
    -e SCENARIO="spike" \
    2>&1 | tee "${REPORT_DIR}/spike_output_${timestamp}.log"

  log_success "Spike test completed"
}

show_usage() {
  echo "K6 Load Testing Runner for ResearchFlow"
  echo ""
  echo "Usage: $0 [scenario] [options]"
  echo ""
  echo "Scenarios:"
  echo "  full       - Full load test (default)"
  echo "  auth       - Authentication endpoint only"
  echo "  projects   - Projects endpoint only"
  echo "  governance - Governance endpoint only"
  echo "  workflow   - Realistic user workflow"
  echo "  stress     - Stress test (rapid requests)"
  echo "  spike      - Spike test (sudden traffic)"
  echo ""
  echo "Options:"
  echo "  --url=<url>      - Base URL (default: http://localhost:3001)"
  echo "  --help           - Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0                           # Run full test"
  echo "  $0 auth                      # Test auth endpoint"
  echo "  $0 workflow --url=http://api.example.com"
  echo ""
  echo "Reports are saved to: ${REPORT_DIR}"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --url=*)
      BASE_URL="${1#*=}"
      shift
      ;;
    --help)
      show_usage
      exit 0
      ;;
    *)
      SCENARIO="$1"
      shift
      ;;
  esac
done

# Main execution
echo ""
log_info "ResearchFlow K6 Load Testing Runner"
echo ""

check_k6
check_api_health

case "${SCENARIO}" in
  full)
    run_full_test
    ;;
  auth)
    run_auth_test
    ;;
  projects)
    run_projects_test
    ;;
  governance)
    run_governance_test
    ;;
  workflow)
    run_workflow_test
    ;;
  stress)
    run_stress_test
    ;;
  spike)
    run_spike_test
    ;;
  *)
    log_error "Unknown scenario: ${SCENARIO}"
    echo ""
    show_usage
    exit 1
    ;;
esac

echo ""
log_success "Load test completed successfully!"

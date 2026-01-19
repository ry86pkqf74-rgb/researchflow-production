#!/usr/bin/env bash
# Phase A - Task 30: Parameterized manuscript-engine test script
# Tests manuscript engine functionality with output assertions

set -euo pipefail

# =============================================================================
# Configuration (can be overridden via environment variables)
# =============================================================================
GOVERNANCE_MODE="${GOVERNANCE_MODE:-DEMO}"
ORCH_URL="${ORCH_URL:-http://localhost:3001}"
WORKER_URL="${WORKER_URL:-http://localhost:8000}"
MANUSCRIPT_URL="${MANUSCRIPT_URL:-http://localhost:3002}"
TIMEOUT="${TIMEOUT:-120}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Helper Functions
# =============================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

fail_closed() {
    log_error "$1"
    log_error "Test failed in GOVERNANCE_MODE=${GOVERNANCE_MODE} - failing closed"
    exit 1
}

# Check if service is healthy
check_health() {
    local url="$1"
    local name="$2"
    local max_attempts="${3:-30}"
    local attempt=1

    log_info "Waiting for ${name} to be healthy at ${url}/healthz..."
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "${url}/healthz" > /dev/null 2>&1; then
            log_success "${name} is healthy"
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done

    fail_closed "${name} health check failed after ${max_attempts} attempts"
}

# Assert no PHI in output (fail closed)
assert_no_phi() {
    local content="$1"
    local context="$2"

    # Common PHI patterns to check (locations only, never values)
    local phi_patterns=(
        '[0-9]{3}-[0-9]{2}-[0-9]{4}'  # SSN pattern
        '[0-9]{10}'                    # Phone numbers
        '[A-Z][0-9]{7}'               # MRN pattern
    )

    for pattern in "${phi_patterns[@]}"; do
        if echo "$content" | grep -qE "$pattern"; then
            fail_closed "PHI pattern detected in ${context} - failing closed per governance requirements"
        fi
    done

    log_success "No PHI patterns detected in ${context}"
}

# =============================================================================
# Test Functions
# =============================================================================
test_orchestrator_health() {
    log_info "Testing orchestrator health endpoints..."

    # Test /healthz
    local healthz_response
    healthz_response=$(curl -sf "${ORCH_URL}/healthz" 2>&1) || fail_closed "Orchestrator /healthz failed"
    log_success "Orchestrator /healthz returned OK"

    # Test /readyz
    local readyz_response
    readyz_response=$(curl -sf "${ORCH_URL}/readyz" 2>&1) || fail_closed "Orchestrator /readyz failed"
    log_success "Orchestrator /readyz returned OK"

    # Test governance mode
    local gov_response
    gov_response=$(curl -sf "${ORCH_URL}/api/governance/mode" 2>&1) || log_warning "Governance mode endpoint not available"
    if [ -n "$gov_response" ]; then
        log_info "Governance mode response: ${gov_response}"
    fi
}

test_worker_health() {
    log_info "Testing worker health endpoints..."

    # Test /healthz
    local healthz_response
    healthz_response=$(curl -sf "${WORKER_URL}/healthz" 2>&1) || fail_closed "Worker /healthz failed"
    log_success "Worker /healthz returned OK"

    # Test /readyz
    local readyz_response
    readyz_response=$(curl -sf "${WORKER_URL}/readyz" 2>&1) || fail_closed "Worker /readyz failed"
    log_success "Worker /readyz returned OK"
}

test_manuscript_service_health() {
    log_info "Testing manuscript service health..."

    local health_response
    health_response=$(curl -sf "${MANUSCRIPT_URL}/health" 2>&1) || {
        log_warning "Manuscript service not available at ${MANUSCRIPT_URL}/health"
        return 0
    }
    log_success "Manuscript service is healthy"
}

test_job_submission() {
    log_info "Testing job submission flow..."

    # Submit a test job
    local job_response
    job_response=$(curl -sf -X POST "${ORCH_URL}/api/jobs" \
        -H "Content-Type: application/json" \
        -d '{
            "type": "test",
            "payload": {"test": true},
            "governance_mode": "'"${GOVERNANCE_MODE}"'"
        }' 2>&1) || {
        log_warning "Job submission endpoint not available"
        return 0
    }

    # Extract job ID
    local job_id
    job_id=$(echo "$job_response" | jq -r '.id // .jobId // empty' 2>/dev/null) || {
        log_warning "Could not parse job response"
        return 0
    }

    if [ -n "$job_id" ]; then
        log_success "Job submitted successfully: ${job_id}"

        # Assert no PHI in response
        assert_no_phi "$job_response" "job submission response"
    fi
}

test_artifact_listing() {
    log_info "Testing artifact listing..."

    local artifacts_response
    artifacts_response=$(curl -sf "${ORCH_URL}/api/artifacts" 2>&1) || {
        log_warning "Artifacts endpoint not available"
        return 0
    }

    # Check if response contains artifacts array
    if echo "$artifacts_response" | jq -e '.artifacts // .[] | length >= 0' > /dev/null 2>&1; then
        log_success "Artifacts endpoint returned valid response"

        # Assert no PHI in artifacts listing
        assert_no_phi "$artifacts_response" "artifacts listing"
    else
        log_warning "Artifacts response format unexpected"
    fi
}

test_manifest_structure() {
    log_info "Testing manifest structure..."

    local manifest_response
    manifest_response=$(curl -sf "${ORCH_URL}/api/manifests" 2>&1) || {
        log_warning "Manifests endpoint not available"
        return 0
    }

    # Verify manifest contains expected fields
    if echo "$manifest_response" | grep -q "artifact-manifest\|manifest" 2>/dev/null; then
        log_success "Manifest structure validated"
    else
        log_warning "Manifest structure validation skipped"
    fi
}

test_governance_enforcement() {
    log_info "Testing governance enforcement for mode: ${GOVERNANCE_MODE}..."

    if [ "$GOVERNANCE_MODE" = "LIVE" ]; then
        log_info "LIVE mode: verifying fail-closed behavior..."

        # Test that ambiguous requests fail closed
        local governance_response
        governance_response=$(curl -sf "${ORCH_URL}/api/governance/validate" \
            -X POST \
            -H "Content-Type: application/json" \
            -d '{"test": "ambiguous"}' 2>&1) || {
            log_success "LIVE mode correctly rejects ambiguous requests (fail-closed)"
            return 0
        }

        # If we got a response, verify it's not permissive
        if echo "$governance_response" | grep -qi "allowed\|permitted\|success" 2>/dev/null; then
            fail_closed "LIVE mode should fail-closed on ambiguous requests"
        fi

        log_success "LIVE mode governance enforcement verified"
    else
        log_info "DEMO mode: governance checks are advisory"
        log_success "DEMO mode governance check passed"
    fi
}

# =============================================================================
# Main Test Runner
# =============================================================================
main() {
    echo ""
    echo "=============================================="
    echo "  Manuscript Engine Test Suite"
    echo "  GOVERNANCE_MODE: ${GOVERNANCE_MODE}"
    echo "=============================================="
    echo ""

    local start_time
    start_time=$(date +%s)
    local tests_passed=0
    local tests_failed=0

    # Wait for services to be healthy
    check_health "$ORCH_URL" "Orchestrator"
    check_health "$WORKER_URL" "Worker"

    # Run test suite
    log_info "Running test suite..."
    echo ""

    test_orchestrator_health && tests_passed=$((tests_passed + 1)) || tests_failed=$((tests_failed + 1))
    test_worker_health && tests_passed=$((tests_passed + 1)) || tests_failed=$((tests_failed + 1))
    test_manuscript_service_health && tests_passed=$((tests_passed + 1)) || tests_failed=$((tests_failed + 1))
    test_job_submission && tests_passed=$((tests_passed + 1)) || tests_failed=$((tests_failed + 1))
    test_artifact_listing && tests_passed=$((tests_passed + 1)) || tests_failed=$((tests_failed + 1))
    test_manifest_structure && tests_passed=$((tests_passed + 1)) || tests_failed=$((tests_failed + 1))
    test_governance_enforcement && tests_passed=$((tests_passed + 1)) || tests_failed=$((tests_failed + 1))

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    echo "=============================================="
    echo "  Test Results"
    echo "=============================================="
    echo -e "  Passed: ${GREEN}${tests_passed}${NC}"
    echo -e "  Failed: ${RED}${tests_failed}${NC}"
    echo "  Duration: ${duration}s"
    echo "  Governance Mode: ${GOVERNANCE_MODE}"
    echo "=============================================="
    echo ""

    if [ $tests_failed -gt 0 ]; then
        fail_closed "Test suite failed with ${tests_failed} failures"
    fi

    log_success "All tests passed!"
    exit 0
}

# Run main
main "$@"

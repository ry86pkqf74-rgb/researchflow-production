#!/usr/bin/env bash
# Phase A - Task 40: Full prod-like stress test
# Submits 10 concurrent jobs and validates completion

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
ORCH_URL="${ORCH_URL:-http://localhost:3001}"
WORKER_URL="${WORKER_URL:-http://localhost:8000}"
CONCURRENT_JOBS="${CONCURRENT_JOBS:-10}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
MAX_WAIT_TIME="${MAX_WAIT_TIME:-300}"
OUTPUT_DIR="${OUTPUT_DIR:-./stress-test-results}"
MAX_ERROR_RATE="${MAX_ERROR_RATE:-0.01}"  # 1% max error rate

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Helper Functions
# =============================================================================
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

timestamp() { date +%Y%m%d_%H%M%S; }

# Get memory usage of container
get_memory_usage() {
    local container_name="$1"
    docker stats --no-stream --format "{{.MemUsage}}" "$container_name" 2>/dev/null || echo "N/A"
}

# =============================================================================
# Test Setup
# =============================================================================
setup() {
    log_info "Setting up stress test environment..."

    # Create output directory
    mkdir -p "$OUTPUT_DIR"

    # Check service health
    log_info "Checking service health..."
    curl -sf "${ORCH_URL}/healthz" > /dev/null || {
        log_error "Orchestrator is not healthy"
        exit 1
    }
    log_success "Orchestrator is healthy"

    curl -sf "${WORKER_URL}/healthz" > /dev/null || {
        log_error "Worker is not healthy"
        exit 1
    }
    log_success "Worker is healthy"
}

# =============================================================================
# Job Submission
# =============================================================================
submit_job() {
    local job_num="$1"
    local response

    response=$(curl -sf -X POST "${ORCH_URL}/api/jobs" \
        -H "Content-Type: application/json" \
        -d '{
            "type": "stress-test",
            "payload": {
                "job_number": '"$job_num"',
                "timestamp": "'"$(date -Iseconds)"'",
                "test_data": "stress-test-payload-'"$job_num"'"
            }
        }' 2>&1) || echo '{"error": "submission_failed"}'

    echo "$response"
}

# Poll job status
poll_job_status() {
    local job_id="$1"
    local status

    status=$(curl -sf "${ORCH_URL}/api/jobs/${job_id}/status" 2>&1) || echo '{"status": "unknown"}'

    echo "$status" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown"
}

# =============================================================================
# Stress Test Execution
# =============================================================================
run_stress_test() {
    log_info "Starting stress test with ${CONCURRENT_JOBS} concurrent jobs..."

    local start_time
    start_time=$(date +%s%3N)

    declare -A job_ids
    declare -A job_start_times
    declare -A job_end_times
    declare -A job_statuses

    local submission_times=()
    local errors=0

    # Submit jobs concurrently
    log_info "Submitting ${CONCURRENT_JOBS} jobs..."

    for i in $(seq 1 "$CONCURRENT_JOBS"); do
        local submit_start
        submit_start=$(date +%s%3N)

        local response
        response=$(submit_job "$i")

        local submit_end
        submit_end=$(date +%s%3N)
        local submit_duration=$((submit_end - submit_start))
        submission_times+=("$submit_duration")

        local job_id
        job_id=$(echo "$response" | jq -r '.id // .jobId // empty' 2>/dev/null)

        if [ -n "$job_id" ] && [ "$job_id" != "null" ]; then
            job_ids[$i]="$job_id"
            job_start_times[$i]="$submit_start"
            job_statuses[$i]="pending"
            log_info "Job $i submitted: ${job_id} (${submit_duration}ms)"
        else
            errors=$((errors + 1))
            job_statuses[$i]="failed"
            log_error "Job $i submission failed: ${response}"
        fi
    done &

    wait

    log_info "All jobs submitted. Waiting for completion..."

    # Poll for completion
    local all_done=false
    local wait_start
    wait_start=$(date +%s)
    local completed=0
    local failed=0

    while [ "$all_done" = false ]; do
        all_done=true
        completed=0
        failed=0

        for i in $(seq 1 "$CONCURRENT_JOBS"); do
            if [ "${job_statuses[$i]}" = "pending" ] || [ "${job_statuses[$i]}" = "running" ]; then
                local job_id="${job_ids[$i]:-}"
                if [ -n "$job_id" ]; then
                    local status
                    status=$(poll_job_status "$job_id")

                    job_statuses[$i]="$status"

                    if [ "$status" = "completed" ] || [ "$status" = "success" ]; then
                        job_end_times[$i]=$(date +%s%3N)
                        completed=$((completed + 1))
                    elif [ "$status" = "failed" ] || [ "$status" = "error" ]; then
                        job_end_times[$i]=$(date +%s%3N)
                        failed=$((failed + 1))
                    else
                        all_done=false
                    fi
                fi
            elif [ "${job_statuses[$i]}" = "completed" ] || [ "${job_statuses[$i]}" = "success" ]; then
                completed=$((completed + 1))
            elif [ "${job_statuses[$i]}" = "failed" ] || [ "${job_statuses[$i]}" = "error" ]; then
                failed=$((failed + 1))
            fi
        done

        # Check timeout
        local elapsed=$(($(date +%s) - wait_start))
        if [ $elapsed -gt "$MAX_WAIT_TIME" ]; then
            log_warning "Timeout reached after ${elapsed}s"
            break
        fi

        if [ "$all_done" = false ]; then
            log_info "Progress: ${completed} completed, ${failed} failed, $((CONCURRENT_JOBS - completed - failed)) pending (${elapsed}s elapsed)"
            sleep "$POLL_INTERVAL"
        fi
    done

    local end_time
    end_time=$(date +%s%3N)
    local total_duration=$((end_time - start_time))

    # Calculate metrics
    local job_latencies=()
    for i in $(seq 1 "$CONCURRENT_JOBS"); do
        if [ -n "${job_end_times[$i]:-}" ] && [ -n "${job_start_times[$i]:-}" ]; then
            local latency=$((job_end_times[$i] - job_start_times[$i]))
            job_latencies+=("$latency")
        fi
    done

    # Generate report
    generate_report "$total_duration" "$completed" "$failed" "${submission_times[*]}" "${job_latencies[*]}"
}

# =============================================================================
# Report Generation
# =============================================================================
generate_report() {
    local total_duration="$1"
    local completed="$2"
    local failed="$3"
    local submission_times_str="$4"
    local job_latencies_str="$5"

    local report_file="${OUTPUT_DIR}/stress-test-$(timestamp).json"

    # Calculate statistics
    local error_rate
    if [ "$CONCURRENT_JOBS" -gt 0 ]; then
        error_rate=$(echo "scale=4; $failed / $CONCURRENT_JOBS" | bc)
    else
        error_rate="0"
    fi

    # Calculate p95 latency (simplified)
    local p95_latency="N/A"
    if [ -n "$job_latencies_str" ]; then
        local sorted_latencies
        sorted_latencies=$(echo "$job_latencies_str" | tr ' ' '\n' | sort -n)
        local count
        count=$(echo "$sorted_latencies" | wc -l)
        local p95_index
        p95_index=$(echo "scale=0; $count * 95 / 100" | bc)
        p95_latency=$(echo "$sorted_latencies" | sed -n "${p95_index}p")
    fi

    # Get memory stats
    local orchestrator_memory
    orchestrator_memory=$(get_memory_usage "researchflow-production-orchestrator-1" 2>/dev/null || echo "N/A")
    local worker_memory
    worker_memory=$(get_memory_usage "researchflow-production-worker-1" 2>/dev/null || echo "N/A")

    # Generate JSON report
    cat > "$report_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "configuration": {
        "concurrent_jobs": $CONCURRENT_JOBS,
        "max_wait_time": $MAX_WAIT_TIME,
        "orchestrator_url": "$ORCH_URL",
        "worker_url": "$WORKER_URL"
    },
    "results": {
        "total_duration_ms": $total_duration,
        "jobs_completed": $completed,
        "jobs_failed": $failed,
        "error_rate": $error_rate,
        "p95_latency_ms": "$p95_latency"
    },
    "resources": {
        "orchestrator_memory": "$orchestrator_memory",
        "worker_memory": "$worker_memory"
    },
    "status": "$([ $(echo "$error_rate > $MAX_ERROR_RATE" | bc) -eq 1 ] && echo "FAILED" || echo "PASSED")"
}
EOF

    log_info "Report saved to: $report_file"

    # Print summary
    echo ""
    echo "=============================================="
    echo "  Stress Test Results"
    echo "=============================================="
    echo "  Concurrent Jobs:    ${CONCURRENT_JOBS}"
    echo "  Total Duration:     ${total_duration}ms"
    echo "  Jobs Completed:     ${completed}"
    echo "  Jobs Failed:        ${failed}"
    echo "  Error Rate:         ${error_rate}"
    echo "  P95 Latency:        ${p95_latency}ms"
    echo "  Orchestrator Mem:   ${orchestrator_memory}"
    echo "  Worker Memory:      ${worker_memory}"
    echo "=============================================="
    echo ""

    # Validate results
    local error_check
    error_check=$(echo "$error_rate > $MAX_ERROR_RATE" | bc)
    if [ "$error_check" -eq 1 ]; then
        log_error "Error rate ${error_rate} exceeds maximum allowed ${MAX_ERROR_RATE}"
        exit 1
    fi

    log_success "Stress test passed!"
}

# =============================================================================
# Main
# =============================================================================
main() {
    echo ""
    echo "=============================================="
    echo "  ResearchFlow Stress Test"
    echo "  $(timestamp)"
    echo "=============================================="
    echo ""

    setup
    run_stress_test

    exit 0
}

main "$@"

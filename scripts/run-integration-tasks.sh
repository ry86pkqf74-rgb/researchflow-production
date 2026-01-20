#!/bin/bash
# =============================================================================
# ResearchFlow Integration Task Runner
# Executes Claude Code prompts in batch mode
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROMPTS_DIR="/workspace/integration-prompts"
RESULTS_DIR="/workspace/integration-results"
LOG_FILE="${RESULTS_DIR}/execution.log"

# Ensure results directory exists
mkdir -p "${RESULTS_DIR}"

# Log function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "${LOG_FILE}"
}

# Check if ANTHROPIC_API_KEY is set
if [ -z "${ANTHROPIC_API_KEY}" ]; then
    error "ANTHROPIC_API_KEY is not set. Please set it before running."
    exit 1
fi

# Display usage
usage() {
    echo "Usage: $0 [OPTIONS] [PROMPT_FILE]"
    echo ""
    echo "Options:"
    echo "  -a, --all        Run all prompts in tasks/ directory"
    echo "  -w, --workflow   Run a specific workflow"
    echo "  -l, --list       List available prompts"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 tasks/001-run-full-test-suite.md"
    echo "  $0 --all"
    echo "  $0 --workflow full-ci-pipeline"
}

# List available prompts
list_prompts() {
    echo -e "${BLUE}Available Prompts:${NC}"
    echo ""
    echo "Tasks:"
    for f in "${PROMPTS_DIR}/tasks/"*.md; do
        [ -e "$f" ] && echo "  - $(basename "$f")"
    done
    echo ""
    echo "Workflows:"
    for f in "${PROMPTS_DIR}/workflows/"*.md; do
        [ -e "$f" ] && echo "  - $(basename "$f")"
    done
}

# Execute a single prompt
execute_prompt() {
    local prompt_file="$1"
    local prompt_name=$(basename "$prompt_file" .md)
    local result_file="${RESULTS_DIR}/${prompt_name}-$(date '+%Y%m%d_%H%M%S').md"

    log "Executing prompt: ${prompt_name}"

    # Read the prompt content
    local prompt_content=$(cat "$prompt_file")

    # Execute with Claude Code
    # Using --print for non-interactive mode
    if claude --print "${prompt_content}" > "${result_file}" 2>&1; then
        success "Prompt completed: ${prompt_name}"
        success "Results saved to: ${result_file}"
        return 0
    else
        error "Prompt failed: ${prompt_name}"
        error "Check ${result_file} for details"
        return 1
    fi
}

# Run all tasks
run_all_tasks() {
    log "Running all integration tasks..."
    local failed=0

    for prompt_file in "${PROMPTS_DIR}/tasks/"*.md; do
        [ -e "$prompt_file" ] || continue
        if ! execute_prompt "$prompt_file"; then
            ((failed++))
        fi
    done

    if [ $failed -eq 0 ]; then
        success "All tasks completed successfully!"
    else
        error "${failed} task(s) failed"
        return 1
    fi
}

# Run a specific workflow
run_workflow() {
    local workflow_name="$1"
    local workflow_file="${PROMPTS_DIR}/workflows/${workflow_name}.md"

    if [ ! -f "$workflow_file" ]; then
        error "Workflow not found: ${workflow_name}"
        echo "Available workflows:"
        list_prompts | grep -A 100 "Workflows:"
        return 1
    fi

    execute_prompt "$workflow_file"
}

# Main
main() {
    log "ResearchFlow Integration Task Runner"
    log "====================================="

    case "${1:-}" in
        -h|--help)
            usage
            ;;
        -l|--list)
            list_prompts
            ;;
        -a|--all)
            run_all_tasks
            ;;
        -w|--workflow)
            if [ -z "$2" ]; then
                error "Workflow name required"
                usage
                exit 1
            fi
            run_workflow "$2"
            ;;
        "")
            usage
            ;;
        *)
            # Assume it's a prompt file path
            if [ -f "${PROMPTS_DIR}/$1" ]; then
                execute_prompt "${PROMPTS_DIR}/$1"
            elif [ -f "$1" ]; then
                execute_prompt "$1"
            else
                error "Prompt file not found: $1"
                exit 1
            fi
            ;;
    esac
}

main "$@"

#!/usr/bin/env bash
# Phase A - Task 24: Secret rotation script for JWT_SECRET and API keys
# Usage: ./scripts/rotate-secrets.sh [--namespace NAME] [--dry-run]

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
NAMESPACE="${NAMESPACE:-researchflow}"
SECRET_NAME="${SECRET_NAME:-app-secrets}"
DRY_RUN="${DRY_RUN:-false}"

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
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat <<EOF
Phase A - Task 24: Secret Rotation Script

USAGE:
    ./scripts/rotate-secrets.sh [OPTIONS]

OPTIONS:
    --namespace NAME       Kubernetes namespace (default: researchflow)
    --secret-name NAME     Secret name (default: app-secrets)
    --rotate-jwt           Rotate JWT_SECRET
    --rotate-anthropic     Rotate ANTHROPIC_API_KEY (requires new key as input)
    --dry-run              Show what would be done without making changes
    --help                 Show this help message

ENVIRONMENT VARIABLES:
    NAMESPACE              Kubernetes namespace
    ANTHROPIC_API_KEY_NEW  New Anthropic API key (required for --rotate-anthropic)

EXAMPLES:
    # Rotate JWT secret
    ./scripts/rotate-secrets.sh --rotate-jwt

    # Rotate Anthropic API key
    ANTHROPIC_API_KEY_NEW='sk-new-key' ./scripts/rotate-secrets.sh --rotate-anthropic

    # Dry run to see what would happen
    ./scripts/rotate-secrets.sh --rotate-jwt --dry-run
EOF
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    if ! command -v openssl &> /dev/null; then
        log_error "openssl not found. Please install openssl."
        exit 1
    fi

    # Check kubectl access
    if ! kubectl auth can-i get secrets -n "$NAMESPACE" &> /dev/null; then
        log_error "Insufficient permissions to read secrets in namespace $NAMESPACE"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

get_current_secrets() {
    log_info "Fetching current secrets..."
    kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o json 2>/dev/null || echo "{}"
}

rotate_jwt_secret() {
    log_info "Rotating JWT_SECRET..."

    # Generate new JWT secret
    local new_jwt_secret
    new_jwt_secret=$(openssl rand -hex 32)

    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY-RUN] Would update JWT_SECRET to new value (${#new_jwt_secret} chars)"
        return 0
    fi

    # Create or update the secret
    kubectl create secret generic "$SECRET_NAME" \
        --from-literal=JWT_SECRET="$new_jwt_secret" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "JWT_SECRET rotated successfully"

    # Trigger rolling restart of affected deployments
    log_info "Restarting deployments to pick up new secret..."
    kubectl rollout restart deployment/orchestrator -n "$NAMESPACE" || true
    kubectl rollout restart deployment/worker -n "$NAMESPACE" || true

    log_success "Deployments restart initiated"
}

rotate_anthropic_key() {
    log_info "Rotating ANTHROPIC_API_KEY..."

    # Require new key as environment variable for security
    if [ -z "${ANTHROPIC_API_KEY_NEW:-}" ]; then
        log_error "ANTHROPIC_API_KEY_NEW environment variable is required"
        log_info "Please set it before running: export ANTHROPIC_API_KEY_NEW='sk-your-new-key'"
        exit 1
    fi

    # Validate key format (basic check)
    if [[ ! "$ANTHROPIC_API_KEY_NEW" =~ ^sk-ant- ]]; then
        log_warning "API key doesn't start with 'sk-ant-'. Proceeding anyway..."
    fi

    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY-RUN] Would update ANTHROPIC_API_KEY to new value"
        return 0
    fi

    # Get existing secret and update
    kubectl create secret generic "$SECRET_NAME" \
        --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY_NEW" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "ANTHROPIC_API_KEY rotated successfully"

    # Trigger rolling restart
    log_info "Restarting deployments to pick up new key..."
    kubectl rollout restart deployment/orchestrator -n "$NAMESPACE" || true

    log_success "Deployment restart initiated"
}

create_audit_log() {
    local action="$1"
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    local audit_entry="[${timestamp}] Secret rotation: ${action} by ${USER:-unknown} in namespace ${NAMESPACE}"

    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY-RUN] Would create audit log entry: $audit_entry"
        return 0
    fi

    # Create audit ConfigMap entry (append to existing)
    kubectl create configmap secret-rotation-audit \
        --from-literal="entry-$(date +%s)=$audit_entry" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f - || true

    log_info "Audit log entry created"
}

# =============================================================================
# Main
# =============================================================================
main() {
    local rotate_jwt=false
    local rotate_anthropic=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --secret-name)
                SECRET_NAME="$2"
                shift 2
                ;;
            --rotate-jwt)
                rotate_jwt=true
                shift
                ;;
            --rotate-anthropic)
                rotate_anthropic=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Validate at least one rotation is requested
    if [ "$rotate_jwt" = "false" ] && [ "$rotate_anthropic" = "false" ]; then
        log_error "No rotation action specified. Use --rotate-jwt or --rotate-anthropic"
        usage
        exit 1
    fi

    echo ""
    echo "=============================================="
    echo "  Secret Rotation Script"
    echo "  Namespace: ${NAMESPACE}"
    echo "  Secret: ${SECRET_NAME}"
    echo "  Dry Run: ${DRY_RUN}"
    echo "=============================================="
    echo ""

    check_prerequisites

    if [ "$rotate_jwt" = "true" ]; then
        rotate_jwt_secret
        create_audit_log "JWT_SECRET rotated"
    fi

    if [ "$rotate_anthropic" = "true" ]; then
        rotate_anthropic_key
        create_audit_log "ANTHROPIC_API_KEY rotated"
    fi

    echo ""
    log_success "Secret rotation completed!"

    if [ "$DRY_RUN" = "false" ]; then
        echo ""
        log_info "Next steps:"
        echo "  1. Verify deployments are healthy: kubectl get pods -n $NAMESPACE"
        echo "  2. Check application logs for any authentication errors"
        echo "  3. Test critical authentication flows"
        echo ""
        log_warning "If issues occur, rollback with: kubectl rollout undo deployment/<name> -n $NAMESPACE"
    fi
}

main "$@"

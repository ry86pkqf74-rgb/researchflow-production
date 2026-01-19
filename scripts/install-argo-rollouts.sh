#!/bin/bash
# Install and Configure Argo Rollouts for ResearchFlow
# Phase A - Task 34 & 49: Blue-Green and Canary Deployments

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "ResearchFlow - Argo Rollouts Installation"
echo "=========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl not found${NC}"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"
echo ""

# Install Argo Rollouts controller
echo "Installing Argo Rollouts controller..."

kubectl create namespace argo-rollouts --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

echo -e "${GREEN}✓ Argo Rollouts controller installed${NC}"
echo ""

# Wait for controller to be ready
echo "Waiting for Argo Rollouts controller to be ready..."
kubectl wait --for=condition=available --timeout=120s \
    deployment/argo-rollouts -n argo-rollouts

echo -e "${GREEN}✓ Controller is ready${NC}"
echo ""

# Install kubectl plugin
echo "Installing kubectl argo-rollouts plugin..."

ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

case $ARCH in
    x86_64)
        ARCH="amd64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
esac

PLUGIN_URL="https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-${OS}-${ARCH}"

if curl -LO "$PLUGIN_URL"; then
    chmod +x kubectl-argo-rollouts-${OS}-${ARCH}

    if sudo mv kubectl-argo-rollouts-${OS}-${ARCH} /usr/local/bin/kubectl-argo-rollouts 2>/dev/null; then
        echo -e "${GREEN}✓ Plugin installed to /usr/local/bin${NC}"
    else
        echo -e "${YELLOW}Warning: Could not install to /usr/local/bin, installing to ~/.local/bin${NC}"
        mkdir -p ~/.local/bin
        mv kubectl-argo-rollouts-${OS}-${ARCH} ~/.local/bin/kubectl-argo-rollouts
        export PATH=$PATH:~/.local/bin
        echo "Add ~/.local/bin to your PATH: export PATH=\$PATH:~/.local/bin"
    fi
else
    echo -e "${YELLOW}Warning: Could not download kubectl plugin${NC}"
fi

echo ""

# Verify plugin installation
if kubectl argo rollouts version &> /dev/null; then
    echo -e "${GREEN}✓ kubectl argo-rollouts plugin working${NC}"
    kubectl argo rollouts version
else
    echo -e "${YELLOW}Warning: kubectl argo-rollouts plugin not found in PATH${NC}"
fi

echo ""

# Create namespace if needed
if ! kubectl get namespace researchflow &> /dev/null; then
    echo "Creating researchflow namespace..."
    kubectl create namespace researchflow
    echo -e "${GREEN}✓ Namespace created${NC}"
fi

echo ""

# Deploy analysis templates
echo "Deploying analysis templates..."
kubectl apply -f infrastructure/kubernetes/base/rollouts/analysis-templates.yaml

echo -e "${GREEN}✓ Analysis templates deployed${NC}"
echo ""

# Ask about deployment strategy
echo "Which deployment strategy would you like to use?"
echo "1) Blue-Green (recommended for first deployment)"
echo "2) Canary (requires Istio)"
echo "3) Both"
echo "4) Skip deployment"
read -p "Enter choice [1-4]: " STRATEGY_CHOICE

case $STRATEGY_CHOICE in
    1)
        echo "Deploying Blue-Green rollout..."
        kubectl apply -f infrastructure/kubernetes/base/rollouts/orchestrator-bluegreen.yaml
        echo -e "${GREEN}✓ Blue-Green rollout deployed${NC}"
        ;;
    2)
        # Check for Istio
        if ! kubectl get crd virtualservices.networking.istio.io &> /dev/null; then
            echo -e "${YELLOW}Warning: Istio not detected. Canary strategy requires Istio.${NC}"
            echo "Install Istio first: ./scripts/install-istio.sh"
            exit 1
        fi

        echo "Deploying Canary rollout..."
        kubectl apply -f infrastructure/kubernetes/base/rollouts/orchestrator-canary.yaml
        echo -e "${GREEN}✓ Canary rollout deployed${NC}"
        ;;
    3)
        echo -e "${YELLOW}Note: Cannot run both strategies simultaneously on same service${NC}"
        echo "Deploy one strategy at a time"
        ;;
    4)
        echo "Skipping deployment"
        ;;
    *)
        echo -e "${YELLOW}Invalid choice, skipping deployment${NC}"
        ;;
esac

echo ""

# Check for Prometheus (required for analysis)
if ! kubectl get svc prometheus -n istio-system &> /dev/null; then
    echo -e "${YELLOW}Warning: Prometheus not found in istio-system namespace${NC}"
    echo "Analysis templates require Prometheus for metrics."
    echo "Install Prometheus for Istio:"
    echo "  kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml"
fi

echo ""

# Show rollouts
echo "Current rollouts:"
kubectl argo rollouts list -n researchflow || echo "No rollouts found"

echo ""
echo "=========================================="
echo "Argo Rollouts Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. View rollouts:"
echo "   kubectl argo rollouts list -n researchflow"
echo ""
echo "2. Watch a rollout:"
echo "   kubectl argo rollouts get rollout orchestrator-bg -n researchflow --watch"
echo ""
echo "3. Trigger a new deployment:"
echo "   kubectl argo rollouts set image orchestrator-bg orchestrator=researchflow/orchestrator:v2.0.0"
echo ""
echo "4. Promote a rollout:"
echo "   kubectl argo rollouts promote orchestrator-bg -n researchflow"
echo ""
echo "5. Access dashboard:"
echo "   kubectl argo rollouts dashboard"
echo "   Then open: http://localhost:3100"
echo ""
echo "6. Abort a rollout:"
echo "   kubectl argo rollouts abort orchestrator-bg -n researchflow"
echo ""

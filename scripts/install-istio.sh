#!/bin/bash
# Install and Configure Istio for ResearchFlow
# Phase A - Task 10: Istio Service Mesh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "ResearchFlow - Istio Installation"
echo "=========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl not found${NC}"
    exit 1
fi

if ! command -v istioctl &> /dev/null; then
    echo -e "${YELLOW}Warning: istioctl not found. Installing...${NC}"
    echo ""

    # Download Istio
    ISTIO_VERSION="${ISTIO_VERSION:-1.20.0}"
    curl -L https://istio.io/downloadIstio | ISTIO_VERSION=$ISTIO_VERSION sh -
    cd istio-$ISTIO_VERSION
    export PATH=$PWD/bin:$PATH

    echo -e "${GREEN}✓ Istio CLI installed${NC}"
    echo ""
fi

# Check cluster connectivity
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"
echo ""

# Install Istio
echo "Installing Istio..."
echo ""

# Use default profile (production-ready)
istioctl install --set profile=default -y

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Istio installed successfully${NC}"
else
    echo -e "${RED}Error: Istio installation failed${NC}"
    exit 1
fi

echo ""

# Verify installation
echo "Verifying Istio installation..."
istioctl verify-install

echo ""

# Enable sidecar injection for researchflow namespace
echo "Enabling sidecar injection for researchflow namespace..."

if kubectl get namespace researchflow &> /dev/null; then
    kubectl label namespace researchflow istio-injection=enabled --overwrite
    echo -e "${GREEN}✓ Sidecar injection enabled${NC}"
else
    echo -e "${YELLOW}Warning: researchflow namespace not found. Creating...${NC}"
    kubectl create namespace researchflow
    kubectl label namespace researchflow istio-injection=enabled
    echo -e "${GREEN}✓ Namespace created and labeled${NC}"
fi

echo ""

# Apply Istio configuration
echo "Applying Istio configuration..."
kubectl apply -f infrastructure/kubernetes/base/istio/

echo -e "${GREEN}✓ Istio configuration applied${NC}"
echo ""

# Install observability addons (optional)
echo "Do you want to install observability addons (Kiali, Jaeger, Prometheus)? (y/n)"
read -r INSTALL_OBSERVABILITY

if [[ "$INSTALL_OBSERVABILITY" =~ ^[Yy]$ ]]; then
    echo "Installing observability addons..."

    # Kiali
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml

    # Jaeger
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/jaeger.yaml

    # Prometheus
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml

    # Grafana
    kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/grafana.yaml

    echo -e "${GREEN}✓ Observability addons installed${NC}"
    echo ""
    echo "Access dashboards with:"
    echo "  Kiali:      istioctl dashboard kiali"
    echo "  Jaeger:     istioctl dashboard jaeger"
    echo "  Prometheus: istioctl dashboard prometheus"
    echo "  Grafana:    istioctl dashboard grafana"
fi

echo ""

# Restart deployments to inject sidecars
echo "Restarting deployments to inject Istio sidecars..."
kubectl rollout restart deployment -n researchflow

echo -e "${GREEN}✓ Deployments restarted${NC}"
echo ""

# Wait for rollout to complete
echo "Waiting for rollout to complete..."
kubectl rollout status deployment -n researchflow --timeout=5m

echo ""

# Verify sidecars
echo "Verifying sidecar injection..."
POD_COUNT=$(kubectl get pods -n researchflow -o jsonpath='{.items[*].spec.containers[*].name}' | grep -o istio-proxy | wc -l)

if [ "$POD_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $POD_COUNT pods with Istio sidecars${NC}"
else
    echo -e "${YELLOW}Warning: No Istio sidecars found. Check pod status.${NC}"
    kubectl get pods -n researchflow
fi

echo ""

# Test mTLS
echo "Testing mTLS configuration..."
kubectl exec -n researchflow \
    $(kubectl get pod -n researchflow -l app.kubernetes.io/component=orchestrator -o jsonpath='{.items[0].metadata.name}') \
    -c istio-proxy -- curl -s http://worker:8000/healthz &> /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ mTLS communication working${NC}"
else
    echo -e "${YELLOW}Warning: mTLS test failed. Check logs for details.${NC}"
fi

echo ""
echo "=========================================="
echo "Istio Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify all pods are running: kubectl get pods -n researchflow"
echo "2. Check Istio proxy logs: kubectl logs -n researchflow POD_NAME -c istio-proxy"
echo "3. View service mesh: istioctl dashboard kiali"
echo "4. Install OPA: ./scripts/install-opa.sh"
echo ""

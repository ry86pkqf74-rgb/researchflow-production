#!/bin/bash
# Install and Configure OPA for ResearchFlow
# Phase A - Task 41: OPA Policies for Orchestrator

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "ResearchFlow - OPA Installation"
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

# Create namespace if needed
if ! kubectl get namespace researchflow &> /dev/null; then
    echo "Creating researchflow namespace..."
    kubectl create namespace researchflow
    echo -e "${GREEN}✓ Namespace created${NC}"
fi

echo ""

# Deploy OPA
echo "Deploying OPA..."
kubectl apply -f infrastructure/kubernetes/base/opa/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ OPA deployed successfully${NC}"
else
    echo -e "${RED}Error: OPA deployment failed${NC}"
    exit 1
fi

echo ""

# Wait for OPA to be ready
echo "Waiting for OPA to be ready..."
kubectl wait --for=condition=available --timeout=120s \
    deployment/opa -n researchflow

echo -e "${GREEN}✓ OPA is ready${NC}"
echo ""

# Test OPA
echo "Testing OPA health..."
kubectl exec -n researchflow \
    $(kubectl get pod -n researchflow -l app=opa -o jsonpath='{.items[0].metadata.name}') \
    -- wget -q -O- http://localhost:8282/health?plugins

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ OPA health check passed${NC}"
else
    echo -e "${YELLOW}Warning: OPA health check failed${NC}"
fi

echo ""

# Test policy
echo "Testing authorization policy..."
kubectl port-forward -n researchflow svc/opa 8181:8181 &
PF_PID=$!
sleep 2

# Test allow health check
RESULT=$(curl -s -X POST http://localhost:8181/v1/data/envoy/authz/allow \
  -d '{"input": {"attributes": {"request": {"http": {"method": "GET", "path": "/healthz", "headers": {}}}}}}' \
  | jq -r '.result')

if [ "$RESULT" == "true" ]; then
    echo -e "${GREEN}✓ Health check policy works${NC}"
else
    echo -e "${YELLOW}Warning: Policy test returned: $RESULT${NC}"
fi

# Test deny without auth
RESULT=$(curl -s -X POST http://localhost:8181/v1/data/envoy/authz/allow \
  -d '{"input": {"attributes": {"request": {"http": {"method": "GET", "path": "/api/artifacts", "headers": {}}}}}}' \
  | jq -r '.result')

if [ "$RESULT" == "false" ]; then
    echo -e "${GREEN}✓ Authorization policy works (denied without auth)${NC}"
else
    echo -e "${YELLOW}Warning: Policy test returned: $RESULT (expected false)${NC}"
fi

# Stop port forward
kill $PF_PID 2>/dev/null

echo ""

# Configure Istio integration (if Istio is installed)
if kubectl get crd gateways.networking.istio.io &> /dev/null; then
    echo "Istio detected. Configuring OPA integration..."

    echo "To enable OPA with Istio, run:"
    echo "  istioctl install --set meshConfig.extensionProviders[0].name='opa-envoy-plugin' \\"
    echo "    --set meshConfig.extensionProviders[0].envoyExtAuthzGrpc.service='opa.researchflow.svc.cluster.local' \\"
    echo "    --set meshConfig.extensionProviders[0].envoyExtAuthzGrpc.port=9191"

    echo ""
    echo "Then apply authorization policies:"
    echo "  kubectl apply -f infrastructure/kubernetes/base/istio/authorization-policy.yaml"
else
    echo -e "${YELLOW}Note: Istio not detected. OPA can be used via middleware.${NC}"
fi

echo ""
echo "=========================================="
echo "OPA Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. View OPA logs: kubectl logs -n researchflow -l app=opa"
echo "2. Test policies: kubectl port-forward -n researchflow svc/opa 8181:8181"
echo "3. Query policy: curl -X POST http://localhost:8181/v1/data/envoy/authz/allow -d '{...}'"
echo "4. Update policies: Edit infrastructure/kubernetes/base/opa/policies/authz.rego"
echo "5. Reload policies: kubectl rollout restart deployment/opa -n researchflow"
echo ""

#!/bin/bash
# ResearchFlow Production - Deployment Script
# ============================================

set -e

BLUE='\033[34m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
NC='\033[0m'

# Configuration
ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
REGISTRY=${DOCKER_REGISTRY:-ghcr.io/your-org}

echo -e "${BLUE}ResearchFlow Deployment${NC}"
echo "========================"
echo "Environment: $ENVIRONMENT"
echo "Version: $VERSION"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'. Use 'staging' or 'production'${NC}"
    exit 1
fi

# Production confirmation
if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${YELLOW}WARNING: You are about to deploy to PRODUCTION${NC}"
    read -p "Are you sure? Type 'yes' to continue: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

# Check kubectl context
echo "Checking Kubernetes context..."
CURRENT_CONTEXT=$(kubectl config current-context)
echo "Current context: $CURRENT_CONTEXT"

if [ "$ENVIRONMENT" == "production" ] && [[ ! "$CURRENT_CONTEXT" =~ production ]]; then
    echo -e "${YELLOW}Warning: Context doesn't appear to be production. Please verify.${NC}"
    read -p "Continue anyway? [y/N] " confirm
    if [ "$confirm" != "y" ]; then
        exit 0
    fi
fi

# Build images if needed
if [ "$VERSION" == "latest" ]; then
    echo ""
    echo "Building Docker images..."
    docker-compose -f docker-compose.prod.yml build

    echo "Tagging images..."
    TIMESTAMP=$(date +%Y%m%d%H%M%S)
    docker tag researchflow/orchestrator:latest $REGISTRY/researchflow/orchestrator:$TIMESTAMP
    docker tag researchflow/worker:latest $REGISTRY/researchflow/worker:$TIMESTAMP
    docker tag researchflow/web:latest $REGISTRY/researchflow/web:$TIMESTAMP

    echo "Pushing images..."
    docker push $REGISTRY/researchflow/orchestrator:$TIMESTAMP
    docker push $REGISTRY/researchflow/worker:$TIMESTAMP
    docker push $REGISTRY/researchflow/web:$TIMESTAMP

    VERSION=$TIMESTAMP
fi

# Update kustomization with new version
echo ""
echo "Updating Kustomize overlay..."
cd infrastructure/kubernetes/overlays/$ENVIRONMENT

# Update image tags
sed -i.bak "s/newTag: .*/newTag: $VERSION/" kustomization.yaml
rm -f kustomization.yaml.bak

# Show what will be deployed
echo ""
echo "Resources to be deployed:"
kubectl kustomize . | grep -E "^kind:|^  name:" | paste - -

# Apply changes
echo ""
echo "Applying Kubernetes manifests..."
kubectl apply -k .

# Wait for rollouts
echo ""
echo "Waiting for rollouts to complete..."

NAMESPACE="researchflow-$ENVIRONMENT"
if [ "$ENVIRONMENT" == "production" ]; then
    NAMESPACE="researchflow-production"
fi

kubectl rollout status deployment/orchestrator -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/worker -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/web -n $NAMESPACE --timeout=300s

# Verify deployment
echo ""
echo "Verifying deployment..."
echo ""
echo "Pods:"
kubectl get pods -n $NAMESPACE
echo ""
echo "Services:"
kubectl get services -n $NAMESPACE
echo ""

# Health check
echo "Running health checks..."
# Get service URL (adjust based on your ingress/loadbalancer setup)
if [ "$ENVIRONMENT" == "staging" ]; then
    SERVICE_URL="https://staging.researchflow.example.com"
else
    SERVICE_URL="https://researchflow.example.com"
fi

for i in {1..10}; do
    if curl -sf "$SERVICE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}Health check passed!${NC}"
        break
    fi
    echo "  Health check attempt $i/10..."
    sleep 5
done

# Commit version update
cd ../../..
git add infrastructure/kubernetes/overlays/$ENVIRONMENT/kustomization.yaml
git commit -m "deploy: $ENVIRONMENT $VERSION" || true

echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo "Version $VERSION deployed to $ENVIRONMENT"
echo "URL: $SERVICE_URL"

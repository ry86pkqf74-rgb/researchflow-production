#!/usr/bin/env bash
# Phase A - Task 9: Helm post-renderer that applies Kustomize overlays
# This script allows Helm to provide parameters while Kustomize handles the manifests

set -euo pipefail

# Get overlay from environment or default to prod
OVERLAY="${KUSTOMIZE_OVERLAY:-infrastructure/kubernetes/overlays/production}"
REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Create temp directory for processing
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

# Read Helm output from stdin
cat > "${TMP}/helm-output.yaml"

# Create kustomization that references Helm output and applies overlay patches
cat > "${TMP}/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Include Helm-generated resources
resources:
  - helm-output.yaml

# Apply patches from the specified overlay
patchesStrategicMerge: []

# Labels to add to all resources
commonLabels:
  app.kubernetes.io/managed-by: helm-kustomize
EOF

# If overlay has patches, reference them
if [ -f "${REPO_ROOT}/${OVERLAY}/kustomization.yaml" ]; then
    # Build using the overlay directly
    kustomize build "${REPO_ROOT}/${OVERLAY}"
else
    # Just output the Helm manifests
    kustomize build "${TMP}"
fi

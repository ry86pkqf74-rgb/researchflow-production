#!/bin/bash
# ==============================================================================
# ResearchFlow GitHub Secrets Setup Script
# ==============================================================================
# Usage: ./scripts/setup-github-secrets.sh
#
# This script helps configure GitHub Secrets for CI/CD workflows.
# Requires: GitHub CLI (gh) authenticated to your repository.
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     ResearchFlow GitHub Secrets Configuration               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI.${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
    echo -e "${RED}Error: Not in a GitHub repository.${NC}"
    exit 1
fi

echo -e "${GREEN}Repository: ${REPO}${NC}"
echo ""

# Function to set secret interactively
set_secret() {
    local name=$1
    local description=$2
    local required=$3

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Secret: ${name}${NC}"
    echo -e "Description: ${description}"

    if [ "$required" = "required" ]; then
        echo -e "${RED}[REQUIRED]${NC}"
    else
        echo -e "${GREEN}[OPTIONAL]${NC}"
    fi

    # Check if secret exists
    if gh secret list | grep -q "^${name}"; then
        echo -e "${GREEN}✓ Already configured${NC}"
        read -p "Update this secret? (y/N): " update
        if [ "$update" != "y" ] && [ "$update" != "Y" ]; then
            return
        fi
    fi

    read -p "Enter value (or press Enter to skip): " value

    if [ -n "$value" ]; then
        echo "$value" | gh secret set "$name"
        echo -e "${GREEN}✓ Secret ${name} configured${NC}"
    else
        if [ "$required" = "required" ]; then
            echo -e "${YELLOW}⚠ Skipped required secret${NC}"
        else
            echo -e "${BLUE}→ Skipped${NC}"
        fi
    fi
    echo ""
}

# Function to set secret from file
set_secret_from_file() {
    local name=$1
    local description=$2

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Secret: ${name}${NC}"
    echo -e "Description: ${description}"
    echo -e "${RED}[REQUIRED - FILE INPUT]${NC}"

    if gh secret list | grep -q "^${name}"; then
        echo -e "${GREEN}✓ Already configured${NC}"
        read -p "Update this secret? (y/N): " update
        if [ "$update" != "y" ] && [ "$update" != "Y" ]; then
            return
        fi
    fi

    read -p "Enter file path (or press Enter to skip): " filepath

    if [ -n "$filepath" ] && [ -f "$filepath" ]; then
        gh secret set "$name" < "$filepath"
        echo -e "${GREEN}✓ Secret ${name} configured from file${NC}"
    else
        echo -e "${YELLOW}⚠ Skipped - file not found${NC}"
    fi
    echo ""
}

echo -e "\n${BLUE}=== AI Provider API Keys ===${NC}\n"

set_secret "OPENAI_API_KEY" "OpenAI API key for GPT-4 code analysis" "required"
set_secret "ANTHROPIC_API_KEY" "Anthropic API key for Claude code review" "required"
set_secret "XAI_API_KEY" "xAI API key for Grok integration" "optional"
set_secret "MERCURY_API_KEY" "InceptionLabs Mercury API key" "optional"
set_secret "SOURCEGRAPH_API_KEY" "Sourcegraph access token for code intelligence" "optional"

echo -e "\n${BLUE}=== Literature Search API Keys ===${NC}\n"

set_secret "NCBI_API_KEY" "NCBI/NLM API key for PubMed and MeSH" "optional"
set_secret "SEMANTIC_SCHOLAR_API_KEY" "Semantic Scholar API key" "optional"

echo -e "\n${BLUE}=== Infrastructure Secrets ===${NC}\n"

set_secret_from_file "KUBE_CONFIG_STAGING" "Kubernetes config for staging environment"
set_secret_from_file "KUBE_CONFIG_PRODUCTION" "Kubernetes config for production environment"

set_secret "STAGING_URL" "Staging environment URL (e.g., https://staging.example.com)" "required"
set_secret "PRODUCTION_URL" "Production environment URL (e.g., https://app.example.com)" "required"

echo -e "\n${BLUE}=== Security Secrets ===${NC}\n"

# Generate JWT secret if not provided
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Secret: JWT_SECRET${NC}"
echo -e "Description: JWT signing secret for authentication"
echo -e "${RED}[REQUIRED]${NC}"

if gh secret list | grep -q "^JWT_SECRET"; then
    echo -e "${GREEN}✓ Already configured${NC}"
    read -p "Update this secret? (y/N): " update
    if [ "$update" = "y" ] || [ "$update" = "Y" ]; then
        read -p "Enter value or 'generate' for auto-generation: " jwt_value
        if [ "$jwt_value" = "generate" ]; then
            jwt_value=$(openssl rand -hex 32)
            echo "Generated: ${jwt_value:0:8}..."
        fi
        if [ -n "$jwt_value" ]; then
            echo "$jwt_value" | gh secret set "JWT_SECRET"
            echo -e "${GREEN}✓ Secret JWT_SECRET configured${NC}"
        fi
    fi
else
    read -p "Enter value or 'generate' for auto-generation: " jwt_value
    if [ "$jwt_value" = "generate" ]; then
        jwt_value=$(openssl rand -hex 32)
        echo "Generated: ${jwt_value:0:8}..."
    fi
    if [ -n "$jwt_value" ]; then
        echo "$jwt_value" | gh secret set "JWT_SECRET"
        echo -e "${GREEN}✓ Secret JWT_SECRET configured${NC}"
    fi
fi
echo ""

# Generate Analytics IP Salt
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Secret: ANALYTICS_IP_SALT${NC}"
echo -e "Description: Salt for hashing IP addresses in analytics"
echo -e "${GREEN}[OPTIONAL]${NC}"

if ! gh secret list | grep -q "^ANALYTICS_IP_SALT"; then
    read -p "Generate and set ANALYTICS_IP_SALT? (Y/n): " gen_salt
    if [ "$gen_salt" != "n" ] && [ "$gen_salt" != "N" ]; then
        salt=$(openssl rand -hex 16)
        echo "$salt" | gh secret set "ANALYTICS_IP_SALT"
        echo -e "${GREEN}✓ Secret ANALYTICS_IP_SALT configured${NC}"
    fi
else
    echo -e "${GREEN}✓ Already configured${NC}"
fi
echo ""

set_secret "GITLEAKS_LICENSE" "Gitleaks license key for secret scanning" "optional"

echo -e "\n${BLUE}=== Optional Integrations ===${NC}\n"

set_secret "SENTRY_DSN" "Sentry DSN for error tracking" "optional"
set_secret "VITE_SENTRY_DSN" "Sentry DSN for frontend (Vite)" "optional"
set_secret "CODECOV_TOKEN" "Codecov token for coverage reports" "optional"
set_secret "STRIPE_WEBHOOK_SECRET" "Stripe webhook signing secret" "optional"

echo -e "\n${BLUE}=== Repository Variables ===${NC}\n"

# Set repository variables
echo -e "${YELLOW}Setting repository variables...${NC}"

gh variable set AI_REVIEW_ENABLED --body "true" 2>/dev/null || \
    echo -e "${YELLOW}Note: Could not set AI_REVIEW_ENABLED variable${NC}"

echo -e "\n${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Configuration Complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Current secrets configured:"
gh secret list
echo ""
echo "Current variables:"
gh variable list 2>/dev/null || echo "No variables configured"
echo ""
echo -e "${BLUE}Documentation: docs/GITHUB_SECRETS_SETUP.md${NC}"

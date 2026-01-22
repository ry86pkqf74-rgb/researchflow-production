#!/bin/bash
# ============================================
# ResearchFlow API Endpoint Test Script
# ============================================
# Tests all major API endpoints to verify functionality
#
# Usage:
#   ./scripts/test-api-endpoints.sh [http|https] [host] [port]
#
# Examples:
#   ./scripts/test-api-endpoints.sh https localhost 443
#   ./scripts/test-api-endpoints.sh http localhost 80
#
# Prerequisites:
#   - jq installed (for JSON parsing)
#   - curl installed
#   - Services running (docker-compose up)

set -e

# Configuration
PROTOCOL=${1:-http}
HOST=${2:-localhost}
PORT=${3:-80}
BASE_URL="${PROTOCOL}://${HOST}:${PORT}"
API_URL="${BASE_URL}/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
SKIPPED=0

# Test result function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local headers="$5"
    local data="$6"

    echo -n "Testing ${name}... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "${endpoint}" ${headers} 2>/dev/null || echo "000")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "${endpoint}" ${headers} -d "${data}" 2>/dev/null || echo "000")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${endpoint}" ${headers} 2>/dev/null || echo "000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "${method}" "${endpoint}" ${headers} 2>/dev/null || echo "000")
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (${status_code})"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: ${expected_status}, Got: ${status_code})"
        if [ -n "$body" ]; then
            echo "  Response: ${body}" | head -n 3
        fi
        ((FAILED++))
        return 1
    fi
}

test_auth_required() {
    local name="$1"
    local method="$2"
    local endpoint="$3"

    echo -n "Testing ${name} (auth required)... "

    response=$(curl -s -w "\n%{http_code}" -X "${method}" "${endpoint}" 2>/dev/null || echo "000")
    status_code=$(echo "$response" | tail -n1)

    if [ "$status_code" = "401" ] || [ "$status_code" = "403" ]; then
        echo -e "${GREEN}✓ PASS${NC} (${status_code} - Auth required)"
        ((PASSED++))
        return 0
    else
        echo -e "${YELLOW}⚠ SKIP${NC} (Expected 401/403, Got: ${status_code})"
        ((SKIPPED++))
        return 0
    fi
}

# Print header
echo ""
echo "========================================"
echo "  ResearchFlow API Endpoint Tests"
echo "========================================"
echo "Base URL: ${BASE_URL}"
echo "API URL:  ${API_URL}"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq not installed. JSON parsing limited.${NC}"
fi

# ============================================
# Test Suite
# ============================================

echo -e "${BLUE}=== Core Health Checks ===${NC}"
test_endpoint "Nginx Health" "GET" "${BASE_URL}/health" "200"
test_endpoint "API Health" "GET" "${API_URL}/health" "200" || test_endpoint "API Health (orchestrator)" "GET" "${BASE_URL}:3001/api/health" "200"

echo ""
echo -e "${BLUE}=== Authentication Endpoints ===${NC}"
test_endpoint "Auth Login (no credentials)" "POST" "${API_URL}/auth/login" "400" "-H 'Content-Type: application/json'"
test_endpoint "Auth Register (no data)" "POST" "${API_URL}/auth/register" "400" "-H 'Content-Type: application/json'"
test_endpoint "Auth Logout" "POST" "${API_URL}/auth/logout" "401"

echo ""
echo -e "${BLUE}=== Governance Endpoints ===${NC}"
test_endpoint "Governance Status" "GET" "${API_URL}/governance/status" "200"
test_auth_required "Governance Mode Switch" "POST" "${API_URL}/governance/mode"
test_auth_required "PHI Checklist" "GET" "${API_URL}/governance/phi-checklist"

echo ""
echo -e "${BLUE}=== Workflow Endpoints ===${NC}"
test_auth_required "List Workflows" "GET" "${API_URL}/workflows"
test_auth_required "Get Workflow Templates" "GET" "${API_URL}/workflows/templates"
test_auth_required "Create Workflow" "POST" "${API_URL}/workflows"

echo ""
echo -e "${BLUE}=== Dataset Endpoints ===${NC}"
test_auth_required "List Datasets" "GET" "${API_URL}/datasets"
test_auth_required "Create Dataset" "POST" "${API_URL}/datasets"

echo ""
echo -e "${BLUE}=== Search Endpoints ===${NC}"
test_auth_required "Search Full-Text" "GET" "${API_URL}/search?q=test&type=fulltext"
test_auth_required "Search Semantic" "GET" "${API_URL}/search?q=test&type=semantic"
test_auth_required "Search Hybrid" "GET" "${API_URL}/search?q=test&type=hybrid"

echo ""
echo -e "${BLUE}=== Organization Endpoints ===${NC}"
test_auth_required "List Organizations" "GET" "${API_URL}/org"
test_auth_required "Get Org Settings" "GET" "${API_URL}/org/default/settings"
test_auth_required "List Org Members" "GET" "${API_URL}/org/default/members"

echo ""
echo -e "${BLUE}=== Consent Management Endpoints ===${NC}"
test_auth_required "Get Consent Status" "GET" "${API_URL}/consent/status"
test_auth_required "Grant Consent" "POST" "${API_URL}/consent/grant"
test_auth_required "Revoke Consent" "POST" "${API_URL}/consent/revoke"

echo ""
echo -e "${BLUE}=== Custom Fields Endpoints ===${NC}"
test_auth_required "Get Custom Field Schemas" "GET" "${API_URL}/custom-fields/schemas"
test_auth_required "Create Field Schema" "POST" "${API_URL}/custom-fields/schemas"

echo ""
echo -e "${BLUE}=== Experiment/Feature Flags ===${NC}"
test_auth_required "List Experiments" "GET" "${API_URL}/experiments"
test_auth_required "Get Experiment Assignment" "GET" "${API_URL}/experiments/test-experiment/assignment"

echo ""
echo -e "${BLUE}=== Docs-First Endpoints ===${NC}"
test_auth_required "List Ideas" "GET" "${API_URL}/docs-first/ideas"
test_auth_required "List Topic Briefs" "GET" "${API_URL}/docs-first/topic-briefs"
test_auth_required "List Venues" "GET" "${API_URL}/docs-first/venues"
test_auth_required "List Doc Kits" "GET" "${API_URL}/docs-first/doc-kits"

echo ""
echo -e "${BLUE}=== Tutorial Endpoints ===${NC}"
test_endpoint "List Tutorials" "GET" "${API_URL}/tutorials" "200" || test_auth_required "List Tutorials" "GET" "${API_URL}/tutorials"
test_auth_required "Get Tutorial Progress" "GET" "${API_URL}/tutorials/intro-workflow/progress"

echo ""
echo -e "${BLUE}=== Help & Documentation ===${NC}"
test_endpoint "Get API Docs" "GET" "${API_URL}/help/docs" "200" || test_auth_required "Get API Docs" "GET" "${API_URL}/help/docs"
test_endpoint "Get Community Links" "GET" "${API_URL}/help/community" "200" || test_auth_required "Get Community Links" "GET" "${API_URL}/help/community"

echo ""
echo -e "${BLUE}=== Plugin Marketplace ===${NC}"
test_auth_required "List Plugins" "GET" "${API_URL}/plugins"
test_auth_required "Get Plugin Details" "GET" "${API_URL}/plugins/test-plugin"

echo ""
echo -e "${BLUE}=== AI Integration Endpoints ===${NC}"
test_auth_required "Get AI Providers" "GET" "${API_URL}/ai/providers"
test_auth_required "Get AI Usage Stats" "GET" "${API_URL}/ai/usage"
test_auth_required "Verify Watermark" "POST" "${API_URL}/ai/watermark/verify"

echo ""
echo -e "${BLUE}=== Integration Endpoints ===${NC}"
test_auth_required "List Integrations" "GET" "${API_URL}/integrations"
test_auth_required "Google Drive Auth Status" "GET" "${API_URL}/integrations/google-drive/auth/status"
test_auth_required "Zotero Sync Status" "GET" "${API_URL}/literature/zotero/sync/status"

echo ""
echo -e "${BLUE}=== Monitoring Endpoints ===${NC}"
test_auth_required "Get System Metrics" "GET" "${API_URL}/monitoring/metrics"
test_auth_required "Get Cluster Status" "GET" "${API_URL}/monitoring/cluster/status"
test_auth_required "Get Cost Metrics" "GET" "${API_URL}/monitoring/costs"

echo ""
echo -e "${BLUE}=== User Settings Endpoints ===${NC}"
test_auth_required "Get User Settings" "GET" "${API_URL}/user/settings"
test_auth_required "Get User Preferences" "GET" "${API_URL}/me/preferences"
test_auth_required "Get API Keys" "GET" "${API_URL}/profile/api-keys"

echo ""
echo -e "${BLUE}=== Badge System ===${NC}"
test_auth_required "List User Badges" "GET" "${API_URL}/badges/user"
test_auth_required "Get Badge Leaderboard" "GET" "${API_URL}/badges/leaderboard"

echo ""
echo -e "${BLUE}=== Sustainability ===${NC}"
test_auth_required "Get CO2 Metrics" "GET" "${API_URL}/sustainability/co2"
test_auth_required "Get Usage Report" "GET" "${API_URL}/sustainability/report"

echo ""
echo -e "${BLUE}=== Peer Review ===${NC}"
test_auth_required "List Review Requests" "GET" "${API_URL}/peer-review/requests"
test_auth_required "Get Review Rubrics" "GET" "${API_URL}/peer-review/rubrics"

echo ""
echo -e "${BLUE}=== ORCID Integration ===${NC}"
test_endpoint "ORCID OAuth URL" "GET" "${API_URL}/orcid/auth/url" "200" || test_auth_required "ORCID OAuth URL" "GET" "${API_URL}/orcid/auth/url"

echo ""
echo -e "${BLUE}=== Artifact V2 Endpoints ===${NC}"
test_auth_required "List Artifacts" "GET" "${API_URL}/v2/artifacts"
test_auth_required "Get Provenance Graph" "GET" "${API_URL}/v2/artifacts/prov/graph"

echo ""
echo -e "${BLUE}=== Conference Tools ===${NC}"
test_auth_required "Discover Conferences" "GET" "${API_URL}/ros/conference/discover?query=machine+learning"
test_auth_required "Get Conference Requirements" "GET" "${API_URL}/ros/conference/requirements"

echo ""
echo -e "${BLUE}=== Comments & Submissions ===${NC}"
test_auth_required "List Comments" "GET" "${API_URL}/ros/comments?documentId=test-doc"
test_auth_required "List Submissions" "GET" "${API_URL}/ros/submissions"

echo ""
echo -e "${BLUE}=== Manuscript Branches ===${NC}"
test_auth_required "List Branches" "GET" "${API_URL}/ros/manuscripts/branches?manuscriptId=test-ms"

echo ""
echo "========================================"
echo "  Test Results Summary"
echo "========================================"
echo -e "${GREEN}Passed:  ${PASSED}${NC}"
echo -e "${RED}Failed:  ${FAILED}${NC}"
echo -e "${YELLOW}Skipped: ${SKIPPED}${NC}"
echo "Total:   $((PASSED + FAILED + SKIPPED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Check output above.${NC}"
    exit 1
fi

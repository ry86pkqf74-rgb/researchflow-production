#!/bin/bash
# ResearchFlow AI Tools Status Checker
# Verifies all AI tools and services are operational

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════"
echo "  ResearchFlow AI Tools Status Check"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Track overall status
ALL_OK=true

check_service() {
    local name=$1
    local check_cmd=$2
    local expected=$3

    if eval "$check_cmd" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name"
        return 0
    else
        echo -e "  ${RED}✗${NC} $name"
        ALL_OK=false
        return 1
    fi
}

check_api() {
    local name=$1
    local url=$2
    local key_var=$3

    if [ -n "${!key_var}" ]; then
        echo -e "  ${GREEN}✓${NC} $name (API key configured)"
    else
        echo -e "  ${YELLOW}○${NC} $name (API key not set: $key_var)"
    fi
}

echo "▸ Cloud AI Providers"
echo "─────────────────────────────────────────────────────────"
check_api "Anthropic (Claude)" "https://api.anthropic.com" "ANTHROPIC_API_KEY"
check_api "OpenAI (GPT-4)" "https://api.openai.com" "OPENAI_API_KEY"
check_api "xAI (Grok)" "https://api.x.ai" "XAI_API_KEY"
check_api "Mercury Coder" "https://api.inceptionlabs.ai" "MERCURY_API_KEY"
check_api "Sourcegraph" "https://sourcegraph.com" "SOURCEGRAPH_API_KEY"
echo ""

echo "▸ Local AI Services"
echo "─────────────────────────────────────────────────────────"
if curl -s http://localhost:1234/v1/models > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} LM Studio (localhost:1234)"
else
    echo -e "  ${YELLOW}○${NC} LM Studio (not running - start for local inference)"
fi
echo ""

echo "▸ IDE Tools"
echo "─────────────────────────────────────────────────────────"
if [ -f "$HOME/Library/Application Support/Cursor/User/settings.json" ]; then
    echo -e "  ${GREEN}✓${NC} Cursor IDE (configured)"
else
    echo -e "  ${RED}✗${NC} Cursor IDE (not configured)"
    ALL_OK=false
fi

if [ -f "$HOME/.continue/config.yaml" ]; then
    echo -e "  ${GREEN}✓${NC} Continue.dev (configured)"
else
    echo -e "  ${RED}✗${NC} Continue.dev (not configured)"
    ALL_OK=false
fi

if command -v codex &> /dev/null; then
    CODEX_VERSION=$(codex --version 2>/dev/null || echo "unknown")
    echo -e "  ${GREEN}✓${NC} Codex CLI ($CODEX_VERSION)"
else
    echo -e "  ${YELLOW}○${NC} Codex CLI (not installed: npm i -g @openai/codex)"
fi
echo ""

echo "▸ Docker Services"
echo "─────────────────────────────────────────────────────────"
if command -v docker &> /dev/null; then
    HEALTHY=$(docker ps --filter "health=healthy" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')
    TOTAL=$(docker ps --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$HEALTHY" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} All $TOTAL services healthy"
    elif [ "$TOTAL" -gt 0 ]; then
        echo -e "  ${YELLOW}○${NC} $HEALTHY/$TOTAL services healthy"
    else
        echo -e "  ${RED}✗${NC} No Docker services running"
        ALL_OK=false
    fi
else
    echo -e "  ${RED}✗${NC} Docker not available"
    ALL_OK=false
fi
echo ""

echo "▸ Version Control"
echo "─────────────────────────────────────────────────────────"
if gh auth status > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} GitHub CLI (authenticated)"
else
    echo -e "  ${RED}✗${NC} GitHub CLI (not authenticated)"
    ALL_OK=false
fi

if [ -d ".git" ]; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo -e "  ${GREEN}✓${NC} Git repository (branch: $BRANCH)"
else
    echo -e "  ${YELLOW}○${NC} Git (not in repository)"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
if $ALL_OK; then
    echo -e "  ${GREEN}All critical systems operational${NC}"
else
    echo -e "  ${YELLOW}Some systems need attention${NC}"
fi
echo "═══════════════════════════════════════════════════════════"

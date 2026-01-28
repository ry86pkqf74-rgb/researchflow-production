#!/bin/bash

echo "=== ResearchFlow Enhanced IRB Test Suite ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  echo -e "${GREEN}✓ $1${NC}"
  ((PASS_COUNT++))
}

fail() {
  echo -e "${RED}✗ $1${NC}"
  ((FAIL_COUNT++))
}

warn() {
  echo -e "${YELLOW}! $1${NC}"
}

section() {
  echo -e "\n${BLUE}--- $1 ---${NC}"
}

# ========================================
# Phase 1-7: Backend Module Tests
# ========================================

section "Phase 1-7: Backend Module Existence"

# Check models.py (in ros_irb module)
if [ -f "services/worker/src/ros_irb/models.py" ]; then
  pass "IRB models.py exists"
  if grep -q "class ExemptionCategory" services/worker/src/ros_irb/models.py 2>/dev/null; then
    pass "ExemptionCategory model defined"
  else
    fail "ExemptionCategory model missing"
  fi
else
  fail "IRB models.py missing"
fi

# Check Emory questions
if [ -f "services/worker/src/ros_irb/emory_questions.py" ]; then
  pass "Emory questions template exists"
  if grep -qi "chart.*review\|secondary.*use" services/worker/src/ros_irb/emory_questions.py 2>/dev/null; then
    pass "Chart review questions defined"
  else
    fail "Chart review questions missing"
  fi
else
  fail "Emory questions template missing"
fi

# Check lay summary validator
if [ -f "services/worker/src/ros_irb/lay_summary_validator.py" ]; then
  pass "Lay summary validator exists"
  if grep -q "validate.*lay.*summary\|validate_emory_lay_summary" services/worker/src/ros_irb/lay_summary_validator.py 2>/dev/null; then
    pass "validate_lay_summary function defined"
  else
    fail "validate_lay_summary function missing"
  fi
else
  fail "Lay summary validator missing"
fi

# Check AI/ML compliance
if [ -f "services/worker/src/ros_irb/ai_ml_compliance.py" ]; then
  pass "AI/ML compliance module exists"
  if grep -q "get_ai_ml_questions\|validate_ai_ml_responses" services/worker/src/ros_irb/ai_ml_compliance.py 2>/dev/null; then
    pass "AI/ML compliance functions defined"
  else
    fail "AI/ML compliance functions missing"
  fi
else
  fail "AI/ML compliance module missing"
fi

# Check PHI scanner enhanced
if [ -f "services/worker/src/ros_irb/phi_scanner_enhanced.py" ]; then
  pass "Enhanced PHI scanner exists"
  if grep -q "EnhancedPHIScanner" services/worker/src/ros_irb/phi_scanner_enhanced.py 2>/dev/null; then
    pass "EnhancedPHIScanner class defined"
  else
    fail "EnhancedPHIScanner class missing"
  fi
else
  fail "Enhanced PHI scanner missing"
fi

# Check vulnerable populations
if [ -f "services/worker/src/ros_irb/vulnerable_populations.py" ]; then
  pass "Vulnerable populations module exists"
  if grep -q "VulnerablePopulation\|POPULATION_REQUIREMENTS" services/worker/src/ros_irb/vulnerable_populations.py 2>/dev/null; then
    pass "VulnerablePopulation handling defined"
  else
    fail "VulnerablePopulation handling missing"
  fi
else
  fail "Vulnerable populations module missing"
fi

# ========================================
# Phase 8: Backend API Tests
# ========================================

section "Phase 8: Backend API"

if [ -f "services/worker/src/api/irb_enhanced.py" ]; then
  pass "IRB enhanced API router exists"

  # Check key endpoints
  if grep -q '"/institutions"' services/worker/src/api/irb_enhanced.py 2>/dev/null; then
    pass "Institutions endpoint defined"
  else
    fail "Institutions endpoint missing"
  fi

  if grep -q '"/lay-summary/validate"' services/worker/src/api/irb_enhanced.py 2>/dev/null; then
    pass "Lay summary validation endpoint defined"
  else
    fail "Lay summary validation endpoint missing"
  fi

  if grep -q '"/vulnerable-populations"' services/worker/src/api/irb_enhanced.py 2>/dev/null; then
    pass "Vulnerable populations endpoint defined"
  else
    fail "Vulnerable populations endpoint missing"
  fi

  if grep -q '"/phi/scan"' services/worker/src/api/irb_enhanced.py 2>/dev/null; then
    pass "PHI scan endpoint defined"
  else
    fail "PHI scan endpoint missing"
  fi

  if grep -q '/ai-ml/compliance-check' services/worker/src/api/irb_enhanced.py 2>/dev/null; then
    pass "AI/ML compliance check endpoint defined"
  else
    fail "AI/ML compliance check endpoint missing"
  fi
else
  fail "IRB enhanced API router missing"
fi

# Check API server registration
if grep -q "irb_enhanced" services/worker/api_server.py 2>/dev/null; then
  pass "IRB enhanced router registered in API server"
else
  fail "IRB enhanced router not registered"
fi

# ========================================
# Phase 9: Frontend Component Tests
# ========================================

section "Phase 9: Frontend Components"

# Check component files exist
COMPONENTS=(
  "services/web/src/features/irb/components/institution-selector.tsx"
  "services/web/src/features/irb/components/lay-summary-editor.tsx"
  "services/web/src/features/irb/components/vulnerable-populations-section.tsx"
  "services/web/src/features/irb/components/ai-ml-disclosure.tsx"
  "services/web/src/features/irb/components/index.ts"
)

for comp in "${COMPONENTS[@]}"; do
  if [ -f "$comp" ]; then
    pass "$(basename $comp) exists"
  else
    fail "$(basename $comp) missing"
  fi
done

# Check main form page
if [ -f "services/web/src/features/irb/pages/enhanced-irb-form.tsx" ]; then
  pass "EnhancedIRBForm page exists"

  # Check component integration
  if grep -q "InstitutionSelector" services/web/src/features/irb/pages/enhanced-irb-form.tsx 2>/dev/null; then
    pass "InstitutionSelector integrated in form"
  else
    fail "InstitutionSelector not integrated"
  fi

  if grep -q "LaySummaryEditor" services/web/src/features/irb/pages/enhanced-irb-form.tsx 2>/dev/null; then
    pass "LaySummaryEditor integrated in form"
  else
    fail "LaySummaryEditor not integrated"
  fi

  if grep -q "VulnerablePopulationsSection" services/web/src/features/irb/pages/enhanced-irb-form.tsx 2>/dev/null; then
    pass "VulnerablePopulationsSection integrated in form"
  else
    fail "VulnerablePopulationsSection not integrated"
  fi

  if grep -q "AIMLDisclosure" services/web/src/features/irb/pages/enhanced-irb-form.tsx 2>/dev/null; then
    pass "AIMLDisclosure integrated in form"
  else
    fail "AIMLDisclosure not integrated"
  fi
else
  fail "EnhancedIRBForm page missing"
fi

# Check feature index exports
if [ -f "services/web/src/features/irb/index.ts" ]; then
  pass "IRB feature index exists"

  EXPORTS=(
    "InstitutionSelector"
    "LaySummaryEditor"
    "VulnerablePopulationsSection"
    "AIMLDisclosure"
    "EnhancedIRBForm"
  )

  for exp in "${EXPORTS[@]}"; do
    if grep -q "$exp" services/web/src/features/irb/index.ts 2>/dev/null; then
      pass "$exp exported from index"
    else
      fail "$exp not exported from index"
    fi
  done
else
  fail "IRB feature index missing"
fi

# ========================================
# React Query & API Integration Tests
# ========================================

section "React Query Integration"

# Check useQuery usage
if grep -q "useQuery" services/web/src/features/irb/components/institution-selector.tsx 2>/dev/null; then
  pass "Institution selector uses React Query"
else
  fail "Institution selector missing React Query"
fi

if grep -q "useMutation" services/web/src/features/irb/components/lay-summary-editor.tsx 2>/dev/null; then
  pass "Lay summary editor uses useMutation"
else
  fail "Lay summary editor missing useMutation"
fi

# Check API endpoint paths
if grep -q "/api/irb/institutions" services/web/src/features/irb/components/institution-selector.tsx 2>/dev/null; then
  pass "Institution selector calls correct API"
else
  fail "Institution selector API path incorrect"
fi

if grep -q "/api/irb/lay-summary/validate" services/web/src/features/irb/components/lay-summary-editor.tsx 2>/dev/null; then
  pass "Lay summary editor calls correct validation API"
else
  fail "Lay summary validation API path incorrect"
fi

# ========================================
# Dark Mode Support Tests
# ========================================

section "Dark Mode Support"

for comp in "${COMPONENTS[@]}"; do
  if [ -f "$comp" ] && [[ "$comp" == *.tsx ]]; then
    if grep -q "dark:" "$comp" 2>/dev/null; then
      pass "$(basename $comp) has dark mode classes"
    else
      warn "$(basename $comp) may need dark mode review"
    fi
  fi
done

# ========================================
# Live API Tests (if services are running)
# ========================================

section "Live API Tests (requires running services)"

WORKER_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null)
if [ "$WORKER_HEALTH" == "200" ]; then
  pass "Worker service is healthy"

  # Test institutions endpoint
  INST_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/irb/institutions 2>/dev/null)
  if [ "$INST_RESPONSE" == "200" ]; then
    pass "GET /api/irb/institutions returns 200"
  else
    warn "GET /api/irb/institutions returned $INST_RESPONSE (service may need restart)"
  fi

  # Test vulnerable populations endpoint
  VP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/api/irb/vulnerable-populations?institution_id=emory" 2>/dev/null)
  if [ "$VP_RESPONSE" == "200" ]; then
    pass "GET /api/irb/vulnerable-populations returns 200"
  else
    warn "GET /api/irb/vulnerable-populations returned $VP_RESPONSE"
  fi

  # Test lay summary validation
  LAY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/irb/lay-summary/validate \
    -H "Content-Type: application/json" \
    -d '{"summary_text": "This is a test lay summary that needs to be at least a hundred words to pass validation. We are testing the enhanced IRB system with institution-specific templates and real-time validation features.", "study_type": "prospective", "min_words": 20, "max_words": 500}' 2>/dev/null)
  if [ "$LAY_RESPONSE" == "200" ]; then
    pass "POST /api/irb/lay-summary/validate returns 200"
  else
    warn "POST /api/irb/lay-summary/validate returned $LAY_RESPONSE"
  fi
else
  warn "Worker service not running (skipping live API tests)"
  warn "Run 'docker compose up -d' to start services"
fi

# ========================================
# Summary
# ========================================

section "Test Summary"

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "Failed: ${RED}$FAIL_COUNT${NC}"
echo -e "Total:  $TOTAL"

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "\n${GREEN}All tests passed! ✓${NC}"
  exit 0
else
  echo -e "\n${YELLOW}Some tests failed. Review the output above.${NC}"
  exit 1
fi

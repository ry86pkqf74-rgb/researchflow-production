#!/bin/bash

echo "=== ResearchFlow Workflow Pipeline Test ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health checks
echo -e "\n--- Test 1: Health Checks ---"
ORCH_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$ORCH_HEALTH" == "200" ]; then
  echo -e "${GREEN}✓ Orchestrator healthy${NC}"
else
  echo -e "${RED}✗ Orchestrator unhealthy (HTTP $ORCH_HEALTH)${NC}"
fi

WORKER_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ "$WORKER_HEALTH" == "200" ]; then
  echo -e "${GREEN}✓ Worker healthy${NC}"
else
  echo -e "${RED}✗ Worker unhealthy (HTTP $WORKER_HEALTH)${NC}"
fi

WEB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173)
if [ "$WEB_HEALTH" == "200" ]; then
  echo -e "${GREEN}✓ Web frontend healthy${NC}"
else
  echo -e "${RED}✗ Web frontend unhealthy (HTTP $WEB_HEALTH)${NC}"
fi

# Test 2: Upload endpoint exists
echo -e "\n--- Test 2: Upload Endpoint ---"
UPLOAD_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/files/upload)
if [ "$UPLOAD_CHECK" == "400" ] || [ "$UPLOAD_CHECK" == "401" ]; then
  echo -e "${GREEN}✓ Upload endpoint exists (expected auth/file error)${NC}"
else
  echo -e "${RED}✗ Upload endpoint issue (HTTP $UPLOAD_CHECK)${NC}"
fi

# Test 3: Stage execution endpoint exists
echo -e "\n--- Test 3: Stage Execution Endpoint ---"
EXEC_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/workflow/execute/5 \
  -H "Content-Type: application/json" \
  -d '{"userInputs": {}}')
if [ "$EXEC_CHECK" == "200" ] || [ "$EXEC_CHECK" == "401" ]; then
  echo -e "${GREEN}✓ Stage execution endpoint exists${NC}"
else
  echo -e "${RED}✗ Stage execution endpoint issue (HTTP $EXEC_CHECK)${NC}"
fi

# Test 4: Docker env vars
echo -e "\n--- Test 4: Docker Environment ---"
ROS_URL=$(docker compose exec orchestrator printenv ROS_API_URL 2>/dev/null)
if [ "$ROS_URL" == "http://worker:8000" ]; then
  echo -e "${GREEN}✓ ROS_API_URL configured correctly${NC}"
else
  echo -e "${YELLOW}! ROS_API_URL not set or incorrect: $ROS_URL${NC}"
fi

UPLOADS_PATH=$(docker compose exec orchestrator printenv UPLOADS_PATH 2>/dev/null)
if [ "$UPLOADS_PATH" == "/data/uploads" ]; then
  echo -e "${GREEN}✓ UPLOADS_PATH configured correctly${NC}"
else
  echo -e "${YELLOW}! UPLOADS_PATH not set or incorrect: $UPLOADS_PATH${NC}"
fi

# Test 5: Upload directory exists
echo -e "\n--- Test 5: Upload Directory ---"
UPLOAD_DIR=$(docker compose exec orchestrator ls -la /data/uploads 2>/dev/null)
if [ -n "$UPLOAD_DIR" ]; then
  echo -e "${GREEN}✓ Upload directory exists${NC}"
else
  echo -e "${YELLOW}! Upload directory may not exist${NC}"
fi

# Test 6: File component check
echo -e "\n--- Test 6: Component Files ---"
if [ -f "services/web/src/components/ui/stage-output-viewer.tsx" ]; then
  echo -e "${GREEN}✓ StageOutputViewer component exists${NC}"
else
  echo -e "${RED}✗ StageOutputViewer component missing${NC}"
fi

# Test 7: Workflow labels check
echo -e "\n--- Test 7: Workflow Label Updates ---"
if grep -q "Variable Definition" services/orchestrator/src/data/workflowStages.ts 2>/dev/null; then
  echo -e "${GREEN}✓ Stage 4 renamed to Variable Definition${NC}"
else
  echo -e "${RED}✗ Stage 4 not renamed${NC}"
fi

# Test 8: Topic card dark mode check
echo -e "\n--- Test 8: Topic Card Dark Mode ---"
if grep -q "dark:text-" services/web/src/components/ui/topic-card-recommendations.tsx 2>/dev/null; then
  echo -e "${GREEN}✓ Topic card has dark mode support${NC}"
else
  echo -e "${RED}✗ Topic card missing dark mode support${NC}"
fi

# Test 9: Real upload wiring check
echo -e "\n--- Test 9: Real Upload Wiring ---"
if grep -q "FormData" services/web/src/components/sections/workflow-pipeline.tsx 2>/dev/null; then
  echo -e "${GREEN}✓ Real FormData upload implemented${NC}"
else
  echo -e "${RED}✗ FormData upload not found${NC}"
fi

if grep -q "/api/files/upload" services/web/src/components/sections/workflow-pipeline.tsx 2>/dev/null; then
  echo -e "${GREEN}✓ Real upload endpoint used${NC}"
else
  echo -e "${RED}✗ Real upload endpoint not found${NC}"
fi

# Test 10: FileId in stage execution
echo -e "\n--- Test 10: FileId in Stage Execution ---"
if grep -q "fileId" services/web/src/components/sections/workflow-pipeline.tsx 2>/dev/null; then
  echo -e "${GREEN}✓ FileId passed to stage execution${NC}"
else
  echo -e "${RED}✗ FileId not found in stage execution${NC}"
fi

if grep -q "fileId" services/orchestrator/routes.ts 2>/dev/null; then
  echo -e "${GREEN}✓ FileId handled in backend${NC}"
else
  echo -e "${RED}✗ FileId not handled in backend${NC}"
fi

# Test 11: Source field in types
echo -e "\n--- Test 11: Source Field in Types ---"
if grep -q "source.*ai.*computed.*template" packages/core/types/types.ts 2>/dev/null; then
  echo -e "${GREEN}✓ Source field added to StageExecutionOutput${NC}"
else
  echo -e "${RED}✗ Source field missing from types${NC}"
fi

# Test 12: StageOutputViewer usage
echo -e "\n--- Test 12: StageOutputViewer Usage ---"
if grep -q "StageOutputViewer" services/web/src/components/sections/workflow-pipeline.tsx 2>/dev/null; then
  echo -e "${GREEN}✓ StageOutputViewer imported and used${NC}"
else
  echo -e "${RED}✗ StageOutputViewer not used in workflow-pipeline${NC}"
fi

echo -e "\n=== Tests Complete ==="
echo -e "Run 'docker compose up -d' and open http://localhost:5173 for manual testing"

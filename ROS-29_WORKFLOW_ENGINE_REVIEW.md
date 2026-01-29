# ROS-29: Workflow Engine + Variables - Comprehensive Review

**Date:** 2026-01-29
**Task:** Review and fix ROS-29 - Workflow Engine + Variables in ResearchFlow
**Status:** ANALYZED WITH GAPS IDENTIFIED

## Executive Summary

The ResearchFlow workflow engine has a **foundation in place** but is **missing critical components** for complete variable picker functionality and seamless inter-stage data transmission. The system implements:

✅ **Exists:**
- Stage navigation framework (20 stages with status tracking)
- Stage output storage in ExecutionState
- Basic data context passing via stageContext object
- Variable metadata tracking (recordCount, variableCount, columnCount)
- Stage-specific UI components (Stage00 through Stage20)

❌ **Missing/Incomplete:**
- Dedicated variable picker UI component (not reusable across stages)
- Variable schema introspection API endpoint
- Explicit inter-stage variable mapping mechanism
- Variable type validation framework
- Stage-to-stage variable conflict resolution
- Workflow variable namespace management

---

## 1. Web Service Analysis (`services/web/src/`)

### 1.1 Workflow Navigation Components

**File:** `/services/web/src/components/sections/workflow-pipeline.tsx`

**Status:** ✅ PARTIAL - Navigation exists but variable passing is limited

#### Found:
- **WorkflowPipeline component** (1900+ lines)
  - Manages executionState with stage results and outputs
  - Tracks expandedGroups for UI navigation
  - Supports stage selection and expansion

- **Stage Selection Model:**
  ```typescript
  const [selectedStage, setSelectedStage] = useState<WorkflowStage | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["data-preparation"]);
  ```

- **Execution State Storage:**
  ```typescript
  interface ExecutionState {
    [stageId: number]: {
      status: 'pending' | 'running' | 'completed' | 'error';
      result?: {
        outputs?: unknown[];
        metadata?: Record<string, unknown>;
      }
    }
  }
  ```

**Gap:** No explicit variable context or schema tracking between stages.

### 1.2 Variable and Data Context Passing

**File:** `/services/web/src/components/sections/workflow-pipeline.tsx` (lines 2819-2868)

**Status:** ✅ PARTIAL - Basic context building, no schema validation

#### Implemented:
```typescript
const stageContext: Record<string, unknown> = {
  stage: selectedStage.name,
  stageId: selectedStage.id,
  status: getStageStatus(selectedStage),
  executionResult: executionState[selectedStage.id]?.result || null,
  outputs: executionState[selectedStage.id]?.result?.outputs || [],
  description: selectedStage.description,
};

// Stage-specific context:
if (selectedStage.id >= 1 && selectedStage.id <= 3) {
  stageContext.topicContext = overviewByStage[1] || null;
  stageContext.topicVersions = topicVersionHistory;
}

if (selectedStage.id >= 4) {
  stageContext.dataContext = {
    uploadedFile: {
      name, size, recordCount, variableCount, phiScanStatus
    }
  };
}

if (selectedStage.id >= 5 && selectedStage.id <= 11) {
  stageContext.previousStageOutputs = {};
  for (let i = 4; i < selectedStage.id; i++) {
    stageContext.previousStageOutputs[`stage${i}`] = executionState[i].result.outputs;
  }
}
```

**Gaps:**
- No variable schema introspection (e.g., column names, types, transformations)
- previousStageOutputs contains raw outputs but no metadata about variable structure
- No type safety for variable references
- No variable availability checking or validation

### 1.3 Variable Selection UI

**File:** `/services/web/src/components/extraction/ExtractionConfigPanel.tsx`

**Status:** ✅ FOUND - ColumnSelector component implemented

#### Existing Implementation:
```typescript
const ColumnSelector: React.FC<{
  columns: ColumnInfo[];
  selected: string[];
  onChange: (columns: string[]) => void;
}> = ({ columns, selected, onChange }) => {
  // Toggle individual columns
  // Select/deselect all by category
  // Groups narrative vs other columns
}

interface ColumnInfo {
  name: string;
  isNarrative: boolean;
}
```

**Issue:** This is component-specific, not reusable across workflow stages.

### 1.4 Variable Selection in Analysis Components

**File:** `/services/web/src/components/analysis/RealAnalysisPanel.tsx`

**Status:** ✅ FOUND - Variable selection exists for analysis

#### Methods Found:
- `renderVariableSelector()` - Single variable selection
- `renderMultiVariableSelector()` - Multiple variable selection

**Gap:** Tightly coupled to RealAnalysisPanel, not extracted as reusable component.

### 1.5 Workflow Persistence Hook

**File:** `/services/web/src/hooks/use-workflow-persistence.ts`

**Status:** ✅ GOOD - Maintains workflow state including variables

#### Persistent State Structure:
```typescript
interface WorkflowPersistentState {
  expandedGroups: string[];
  executionState: Record<number, { status: string; result?: unknown }>;
  scopeValuesByStage: Record<number, Record<string, string>>;
  topicVersionHistory: TopicVersionHistory;
  isTopicLocked: boolean;
  selectedManuscriptId: number | null;
  selectedJournalId: string | null;
  overviewByStage: Record<number, string>;
  lifecycleState: string;
  lastSavedAt: string;
  researchId: string;
  topicId: string | null;
}
```

**Gap:** `scopeValuesByStage` exists but is not actively used for variable mapping between stages.

---

## 2. Orchestrator Service Analysis (`services/orchestrator/src/`)

### 2.1 Workflow Stage Routes

**File:** `/services/orchestrator/src/routes/workflow-stages.ts`

**Status:** ✅ GOOD - Endpoints exist for stage management

#### Implemented Endpoints:
```typescript
GET    /api/workflow/stages              // Get all workflow stage groups
GET    /api/workflow/stages/:stageId     // Get specific stage
POST   /api/workflow/stages/:stageId/approve-ai
POST   /api/workflow/stages/:stageId/revoke-ai
POST   /api/workflow/stages/:stageId/attest
POST   /api/workflow/stages/:stageId/complete
GET    /api/workflow/lifecycle
POST   /api/workflow/lifecycle/transition
GET    /api/workflow/audit-log
POST   /api/workflow/reset
```

**Critical Gap:** No endpoints for:
- Variable schema retrieval from previous stage
- Variable mapping between stages
- Variable validation
- Schema introspection

### 2.2 Workflows CRUD Routes

**File:** `/services/orchestrator/src/routes/workflows.ts`

**Status:** ✅ PARTIAL - Workflow CRUD exists but no variable management

#### Endpoints:
```typescript
GET    /api/workflows                  // List workflows
POST   /api/workflows                  // Create workflow
GET    /api/workflows/templates        // List templates
GET    /api/workflows/:id              // Get workflow
POST   /api/workflows/:id/versions     // Create version
GET    /api/workflows/:id/versions     // List versions
POST   /api/workflows/:id/publish
POST   /api/workflows/:id/policy       // Get/set policies
```

**Gap:** No endpoints for variable management, schema definition, or inter-stage mapping.

### 2.3 Workflow Service

**File:** `/services/orchestrator/src/services/workflowService.ts`

**Status:** ✅ PARTIAL - Basic CRUD, no variable support

#### Existing:
- Workflow templates with stage definitions (nodes and edges)
- Version control
- Policy management

**Gap:** No service methods for:
- Variable schema management
- Variable extraction from stage outputs
- Variable validation
- Cross-stage variable compatibility checking

---

## 3. Data Models Analysis

### 3.1 Frontend Type System

**File:** `/services/web/src/types/api.ts`

**Status:** ⚠️ INCOMPLETE - Missing variable schema types

#### Currently Defined:
```typescript
interface Dataset {
  recordCount: number;
  // Missing: column/variable metadata
}
```

**Missing Types:**
```typescript
// NOT DEFINED - NEEDS CREATION
interface VariableSchema {
  name: string;
  type: 'numeric' | 'categorical' | 'text' | 'date' | 'boolean';
  nullable: boolean;
  description?: string;
  constraints?: Record<string, unknown>;
}

interface StageOutput {
  variableSchema?: VariableSchema[];
  // Other output properties
}
```

### 3.2 Core Type System

**Location:** `@packages/core/types/`

**Status:** ⚠️ NOT VERIFIED - Need to check for variable schema definitions

---

## 4. Identified Gaps & Missing Features

### Critical Gaps (Must Fix)

#### 4.1 Variable Schema Introspection API
**Severity:** HIGH
**Impact:** Stages cannot discover what variables are available from previous stages

**Current State:** Variables are passed as raw outputs with no metadata
**Needed:**
```typescript
// New endpoint needed
GET /api/workflow/stages/:stageId/schema
Response: {
  variables: [
    { name: 'age', type: 'numeric', min: 18, max: 95 },
    { name: 'diagnosis', type: 'categorical', values: [...] }
  ]
}
```

#### 4.2 Variable Picker Reusable Component
**Severity:** HIGH
**Impact:** Each stage must reimplement variable selection UI

**Current State:** ColumnSelector in ExtractionConfigPanel, renderVariableSelector in RealAnalysisPanel
**Needed:**
```typescript
// New component needed
<VariablePicker
  availableVariables={variables}
  selectedVariables={selected}
  onChange={setSelected}
  multiSelect={true}
  filterType="numeric" // Optional type filter
/>
```

#### 4.3 Inter-Stage Variable Mapping
**Severity:** HIGH
**Impact:** No explicit mapping of variables between stages

**Current State:** previousStageOutputs contains raw data, no validation
**Needed:**
```typescript
// Service method needed
function mapVariablesBetweenStages(
  fromStageId: number,
  toStageId: number,
  variableNames: string[]
): MappingResult
```

#### 4.4 Variable Type Validation Framework
**Severity:** MEDIUM
**Impact:** No runtime validation that stage inputs/outputs have correct variable types

**Current State:** No type checking on variables
**Needed:**
```typescript
interface VariableRequirement {
  name: string;
  type: VariableType;
  optional?: boolean;
}

function validateStageVariables(
  stageId: number,
  variables: unknown[]
): ValidationResult
```

### Important Gaps (Should Fix)

#### 4.5 Variable Conflict Detection
**Severity:** MEDIUM
**Impact:** No detection when stages reference non-existent variables

**Current State:** Silent failures if variable not found
**Needed:** Validation on stage execution

#### 4.6 Workflow Variable Namespace
**Severity:** MEDIUM
**Impact:** Variables could have naming conflicts across stages

**Current State:** Using bare variable names with no scope
**Needed:**
```typescript
// Namespaced approach
stage5.variables.age  // vs just 'age'
stage6.variables.age
```

#### 4.7 Variable Transformation Tracking
**Severity:** LOW-MEDIUM
**Impact:** No record of which transformations were applied to variables

**Current State:** Variables passed but origin/transformation unknown
**Needed:** Metadata tracking for data lineage

---

## 5. What's Working Well

### ✅ Stage Navigation
- 20 stages fully defined with metadata
- Stage status tracking (pending, running, completed, error)
- Lifecycle state management (DRAFT, IN_PROGRESS, REVIEW, COMPLETED)

### ✅ Execution State Management
- Results persisted per stage
- localStorage persistence via useWorkflowPersistence hook
- Debounced auto-save (1 second interval)

### ✅ Context Passing Foundation
- stageContext object built with stage-specific data
- topicContext for hypothesis stages (1-3)
- dataContext for analysis stages (4+)
- previousStageOutputs for stages 5-11

### ✅ UI Components
- WorkflowSidebar with phase progress tracking
- ProgressStepper for stage navigation
- StageOutputViewer for displaying results
- ChatAgentPanel for per-stage assistance

### ✅ Attestation & Governance
- Pre-execution checkpoints
- Audit log tracking
- Governance mode enforcement
- AI approval gates

---

## 6. Recommended Implementation Plan

### Phase 1: Variable Schema Support (Highest Priority)

**Task 1.1: Add VariableSchema Types**
- **Files to create/modify:**
  - `/services/web/src/types/api.ts` - Add VariableSchema interface
  - `@packages/core/types/` - Add schema types to core

**Task 1.2: Create Variable Schema Introspection Endpoint**
- **Endpoint:** `GET /api/workflow/stages/:stageId/schema`
- **Returns:** List of variables with types, constraints, descriptions
- **File:** `/services/orchestrator/src/routes/workflow-stages.ts`

**Task 1.3: Implement Schema Extraction Logic**
- **Service:** New `stageSchemaService.ts`
- **Methods:**
  - `extractVariableSchema(stageOutput: unknown[]): VariableSchema[]`
  - `mergeSchemas(schemas: VariableSchema[][]): VariableSchema[]`

### Phase 2: Reusable Variable Picker Component

**Task 2.1: Extract ColumnSelector**
- **New component:** `/services/web/src/components/ui/variable-picker.tsx`
- **Base on:** ExtractionConfigPanel.ColumnSelector
- **Features:**
  - Single/multi-select modes
  - Type filtering (numeric, categorical, text, etc.)
  - Search/filter by name
  - Organized by type/category

**Task 2.2: Create Variable Picker Hook**
- **Hook:** `/services/web/src/hooks/use-variable-picker.ts`
- **Manages:** Selected variables, available variables, validation state

**Task 2.3: Refactor Stage Components**
- Update Stage07StatisticalModeling to use new VariablePicker
- Update RealAnalysisPanel to use new VariablePicker
- Update ExtractionConfigPanel to use new VariablePicker

### Phase 3: Inter-Stage Variable Mapping

**Task 3.1: Create Variable Mapping Service**
- **Service:** `/services/orchestrator/src/services/variableMapperService.ts`
- **Methods:**
  - `getAvailableVariables(stageId, previousStageId)`
  - `validateVariableMapping(fromVariables, toVariables)`
  - `trackVariableTransformation(stageId, transformation)`

**Task 3.2: Add Mapping Endpoints**
- `GET /api/workflow/stages/:fromStageId/available-variables`
- `POST /api/workflow/stages/:toStageId/validate-mapping`

**Task 3.3: Update Workflow Context**
- Enhance stageContext to include available variables
- Add variable validation to stage execution

### Phase 4: Variable Type Validation

**Task 4.1: Define Variable Requirements**
- Create stage requirements registry
- Define type constraints for each stage

**Task 4.2: Implement Validation Framework**
- Service: `stageValidationService.ts`
- Runtime validation before stage execution

**Task 4.3: Add Validation UI**
- Error display for variable conflicts
- Type mismatch warnings

---

## 7. Files Requiring Changes

### Frontend (`services/web/`)

| File Path | Required Changes | Priority |
|-----------|-----------------|----------|
| `src/types/api.ts` | Add VariableSchema, VariableRequirement types | HIGH |
| `src/components/ui/variable-picker.tsx` | CREATE - Reusable variable selection | HIGH |
| `src/hooks/use-variable-picker.ts` | CREATE - Variable picker state management | HIGH |
| `src/components/sections/workflow-pipeline.tsx` | Update stageContext to include variable schema | HIGH |
| `src/components/stages/Stage07StatisticalModeling.tsx` | Use new VariablePicker component | MEDIUM |
| `src/components/analysis/RealAnalysisPanel.tsx` | Use new VariablePicker component | MEDIUM |
| `src/components/extraction/ExtractionConfigPanel.tsx` | Extract ColumnSelector, use VariablePicker | MEDIUM |
| `src/hooks/use-workflow-persistence.ts` | Track variable schemas in persistent state | LOW |

### Backend (`services/orchestrator/`)

| File Path | Required Changes | Priority |
|-----------|-----------------|----------|
| `src/routes/workflow-stages.ts` | Add variable schema endpoints | HIGH |
| `src/routes/workflows.ts` | Add variable management endpoints | HIGH |
| `src/services/workflowService.ts` | Add variable schema methods | HIGH |
| `src/services/stageSchemaService.ts` | CREATE - Schema extraction and merging | HIGH |
| `src/services/variableMapperService.ts` | CREATE - Variable mapping logic | HIGH |
| `src/services/stageValidationService.ts` | CREATE - Variable type validation | MEDIUM |
| `src/middleware/rbac.ts` | UPDATE - Add variable access permissions if needed | LOW |

### Core Types (`packages/core/`)

| File Path | Required Changes | Priority |
|-----------|-----------------|----------|
| `types/workflow.ts` | Add VariableSchema, VariableRequirement to WorkflowDefinition | HIGH |
| `schema.ts` | ADD - Variable schema and mapping tables if using DB | MEDIUM |

---

## 8. Quick Wins (Simple Fixes Available Now)

### 8.1 Extract Existing ColumnSelector as Reusable Component
**Time:** 30 minutes
**Impact:** Immediate reusability across components
**Action:**
1. Move ColumnSelector from ExtractionConfigPanel to new `variable-picker.tsx`
2. Update imports in ExtractionConfigPanel
3. Import in RealAnalysisPanel

### 8.2 Add Variable Count Metadata to Workflow State
**Time:** 15 minutes
**Impact:** Better visibility into dataset structure
**Action:**
1. Update uploadedFile state to track columnNames: string[]
2. Add this to scopeValuesByStage
3. Pass to stageContext in ChatAgentPanel

### 8.3 Create Variable Schema Types
**Time:** 20 minutes
**Impact:** Foundation for all variable work
**Action:**
1. Add VariableSchema interface to types/api.ts
2. Export from core types
3. Use in stageContext

### 8.4 Add Variable Availability Comment to Stages
**Time:** 10 minutes
**Impact:** Documentation for developers
**Action:**
1. Add JSDoc comments to each stage component indicating which variables from previous stages it expects

---

## 9. Testing Recommendations

### Unit Tests Needed
- Variable schema extraction (stageSchemaService)
- Variable mapping validation (variableMapperService)
- Variable type validation (stageValidationService)

### Integration Tests Needed
- End-to-end variable flow from Stage 4 (data) through Stage 7 (analysis)
- Cross-stage variable references
- Variable type conflicts

### E2E Tests Needed
- Upload dataset → select variables → run analysis with selected variables
- Variable mapping UI workflows

---

## 10. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Pipeline UI                      │
│  (services/web/src/components/sections/workflow-pipeline.tsx)│
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Stage Selection & Execution                         │   │
│  │  - selectedStage: WorkflowStage                       │   │
│  │  - executionState: Record<number, StageExecution>    │   │
│  │  - scopeValuesByStage: Record<number, Variables>    │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Stage Context Builder (lines 2819-2868)             │   │
│  │  - topicContext (stages 1-3)                          │   │
│  │  - dataContext (stages 4+)                           │   │
│  │  - previousStageOutputs (stages 5-11)                │   │
│  │  ❌ MISSING: Variable Schema & Mapping              │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Chat Agent Panel                                     │   │
│  │  - getClientContext() provides stageContext           │   │
│  │  - Passes to AI/analysis agents                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓ (API calls)
┌─────────────────────────────────────────────────────────────┐
│              Orchestrator Routes & Services                  │
│         (services/orchestrator/src/routes/ & services/)      │
│                                                               │
│  ✅ /api/workflow/stages                                    │
│  ✅ /api/workflow/stages/:stageId                           │
│  ✅ /api/workflow/stages/:stageId/complete                  │
│                                                               │
│  ❌ MISSING:                                                │
│  ❌ /api/workflow/stages/:stageId/schema                    │
│  ❌ /api/workflow/variables/available                       │
│  ❌ /api/workflow/variables/validate-mapping                │
│                                                               │
│  Services:                                                    │
│  ✅ workflowService (CRUD)                                  │
│  ✅ lifecycleService (state management)                     │
│  ❌ stageSchemaService (NEEDS CREATION)                     │
│  ❌ variableMapperService (NEEDS CREATION)                  │
│  ❌ stageValidationService (NEEDS CREATION)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Current Implementation Examples

### How Variables Currently Flow (Limited):
```typescript
// Stage 4: Upload data
uploadedFile = {
  name: "dataset.csv",
  recordCount: 250,
  variableCount: 42  // ← Only count, not names or types
}

// Stage 5-11: Access previous outputs
stageContext.dataContext = {
  uploadedFile: { name, size, recordCount, variableCount }
}
stageContext.previousStageOutputs = {
  stage4: [{ /* raw data */ }],  // ← No schema
  stage5: [{ /* raw data */ }]
}

// Problem: Stage 7 (Analysis) doesn't know what variables are available
// or their types to show in the variable selector UI
```

### How It SHOULD Flow:
```typescript
// Stage 4: Upload data
uploadedFile = {
  name: "dataset.csv",
  recordCount: 250,
  variableCount: 42,
  variableSchema: [
    { name: "age", type: "numeric", min: 18, max: 95 },
    { name: "diagnosis", type: "categorical", values: [...] },
    { name: "treatment_date", type: "date" }
  ]
}

// Stage 5-7: Access schema and map variables
const availableVariables = await fetch(
  `/api/workflow/stages/4/schema?stageId=7`
);
// Returns: { variables: [age, diagnosis, treatment_date, ...] }

// Stage 7: Variable selection with proper UI
<VariablePicker
  availableVariables={availableVariables}
  selectedVariables={modelConfig.independentVariables}
  onChange={setIndependentVariables}
  filterType="numeric"  // Only numeric for regression
/>

// Stage 8+: Continue with validated variable references
```

---

## 12. Dependencies & Blockers

### No External Blockers
- All required libraries are already installed (React, TypeScript, Express)
- No database schema changes required (can use in-memory for MVP)

### Internal Dependencies
- Variable schema work depends on having types defined first
- Variable mapping work depends on variable schema work
- Validation framework depends on requirements being finalized

### Recommended Sequence
1. **Day 1:** Add VariableSchema types (30 min)
2. **Day 1:** Create variable-picker component (1.5 hrs)
3. **Day 2:** Implement schema extraction service (2 hrs)
4. **Day 2:** Add introspection endpoints (1.5 hrs)
5. **Day 3:** Integrate with existing stages (2 hrs)
6. **Day 3:** Add validation framework (2 hrs)
7. **Day 4:** Testing & refinement (2 hrs)

---

## 13. Success Criteria

### Phase 1 Complete When:
- [ ] VariableSchema types exist in core and frontend
- [ ] Schema introspection endpoint working
- [ ] Stage components can display available variables from previous stages

### Phase 2 Complete When:
- [ ] VariablePicker component extracted and reusable
- [ ] At least 3 stage components updated to use it
- [ ] Component has search/filter/type-based selection

### Phase 3 Complete When:
- [ ] Variable mapping service handles cross-stage references
- [ ] Validation prevents stage execution with invalid variables
- [ ] Mapping endpoints tested via Postman/API client

### Phase 4 Complete When:
- [ ] Type validation framework prevents type mismatches
- [ ] UI shows helpful errors for variable issues
- [ ] End-to-end test passes: upload → select variables → analyze

---

## Conclusion

ROS-29 has a **strong foundation** for workflow management but needs **focused work** on variable management. The **critical path** is:

1. **Types** (30 min) → 2. **Picker Component** (1.5 hrs) → 3. **Schema Service** (2 hrs) → 4. **Endpoints** (1.5 hrs) → 5. **Integration** (2 hrs)

This is **7.5 hours of development** to get from current state to fully functional variable picker and inter-stage variable mapping.

**Recommended priority:** Start with Phase 1 (types + picker) to unblock frontend UI work, then move to Phase 2 (services) for backend support.

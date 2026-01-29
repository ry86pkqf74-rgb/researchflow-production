# ROS-29: Workflow Engine + Variables - Executive Summary

**Review Date:** 2026-01-29
**Reviewer:** Code Analysis Agent
**Status:** ANALYSIS COMPLETE - GAPS IDENTIFIED & FIXES DOCUMENTED

---

## Overview

ResearchFlow's workflow engine has **solid foundational components** but lacks **critical variable management infrastructure** needed for seamless inter-stage data transmission and dynamic variable selection.

## Current State Assessment

### ✅ What's Working
| Component | Status | Details |
|-----------|--------|---------|
| **Stage Navigation** | ✅ Complete | 20 stages defined, status tracking, navigation UI |
| **Execution State** | ✅ Complete | Results persisted per stage, auto-save to localStorage |
| **Context Passing** | ✅ Partial | topicContext, dataContext, previousStageOutputs implemented |
| **UI Components** | ✅ Complete | StageOutputViewer, WorkflowSidebar, ProgressStepper |
| **Governance** | ✅ Complete | Attestation gates, audit logs, AI approval system |
| **Variable Selection UI** | ✅ Exists (scattered) | ColumnSelector in ExtractionConfigPanel, renderVariableSelector in RealAnalysisPanel |

### ❌ What's Missing
| Component | Gap | Impact |
|-----------|-----|--------|
| **Variable Schema API** | No endpoint to fetch variable definitions | Stages can't discover available variables from previous stages |
| **Reusable Variable Picker** | Implementations scattered across components | Code duplication, maintenance burden |
| **Type System for Variables** | No VariableSchema interface | No type safety for variable references |
| **Inter-Stage Variable Mapping** | No explicit mapping mechanism | Implicit data passing, prone to errors |
| **Variable Validation** | No pre-execution checks | Invalid variable references silently fail |
| **Variable Namespace** | Variables use bare names | Potential naming conflicts |

## Gap Analysis Summary

### Critical Gaps (Must Have)
1. **Variable Schema Introspection** (HIGH) - Stages need to know what variables are available
2. **Reusable Variable Picker Component** (HIGH) - 3+ stage components need this
3. **Type System for Variables** (HIGH) - Foundation for all variable work
4. **Inter-Stage Variable Mapping** (HIGH) - Explicit passing of variables between stages

### Important Gaps (Should Have)
5. **Variable Type Validation** (MEDIUM) - Runtime checks for type compatibility
6. **Variable Conflict Detection** (MEDIUM) - Prevent references to non-existent variables
7. **Variable Transformation Tracking** (MEDIUM) - Data lineage/provenance

### Nice to Have
8. **Variable Namespace Management** (LOW) - Scope variables by stage
9. **Schema Caching** (LOW) - Performance optimization

## Recommended Scope

### Phase 1: Core Variable System (HIGH PRIORITY)
**Effort:** 7.5 hours | **Impact:** Enables variable picker UI + inter-stage data flow

1. **Add VariableSchema Types** (30 min)
   - Frontend: `/services/web/src/types/api.ts`
   - Core: `/packages/core/types/schema.ts`
   - Enables type safety for variables

2. **Extract VariablePicker Component** (1.5 hrs)
   - Create: `/services/web/src/components/ui/variable-picker.tsx`
   - Base on existing ColumnSelector
   - Reusable across all stages

3. **Implement Schema Service** (2 hrs)
   - Create: `/services/orchestrator/src/services/stageSchemaService.ts`
   - Extract variable schemas from stage outputs
   - Merge schemas from multiple sources

4. **Add Schema Endpoints** (1.5 hrs)
   - Route: `/api/workflow/stages/:stageId/schema`
   - Returns: List of available variables with types
   - File: `/services/orchestrator/src/routes/workflow-stages.ts`

5. **Integration & Testing** (2 hrs)
   - Update Stage components to use VariablePicker
   - Test schema retrieval
   - Test variable selection workflow

### Phase 2: Variable Validation (MEDIUM PRIORITY)
**Effort:** 4 hours | **Impact:** Prevents execution errors

1. Create variable mapping service
2. Add validation endpoints
3. UI error display
4. Pre-execution validation hooks

### Phase 3: Advanced Features (LOW PRIORITY)
**Effort:** 3 hours | **Impact:** Better UX and maintainability

1. Variable transformation tracking
2. Schema caching
3. Variable namespace management

---

## Quick Wins (Can Do Today)

Four simple improvements that take <2 hours total:

### 1. Extract ColumnSelector Component (30 min)
**Impact:** Immediate reuse in 3+ stages
- Move from ExtractionConfigPanel to standalone `variable-picker.tsx`
- Update imports

### 2. Add VariableSchema Types (20 min)
**Impact:** Foundation for all variable work
- Add to `types/api.ts`
- No API changes needed

### 3. Export Types from Core (15 min)
**Impact:** Consistency across services
- Create `/packages/core/types/schema.ts`
- One source of truth for types

### 4. Add Documentation (10 min)
**Impact:** Guides developers on variable flow
- JSDoc comments in Stage components
- Explains which variables each stage expects/produces

**Total Time:** 75 minutes
**Recommendation:** Do these today, they unblock larger work

---

## Implementation Timeline

```
Day 1 (2-3 hours):        Day 2 (2-3 hours):       Day 3 (1-2 hours):
├─ Quick Win #1-4         ├─ Schema Service      ├─ Stage Integration
├─ VariablePicker UI      ├─ Endpoints           ├─ Testing
└─ Type System            └─ Validation Logic    └─ Documentation

Total: ~7.5 hours → Phase 1 Complete
```

## File Changes Required

### Frontend (services/web/)
- `src/types/api.ts` - Add VariableSchema types
- `src/components/ui/variable-picker.tsx` - CREATE new component
- `src/hooks/use-variable-picker.ts` - CREATE hook
- `src/components/sections/workflow-pipeline.tsx` - Update stageContext
- Stage components - Use new VariablePicker

### Backend (services/orchestrator/)
- `src/routes/workflow-stages.ts` - Add schema endpoints
- `src/services/stageSchemaService.ts` - CREATE schema service
- `src/services/variableMapperService.ts` - CREATE mapping service
- `src/services/stageValidationService.ts` - CREATE validation service

### Core (packages/core/)
- `types/schema.ts` - CREATE variable type definitions
- `types/index.ts` - Export new types

---

## Success Metrics

### Phase 1 Success:
- [ ] VariablePicker component renders in Stage07
- [ ] Schema endpoint returns variable list for dataset
- [ ] Stage components can display "Available Variables" from previous stage
- [ ] No TypeScript errors in type-check

### Phase 2 Success:
- [ ] Type validation prevents incompatible variables
- [ ] Error messages guide users to valid selections
- [ ] Validation runs before stage execution

### Phase 3 Success:
- [ ] Data lineage visible in audit trail
- [ ] Variables namespaced by stage
- [ ] Schema caching improves performance

---

## Key Findings

### Architecture is Sound
- Workflow execution model is well-designed
- Context passing pattern is sensible
- Governance/attestation layer is comprehensive

### Main Limitation
Variables are treated as **data blobs** rather than **typed entities**. Stage 4 uploads a dataset but:
- ❌ Doesn't extract column/variable metadata
- ❌ Doesn't pass variable information to Stage 5+
- ❌ Stage 7 can't display available variables to user
- ❌ No type validation (user could select wrong variable type)

### Solution is Straightforward
Add a **variable schema layer** that:
- ✅ Extracts variable metadata from datasets
- ✅ Passes schema through stage context
- ✅ Enables UI to show available variables
- ✅ Validates type compatibility

---

## Code References

### Where Data Currently Flows
```
Stage 4 Upload (workflow-pipeline.tsx:2084)
  → uploadedFile state (name, size, recordCount, variableCount)
  → dataContext.uploadedFile (lines 2837-2846)
  → ChatAgentPanel.stageContext (lines 2868)
  → NOT TO STAGE 7 (no schema)
```

### Where Variables Are Selected
```
ExtractionConfigPanel.tsx         → Tightly coupled
RealAnalysisPanel.tsx              → Tightly coupled
Stage07StatisticalModeling.tsx     → Uses Select component directly
```

### Workflow State Management
```
WorkflowPersistentState (use-workflow-persistence.ts)
  ✅ Persists: executionState, scopeValuesByStage
  ❌ Missing: Variable schemas, type definitions
```

---

## Next Actions

### Immediate (Today)
1. ✅ **Complete this analysis** → ROS-29_WORKFLOW_ENGINE_REVIEW.md (DONE)
2. ✅ **Create quick wins guide** → ROS-29_QUICK_FIXES.md (DONE)
3. Choose: Apply quick wins OR plan sprint

### Short Term (This Week)
1. Apply Quick Wins #1-4 (75 minutes)
2. Implement Phase 1 (7.5 hours)
3. Demo with one stage (Stage 7 statistical analysis)
4. Get feedback before Phase 2

### Medium Term (Next Sprint)
1. Implement Phase 2 (validation)
2. Expand to all stages
3. Add Phase 3 features as needed

---

## Risk Assessment

### No Technical Risks
- All needed libraries already available
- No external dependencies
- No database schema changes required for MVP

### Implementation Risks
- **Moderate:** Type system changes could affect many files
- **Low:** Variable picker extraction is isolated
- **Mitigation:** Do quick wins first to validate approach

---

## Questions for Product/Design

1. **Variable Naming:** Should we use `stage5.age` or just `age` for variables?
2. **Type System:** Are 6 types (numeric, categorical, text, date, boolean, unknown) sufficient?
3. **Variable Mapping UI:** Should users explicitly map variables, or auto-detect by name?
4. **Error Handling:** What should happen if stage references non-existent variable?
   - A) Block execution (strict)
   - B) Skip that variable (lenient)
   - C) Show warning but allow (permissive)

---

## Attachments

1. **ROS-29_WORKFLOW_ENGINE_REVIEW.md** - 13 sections covering complete analysis
2. **ROS-29_QUICK_FIXES.md** - Step-by-step implementation for 4 quick wins
3. **This document** - Executive summary

---

## Contact & Questions

For detailed implementation guidance, see: `ROS-29_WORKFLOW_ENGINE_REVIEW.md`
For quick implementation, see: `ROS-29_QUICK_FIXES.md`

Questions about:
- **Architecture:** See section 10 of detailed review
- **Type system:** See section 3 and Quick Win #2
- **Component extraction:** See section 1.3 and Quick Win #1
- **API design:** See section 2.1 and section 6.2 of detailed review
- **Implementation timeline:** See section 12 of detailed review

---

**Status:** ✅ Analysis complete, ready for implementation decisions
**Next Step:** Stakeholder review + implementation planning

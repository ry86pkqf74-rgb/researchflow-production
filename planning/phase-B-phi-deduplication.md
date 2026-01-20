# Phase B: PHI Deduplication (P0)

## Objective
Remove duplicated PHI regex logic. Use `@researchflow/phi-engine` everywhere.

## Current State Analysis

### Duplicate PHI Pattern Locations:
1. **`services/orchestrator/services/phi-scanner.ts`**
   - Already imports `PHI_PATTERNS` from `@researchflow/phi-engine`
   - Good - uses shared patterns

2. **`services/orchestrator/src/services/phi-protection.ts`**
   - Has its **own** `PHI_PATTERNS` object (lines 22-58)
   - Defines: NAME, ZIP_CODE, ADDRESS, DATE_MDY, DATE_DMY, DATE_ISO, PHONE, EMAIL, SSN, MRN, HEALTH_PLAN, ACCOUNT, URL, IP_ADDRESS
   - **DUPLICATE** - needs to use phi-engine

3. **`services/orchestrator/utils/run-manifest.ts`**
   - Likely has basic PHI validation
   - Need to check and consolidate

4. **`services/worker/src/workflow_engine/runner.py`**
   - Has `PHI_PATTERNS` list (lines 19-36)
   - Python duplicate - will be addressed in Phase C (codegen)

## Implementation Plan

### Step 1: Verify/Create phi-engine package
**Path:** `packages/phi-engine/src/`

If not exists, create with:
- `patterns.ts` - canonical pattern definitions
- `scanner.ts` - scanning utilities
- `types.ts` - shared type definitions
- `index.ts` - exports

### Step 2: Refactor phi-protection.ts to use phi-engine
**File:** `services/orchestrator/src/services/phi-protection.ts`

Changes:
- Remove local `PHI_PATTERNS` constant
- Import from `@researchflow/phi-engine`
- Update `scanForPhi()` to use imported patterns
- Convert findings to hash + location format
- Ensure HIGH_CONFIDENCE patterns used for gates

### Step 3: Check and update run-manifest.ts
**File:** `services/orchestrator/utils/run-manifest.ts`

Changes:
- Remove any local PHI patterns
- Import from `@researchflow/phi-engine`
- Use conservative HIGH_CONFIDENCE patterns

### Step 4: Update imports and ensure consistency
- All orchestrator services use `@researchflow/phi-engine`
- Single source of truth for Node patterns
- Python patterns will be generated in Phase C

## Files Modified
1. `packages/phi-engine/src/patterns.ts` (create/update)
2. `packages/phi-engine/src/index.ts` (ensure exports)
3. `services/orchestrator/src/services/phi-protection.ts`
4. `services/orchestrator/utils/run-manifest.ts` (if needed)

## Commit Message
```
refactor(phi): deduplicate orchestrator PHI scanners to phi-engine

- Remove duplicate PHI_PATTERNS from phi-protection.ts
- Import all patterns from @researchflow/phi-engine
- Ensure consistent HIGH_CONFIDENCE pattern set for gates
- Convert all findings to hash + location format
```

## Verification
- [ ] npm test passes
- [ ] Only one PHI_PATTERNS definition in Node codebase
- [ ] phi-scanner.ts uses phi-engine
- [ ] phi-protection.ts uses phi-engine
- [ ] All findings are hash-only (no raw values)

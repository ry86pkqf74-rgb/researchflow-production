# CI/CD Fix Plan - ResearchFlow Production

## Executive Summary

The CI/CD pipeline is failing across 4 job categories:
1. **TypeCheck** - 80+ TypeScript compilation errors
2. **Unit Tests** - 5 test suites failing due to import issues
3. **Governance Tests** - Same import issues as unit tests
4. **Security Audit** - 12 npm vulnerabilities (3 high, 9 moderate)

## Root Cause Analysis

### 1. TypeCheck Failures (Priority: HIGH)

**Issue Categories:**

#### A. Missing PHI Engine Export (Critical)
```
Cannot find package '@researchflow/phi-engine/patterns'
```
- Location: `packages/ai-router/src/phi-gate.service.ts:8`
- Impact: Blocks all tests that import from ai-router

**Fix:** Add subpath export to `packages/phi-engine/package.json`

#### B. CLI Package Missing Dependencies
```
Cannot find module 'ora', 'cli-table3', 'inquirer', 'got', 'conf'
```
- Location: `packages/cli/src/`
- Impact: Type errors in CLI package

**Fix:** Add dev dependencies or exclude CLI from type-check

#### C. Manuscript Engine Type Mismatches
- Missing type exports: `Manuscript`, `ClinicalDataset`, `ExportOptions`, etc.
- PHI type enum mismatch: `"ZIP"` vs `"ZIP_CODE"`, `"DATE"` vs `"DOB"`
- Duplicate exports in types/index.ts

**Fix:** Update type definitions and fix enum values

#### D. Discriminated Union Access Issues
```
Property 'reason' does not exist on type '{ allowed: true; } | { allowed: false; reason: string; }'
```
- Location: `packages/ai-router/src/model-router.service.ts:110`
- Location: `services/orchestrator/llm-router.ts:89`

**Fix:** Add type guard before accessing `reason` property

#### E. Presidio Adapter Async Mismatch
```
Type '(text: string) => Promise<PhiFinding[]>' is not assignable to type '(text: string) => PhiFinding[]'
```

**Fix:** Update base interface to support async or create async variant

### 2. Unit Test Failures (Priority: HIGH)

**5 Failed Test Suites:**
1. `tests/integration/manuscript-engine/compliance-export.test.ts`
2. `tests/integration/manuscript-engine/data-integration.test.ts`
3. `tests/integration/manuscript-engine/writing-tools.test.ts`
4. `tests/integration/manuscript-engine/literature.test.ts`
5. `tests/integration/manuscript-engine/structure.test.ts`

**Root Causes:**
1. Missing `@researchflow/phi-engine/patterns` export (same as TypeCheck)
2. Tests importing from `@jest/globals` instead of `vitest`

**Fix:**
- Add phi-engine patterns export
- Update test imports from `@jest/globals` to `vitest`

### 3. Security Audit Failures (Priority: MEDIUM)

**12 Vulnerabilities:**
- 3 High severity
- 9 Moderate severity

**Key Issues:**
1. `esbuild` - Build tool vulnerability
2. `tar` - Path sanitization vulnerability (GHSA-8qq5-rm4j-mr97)
3. `vite` - Depends on vulnerable esbuild

**Fix:** Run `npm audit fix` or update specific packages

## Implementation Plan

### Phase 1: Critical Path Fixes (Immediate)

#### Step 1.1: Add PHI Engine Patterns Export
```bash
# Edit packages/phi-engine/package.json
```
Add to exports:
```json
"./patterns": {
  "import": "./src/patterns.ts",
  "require": "./dist/patterns.js",
  "types": "./src/patterns.ts"
}
```

#### Step 1.2: Fix Test Imports
Update 5 test files to use vitest instead of @jest/globals:
```typescript
// Before
import { describe, it, expect, beforeAll } from '@jest/globals';

// After
import { describe, it, expect, beforeAll } from 'vitest';
```

#### Step 1.3: Fix Discriminated Union Access
```typescript
// Before
const result = await this.aiGate.checkRequest(request);
if (!result.allowed) {
  throw new Error(result.reason); // Error: reason might not exist
}

// After
const result = await this.aiGate.checkRequest(request);
if (!result.allowed) {
  throw new Error(result.reason); // Now TypeScript knows reason exists
}
```

### Phase 2: Type System Fixes

#### Step 2.1: Fix PHI Type Enums
Update test files using incorrect enum values:
- `"ZIP"` → `"ZIP_CODE"`
- `"DATE"` → `"DOB"`

#### Step 2.2: Add Missing Type Exports
Update `packages/manuscript-engine/src/types/index.ts` to export:
- `Manuscript`
- `ClinicalDataset`
- `ExportOptions`
- `ComplianceCheckResult`
- etc.

#### Step 2.3: Fix Duplicate Exports
Resolve re-export ambiguity in types/index.ts

### Phase 3: Dependency Updates

#### Step 3.1: Security Fixes
```bash
npm audit fix
```

#### Step 3.2: Optional CLI Dependencies
Add to `packages/cli/package.json`:
```json
"devDependencies": {
  "@types/ora": "^3.2.0",
  "@types/inquirer": "^9.0.0",
  "cli-table3": "^0.6.0",
  "got": "^13.0.0",
  "conf": "^12.0.0"
}
```

## Execution Order

1. **Fix PHI Engine Export** (unblocks tests)
2. **Fix Test Imports** (unblocks test suite)
3. **Fix Discriminated Unions** (fixes type errors)
4. **Fix PHI Type Enums** (fixes remaining type errors)
5. **Run npm audit fix** (fixes security)
6. **Verify CI passes**

## Success Criteria

- [ ] `npm run typecheck` passes (or only has pre-existing errors)
- [ ] `npm run test:unit` passes (1088+ tests)
- [ ] `npm run test:rbac` passes
- [ ] `npm run test:phi` passes
- [ ] `npm run test:fail-closed` passes
- [ ] `npm run test:mode-enforcement` passes
- [ ] `npm run test:invariants` passes
- [ ] `npm audit --audit-level=high` returns 0 high vulnerabilities

## Estimated Time

- Phase 1: 30 minutes
- Phase 2: 45 minutes
- Phase 3: 15 minutes
- Testing & Verification: 20 minutes

**Total: ~2 hours**

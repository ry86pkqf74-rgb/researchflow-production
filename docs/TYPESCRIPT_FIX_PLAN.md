# TypeScript Error Fix Plan

## Error Summary (564 total errors)

| Category | Count | Priority | Fix Strategy |
|----------|-------|----------|--------------|
| Missing test globals (expect, it, describe) | 262 | HIGH | Add vitest types to tsconfig |
| Object literal unknown properties | 48+ | MEDIUM | Update type definitions |
| localStorage not found | 17 | LOW | Add DOM lib or mock |
| Missing module declarations (ora, cli-table3, supertest) | 12 | MEDIUM | Add @types packages |
| IMRaDSection export missing | 7 | HIGH | Fix type exports |
| PHI type enum mismatches (ZIP vs ZIP_CODE) | 6 | HIGH | Fix enum values |
| Express Request type mismatch | 7 | MEDIUM | Align express versions |
| Discriminated union access | 6 | HIGH | Already fixed |
| Unknown type property access | 15 | MEDIUM | Add type assertions |

## Fix Implementation Order

### Phase 1: Test Globals (262 errors)
Add vitest types to tsconfig.json compilerOptions.types

### Phase 2: Type Exports (7+ errors)
Fix manuscript-engine type exports for IMRaDSection

### Phase 3: PHI Enums (6 errors)
Update test files using wrong enum values

### Phase 4: Module Declarations (12 errors)
Add missing @types packages or declare modules

### Phase 5: Object Literals (48+ errors)
Update TemplatePlaceholder and other interfaces

### Phase 6: Express Types (7 errors)
Align express type versions across packages

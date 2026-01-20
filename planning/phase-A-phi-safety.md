# Phase A: PHI Safety Fix (P0 - Critical)

## Objective
Ensure **no PHI scanner output contains raw matched text**. Only hashes + locations are allowed.

## Current State Analysis

### Problem Areas Identified:
1. **`services/orchestrator/services/phi-scanner.ts`**
   - Interface `PHIPattern` has `matchedText: string` field
   - Currently sets `matchedText: '[REDACTED]'` but interface still exposes the field
   - Need to replace with `matchHash` (SHA256 first 12 chars) + `matchLength`

2. **`services/orchestrator/src/services/phi-protection.ts`**
   - Interface `PhiIdentifier` has `value: string` - **PHI LEAK RISK**
   - Stores raw matched text in findings
   - Need to replace with hash + length

3. **UI Components** (already safe)
   - `services/web/src/components/phi/PhiGate.tsx` displays type/severity/location/description
   - Does NOT display raw PHI (good)

## Implementation Plan

### Step 1: Update phi-scanner.ts interfaces and implementation
**File:** `services/orchestrator/services/phi-scanner.ts`

Changes:
```typescript
// REMOVE from PHIPattern interface:
matchedText: string;

// ADD to PHIPattern interface:
matchHash: string;      // SHA256(matchedText).slice(0,12)
matchLength: number;    // Original match length
```

Update `scanForPHI()` function:
- Compute hash: `crypto.createHash('sha256').update(match[0]).digest('hex').slice(0,12)`
- Store matchLength: `match[0].length`
- Never store or log raw match

### Step 2: Update phi-protection.ts interfaces and implementation
**File:** `services/orchestrator/src/services/phi-protection.ts`

Changes:
```typescript
// REMOVE from PhiIdentifier interface:
value: string;

// ADD to PhiIdentifier interface:
valueHash: string;      // SHA256(value).slice(0,12)
valueLength: number;    // Original value length
```

Update `scanForPhi()` function:
- Hash immediately, discard raw value
- Update all downstream consumers

### Step 3: Add unit tests for PHI safety
**File:** `tests/unit/services/orchestrator/phi-scanner.test.ts` (new)

Tests:
- Assert no response JSON includes `matchedText`
- Assert no response JSON includes `value`
- Assert `matchHash` and `valueHash` are present and 12 chars
- Assert no raw PHI patterns appear in output

### Step 4: Update any UI components if needed
- Verify PhiGate.tsx doesn't expect `matchedText` or `value`
- Update display format to `[HASH:abcd1234] (pos 120-131)`

## Files Modified
1. `services/orchestrator/services/phi-scanner.ts`
2. `services/orchestrator/src/services/phi-protection.ts`
3. `tests/unit/services/orchestrator/phi-scanner.test.ts` (new)

## Commit Message
```
fix(phi): make PHI scan outputs hash-only and PHI-safe

- Replace matchedText with matchHash + matchLength in PHIPattern
- Replace value with valueHash + valueLength in PhiIdentifier
- Add unit tests asserting no raw PHI in scanner outputs
- SHA256 hash (first 12 chars) used for deduplication without exposure
```

## Verification
- [ ] npm test passes
- [ ] No `matchedText` field in any response
- [ ] No `value` field in PhiIdentifier responses
- [ ] Hashes are 12 hex characters
- [ ] Position info preserved for UI highlighting

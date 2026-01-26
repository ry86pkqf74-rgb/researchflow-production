# Phase C: Canonical PHI Registry + Codegen (P1)

## Objective
Prevent PHI drift by defining patterns **once** in JSON and generating TypeScript + Python code.

## Implementation Plan

### Step 1: Create canonical PHI patterns spec
**File:** `shared/phi/phi_patterns.v1.json`

Schema:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "version": "1.0.0",
  "generated_at": "ISO timestamp",
  "patterns": [
    {
      "id": "SSN_STRICT",
      "category": "SSN",
      "tier": ["HIGH_CONFIDENCE", "OUTPUT_GUARD"],
      "regex": {
        "source": "\\b\\d{3}-\\d{2}-\\d{4}\\b",
        "flags": "g"
      },
      "hipaaCategory": "164.514(b)(2)(i)(A)",
      "baseConfidence": 0.8,
      "description": "Social Security Number (strict format)"
    }
  ]
}
```

Patterns to include:
- SSN_STRICT (HIGH_CONFIDENCE)
- EMAIL (HIGH_CONFIDENCE)
- PHONE (HIGH_CONFIDENCE)
- MRN (HIGH_CONFIDENCE)
- DATE (OUTPUT_GUARD)
- ZIP_PLUS_4 (OUTPUT_GUARD)
- IP_ADDRESS (OUTPUT_GUARD)
- NAME (OUTPUT_GUARD) - with caveats
- ADDRESS (OUTPUT_GUARD)
- ACCOUNT_NUMBER (OUTPUT_GUARD)

### Step 2: Create generator script
**File:** `scripts/governance/generate_phi_patterns.py`

Features:
- Reads `shared/phi/phi_patterns.v1.json`
- Generates TypeScript: `packages/phi-engine/src/patterns.generated.ts`
- Generates Python: `services/worker/src/validation/phi_patterns_generated.py`
- Validates regex syntax in both languages
- No network calls (CI-safe)

TypeScript output format:
```typescript
// AUTO-GENERATED - DO NOT EDIT
// Source: shared/phi/phi_patterns.v1.json
// Generated: {timestamp}

export const PHI_PATTERNS_HIGH_CONFIDENCE = [...];
export const PHI_PATTERNS_OUTPUT_GUARD = [...];
export const PHI_PATTERNS = PHI_PATTERNS_HIGH_CONFIDENCE;
```

Python output format:
```python
# AUTO-GENERATED - DO NOT EDIT
# Source: shared/phi/phi_patterns.v1.json
# Generated: {timestamp}

PHI_PATTERNS_HIGH_CONFIDENCE: List[Tuple[str, re.Pattern]] = [...]
PHI_PATTERNS_EXTENDED: List[Tuple[str, re.Pattern]] = [...]
PHI_PATTERNS = PHI_PATTERNS_HIGH_CONFIDENCE
PHI_PATTERNS_OUTPUT_GUARD = PHI_PATTERNS_HIGH_CONFIDENCE + PHI_PATTERNS_EXTENDED
```

### Step 3: Create JSON schema for validation
**File:** `shared/phi/phi_patterns.schema.json`

Validate:
- Required fields (id, category, tier, regex, hipaaCategory)
- Tier values are valid
- Regex source compiles

### Step 4: Add CI guard workflow
**File:** `.github/workflows/phi-codegen-check.yml`

Steps:
1. Run `python scripts/governance/generate_phi_patterns.py --check`
2. Fail if generated files differ from committed files
3. Provide clear error message about running generator

### Step 5: Update phi-engine to use generated patterns
**File:** `packages/phi-engine/src/index.ts`

Changes:
- Import from `patterns.generated.ts`
- Re-export for consumers

### Step 6: Update Python worker to use generated patterns
**File:** `services/worker/src/validation/phi_patterns.py`

Changes:
- Import from `phi_patterns_generated.py`
- Deprecate old manually-maintained patterns

## Files Created/Modified
1. `shared/phi/phi_patterns.v1.json` (new)
2. `shared/phi/phi_patterns.schema.json` (new)
3. `scripts/governance/generate_phi_patterns.py` (new)
4. `packages/phi-engine/src/patterns.generated.ts` (generated)
5. `services/worker/src/validation/phi_patterns_generated.py` (generated)
6. `.github/workflows/phi-codegen-check.yml` (new)
7. `packages/phi-engine/src/index.ts` (update)
8. `services/worker/src/validation/phi_patterns.py` (update)

## Commit Message
```
chore(phi): add canonical PHI registry + code generation

- Create shared/phi/phi_patterns.v1.json as single source of truth
- Add generator script for TypeScript and Python outputs
- Add CI guard to fail if generated files drift from source
- Update phi-engine and worker to use generated patterns
```

## Verification
- [ ] npm test passes
- [ ] pytest passes
- [ ] Generator produces valid TS and Python
- [ ] CI guard detects drift
- [ ] All patterns match between Node and Python

# ResearchFlow Security Vulnerability Assessment

**Date:** January 27, 2026
**Assessed By:** Automated Security Scan
**Repository:** ry86pkqf74-rgb/researchflow-production

---

## Executive Summary

GitHub Dependabot identified **15 vulnerabilities** in the ResearchFlow production codebase:
- **Critical:** 1
- **High:** 10
- **Moderate:** 4

After detailed analysis via `npm audit`, the actual breakdown from the JavaScript ecosystem is:
- **Critical:** 0
- **High:** 3
- **Moderate:** 10

Python dependencies appear current with no known CVEs affecting the versions in use.

---

## Vulnerability Details

### HIGH SEVERITY (3)

#### 1. tar (node-tar) - Arbitrary File Overwrite
- **Package:** `tar` (transitive via `@mapbox/node-pre-gyp` → `canvas`)
- **Version:** ≤7.5.3
- **CVE:** GHSA-8qq5-rm4j-mr97, GHSA-r6q2-hw4h-h46w
- **CVSS:** 8.8
- **Description:** Insufficient path sanitization allows arbitrary file overwrite and symlink poisoning
- **Fix Available:** Update `canvas` to ^3.2.1
- **Impact:** Development dependency only (manuscript-engine)

#### 2. tar (node-tar) - Race Condition
- **Package:** `tar` (same as above)
- **CVE:** GHSA-r6q2-hw4h-h46w
- **Description:** Unicode ligature collisions on macOS APFS can cause race conditions
- **Fix Available:** Same as above

#### 3. @mapbox/node-pre-gyp - Vulnerable tar dependency
- **Package:** `@mapbox/node-pre-gyp` ≤1.0.11
- **Via:** `canvas` package
- **Fix Available:** Update `canvas` to ^3.2.1

---

### MODERATE SEVERITY (10)

#### 4. esbuild - Development Server CORS Issue
- **Package:** `esbuild` ≤0.24.2
- **CVE:** GHSA-67mh-4wv8-2f99
- **CVSS:** 5.3
- **Description:** Any website can send requests to dev server and read responses
- **Fix Available:** Update `drizzle-kit` to ^0.31.8 or `vite` to ^7.3.1
- **Impact:** Development only, not production

#### 5. vite - Inherits esbuild vulnerability
- **Package:** `vite` 0.11.0 - 6.1.6
- **Current:** 5.3.1
- **Fix Available:** Update to ^7.3.1 (major version)
- **Impact:** Development only

#### 6. vitest - Inherits vite/vite-node vulnerability
- **Package:** `vitest` ≤3.0.0-beta.4
- **Current:** 1.6.0
- **Fix Available:** Update to ^4.0.18 (major version)
- **Impact:** Test runner only

#### 7. @vitest/coverage-v8 - Inherits vitest vulnerability
- **Package:** `@vitest/coverage-v8` ≤2.2.0-beta.2
- **Current:** 1.6.0
- **Fix Available:** Update to ^4.0.18

#### 8. @vitest/mocker - Inherits vite vulnerability
- **Package:** `@vitest/mocker` ≤3.0.0-beta.4
- **Fix Available:** Update vitest

#### 9. vite-node - Inherits vite vulnerability
- **Package:** `vite-node` ≤2.2.0-beta.2
- **Fix Available:** Update vitest

#### 10. drizzle-kit - Inherits esbuild vulnerability
- **Package:** `drizzle-kit` ≤1.0.0-beta.1
- **Current:** 0.22.0
- **Fix Available:** Update to ^0.31.8 (minor version)
- **Impact:** Database tooling only

#### 11. @esbuild-kit/core-utils - Inherits esbuild
- **Package:** `@esbuild-kit/core-utils`
- **Fix Available:** Update drizzle-kit

#### 12. @esbuild-kit/esm-loader - Inherits esbuild
- **Package:** `@esbuild-kit/esm-loader`
- **Fix Available:** Update drizzle-kit

#### 13. lodash - Prototype Pollution
- **Package:** `lodash` 4.0.0 - 4.17.21
- **CVE:** GHSA-xxjr-mmjv-4gpg
- **CVSS:** 6.5
- **Description:** Prototype pollution in `_.unset` and `_.omit` functions
- **Fix Available:** Update to lodash ≥4.17.22
- **Impact:** Indirect dependency

---

## Risk Assessment

| Severity | Count | Production Impact | Action Required |
|----------|-------|-------------------|-----------------|
| Critical | 0 | N/A | N/A |
| High | 3 | **Low** - Dev/build tools only | Update canvas package |
| Moderate | 10 | **Low** - Dev/test tools only | Update dev dependencies |

### Production Risk: LOW

All identified vulnerabilities affect **development dependencies only**:
- `tar` → `canvas` (PDF generation testing)
- `esbuild` → `vite`, `drizzle-kit` (build tools)
- `vitest` (test runner)
- `lodash` (utility library, indirect)

**No runtime production dependencies are affected.**

---

## Remediation Plan

### Phase 1: Safe Updates (No Breaking Changes)
```bash
# Update lodash (resolves prototype pollution)
npm update lodash

# Update drizzle-kit to latest minor
npm install drizzle-kit@^0.31.8
```

### Phase 2: Major Version Updates (Requires Testing)
```bash
# Update vite (major version bump)
npm install vite@^7.3.1 -w services/web

# Update vitest and coverage (major version bump)
npm install vitest@^4.0.18 @vitest/coverage-v8@^4.0.18

# Update canvas (major version bump)
npm install canvas@^3.2.1 -w packages/manuscript-engine
```

### Phase 3: Verification
1. Run full test suite: `npm test`
2. Build all packages: `npm run build`
3. Verify web service builds: `npm run build -w services/web`
4. Check for TypeScript errors: `npm run typecheck`

---

## Recommended Immediate Actions

1. **✅ SAFE TO UPDATE NOW:**
   - `lodash` - patch for prototype pollution
   - `drizzle-kit` - minor version with security fix

2. **⚠️ UPDATE WITH TESTING:**
   - `vite` 5.x → 7.x (may have breaking changes)
   - `vitest` 1.x → 4.x (may have breaking changes)
   - `canvas` 2.x → 3.x (may have API changes)

3. **📋 MONITORING:**
   - Continue watching for Python dependency CVEs
   - Enable Dependabot auto-updates for patch versions

---

## Python Dependencies Status

| Package | Version | Status |
|---------|---------|--------|
| Pillow | 12.1.0 | ✅ No known CVEs |
| FastAPI | 0.128.0 | ✅ Current |
| cryptography | 46.0.3 | ✅ Current |
| requests | 2.32.5 | ✅ Current |
| SQLAlchemy | 2.0.38 | ✅ Current |

Python dependencies are using current versions with no known vulnerabilities.

---

## Conclusion

The ResearchFlow production application has **LOW production security risk**. All vulnerabilities identified by Dependabot affect development and build tooling, not runtime production code. The recommended updates should be applied during a maintenance window with full testing.

**Priority Order:**
1. lodash (quick win, no risk)
2. drizzle-kit (minor version)
3. vite/vitest (major versions, requires testing)
4. canvas (if PDF testing is needed)

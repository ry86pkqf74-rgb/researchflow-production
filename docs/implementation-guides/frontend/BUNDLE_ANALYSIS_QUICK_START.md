# Bundle Analysis Quick Start Guide

Quick reference for analyzing and optimizing bundle sizes.

## TL;DR - Common Tasks

### View Bundle Size Breakdown
```bash
npm run build:analyze
# Opens dist/stats.html in browser automatically
# Shows interactive visualization of all chunks
```

### Check Current Build Size
```bash
npm run build
# Watch console output for chunk sizes and gzip warnings
```

### Understand the Output

When you run `npm run build`, the output shows:

```
dist/js/vendor-react-abc123.js    152.45 kb │ gzip:  42.53 kb
dist/js/vendor-ui-def456.js       98.32 kb  │ gzip:  28.17 kb
dist/js/vendor-query-ghi789.js    45.28 kb  │ gzip:  11.29 kb
dist/js/main-jkl012.js            156.89 kb │ gzip:  38.41 kb
dist/js/pages-dashboard-mno345.js 78.45 kb  │ gzip:  19.23 kb
dist/assets/images/...             64.32 kb │ gzip:   0.00 kb (binary)
dist/assets/style.css              32.15 kb │ gzip:   5.42 kb
```

**Read as:**
- Left column: Raw file size
- Right column (gzip): Compressed size for transfer
- **Focus on gzip sizes** - that's what users download

### Typical Sizes Reference

| Metric | Good | Fair | Large |
|--------|------|------|-------|
| Main bundle | <150 KB | 150-200 KB | >200 KB |
| Vendor chunks | <100 KB each | 100-150 KB | >150 KB |
| Total initial | <500 KB | 500-800 KB | >800 KB |
| Largest chunk | <300 KB | 300-500 KB | >500 KB |

## Interactive Bundle Analyzer

### Running the Analyzer

```bash
npm run build:analyze
```

This will:
1. Run production build with all optimizations
2. Generate `dist/stats.html`
3. Automatically open visualization in browser

### Reading the Visualization

The HTML shows an interactive treemap:
- **Box size** = actual file size
- **Color intensity** = module depth/dependencies
- **Hover** = detailed size breakdown
- **Click** = expand/collapse sections

### What to Look For

1. **Duplicate Modules**
   - Same library appearing in multiple chunks
   - Red flag: May indicate misconfigured splitting

2. **Unused Code**
   - Libraries larger than expected
   - Check if all exports are actually imported

3. **Heavy Dependencies**
   - Large single modules eating space
   - Consider lazy loading or alternatives

## Common Issues & Solutions

### Issue: Bundle Too Large (>1.2 MB gzipped)

**Step 1: Identify the culprit**
```bash
npm run build:analyze
# Look for the largest modules
```

**Step 2: Check what you're importing**
```typescript
// ❌ Avoid - imports entire library
import _ from 'lodash';

// ✅ Better - import specific functions
import { debounce } from 'lodash-es';

// ✅ Best - use native/lighter alternatives
const debounce = (fn, wait) => { /* ... */ };
```

**Step 3: Lazy load heavy features**
```typescript
// ❌ Adds to main bundle
import Dashboard from './pages/Dashboard';

// ✅ Loads on demand (separate chunk)
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

### Issue: Chunk Size Warning

```
⚠️  chunk dist/js/vendor-ui-abc123.js (248.45 kb)
    exceeds recommended size of 500 KB
```

**This is normal** for vendor chunks. But if you see warnings:
1. Run `npm run build:analyze` to investigate
2. Look for unexpected large modules
3. Check for duplicate dependencies

### Issue: Slow Build Times

```bash
# Use dev mode for iteration (no compression)
npm run dev

# Only use build when needed
npm run build

# If build is actually slow, check what's slow:
npm run build -- --profile
# Creates build timing report
```

## Quick Wins for Optimization

### 1. Remove Unused Dependencies
```bash
# Check for unused packages
npm ls --depth=0

# Remove if not used
npm uninstall unused-package
```

### 2. Fix Duplicate Dependencies
If you see same package in multiple chunks:
```bash
# Update lockfile
npm ci

# Check if versions can be unified
npm ls lodash
```

### 3. Use ES Modules Only
```typescript
// ❌ Prevents tree shaking
import * as utils from 'lib';

// ✅ Allows tree shaking
import { specificFunction } from 'lib';
```

### 4. Lazy Load Routes
```typescript
// ❌ All pages in main bundle
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';

// ✅ Each page in separate chunk
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Reports = lazy(() => import('./pages/Reports'));
```

## Build Optimization Checklist

Before deployment:

- [ ] Run `npm run build` without errors
- [ ] Check total gzipped size < 1.2 MB
- [ ] No chunk size warnings
- [ ] Run `npm run build:analyze` to verify split
- [ ] Vendor chunks cached properly
- [ ] No duplicate modules in stats.html
- [ ] CSS bundle reasonable size (< 30 KB gzipped)

## Monitoring After Deployment

### Track These Metrics

1. **Initial Load Time**
   ```
   Ideal: < 2 seconds on 4G
   Target: < 3 seconds on 4G
   Alert: > 4 seconds
   ```

2. **First Contentful Paint (FCP)**
   ```
   Ideal: < 1.0 second
   Target: < 1.8 seconds
   Alert: > 3.0 seconds
   ```

3. **Cache Hit Rate**
   ```
   Vendor chunks should hit cache > 90% of time
   Main chunk: 10-30% (updates frequently)
   ```

## Useful Commands

```bash
# Development
npm run dev                    # Run dev server (no optimization)

# Production
npm run build                  # Build with optimizations
npm run build:analyze          # Build and open size analyzer

# Testing
npm run preview                # Serve built bundle locally
npm run lint                   # Check code quality

# Advanced
npm run build -- --verbose     # Detailed build output
npm run build -- --profile     # Build timing analysis
```

## Performance Tips

### For Users (Load Time)
1. Vendor chunks cached = faster repeat visits
2. Code splitting = faster initial paint
3. Compression = faster transfer

### For Developers (Build Time)
1. Use `npm run dev` while developing
2. Use `npm run build` only before deploy
3. Compression plugins only in production

### For DevOps (Deployment)
1. All `dist/` files should be served
2. Set long cache headers for `-[hash].js` files
3. Set short cache for `index.html`
4. Enable gzip at server level
5. Consider Brotli for newer browsers

## Next Steps

- Read full guide: See [BUILD_OPTIMIZATION.md](./BUILD_OPTIMIZATION.md)
- Check current sizes: `npm run build:analyze`
- Identify optimization targets specific to your app
- Plan lazy loading for heavy features

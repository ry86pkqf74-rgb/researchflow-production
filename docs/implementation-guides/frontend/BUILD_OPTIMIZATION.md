# Frontend Build Optimization Guide

This document outlines the production build optimizations implemented for the ResearchFlow web application.

## Overview

The Vite configuration has been enhanced with comprehensive production optimization strategies to reduce bundle size, improve caching, and optimize runtime performance.

## Optimization Features

### 1. Code Splitting Strategy

The build process automatically splits code into logical chunks for better caching and parallel loading:

**Vendor Chunks:**
- **vendor-react**: React core, React DOM, and routing libraries
  - Size target: ~150-180 KB (gzipped)
  - Cache: Long-term (changes only with React upgrades)

- **vendor-ui**: Radix UI component library
  - Size target: ~80-120 KB (gzipped)
  - Cache: Long-term (stable component APIs)

- **vendor-query**: TanStack Query for data fetching
  - Size target: ~30-50 KB (gzipped)
  - Cache: Long-term (changes only with major library updates)

- **vendor-editor**: TipTap editor and ProseMirror
  - Size target: ~60-100 KB (gzipped)
  - Cache: Medium-term (editor plugins may change)

- **vendor-charts**: Recharts and D3 dependencies
  - Size target: ~100-150 KB (gzipped)
  - Cache: Long-term (analytics components stable)

- **vendor-date**: Date utilities (date-fns, react-day-picker)
  - Size target: ~30-50 KB (gzipped)
  - Cache: Long-term (minimal changes)

- **vendor-collab**: Yjs and collaborative editing libraries
  - Size target: ~40-60 KB (gzipped)
  - Cache: Medium-term (CRDTs may evolve)

- **vendor-flow**: ReactFlow visualization
  - Size target: ~50-80 KB (gzipped)
  - Cache: Medium-term

- **vendor-forms**: Form handling and validation
  - Size target: ~40-60 KB (gzipped)
  - Cache: Long-term (stable libraries)

- **vendor-anim**: Animation and utility libraries
  - Size target: ~30-50 KB (gzipped)
  - Cache: Long-term (foundational utilities)

**Application Chunks:**
- **main**: Application entry point and page routing
- **Dynamic route chunks**: Feature-specific routes loaded on demand

### 2. Asset Organization

Assets are organized by type for optimal delivery:
```
dist/
├── js/
│   ├── main-[hash].js
│   ├── vendor-react-[hash].js
│   ├── vendor-ui-[hash].js
│   └── [name]-[hash].js
├── assets/
│   ├── images/
│   ├── fonts/
│   └── [other]/
└── stats.html (bundle analysis)
```

### 3. Gzip Compression

All files larger than 10KB are automatically compressed with gzip during build:
- Enabled only in production builds
- Creates `.gz` versions alongside original files
- Original files retained for CDN fallback
- Typical compression: 60-75% size reduction

### 4. Bundle Analysis

Tree shaking and dead code elimination are enabled by default. Check bundle composition:

```bash
npm run build:analyze
```

This generates a `dist/stats.html` file with an interactive visualization showing:
- Bundle composition by module
- Module sizes (raw and gzipped)
- Duplicate dependencies
- Optimization opportunities

## Build Commands

### Standard Production Build
```bash
npm run build
```

Outputs optimized bundles to `dist/` directory with:
- Code minification (esbuild)
- Tree shaking enabled
- Gzip compression applied
- Chunking as per strategy above
- Source maps disabled (security)

### Build with Bundle Analysis
```bash
npm run build:analyze
```

Same as `npm run build` but:
- Generates interactive bundle analysis HTML report
- Automatically opens stats visualization
- Useful for identifying optimization opportunities
- Reports both raw and gzipped sizes

### Development Server
```bash
npm run dev
```

Runs unminified dev server with:
- Hot module reloading
- Full source maps
- Fast builds for iteration
- API proxy to backend

### Build Preview
```bash
npm run preview
```

Serves the built production bundle locally for testing

## Expected Bundle Sizes

Target sizes (gzipped) for different scenarios:

### Minimal Bundle (pages only, no features)
- Main: 80-100 KB
- Vendor-react: 150 KB
- Vendor-ui: 100 KB
- **Total: 330-350 KB**

### With Dashboard Features
- Main: 120-150 KB
- Charts vendors: 120 KB
- Query vendor: 40 KB
- Other vendors: 300 KB
- **Total: 580-610 KB**

### Full Application Load
- All vendors: 850-950 KB
- Main + all features: 200-250 KB
- **Total: 1.0-1.2 MB**

## Optimization Targets

### Current Focus Areas

1. **Radix UI Optimization**
   - Currently using full component library
   - Potential: Tree-shake unused components (-10-15 KB possible)
   - Action: Audit imports and remove unused components

2. **ProseMirror Bundle**
   - Editor now isolated in vendor-editor chunk
   - Potential: Lazy load editor on demand (-60 KB initial)
   - Action: Implement dynamic import for editor features

3. **Recharts Bundle**
   - Large charting library (100+ KB gzipped)
   - Potential: Use lighter alternative or lazy load (-40 KB possible)
   - Action: Evaluate alternatives for non-critical charts

4. **Yjs Collaborative Features**
   - Now isolated in vendor-collab chunk
   - Potential: Lazy load only when collaboration needed (-40 KB)
   - Action: Implement feature flag for collab loading

### Secondary Opportunities

5. **Locale Data Optimization**
   - i18next may load all locales
   - Potential: Load only active locale dynamically (-20-30 KB)

6. **Form Validation**
   - Zod library duplicated in multiple chunks
   - Potential: Consolidate validation logic (-10 KB)

## Tree Shaking Verification

To verify tree shaking is working properly:

```bash
# Build and analyze
npm run build:analyze

# Look for:
# 1. No duplicate modules across chunks
# 2. Unused code sections marked as deduped
# 3. Minimal "unreferenced" code
```

**Expected Results:**
- Vendor chunks: 0% unused
- Feature chunks: 0-5% unused
- Main chunk: 2-5% unused

## CSS Optimization

CSS is automatically optimized:
- Tailwind CSS purges unused styles in production
- Inline critical CSS enabled by default
- CSS-in-JS (Tailwind, CVA) handled by esbuild
- Bundle: ~15-25 KB gzipped

## Performance Monitoring

After deployment, monitor:

1. **Initial Load Time** (target: <3s on 4G)
   - Measure Time to Interactive (TTI)
   - Track First Contentful Paint (FCP)

2. **Bundle Size Metrics**
   - Main bundle: <200 KB gzipped
   - Largest chunk: <300 KB gzipped
   - Total initial: <500 KB gzipped

3. **Cache Effectiveness**
   - Vendor chunks should hit browser cache
   - Main chunk should update frequently
   - Feature chunks should cache between visits

## Advanced Configuration

### Adjusting Chunk Thresholds

Edit `vite.config.ts` to change chunk splitting behavior:

```typescript
// In rollupOptions.output.manualChunks
if (id.includes('your-library')) {
  return 'chunk-name'; // Creates chunk-name-[hash].js
}
```

### Adjusting Compression Settings

Edit `vite.config.ts` to modify compression:

```typescript
compressionPlugin({
  threshold: 10240, // Only compress files > 10KB (default)
  algorithm: 'gzip', // or 'brotli'
  ext: '.gz' // or '.br' for brotli
})
```

### Dynamic Import Optimization

For lazy-loaded routes, ensure proper splitting:

```typescript
// Good - creates separate chunk
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Avoid - may bundle with main
import Dashboard from './pages/Dashboard';
```

## Troubleshooting

### Bundle Size Increased After Changes

1. Run `npm run build:analyze` to see what changed
2. Check for unintended library imports
3. Verify tree shaking is working (no duplicates)
4. Use `--analyze` flag to get size breakdown

### Slow Build Times

1. Check if compression plugin is enabled in dev
2. Use `npm run dev` for development (no compression)
3. Reserve `npm run build` for production builds

### Chunks Not Splitting As Expected

1. Verify chunk names in `dist/js/` directory
2. Check manual chunk configuration matches library paths
3. Run with verbose flag: `npm run build -- --verbose`

## Future Improvements

1. **Module Federation** - Share code between services
2. **Partial Hydration** - Only hydrate interactive components
3. **Service Worker** - Cache strategy for offline support
4. **HTTP/2 Server Push** - Pre-push critical assets
5. **Image Optimization** - Automatic AVIF/WebP conversion

## Resources

- [Vite Build Optimization](https://vitejs.dev/guide/build.html)
- [Rollup Code Splitting](https://rollupjs.org/guide/en/#outputmanualchunks)
- [Web Vitals](https://web.dev/vitals/)
- [Bundle Analysis Best Practices](https://web.dev/bundling-and-serving-js/)

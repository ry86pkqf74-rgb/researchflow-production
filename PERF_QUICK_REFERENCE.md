# Performance Optimization Quick Reference

## File Locations & Sizes

```
services/orchestrator/src/
├── middleware/cache.ts                    (408 lines, 11KB)
└── config/cache.config.ts                 (377 lines, 8.8KB)

services/web/
├── vite.config.ts                         (ENHANCED)
└── src/lib/image-optimization.ts          (517 lines, 14KB)
```

## Quick Integration Guide

### 1. Backend Cache Setup (5 minutes)

**File**: `services/orchestrator/src/index.ts`

```typescript
import { createCacheMiddleware } from './middleware/cache';
import cacheConfig from './config/cache.config';

// ... existing code ...

// Initialize cache middleware (MUST be before routes)
const cacheMiddleware = createCacheMiddleware({
  backend: cacheConfig.backend,
  redisUrl: cacheConfig.redisUrl,
  enabled: cacheConfig.enabled,
});

app.use(cacheMiddleware.middleware());

// Optional: Add admin cache management endpoint
app.post('/api/admin/cache/invalidate', requireAdminAuth, 
  cacheMiddleware.createInvalidationMiddleware());

// Optional: Health check
app.get('/api/health/cache', async (req, res) => {
  const stats = await cacheMiddleware.getStats();
  res.json(stats);
});
```

### 2. Frontend Build Optimization (Already Done)

**Status**: ✅ vite.config.ts has been enhanced with:
- Brotli + Gzip compression
- 11-chunk vendor splitting
- Advanced minification
- Bundle analyzer

**To verify**:
```bash
cd services/web
ANALYZE=true npm run build
# Opens dist/stats.html with bundle analysis
```

### 3. Frontend Image Optimization (5 minutes)

**File**: Any component using images

```typescript
// Simple lazy loading
import { LazyImage } from '@/lib/image-optimization';

<LazyImage src="/images/my-image.jpg" alt="Description" />

// Responsive with WebP
import { generateResponsiveImage, LazyImage } from '@/lib/image-optimization';

const imageData = generateResponsiveImage('/images/photo', 'Photo');
<LazyImage {...imageData} />

// Progressive with placeholders
import { ProgressiveImage } from '@/lib/image-optimization';

<ProgressiveImage 
  src="/images/header.jpg"
  alt="Header"
  aspectRatio={16/9}
/>
```

## Cache Configuration Examples

### Adjust TTL for Specific Route

**File**: `services/orchestrator/src/config/cache.config.ts`

```typescript
// Find ROUTE_CACHE_CONFIG object and modify:
'/api/custom-endpoint': {
  ttl: 600,                    // 10 minutes
  enabled: true,
  bypassForAuth: false,
  description: 'Custom endpoint cache',
}
```

### Enable/Disable Caching Globally

```bash
# In .env
CACHE_ENABLED=true           # Set to false to disable all caching
CACHE_BACKEND=redis          # or 'memory' for fallback
REDIS_URL=redis://localhost:6379
```

### Use Memory Cache Instead of Redis

```typescript
// In initialization code
const cache = createCacheMiddleware({
  backend: 'memory',  // Fallback for testing
  enabled: true,
});
```

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Cache Hit Rate | 60-80% | TBD |
| API Response Time | -30-50% | TBD |
| Bundle Size (gzip) | <200KB | TBD |
| Image Load Time | -40-50% | TBD |
| Lazy Load Rate | >80% | TBD |

## Monitoring Commands

### Check Cache Health
```bash
curl http://localhost:3001/api/health/cache
```

### Test Cache Hit/Miss
```bash
# First request (MISS)
curl -v http://localhost:3001/api/manuscript 2>&1 | grep X-Cache

# Second request (HIT)
curl -v http://localhost:3001/api/manuscript 2>&1 | grep X-Cache
```

### Invalidate Specific Cache
```bash
curl -X POST http://localhost:3001/api/admin/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"pattern": "/api/manuscript"}'
```

### Analyze Bundle Size
```bash
cd services/web
ANALYZE=true npm run build
# View: open dist/stats.html
```

### Check Image Optimization Metrics
```tsx
// In browser console
import { imageMetrics } from '@/lib/image-optimization';
console.log(imageMetrics.getMetrics());
```

## Common Issues & Solutions

### Cache Not Working
1. Check Redis connection: `redis-cli ping`
2. Verify CACHE_ENABLED=true in .env
3. Confirm CACHE_BACKEND setting
4. Check route is GET/HEAD (only cacheable methods)

### Bundle Still Large
1. Run `ANALYZE=true npm run build`
2. Check vendor-common chunk (may need splitting)
3. Verify tree-shaking working
4. Check for unused dependencies

### Images Not Lazy Loading
1. Verify browser supports Intersection Observer
2. Check LazyImage component rendering
3. Inspect Network tab for data-src attribute
4. Confirm images not in viewport on initial load

## Environment Variables Reference

### Cache Options
```env
# Backend
CACHE_BACKEND=redis              # redis | memory
REDIS_URL=redis://localhost:6379

# Control
CACHE_ENABLED=true
CACHE_KEY_PREFIX=rf:cache:
CACHE_MAX_ENTRIES=10000

# Features
CACHE_WARMING_ENABLED=false
CACHE_COMPRESSION_ENABLED=false
CACHE_STALE_WHILE_REVALIDATE=true
CACHE_STATS_ENABLED=true
```

### Build Options
```env
NODE_ENV=production
ANALYZE=false                    # Set true for bundle analysis
VITE_COMPRESS_GZIP=true
VITE_COMPRESS_BROTLI=true
```

## File Dependencies

```
cache.ts
├── Requires: ioredis (npm dependency)
└── Exports: CacheMiddleware, createCacheMiddleware, TaggedCache

cache.config.ts
├── Requires: ./env (existing config helper)
└── Exports: cacheConfig, CACHE_TTL, ROUTE_CACHE_CONFIG

vite.config.ts
├── Requires: vite-plugin-compression (optional)
├── Requires: rollup-plugin-visualizer (optional)
└── Exports: Vite configuration

image-optimization.ts
├── Requires: React (for components)
└── Exports: LazyImage, ProgressiveImage, generateResponsiveImage, etc.
```

## Testing Checklist

- [ ] Cache middleware initializes without errors
- [ ] Redis connection successful
- [ ] GET requests return X-Cache: HIT on second request
- [ ] POST requests not cached
- [ ] Cache invalidation endpoint works
- [ ] Images lazy load on scroll
- [ ] WebP format detected correctly
- [ ] Bundle analysis accessible
- [ ] Compression enabled (gzip + brotli)
- [ ] Vendor chunks properly split
- [ ] No console errors in production build

## Performance Gains Expected

After implementing all three optimizations:

1. **API Performance**: 30-50% faster response times
2. **Bundle Size**: 40-50% reduction (gzipped)
3. **Image Loading**: 60-70% fewer network requests
4. **Initial Page Load**: 2-3 seconds faster
5. **Cache Hit Rate**: 60-80% of requests served from cache

## Next Steps

1. Integrate cache middleware in index.ts
2. Deploy to staging environment
3. Monitor cache hit rates
4. Adjust TTL values based on metrics
5. Run bundle analysis and optimize further
6. Roll out image optimization to key pages
7. Monitor Core Web Vitals improvements

## Support

- Cache documentation: See cache.config.ts comments
- Image optimization examples: See image-optimization.ts JSDoc
- Bundle analysis: ANALYZE=true npm run build

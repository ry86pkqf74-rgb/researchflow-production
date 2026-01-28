# ResearchFlow Frontend Deployment Guide

This guide covers frontend build optimization, deployment configuration, and performance best practices.

## Architecture Overview

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 18 | UI Components |
| Build Tool | Vite | Fast development & optimized builds |
| Styling | Tailwind CSS | Utility-first CSS |
| State | TanStack Query | Server state management |
| Router | React Router v6 | Client-side routing |
| Rich Text | TipTap | Collaborative editing |
| Charts | Recharts | Data visualization |
| Server | Nginx | Static file serving & proxy |

---

## Build Optimizations

### 1. Code Splitting Strategy

The Vite config implements automatic code splitting:

```typescript
// Vendor chunks for optimal caching
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-ui': ['@radix-ui/*'],
  'vendor-query': ['@tanstack/react-query'],
  'vendor-editor': ['@tiptap/*', 'prosemirror-*'],
  'vendor-charts': ['recharts', 'd3'],
  'vendor-date': ['date-fns', 'react-day-picker']
}
```

**Benefits:**
- React core updates rarely → cached for months
- UI components separated from app logic
- Heavy dependencies isolated

### 2. Build Configuration

```typescript
// vite.config.ts
build: {
  target: 'es2020',           // Modern browsers only
  sourcemap: false,           // Disabled in production
  minify: 'esbuild',          // Fastest minification
  chunkSizeWarningLimit: 500  // Alert if chunks > 500KB
}
```

### 3. Tree Shaking

Ensure optimal tree shaking:

```typescript
// ✅ Good - named imports
import { Button } from '@/components/ui';

// ❌ Bad - barrel imports can prevent tree shaking
import * as UI from '@/components/ui';
```

---

## Environment Variables

### Required Variables

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:1234
VITE_COLLAB_URL=ws://localhost:1234

# Feature Flags
VITE_APP_MODE=production
NEXT_PUBLIC_ENABLE_CHAT_AGENTS=true

# Optional
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_ENABLE_ANALYTICS=true
```

### Build-time vs Runtime

- `VITE_*` variables are embedded at build time
- Cannot change after build without rebuilding
- Use Docker build args:

```dockerfile
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build
```

---

## Nginx Configuration

### Security Headers

```nginx
# Prevents clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# Prevents MIME type sniffing
add_header X-Content-Type-Options "nosniff" always;

# XSS protection (legacy browsers)
add_header X-XSS-Protection "1; mode=block" always;

# Referrer policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Caching Strategy

```nginx
# Static assets - cache for 1 year (fingerprinted)
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML files - never cache
location ~* \.html$ {
    expires -1;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
}
```

### Compression

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript;
```

---

## Performance Optimization

### 1. Lazy Loading Routes

```typescript
// ✅ Lazy load routes
const Dashboard = lazy(() => import('./pages/Dashboard'));
const IRBForm = lazy(() => import('./features/irb/pages/EnhancedIRBForm'));

<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/irb" element={<IRBForm />} />
  </Routes>
</Suspense>
```

### 2. Image Optimization

```typescript
// Use responsive images
<img
  srcSet="image-320.webp 320w, image-640.webp 640w"
  sizes="(max-width: 600px) 320px, 640px"
  loading="lazy"
  alt="Description"
/>
```

### 3. React Query Caching

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      cacheTime: 30 * 60 * 1000,    // 30 minutes
      refetchOnWindowFocus: false,
    }
  }
});
```

### 4. Memo & Callbacks

```typescript
// Memoize expensive components
const Chart = memo(({ data }) => { /* ... */ });

// Stable callback references
const handleClick = useCallback(() => { /* ... */ }, [deps]);
```

---

## Bundle Analysis

### Analyze Bundle Size

```bash
# Generate bundle stats
npm run build -- --stats

# View with rollup-plugin-visualizer
npm run build:analyze
```

### Target Bundle Sizes

| Chunk | Target | Max |
|-------|--------|-----|
| vendor-react | < 150KB | 200KB |
| vendor-ui | < 100KB | 150KB |
| vendor-editor | < 200KB | 300KB |
| vendor-charts | < 150KB | 250KB |
| Main app | < 200KB | 300KB |

---

## Deployment Checklist

### Pre-Build

- [ ] All VITE_* environment variables set
- [ ] Feature flags configured
- [ ] Analytics/Sentry DSN configured (if applicable)

### Build

- [ ] `npm run build` completes without errors
- [ ] No chunk size warnings
- [ ] All assets generated in `dist/`

### Deploy

- [ ] Nginx config updated
- [ ] SSL certificates valid
- [ ] CDN cache invalidated (if using CDN)

### Post-Deploy

- [ ] Health check passes (`/health`)
- [ ] SPA routing works (refresh on any page)
- [ ] API proxy working (`/api/*`)
- [ ] WebSocket connections established
- [ ] No console errors in production

---

## CDN Configuration (Optional)

For production with high traffic, consider a CDN:

### CloudFlare

```
Rules:
- Cache static assets: *.js, *.css, *.png → 1 year
- Don't cache HTML → bypass cache
- Enable Brotli compression
```

### AWS CloudFront

```yaml
CacheBehaviors:
  - PathPattern: /assets/*
    TTL: 31536000  # 1 year
    Compress: true
  - PathPattern: /*
    TTL: 0
    Compress: true
```

---

## Monitoring

### Web Vitals

Monitor Core Web Vitals:
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

```typescript
import { getCLS, getFID, getLCP } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getLCP(console.log);
```

### Error Tracking (Sentry)

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,  // 10% of transactions
});
```

---

## Troubleshooting

### Common Issues

**1. Blank page after deploy**
- Check browser console for 404 errors
- Verify Nginx SPA fallback: `try_files $uri /index.html`

**2. API requests failing**
- Verify proxy configuration in nginx.conf
- Check `VITE_API_BASE_URL` at build time

**3. WebSocket connection failed**
- Verify `VITE_COLLAB_URL` is correct
- Check WebSocket proxy headers in nginx

**4. Large bundle size**
- Run bundle analyzer
- Check for duplicate dependencies
- Verify tree shaking working

**5. Slow initial load**
- Enable gzip/brotli compression
- Implement code splitting
- Use CDN for static assets

---

## Quick Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Analyze bundle
npm run build -- --analyze

# Type check
npm run typecheck

# Lint
npm run lint
```

---

*Last updated: January 2026*

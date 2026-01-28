# Vercel Deployment Guide

This guide explains how to deploy the ResearchFlow frontend to Vercel.

## Overview

ResearchFlow uses a monorepo structure with multiple services. This deployment configuration focuses on deploying only the frontend web application (`services/web`) to Vercel, while backend services (orchestrator, worker) should be deployed separately (e.g., to a container platform like Railway, Render, or AWS).

## Prerequisites

1. A Vercel account (free tier works for development)
2. Vercel CLI installed: `npm i -g vercel`
3. Access to the repository on GitHub

## Deployment Options

### Option 1: Deploy from Root (Recommended for GitHub Integration)

This option deploys from the repository root and is ideal for GitHub integration with automatic deployments.

**Configuration File:** `vercel.json` (root)

#### Steps:

1. **Connect Repository to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the configuration from `vercel.json`

2. **Configure Environment Variables**
   
   In the Vercel project settings, add these environment variables:
   
   ```
   VITE_API_URL=https://your-api-backend.com
   VITE_WS_URL=wss://your-websocket-backend.com
   ```
   
   Replace with your actual backend API URLs.

3. **Deploy**
   
   Vercel will automatically deploy on every push to your main branch. For manual deployment:
   
   ```bash
   vercel --prod
   ```

### Option 2: Deploy from services/web Directory

This option deploys directly from the web service directory.

**Configuration File:** `services/web/vercel.json`

#### Steps:

1. **Navigate to web directory:**
   ```bash
   cd services/web
   ```

2. **Deploy using Vercel CLI:**
   ```bash
   vercel
   ```

3. **For production deployment:**
   ```bash
   vercel --prod
   ```

## Environment Variables

The frontend requires these environment variables to function properly:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API endpoint | `https://api.researchflow.com` |
| `VITE_WS_URL` | WebSocket endpoint for real-time features | `wss://ws.researchflow.com` |

### Setting Environment Variables in Vercel

1. Go to your project in Vercel Dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with appropriate values for:
   - **Production**: Live backend URLs
   - **Preview**: Staging/preview backend URLs
   - **Development**: Local development URLs (optional)

## Build Configuration

The build process:

1. **Install Dependencies**
   - Root dependencies are installed first
   - Web service dependencies are installed via workspace
   - Packages are built (core, design-system)

2. **Build Frontend**
   - Vite builds the React application
   - Output directory: `services/web/dist`
   - Optimized for production with code splitting

3. **Deploy**
   - Built files are uploaded to Vercel CDN
   - Environment variables are injected at build time
   - SPA routing is configured for client-side navigation

## Routing Configuration

The frontend is a Single Page Application (SPA). The `vercel.json` configuration includes:

- **Rewrites**: All routes are rewritten to `/index.html` to support client-side routing
- **Headers**: Security headers (CSP, X-Frame-Options, etc.)
- **Caching**: Aggressive caching for static assets, no-cache for HTML

## Security Headers

The deployment includes these security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Caching Strategy

- **HTML files** (`index.html`): No cache, always fresh
- **JavaScript/CSS bundles**: Immutable, cached for 1 year
- **Assets**: Immutable, cached for 1 year

## Backend Deployment

**Important**: Vercel is used only for the frontend. Backend services must be deployed separately:

### Recommended Backend Platforms:

1. **Railway** (simplest, Docker support)
   - Deploy `services/orchestrator` (Node.js API)
   - Deploy `services/worker` (Python worker)
   - Automatic HTTPS, easy environment variables

2. **Render** (generous free tier)
   - Docker support for both services
   - Managed PostgreSQL and Redis

3. **AWS ECS/Fargate** (production-grade)
   - Full Docker Compose support
   - Scalable infrastructure

4. **DigitalOcean App Platform**
   - Docker support
   - Managed databases

### Backend Services Required:

- **PostgreSQL** database
- **Redis** for job queue and caching
- **Orchestrator** service (Node.js on port 3001)
- **Worker** service (Python on port 8000)
- **Collab** service (WebSocket on port 3002)

## Local Testing

Before deploying, test the build locally:

```bash
# Build the frontend
cd services/web
npm run build

# Preview the build
npm run preview

# Or use serve
npx serve dist
```

Open http://localhost:4173 to verify the build works correctly.

## Troubleshooting

### Build Fails with Module Errors

- Ensure all workspace dependencies are installed
- Check that `packages/core` builds successfully
- Verify Node.js version is 20+

### Environment Variables Not Working

- Vite environment variables must be prefixed with `VITE_`
- Variables are injected at build time, not runtime
- Redeploy after changing environment variables

### 404 on Routes

- Verify `rewrites` configuration in `vercel.json`
- All routes should rewrite to `/index.html`
- Check browser console for routing errors

### Backend Connection Issues

- Verify `VITE_API_URL` is correct and accessible
- Check CORS configuration on backend
- Ensure backend is deployed and running

## Monitoring and Analytics

Vercel provides built-in analytics:

1. Go to your project dashboard
2. Click on "Analytics" tab
3. View:
   - Page views
   - Performance metrics (Web Vitals)
   - Traffic sources

## Production Checklist

Before deploying to production:

- [ ] Environment variables configured
- [ ] Backend services deployed and accessible
- [ ] Database migrations run
- [ ] CORS configured on backend
- [ ] SSL/HTTPS enabled
- [ ] DNS configured (if using custom domain)
- [ ] Security headers verified
- [ ] Performance tested (Lighthouse score)
- [ ] Error tracking configured (optional: Sentry)

## Continuous Deployment

Vercel automatically deploys:

- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

Configure branch deployment in:
- Settings → Git → Production Branch
- Settings → Git → Deploy Hooks (for manual triggers)

## Custom Domains

To add a custom domain:

1. Go to Project Settings → Domains
2. Add your domain (e.g., `researchflow.com`)
3. Configure DNS records as instructed
4. Vercel handles SSL certificates automatically

## Cost Considerations

Vercel pricing:

- **Hobby (Free)**: 
  - 100 GB bandwidth/month
  - Unlimited projects
  - Good for development/testing

- **Pro ($20/month)**:
  - 1 TB bandwidth
  - Preview deployments
  - Team collaboration
  - Recommended for production

See [Vercel Pricing](https://vercel.com/pricing) for details.

## Support

For issues:

1. Check [Vercel Documentation](https://vercel.com/docs)
2. Review build logs in Vercel Dashboard
3. Check repository issues on GitHub
4. Contact the development team

## Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Environment Variables Guide](https://vercel.com/docs/concepts/projects/environment-variables)
- [Custom Domains Guide](https://vercel.com/docs/concepts/projects/custom-domains)

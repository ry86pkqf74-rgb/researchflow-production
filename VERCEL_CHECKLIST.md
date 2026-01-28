# Vercel Deployment Checklist

Use this checklist to ensure a smooth deployment to Vercel.

## Pre-Deployment Checklist

### 1. Code Preparation
- [ ] All changes committed and pushed to GitHub
- [ ] Build tested locally (`cd services/web && npm run build`)
- [ ] No build errors or critical warnings
- [ ] Dependencies updated and security vulnerabilities addressed

### 2. Environment Variables
- [ ] Backend API endpoint URL ready (VITE_API_URL)
- [ ] WebSocket endpoint URL ready (VITE_WS_URL)
- [ ] Optional variables prepared (Sentry DSN, Analytics, etc.)

### 3. Backend Services
- [ ] Backend API deployed and accessible
- [ ] PostgreSQL database provisioned
- [ ] Redis instance provisioned
- [ ] WebSocket service running
- [ ] Database migrations completed
- [ ] CORS configured to allow Vercel domain

### 4. Vercel Account Setup
- [ ] Vercel account created
- [ ] GitHub repository connected to Vercel
- [ ] Vercel CLI installed (`npm install -g vercel`)

## Deployment Steps

### Initial Deployment

1. **Connect Repository to Vercel**
   ```bash
   # Option A: Using Vercel Dashboard
   # Go to https://vercel.com/new
   # Import your GitHub repository
   
   # Option B: Using Vercel CLI
   vercel
   ```

2. **Configure Project Settings**
   - [ ] Project name set
   - [ ] Framework detected as "Vite"
   - [ ] Root directory: `./` (or leave blank)
   - [ ] Build command verified
   - [ ] Output directory verified: `services/web/dist`

3. **Add Environment Variables**
   - [ ] Go to Project Settings → Environment Variables
   - [ ] Add `VITE_API_URL` with your backend URL
   - [ ] Add `VITE_WS_URL` with your WebSocket URL
   - [ ] Add any optional variables
   - [ ] Set variables for all environments (Production, Preview, Development)

4. **Deploy**
   ```bash
   # Deploy to production
   vercel --prod
   ```

### Post-Deployment Verification

5. **Test Deployment**
   - [ ] Open deployment URL
   - [ ] Verify homepage loads correctly
   - [ ] Check browser console for errors
   - [ ] Test authentication (login/register)
   - [ ] Verify API connectivity
   - [ ] Test WebSocket connection (if applicable)
   - [ ] Test main user flows:
     - [ ] Create new project
     - [ ] Upload data
     - [ ] Run workflow
     - [ ] View results

6. **Performance Check**
   - [ ] Run Lighthouse audit
   - [ ] Check Core Web Vitals
   - [ ] Verify asset caching working
   - [ ] Test on mobile devices
   - [ ] Check load times from different regions

7. **Security Verification**
   - [ ] Verify security headers present
   - [ ] Check HTTPS is enforced
   - [ ] Verify no sensitive data in client bundle
   - [ ] Test CSP (Content Security Policy)
   - [ ] Verify API keys not exposed

## Configuration Checklist

### Vercel Project Settings

- [ ] **General**
  - [ ] Project name is descriptive
  - [ ] Framework Preset: Vite
  - [ ] Node.js Version: 20.x

- [ ] **Git**
  - [ ] Production Branch: `main` (or your preferred branch)
  - [ ] Deploy Hooks configured (optional)
  - [ ] Auto-deploy enabled for production branch

- [ ] **Environment Variables**
  - [ ] All required variables added
  - [ ] Sensitive variables marked as encrypted
  - [ ] Variables set for appropriate environments

- [ ] **Domains**
  - [ ] Custom domain configured (if applicable)
  - [ ] DNS records verified
  - [ ] SSL certificate active
  - [ ] Redirects configured (www → non-www or vice versa)

- [ ] **Performance**
  - [ ] Edge Network enabled
  - [ ] Image Optimization enabled (if using Vercel Image)
  - [ ] Analytics enabled (optional)

## Monitoring Checklist

### Post-Launch Monitoring

- [ ] **Day 1**
  - [ ] Monitor Vercel Analytics for traffic
  - [ ] Check error logs in Vercel dashboard
  - [ ] Verify backend API logs for traffic
  - [ ] Monitor database performance

- [ ] **Week 1**
  - [ ] Review performance metrics
  - [ ] Check for any 404 errors
  - [ ] Verify all features working
  - [ ] User feedback collected

- [ ] **Month 1**
  - [ ] Review bandwidth usage
  - [ ] Check Vercel billing (if on paid plan)
  - [ ] Optimize based on metrics
  - [ ] Update dependencies

## Troubleshooting Checklist

If deployment fails or issues occur, check:

- [ ] Build logs in Vercel dashboard
- [ ] Environment variables are correct
- [ ] Backend API is accessible from Vercel
- [ ] CORS configuration allows Vercel domain
- [ ] Node.js version compatibility
- [ ] Dependencies installed correctly
- [ ] No hardcoded localhost URLs in code

## Rollback Plan

If critical issues arise:

1. **Instant Rollback**
   ```bash
   # In Vercel Dashboard: Deployments → Previous deployment → Promote to Production
   # Or via CLI:
   vercel rollback
   ```

2. **Fix and Redeploy**
   - [ ] Identify issue in logs
   - [ ] Create fix branch
   - [ ] Test fix locally
   - [ ] Deploy fix to preview
   - [ ] Verify fix works
   - [ ] Deploy to production

## Ongoing Maintenance

- [ ] **Weekly**
  - Monitor performance metrics
  - Check for dependency updates
  - Review error logs

- [ ] **Monthly**
  - Update dependencies
  - Run security audit
  - Review and optimize bundle size
  - Check Lighthouse scores

- [ ] **Quarterly**
  - Review Vercel plan/usage
  - Audit environment variables
  - Review and update documentation
  - Performance optimization review

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - Detailed deployment guide
- [.env.vercel.example](./.env.vercel.example) - Environment variables template
- [scripts/deploy-vercel.sh](./scripts/deploy-vercel.sh) - Deployment script

## Notes

- Keep a copy of this checklist for each deployment
- Update checklist based on learnings from each deployment
- Document any custom configurations or workarounds

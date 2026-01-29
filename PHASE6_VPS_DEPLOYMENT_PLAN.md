# ResearchFlow Phase 6: VPS Production Deployment
## Comprehensive Execution Plan with AI Tool Delegations

**Generated**: January 28, 2026 @ 10:00 PM
**Status**: Ready for Parallel Execution
**Estimated Duration**: 4-6 hours

---

## Infrastructure Requirements

### Minimum VPS Specifications
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU Cores | 8 | 16 |
| RAM | 16 GB | 32 GB |
| Storage | 100 GB SSD | 250 GB NVMe |
| Bandwidth | 1 TB/mo | Unlimited |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Service Resource Allocation
| Service | CPU | RAM | Storage |
|---------|-----|-----|---------|
| Orchestrator | 2 cores | 2 GB | 1 GB |
| Worker | 4 cores | 8 GB | 10 GB |
| Web (Nginx) | 0.5 cores | 256 MB | 100 MB |
| Collab | 1 core | 512 MB | 100 MB |
| Guideline Engine | 1 core | 1 GB | 500 MB |
| PostgreSQL | 2 cores | 4 GB | 50 GB |
| Redis | 1 core | 1 GB | 2 GB |
| **TOTAL** | **11.5 cores** | **16.8 GB** | **64 GB** |

---

## Phase 6 Streams (Parallel Execution)

### STREAM 6A: VPS Provisioning
**Assigned Tool**: Claude (Cowork) + Chrome Browser
**Priority**: P0-Critical
**Duration**: 30 min

#### Tasks:
1. [ ] Select VPS provider (DigitalOcean/Vultr/Hetzner)
2. [ ] Provision VPS with Ubuntu 22.04 LTS
3. [ ] Configure SSH key authentication
4. [ ] Set up firewall rules (UFW)
5. [ ] Install Docker & Docker Compose
6. [ ] Create deploy user with sudo

#### Commands:
```bash
# Initial server setup
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2 ufw fail2ban

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Create deploy user
adduser --disabled-password deploy
usermod -aG docker deploy
```

---

### STREAM 6B: DNS & SSL Configuration
**Assigned Tool**: Claude (Chrome Browser) + Cloudflare
**Priority**: P0-Critical
**Duration**: 20 min

#### Tasks:
1. [ ] Configure DNS A records pointing to VPS IP
2. [ ] Set up Cloudflare proxy (optional)
3. [ ] Generate Let's Encrypt SSL certificates
4. [ ] Configure auto-renewal with certbot

#### DNS Records:
```
A     @              → VPS_IP
A     www            → VPS_IP
A     api            → VPS_IP
CNAME collab         → @
```

#### SSL Setup:
```bash
# Install certbot
apt install -y certbot python3-certbot-nginx

# Generate certificates
certbot certonly --standalone -d researchflow.app -d www.researchflow.app
```

---

### STREAM 6C: GitHub Actions CI/CD
**Assigned Tool**: Claude (Cowork) + GitHub API
**Priority**: P1-High
**Duration**: 45 min

#### Tasks:
1. [ ] Create GitHub Actions deployment workflow
2. [ ] Configure secrets in GitHub repository
3. [ ] Set up Docker registry (GHCR)
4. [ ] Create deployment scripts
5. [ ] Test CI/CD pipeline

#### Required GitHub Secrets:
```
VPS_HOST          - VPS IP address
VPS_USER          - deploy
VPS_SSH_KEY       - Private SSH key
DOCKER_REGISTRY   - ghcr.io/username
DOMAIN            - researchflow.app
```

---

### STREAM 6D: Production Environment
**Assigned Tool**: Claude (Cowork)
**Priority**: P1-High
**Duration**: 30 min

#### Tasks:
1. [ ] Create production .env file
2. [ ] Generate secure secrets (JWT, Redis password)
3. [ ] Configure nginx.conf for production
4. [ ] Set up log rotation
5. [ ] Configure backup strategy

#### Production .env Template:
```bash
# Database
POSTGRES_USER=ros_prod
POSTGRES_PASSWORD=<generated>
POSTGRES_DB=researchflow
DATABASE_URL=postgresql://ros_prod:<password>@postgres:5432/researchflow

# Redis
REDIS_PASSWORD=<generated>

# JWT
JWT_SECRET=<generated-256-bit>
JWT_EXPIRES_IN=24h

# API Keys (from existing .env)
OPENAI_API_KEY=<existing>
ANTHROPIC_API_KEY=<existing>
NOTION_API_KEY=<existing>

# Domain
DOMAIN=researchflow.app
```

---

### STREAM 6E: Monitoring & Alerts
**Assigned Tool**: n8n + Notion
**Priority**: P2-Medium
**Duration**: 30 min

#### Tasks:
1. [ ] Configure health check endpoints
2. [ ] Set up uptime monitoring (UptimeRobot/Healthchecks.io)
3. [ ] Create n8n workflow for error alerts
4. [ ] Configure Notion incident log
5. [ ] Set up resource usage alerts

#### Health Endpoints:
```
GET /health                 - Main health check
GET /api/health            - API health check
GET /api/health/db         - Database connectivity
GET /api/health/redis      - Redis connectivity
```

---

## AI Tool Assignment Matrix

| Stream | Primary Tool | Secondary | Fallback | Status |
|--------|--------------|-----------|----------|--------|
| 6A: VPS Provisioning | Chrome Browser | Control Mac | Manual | ⏳ |
| 6B: DNS & SSL | Chrome Browser | Cloudflare API | Manual | ⏳ |
| 6C: CI/CD Pipeline | Claude (Cowork) | GitHub Actions | Manual | ⏳ |
| 6D: Production Env | Claude (Cowork) | Bash | Manual | ⏳ |
| 6E: Monitoring | n8n | Notion MCP | Manual | ⏳ |

---

## Parallel Execution Timeline

```
TIME    STREAM 6A       STREAM 6B       STREAM 6C       STREAM 6D       STREAM 6E
────────────────────────────────────────────────────────────────────────────────────
0-30m   [VPS Setup]     [Wait]          [Wait]          [Env Config]    [Wait]
        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ░░░░░░░░░░░░░░  ░░░░░░░░░░░░░░  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ░░░░░░░░░░░░

30-50m  ✅ COMPLETE     [DNS & SSL]     [CI/CD Setup]   ✅ COMPLETE     [n8n Config]
                        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  ▓▓▓▓▓▓▓▓▓▓▓▓

50-90m                  ✅ COMPLETE     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  ▓▓▓▓▓▓▓▓▓▓▓▓

90-120m                                 ✅ COMPLETE                     ✅ COMPLETE
────────────────────────────────────────────────────────────────────────────────────
                           ALL STREAMS COMPLETE - READY FOR DEPLOYMENT
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] VPS provisioned and accessible
- [ ] DNS pointing to VPS IP
- [ ] SSL certificates generated
- [ ] GitHub Actions configured
- [ ] Production .env ready
- [ ] Backup strategy configured

### Deployment
- [ ] Clone repository to VPS
- [ ] Copy production .env
- [ ] Run `docker compose -f docker-compose.prod.yml up -d`
- [ ] Verify all services healthy
- [ ] Run smoke tests

### Post-Deployment
- [ ] Verify SSL working (https://researchflow.app)
- [ ] Test authentication flow
- [ ] Test file upload functionality
- [ ] Verify WebSocket connections
- [ ] Configure monitoring alerts
- [ ] Update Notion Mission Control

---

## Success Criteria

### Phase 6 Complete When:
- [ ] VPS operational and accessible
- [ ] All 8 Docker services running healthy
- [ ] HTTPS working with valid SSL
- [ ] CI/CD pipeline tested
- [ ] Monitoring configured
- [ ] Zero critical issues

---

## Emergency Rollback

```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Restore from backup (if needed)
./scripts/restore-backup.sh

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

---

*Document Version: 1.0*
*Generated by: Claude (Cowork)*
*Phase: 6 - VPS Production Deployment*

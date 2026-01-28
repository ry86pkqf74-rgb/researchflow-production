# VPS Deployment Runbook

**Task ID:** DOC-001
**Priority:** P1 - High
**Last Updated:** January 28, 2026

---

## Overview

This runbook provides step-by-step instructions for deploying ResearchFlow to a VPS (Virtual Private Server) with HIPAA-compliant configuration.

---

## 1. Server Requirements

### Minimum Specifications
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| Storage | 100 GB SSD | 250 GB NVMe |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Network | 1 Gbps | 1 Gbps |

### Required Ports
| Port | Service | Access |
|------|---------|--------|
| 22 | SSH | Admin only |
| 80 | HTTP (redirect) | Public |
| 443 | HTTPS | Public |
| 5432 | PostgreSQL | Internal only |
| 6379 | Redis | Internal only |

---

## 2. Domain/DNS Setup

### Required DNS Records

```bash
# A Records (replace with your VPS IP)
researchflow.example.com    A    203.0.113.50
api.researchflow.example.com    A    203.0.113.50

# Optional: Mail records for notifications
researchflow.example.com    MX   10 mail.example.com
researchflow.example.com    TXT  "v=spf1 include:_spf.example.com ~all"
```

### Verify DNS Propagation

```bash
dig +short researchflow.example.com
dig +short api.researchflow.example.com
```

---

## 3. Docker Installation

### Install Docker Engine

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

## 4. SSL Certificate Setup

### Option A: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot

# Stop any existing web servers
sudo systemctl stop nginx 2>/dev/null || true

# Obtain certificate
sudo certbot certonly --standalone \
  -d researchflow.example.com \
  -d api.researchflow.example.com \
  --agree-tos \
  --email admin@example.com \
  --non-interactive

# Certificates stored at:
# /etc/letsencrypt/live/researchflow.example.com/fullchain.pem
# /etc/letsencrypt/live/researchflow.example.com/privkey.pem
```

### Option B: Self-Signed (Development Only)

```bash
mkdir -p infrastructure/certs
cd infrastructure/certs

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/CN=researchflow.local"
```

### Auto-Renewal Setup

```bash
# Add to crontab
echo "0 0 * * * root certbot renew --quiet --post-hook 'docker compose restart nginx'" | sudo tee -a /etc/cron.d/certbot-renew
```

---

## 5. Environment Configuration

### Clone Repository

```bash
cd /opt
sudo git clone https://github.com/ry86pkqf74-rgb/researchflow-production.git
sudo chown -R $USER:$USER researchflow-production
cd researchflow-production
```

### Configure Environment

```bash
# Copy example environment
cp .env.example .env

# Edit environment variables
nano .env
```

### Required Environment Variables

```bash
# === CRITICAL: Change these in production ===
JWT_SECRET=<generate-64-char-random-string>
REFRESH_TOKEN_SECRET=<generate-64-char-random-string>
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>

# === Domain Configuration ===
CLIENT_URL=https://researchflow.example.com
API_URL=https://api.researchflow.example.com

# === HIPAA Mode ===
GOVERNANCE_MODE=LIVE
PHI_SCAN_ENABLED=true
AUDIT_LOG_ENABLED=true

# === Database ===
DATABASE_URL=postgresql://ros:${POSTGRES_PASSWORD}@postgres:5432/researchflow
PGSSLMODE=require

# === Redis ===
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# === AI Services (Optional) ===
ANTHROPIC_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>
```

### Generate Secure Secrets

```bash
# Generate JWT_SECRET
openssl rand -base64 48 | tr -d '\n'

# Generate REFRESH_TOKEN_SECRET
openssl rand -base64 48 | tr -d '\n'

# Generate database password
openssl rand -base64 24 | tr -d '\n'
```

---

## 6. Deployment Commands

### Initial Deployment

```bash
cd /opt/researchflow-production

# Pull latest code
git pull origin main

# Build images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services with HIPAA overlay
docker compose -f docker-compose.yml \
  -f docker-compose.hipaa.yml \
  -f docker-compose.prod.yml \
  up -d

# Verify all services are healthy
docker compose ps
```

### Database Migrations

```bash
# Run migrations
docker compose exec orchestrator npm run db:migrate

# Seed initial data (optional)
docker compose exec orchestrator npm run db:seed
```

### Verify Deployment

```bash
# Run smoke tests
./scripts/verify-deployment.sh

# Check logs for errors
docker compose logs --tail=50 orchestrator
docker compose logs --tail=50 worker
```

---

## 7. Monitoring Setup

### System Metrics

```bash
# Install node_exporter for Prometheus
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xzf node_exporter-*.tar.gz
sudo mv node_exporter-*/node_exporter /usr/local/bin/
```

### Log Aggregation

```bash
# View all service logs
docker compose logs -f

# View specific service
docker compose logs -f orchestrator

# Audit logs location
tail -f /var/log/researchflow/audit.log
```

### Health Check Endpoints

| Endpoint | Expected Response |
|----------|-------------------|
| `https://api.example.com/health` | `{"status":"healthy"}` |
| `https://api.example.com/health/db` | `{"postgres":"connected"}` |
| `https://api.example.com/health/redis` | `{"redis":"connected"}` |

### Alerting (Optional)

```bash
# Install Prometheus Alertmanager
# Configure alerts for:
# - Service down (5 minutes)
# - High CPU (>80% for 10 minutes)
# - High memory (>90%)
# - Disk space low (<10%)
# - SSL certificate expiring (<14 days)
```

---

## 8. Backup Strategy

### Automated Backups

```bash
# Add to crontab
sudo crontab -e

# Add these lines:
# Daily PostgreSQL backup at 2 AM
0 2 * * * /opt/researchflow-production/scripts/postgres-backup.sh

# Daily volume backup at 3 AM
0 3 * * * /opt/researchflow-production/scripts/volume-backup.sh shared-data

# Weekly Redis backup (Sunday 4 AM)
0 4 * * 0 /opt/researchflow-production/scripts/redis-backup.sh
```

### Off-Site Backup (Recommended)

```bash
# Sync to S3 or similar
aws s3 sync /backups s3://researchflow-backups/$(hostname)/ --delete
```

### Backup Verification

```bash
# Weekly restore test
./scripts/test-restore.sh
```

---

## 9. Security Hardening

### Firewall Configuration

```bash
# UFW setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### SSH Hardening

```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
```

### Fail2Ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 10. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Services not starting | Check `docker compose logs <service>` |
| Database connection failed | Verify POSTGRES_PASSWORD in .env |
| Redis auth failed | Verify REDIS_PASSWORD in .env |
| SSL errors | Check certificate paths and permissions |
| 502 Bad Gateway | Restart orchestrator: `docker compose restart orchestrator` |

### Emergency Rollback

```bash
# Rollback to previous version
git checkout <previous-tag>
docker compose down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Support Contacts

- Technical Lead: [TBD]
- On-Call: [TBD]
- Security Incidents: [TBD]

---

*Generated for ResearchFlow HIPAA-Compliant Deployment*

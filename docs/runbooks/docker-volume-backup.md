# Docker Volume Backup Strategy

**Task ID:** DOCK-010
**Priority:** P1 - High
**Last Updated:** January 28, 2026

---

## Overview

This runbook describes the backup and restore procedures for ResearchFlow Docker volumes, ensuring data integrity and disaster recovery capability.

## Volumes to Backup

| Volume | Data Type | Priority | Backup Frequency |
|--------|-----------|----------|------------------|
| postgres-data | Database | Critical | Daily (incremental) |
| postgres_hipaa_data | HIPAA Database | Critical | Daily (encrypted) |
| redis-data | Cache/Sessions | Medium | Weekly |
| redis_hipaa_data | HIPAA Cache | Medium | Weekly |
| shared-data | Uploads/Artifacts | High | Daily |
| projects-data | Git Repositories | High | Daily |

---

## Backup Procedures

### 1. PostgreSQL Backup (Recommended)

```bash
#!/bin/bash
# postgres-backup.sh

BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="researchflow-postgres-1"

# Create backup directory
mkdir -p $BACKUP_DIR

# Full database dump with compression
docker exec $CONTAINER pg_dumpall -U ros | gzip > $BACKUP_DIR/full_backup_$DATE.sql.gz

# Verify backup
if gzip -t $BACKUP_DIR/full_backup_$DATE.sql.gz; then
  echo "✅ Backup verified: full_backup_$DATE.sql.gz"
else
  echo "❌ Backup verification failed!"
  exit 1
fi

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

### 2. Redis Backup

```bash
#!/bin/bash
# redis-backup.sh

BACKUP_DIR="/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="researchflow-redis-1"

mkdir -p $BACKUP_DIR

# Trigger RDB snapshot
docker exec $CONTAINER redis-cli -a $REDIS_PASSWORD BGSAVE

# Wait for snapshot to complete
sleep 5

# Copy RDB file
docker cp $CONTAINER:/data/dump.rdb $BACKUP_DIR/dump_$DATE.rdb

echo "✅ Redis backup: dump_$DATE.rdb"
```

### 3. Volume Backup (Generic)

```bash
#!/bin/bash
# volume-backup.sh

VOLUME=$1
BACKUP_DIR="/backups/volumes"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Create tarball of volume
docker run --rm \
  -v $VOLUME:/source:ro \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/${VOLUME}_$DATE.tar.gz -C /source .

echo "✅ Volume backup: ${VOLUME}_$DATE.tar.gz"
```

---

## Restore Procedures

### 1. PostgreSQL Restore

```bash
#!/bin/bash
# postgres-restore.sh

BACKUP_FILE=$1

# Stop services that depend on postgres
docker compose stop orchestrator worker guideline-engine

# Restore from backup
gunzip -c $BACKUP_FILE | docker exec -i researchflow-postgres-1 psql -U ros

# Restart services
docker compose start orchestrator worker guideline-engine

echo "✅ Database restored from $BACKUP_FILE"
```

### 2. Volume Restore

```bash
#!/bin/bash
# volume-restore.sh

VOLUME=$1
BACKUP_FILE=$2

# Stop all services
docker compose down

# Clear and restore volume
docker run --rm \
  -v $VOLUME:/target \
  -v $(dirname $BACKUP_FILE):/backup \
  alpine sh -c "rm -rf /target/* && tar xzf /backup/$(basename $BACKUP_FILE) -C /target"

# Restart services
docker compose up -d

echo "✅ Volume $VOLUME restored from $BACKUP_FILE"
```

---

## Automated Backup Schedule (Cron)

Add to `/etc/crontab` or use cron job:

```cron
# Daily PostgreSQL backup at 2 AM
0 2 * * * root /opt/researchflow/scripts/postgres-backup.sh

# Daily shared-data backup at 3 AM
0 3 * * * root /opt/researchflow/scripts/volume-backup.sh shared-data

# Weekly Redis backup (Sunday 4 AM)
0 4 * * 0 root /opt/researchflow/scripts/redis-backup.sh
```

---

## HIPAA Compliance Notes

1. **Encryption**: All backups containing PHI must be encrypted at rest
   ```bash
   # Encrypt backup with GPG
   gpg --symmetric --cipher-algo AES256 backup.tar.gz
   ```

2. **Access Control**: Backup files should have restricted permissions
   ```bash
   chmod 600 /backups/*
   chown root:root /backups/*
   ```

3. **Retention**: Keep backups for minimum 6 years per HIPAA requirements

4. **Audit Trail**: Log all backup/restore operations

---

## Verification Checklist

- [ ] Backup scripts are executable
- [ ] Backup directory exists with correct permissions
- [ ] Cron jobs are configured
- [ ] Test restore procedure completed successfully
- [ ] Encryption keys are stored securely
- [ ] Off-site backup location configured (optional)

---

*Generated for ResearchFlow HIPAA-Compliant Deployment*

# ResearchFlow Backups and Recovery Runbook

## Overview

This document covers backup strategies, automated backup configuration, and disaster recovery
procedures for ResearchFlow production systems.

## Backup Strategy

### What Gets Backed Up

| Component | Method | Frequency | Retention |
|-----------|--------|-----------|-----------|
| PostgreSQL | pg_dump | Daily + on-demand | 30 days |
| Redis | RDB snapshots | Hourly | 7 days |
| Artifacts | Volume snapshots | Daily | 90 days |
| Configuration | Git repository | On change | Infinite |

### Backup Locations

| Environment | Primary | Secondary |
|-------------|---------|-----------|
| Development | Local `backups/` | N/A |
| Staging | S3 bucket | Local fallback |
| Production | S3 bucket (encrypted) | Cross-region replica |

## Local Backups (Docker Compose)

### Manual Backup

```bash
# Create a backup
make db-backup

# Create production backup
make db-backup-prod

# List available backups
make db-backup-list
```

### Backup Output

Backups are stored in the `backups/` directory with naming convention:
```
backups/backup_YYYYMMDD_HHMMSS.sql.gz
backups/backup_prod_YYYYMMDD_HHMMSS.sql.gz
```

### Manual Restore

```bash
# Restore from a specific backup
make db-restore BACKUP_FILE=backups/backup_20250120_143000.sql.gz

# Note: This will prompt for confirmation before overwriting
```

### Backup Retention

```bash
# Clean up backups older than 30 days
make db-backup-retention
```

### Automated Local Backups (cron)

Add to crontab (`crontab -e`):

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/researchflow-production && make db-backup >> logs/backup.log 2>&1

# Weekly retention cleanup on Sundays at 3 AM
0 3 * * 0 cd /path/to/researchflow-production && make db-backup-retention >> logs/backup.log 2>&1
```

## Kubernetes Backups

### CronJob Configuration

Create `infrastructure/kubernetes/base/backup-cronjob.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: researchflow
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM UTC
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:16-alpine
            env:
            - name: PGHOST
              value: postgres
            - name: PGUSER
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: username
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: password
            - name: PGDATABASE
              value: researchflow
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: backup-s3-credentials
                  key: access-key
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: backup-s3-credentials
                  key: secret-key
            - name: S3_BUCKET
              value: researchflow-backups
            command:
            - /bin/sh
            - -c
            - |
              set -e
              TIMESTAMP=$(date +%Y%m%d_%H%M%S)
              BACKUP_FILE="/tmp/backup_${TIMESTAMP}.sql.gz"

              echo "Starting backup at $(date)"
              pg_dump | gzip > "$BACKUP_FILE"

              echo "Uploading to S3..."
              apk add --no-cache aws-cli
              aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/postgres/${TIMESTAMP}.sql.gz"

              echo "Backup completed successfully"
              rm -f "$BACKUP_FILE"
          restartPolicy: OnFailure
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-retention
  namespace: researchflow
spec:
  schedule: "0 4 * * 0"  # Weekly on Sundays at 4 AM UTC
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: amazon/aws-cli:latest
            env:
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: backup-s3-credentials
                  key: access-key
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: backup-s3-credentials
                  key: secret-key
            - name: S3_BUCKET
              value: researchflow-backups
            command:
            - /bin/sh
            - -c
            - |
              # Delete backups older than 30 days
              CUTOFF=$(date -d "30 days ago" +%Y%m%d)
              aws s3 ls "s3://${S3_BUCKET}/postgres/" | while read -r line; do
                FILE=$(echo "$line" | awk '{print $4}')
                DATE=$(echo "$FILE" | grep -oP '^\d{8}')
                if [ -n "$DATE" ] && [ "$DATE" -lt "$CUTOFF" ]; then
                  echo "Deleting old backup: $FILE"
                  aws s3 rm "s3://${S3_BUCKET}/postgres/$FILE"
                fi
              done
          restartPolicy: OnFailure
```

### Apply CronJobs

```bash
kubectl apply -f infrastructure/kubernetes/base/backup-cronjob.yaml
```

### Manual Kubernetes Backup

```bash
# Trigger immediate backup
kubectl create job --from=cronjob/postgres-backup postgres-backup-manual-$(date +%s) \
  -n researchflow

# Check backup status
kubectl get jobs -n researchflow
kubectl logs job/postgres-backup-manual-TIMESTAMP -n researchflow
```

## Point-in-Time Recovery (PITR)

For production systems requiring point-in-time recovery, use PostgreSQL WAL archiving.

### Enable WAL Archiving

Add to `postgresql.conf` or via ConfigMap:

```
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://researchflow-backups/wal/%f'
archive_timeout = 300
```

### PITR Recovery Procedure

1. **Stop the database service:**
   ```bash
   kubectl scale deployment postgres --replicas=0 -n researchflow
   ```

2. **Restore base backup:**
   ```bash
   # Download the most recent base backup before the target time
   aws s3 cp s3://researchflow-backups/postgres/YYYYMMDD_HHMMSS.sql.gz .
   ```

3. **Create recovery configuration:**
   ```bash
   cat > recovery.conf << EOF
   restore_command = 'aws s3 cp s3://researchflow-backups/wal/%f %p'
   recovery_target_time = '2025-01-20 14:30:00 UTC'
   recovery_target_action = 'promote'
   EOF
   ```

4. **Restore and replay WAL:**
   ```bash
   # This requires direct access to the PostgreSQL data directory
   # Typically done via a restore job or manual intervention
   ```

5. **Restart and verify:**
   ```bash
   kubectl scale deployment postgres --replicas=1 -n researchflow
   kubectl logs deployment/postgres -n researchflow --follow
   ```

## Disaster Recovery Scenarios

### Scenario 1: Corrupted Database

**Symptoms:** Query errors, inconsistent data, crash loops

**Recovery:**

```bash
# 1. Put system in STANDBY mode
kubectl patch configmap researchflow-config -n researchflow-production \
  --type merge -p '{"data":{"ROS_MODE":"STANDBY"}}'
kubectl rollout restart deployment/orchestrator -n researchflow-production

# 2. Identify last known good backup
aws s3 ls s3://researchflow-backups/postgres/ --recursive | sort | tail -20

# 3. Restore from backup
# (Follow restore procedure above)

# 4. Return to LIVE mode
kubectl patch configmap researchflow-config -n researchflow-production \
  --type json -p '[{"op":"remove","path":"/data/ROS_MODE"}]'
kubectl rollout restart deployment/orchestrator -n researchflow-production
```

### Scenario 2: Accidental Data Deletion

**Recovery:**

1. Immediately set `ROS_MODE=STANDBY` to prevent further changes
2. Use PITR to recover to a point before the deletion
3. Export the recovered data
4. Merge with current data if needed
5. Return to LIVE mode

### Scenario 3: Complete Infrastructure Loss

**Recovery:**

1. Provision new infrastructure (Terraform)
2. Deploy application (kubectl apply)
3. Restore database from S3 backup
4. Restore artifact volumes from snapshots
5. Verify all services healthy
6. Update DNS/load balancers

## Backup Verification

### Monthly Backup Test Procedure

1. **Spin up test environment:**
   ```bash
   kubectl create namespace researchflow-backup-test
   ```

2. **Restore backup to test environment:**
   ```bash
   # Deploy postgres to test namespace
   # Restore from production backup
   ```

3. **Verify data integrity:**
   ```bash
   # Run consistency checks
   # Compare row counts with production
   # Verify sample records
   ```

4. **Document results:**
   - Record test date
   - Backup file used
   - Time to restore
   - Any issues found

5. **Cleanup:**
   ```bash
   kubectl delete namespace researchflow-backup-test
   ```

## Monitoring and Alerts

### Backup Monitoring

```yaml
# Prometheus alert for failed backups
groups:
  - name: backup-alerts
    rules:
      - alert: BackupJobFailed
        expr: |
          kube_job_status_failed{job_name=~"postgres-backup.*"} > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database backup job failed"
          description: "Backup job {{ $labels.job_name }} has failed"

      - alert: NoRecentBackup
        expr: |
          time() - backup_last_success_timestamp > 86400 * 2
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "No recent database backup"
          description: "Last successful backup was more than 2 days ago"
```

## Quick Reference

| Task | Command |
|------|---------|
| Manual backup (local) | `make db-backup` |
| List backups | `make db-backup-list` |
| Restore backup | `make db-restore BACKUP_FILE=path` |
| Cleanup old backups | `make db-backup-retention` |
| Trigger K8s backup | `kubectl create job --from=cronjob/postgres-backup ...` |
| Check backup status | `kubectl get jobs -n researchflow` |
| Download from S3 | `aws s3 cp s3://researchflow-backups/postgres/FILE .` |

## Contact

For backup/recovery emergencies:
- On-call: [PagerDuty/OpsGenie link]
- Slack: #researchflow-ops
- Email: ops@researchflow.example.com

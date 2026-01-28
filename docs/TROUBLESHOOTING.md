# ResearchFlow Troubleshooting Guide

> **Common issues and solutions for ResearchFlow**
> Last Updated: 2026-01-28 | Version: 1.0

## Table of Contents

1. [Service Startup Failures](#service-startup-failures)
2. [Authentication Issues](#authentication-issues)
3. [Database Connection Problems](#database-connection-problems)
4. [PHI Scanning Errors](#phi-scanning-errors)
5. [Export Failures](#export-failures)
6. [Performance Issues](#performance-issues)
7. [Network and Connectivity](#network-and-connectivity)
8. [File and Storage Issues](#file-and-storage-issues)
9. [Collaboration and Real-Time Features](#collaboration-and-real-time-features)
10. [Analysis and Job Failures](#analysis-and-job-failures)

---

## Service Startup Failures

### Issue: Orchestrator Service Won't Start

**Symptoms**:
- Port 3001 not responding
- Error: "EADDRINUSE" or "listen EACCES"
- Service exits immediately after start

**Diagnosis Steps**:
1. Check if port 3001 is already in use:
   ```bash
   netstat -tlnp | grep 3001
   # or
   lsof -i :3001
   ```
2. Check logs:
   ```bash
   docker logs -f orchestrator
   # or
   pm2 logs orchestrator
   ```
3. Verify environment variables:
   ```bash
   echo $DATABASE_URL
   echo $REDIS_URL
   ```

**Solutions**:

| Symptom | Solution |
|---------|----------|
| **Port already in use** | Kill existing process: `kill -9 <PID>` or change PORT env var to 3002 |
| **Permission denied** | Run with sudo or change port to > 1024 |
| **DATABASE_URL not set** | Set: `export DATABASE_URL=postgresql://user:pass@host:5432/db` |
| **REDIS_URL not set** | Set: `export REDIS_URL=redis://localhost:6379` |
| **Cannot connect to DB** | Verify database is running (see [Database Issues](#database-connection-problems)) |
| **Memory error** | Increase available memory or reduce worker processes |
| **Module not found** | Run `npm install` and `npm run build` |

**Next Steps**:
- Verify all dependencies are installed: `npm install`
- Check Node version: `node --version` (should be 18+)
- Try rebuilding: `npm run build`
- Check /data/ directory exists and is writable

---

### Issue: Worker Service Won't Start

**Symptoms**:
- Worker pod in Pending/CrashLoopBackOff state
- Error: "ImportError: No module named X"
- Worker doesn't accept HTTP requests on port 8000

**Diagnosis Steps**:
1. Check logs:
   ```bash
   docker logs -f worker
   # or
   tail -f /data/logs/worker.log
   ```
2. Verify Python environment:
   ```bash
   python --version  # Should be 3.10+
   pip list | grep -E "pandera|pandas|scipy"
   ```
3. Check permissions:
   ```bash
   ls -la /app/
   ls -la /data/
   ```

**Solutions**:

| Symptom | Solution |
|---------|----------|
| **Module not found** | Install dependencies: `pip install -r requirements.txt` |
| **Wrong Python version** | Use Python 3.10+: `python3.10 -m pip install -r requirements.txt` |
| **Cannot write to /data/** | Fix permissions: `chmod 755 /data/ && chown app:app /data/` |
| **CUDA/GPU errors** | Disable GPU: `export CUDA_VISIBLE_DEVICES=""` or `TORCH_DEVICE=cpu` |
| **Memory issues** | Increase container memory limit or reduce batch size |
| **Pandera validation fail** | Check data schema hasn't changed, verify requirements.txt versions |
| **Connection to orchestrator** | Verify orchestrator is running and accessible |

**Next Steps**:
- Rebuild container: `docker build -t worker:latest services/worker/`
- Check PYTHONPATH: `echo $PYTHONPATH` (should include /app and /app/src)
- Manually test import: `python -c "import pandera; print(pandera.__version__)"`

---

### Issue: Redis Connection Fails

**Symptoms**:
- Error: "Error: connect ECONNREFUSED 127.0.0.1:6379"
- Cache features not working
- Job queue not processing

**Diagnosis Steps**:
1. Check if Redis is running:
   ```bash
   redis-cli ping
   ```
2. Check Redis logs:
   ```bash
   docker logs redis
   ```
3. Verify Redis is on expected port:
   ```bash
   netstat -tlnp | grep 6379
   ```
4. Test connection:
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

**Solutions**:

| Symptom | Solution |
|---------|----------|
| **Redis not running** | Start Redis: `docker run -d -p 6379:6379 redis:7` or `systemctl start redis-server` |
| **Wrong connection string** | Set correct: `export REDIS_URL=redis://localhost:6379` |
| **Authorization failed** | Add password: `redis-cli AUTH <password>` or update REDIS_URL to include password |
| **Port binding error** | Change Redis port: `redis-server --port 6380` and update REDIS_URL |
| **Out of memory** | Increase Redis memory: `redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru` |
| **Slow queries** | Check slow log: `redis-cli slowlog get 10` |
| **Connection timeout** | Check network connectivity and firewall rules |

**Next Steps**:
- Flush cache if corrupted: `redis-cli FLUSHALL` (caution: clears all data)
- Check Redis info: `redis-cli INFO`
- Monitor Redis commands: `redis-cli MONITOR`

---

## Authentication Issues

### Issue: Login Fails with "Invalid Credentials"

**Symptoms**:
- User unable to log in
- "Invalid email or password" message
- Correct password still fails

**Diagnosis Steps**:
1. Check user account exists:
   ```bash
   # In admin panel or via API
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/users?email=user@example.com
   ```
2. Check user status: Is account active or suspended?
3. Check authentication logs:
   ```bash
   grep "authentication\|login" /data/logs/*.log
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Wrong password** | User clicks "Forgot Password" and resets password |
| **Account suspended** | Admin unsuspends account: User Management → Unsuspend |
| **Account not activated** | User clicks activation link in email or admin manually activates |
| **Wrong email** | User tries with different email address associated with account |
| **Browser cache** | Clear cookies and try incognito window |
| **Too many failed attempts** | Account locked; wait 15 minutes or admin resets |

**Next Steps**:
- Send password reset email: `POST /api/auth/password-reset-request`
- Check JWT secret is the same on all services
- Verify authentication logs: `docker logs -f orchestrator | grep -i auth`

---

### Issue: MFA (Multi-Factor Authentication) Not Working

**Symptoms**:
- "Invalid MFA code" after entering correct code
- Authenticator app not syncing
- Recovery codes don't work
- Can't disable MFA

**Diagnosis Steps**:
1. Check server time is correct:
   ```bash
   date
   # Should match client device
   ntpdate -q time.nist.gov
   ```
2. Verify TOTP secret was saved correctly
3. Check if MFA is required for the user:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/me
   # Look for "mfaEnabled": true
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Server/client time skew** | Sync system time: `timedatectl set-ntp true` or use NTP server |
| **Old TOTP code** | TOTP codes are 30-second windows; discard old codes |
| **Wrong authenticator app** | Ensure app is synced to server time; try Google Authenticator |
| **Lost access to authenticator** | Use recovery codes or admin resets MFA for user |
| **Recovery codes exhausted** | Admin generates new recovery codes for user |
| **Browser remembering MFA** | Clear browser cookies and try again in private window |

**For Users**:
1. User clicks "Can't access your authenticator?" during login
2. Verifies identity (email, phone)
3. Receives temporary bypass code or password reset link
4. Sets new password and reconfigures MFA

**For Admins**:
1. Go to User Management → Select user
2. Click "Reset MFA"
3. User receives password reset email
4. After password reset, MFA is disabled
5. User can reconfigure MFA on login

---

### Issue: JWT Token Expired or Invalid

**Symptoms**:
- "Invalid or expired token" errors
- 401 Unauthorized on API calls
- User logged out unexpectedly

**Diagnosis Steps**:
1. Check token expiration:
   ```bash
   # Decode JWT (using jwt.io or command line)
   jwt decode $TOKEN
   # Look for "exp" field (expiration time)
   ```
2. Check current time on server:
   ```bash
   date +%s  # Current Unix timestamp
   ```
3. Verify JWT_SECRET is consistent:
   ```bash
   echo $JWT_SECRET
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Token expired** | User logs in again to get new token |
| **Token corrupted** | Clear cookies and log in again |
| **Wrong JWT_SECRET** | Ensure all services use same JWT_SECRET |
| **Clock skew** | Sync server clocks: `ntpdate -s time.nist.gov` |
| **Token revoked** | User session was ended; log in again |
| **Multiple instances with different secrets** | Use centralized secret management (Vault, AWS Secrets Manager) |

**Next Steps**:
- Check token validity: `curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/me`
- Review authentication service logs
- Implement token refresh mechanism if needed

---

## Database Connection Problems

### Issue: "Cannot Connect to Database" Error

**Symptoms**:
- Services cannot start or crash after start
- "ECONNREFUSED" errors in logs
- "Connection timeout" errors

**Diagnosis Steps**:
1. Check if PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   # or
   systemctl status postgresql
   ```
2. Test connection:
   ```bash
   psql -h localhost -U ros -d ros -c "SELECT 1"
   ```
3. Check credentials:
   ```bash
   echo $DATABASE_URL
   ```
4. Check network:
   ```bash
   nc -zv localhost 5432
   telnet localhost 5432
   ```

**Solutions**:

| Symptom | Solution |
|---------|----------|
| **Database not running** | Start: `docker run -d postgres:14` or `systemctl start postgresql` |
| **Wrong credentials** | Verify DATABASE_URL has correct user/password |
| **Wrong host** | Update DATABASE_URL to correct hostname |
| **Port not exposed** | Map port: `docker run -p 5432:5432 postgres:14` |
| **Firewall blocking** | Allow port 5432: `ufw allow 5432` or update security group |
| **Database doesn't exist** | Create: `createdb -h localhost -U ros ros` |
| **Connection pool exhausted** | Increase pool size: `DATABASE_POOL_SIZE=20` |

**Next Steps**:
```bash
# Test PostgreSQL connection
psql postgresql://ros:ros@localhost:5432/ros -c "SELECT version()"

# Check database size
psql -c "SELECT pg_size_pretty(pg_database_size('ros'))"

# View active connections
psql -c "SELECT * FROM pg_stat_activity WHERE datname='ros'"
```

---

### Issue: "Connection Pool Exhausted"

**Symptoms**:
- "Too many connections" error
- Queries hang and timeout
- Services become unresponsive

**Diagnosis Steps**:
1. Check active connections:
   ```bash
   psql -c "SELECT count(*) FROM pg_stat_activity"
   ```
2. See which queries are holding connections:
   ```bash
   psql -c "SELECT pid, usename, query, state FROM pg_stat_activity"
   ```
3. Check pool configuration:
   ```bash
   echo $DATABASE_POOL_SIZE
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Long-running queries** | Kill them: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query_duration > interval '1 hour'` |
| **Idle connections** | Restart application to reset connection pool |
| **Pool too small** | Increase: `export DATABASE_POOL_SIZE=30` |
| **Connection leak** | Check code for connections not being returned to pool |
| **Too many clients** | Increase PostgreSQL `max_connections`: `ALTER SYSTEM SET max_connections = 200` |

**Next Steps**:
- Kill idle connections: `psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle'"`
- Restart application services
- Monitor connection usage: `watch -n 5 'psql -c "SELECT count(*) FROM pg_stat_activity"'`

---

### Issue: Database Slow or Unresponsive

**Symptoms**:
- Queries taking much longer than normal
- 100% CPU usage
- High disk I/O

**Diagnosis Steps**:
1. Check slow queries:
   ```bash
   psql -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10"
   ```
2. Check table bloat:
   ```bash
   psql -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC"
   ```
3. Check index usage:
   ```bash
   psql -c "SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan"
   ```
4. Check query plans:
   ```bash
   psql -c "EXPLAIN ANALYZE SELECT ..."
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Missing indexes** | Create index: `CREATE INDEX idx_name ON table(column)` |
| **Table bloat** | Run VACUUM: `VACUUM ANALYZE` |
| **Seq scans on large table** | Create index on frequently filtered column |
| **No statistics** | Update stats: `ANALYZE` |
| **Disk full** | Delete old logs/artifacts or expand storage |
| **High memory usage** | Increase work_mem: `ALTER SYSTEM SET work_mem = '256MB'` |

**Next Steps**:
```bash
# Analyze query plan
psql -c "EXPLAIN ANALYZE SELECT * FROM projects WHERE created_at > NOW() - INTERVAL '7 days'"

# Check index health
psql -c "SELECT schemaname, tablename, indexname FROM pg_stat_user_indexes WHERE idx_scan = 0"

# Reindex if corruption suspected
psql -c "REINDEX TABLE projects"
```

---

## PHI Scanning Errors

### Issue: PHI Scanner Not Detecting PHI

**Symptoms**:
- PHI data uploaded without redaction in DEMO mode
- No warnings about detected PHI
- Scanner appears to be running but not working

**Diagnosis Steps**:
1. Check if scanner is enabled:
   ```bash
   echo $PHI_SCAN_ENABLED
   ```
2. Check scanner status:
   ```bash
   curl http://localhost:3001/api/health/phi-scanner
   ```
3. Test scanner manually:
   ```bash
   curl -X POST http://localhost:3001/api/phi/scan \
     -H "Content-Type: application/json" \
     -d '{"text": "SSN: 123-45-6789"}'
   ```
4. Check scanner logs:
   ```bash
   grep -i "phi\|scan" /data/logs/*.log
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Scanner disabled** | Enable: `export PHI_SCAN_ENABLED=true` and restart |
| **Patterns outdated** | Update PHI patterns (quarterly): Check `packages/phi-engine/src/patterns` |
| **False negatives** | Add custom patterns or improve ML model |
| **GOVERNANCE_MODE wrong** | Set to LIVE for real PHI detection: `export GOVERNANCE_MODE=LIVE` |
| **Scanner crashed** | Restart service: `docker restart orchestrator` |
| **Memory issues** | Increase memory for orchestrator service |

**Next Steps**:
- Verify patterns are loaded: Check `packages/phi-engine/patterns.json`
- Test with known SSN: `123-45-6789` or `987-65-4321`
- Review false positive rate: Is it too aggressive or not aggressive enough?

---

### Issue: PHI Redaction Not Working

**Symptoms**:
- PHI not being redacted in DEMO mode
- Redacted text doesn't show [PHI-REDACTED]
- Export still contains identifiable information

**Diagnosis Steps**:
1. Check governance mode:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/admin/governance
   # Look for "mode": "DEMO"
   ```
2. Check redaction setting:
   ```bash
   echo $PHI_AUTO_REDACT
   ```
3. Test redaction:
   ```bash
   curl -X POST http://localhost:3001/api/phi/redact \
     -H "Content-Type: application/json" \
     -d '{"text": "John Smith, SSN 123-45-6789"}'
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Not in DEMO mode** | Switch to DEMO: `export GOVERNANCE_MODE=DEMO` |
| **Auto-redact disabled** | Enable: `export PHI_AUTO_REDACT=true` |
| **Patterns not matching** | Improve patterns or manually add to whitelist |
| **Already redacted in DB** | Check when data was uploaded (redaction is at upload time) |
| **Export mode** | Some exports may preserve PHI by design in LIVE mode |

**Next Steps**:
- Verify mode: `curl http://localhost:3001/api/health`
- Check audit log: Was upload processed in DEMO or LIVE mode?
- Manual redaction: Use the /api/phi/redact endpoint

---

### Issue: PHI Scan Takes Too Long

**Symptoms**:
- File upload hangs during PHI scan
- Timeout error after waiting long time
- Large files fail to upload

**Diagnosis Steps**:
1. Check scanner performance:
   ```bash
   curl http://localhost:3001/api/health/performance
   ```
2. Monitor scanner while uploading:
   ```bash
   tail -f /data/logs/phi-scanner.log
   ```
3. Check file size:
   ```bash
   ls -lh /path/to/file
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **File too large** | Split into smaller files (< 100 MB each) |
| **Regex patterns slow** | Disable expensive patterns: Edit patterns config |
| **ML model slow** | Disable ML if not needed: `export PHI_USE_ML_DETECTION=false` |
| **Insufficient resources** | Increase CPU/memory for scanner service |
| **Network slow** | Check network bandwidth during upload |
| **Scan timeout** | Increase: `export PHI_SCAN_TIMEOUT_SECONDS=300` |

**Next Steps**:
- Profile scanner: Enable debug logging to see which patterns are slow
- Consider async scanning: Scan happens after upload completes
- Break large files into chunks

---

## Export Failures

### Issue: Export Fails with "Permission Denied"

**Symptoms**:
- Export button disabled
- "Insufficient permissions" error
- Governance approval not showing

**Diagnosis Steps**:
1. Check user role:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/me
   # Look for "role": "RESEARCHER"
   ```
2. Check project access:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/projects/{id}/members
   ```
3. Check governance requirements:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/governance/requirements?projectId={id}
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **User is VIEWER** | Only RESEARCHER+ can export; upgrade role |
| **No project access** | Add user to project with EDITOR role |
| **Governance approval required** | Submit for governance review and wait for approval |
| **Export restricted** | Check governance policy; may not allow exports |
| **Session expired** | Log in again to refresh token |

**Next Steps**:
- Request elevated role from admin
- Request project access from project owner
- Submit governance review if PHI involved

---

### Issue: Export Produces Empty or Corrupted File

**Symptoms**:
- Downloaded file is empty
- File size 0 bytes
- File cannot be opened (corrupted)
- Partial data in export

**Diagnosis Steps**:
1. Check export status:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/exports/{exportId}
   ```
2. Check worker logs:
   ```bash
   grep -i "export\|error" /data/logs/worker.log | tail -20
   ```
3. Check file system:
   ```bash
   ls -lh /data/artifacts/*export*
   du -sh /data/artifacts/
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Disk full** | Free up disk space; delete old artifacts |
| **Worker crash** | Check worker service status and restart if needed |
| **Permission error** | Check file permissions: `chmod 644 /data/artifacts/*` |
| **Incomplete write** | Retry export; may have been interrupted |
| **Large dataset timeout** | Increase export timeout: `export EXPORT_TIMEOUT_MS=600000` |
| **Memory error** | Split into smaller exports or increase memory |

**Next Steps**:
- Retry export
- Check worker health: `curl http://localhost:8000/health`
- Try exporting smaller dataset first to test

---

### Issue: "Insufficient Disk Space" During Export

**Symptoms**:
- Export starts then fails
- "No space left on device" error
- Disk usage shows 100%

**Diagnosis Steps**:
1. Check disk usage:
   ```bash
   df -h /data/
   ```
2. See what's using space:
   ```bash
   du -sh /data/* | sort -h
   ```
3. Check file count:
   ```bash
   find /data/ -type f | wc -l
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Artifacts too large** | Delete old artifacts: `rm /data/artifacts/old_*` |
| **Logs too large** | Archive logs: Move /data/logs to backup |
| **Database too large** | Run VACUUM ANALYZE on PostgreSQL |
| **Temp files** | Clear temp: `rm -rf /tmp/* /var/tmp/*` |
| **Add storage** | Expand volume or add new storage device |

**Next Steps**:
```bash
# Archive old logs
mkdir -p /backup/logs
tar -czf /backup/logs/archive-$(date +%Y%m%d).tar.gz /data/logs/
rm /data/logs/archive-*.log  # Keep recent logs only

# Clean old artifacts older than 30 days
find /data/artifacts/ -mtime +30 -delete

# Monitor disk space
watch -n 5 df -h /data/
```

---

## Performance Issues

### Issue: API Responses Very Slow

**Symptoms**:
- Requests take > 5 seconds
- Dashboard loads slowly
- Analysis takes much longer than expected

**Diagnosis Steps**:
1. Check response times:
   ```bash
   curl -w "Total time: %{time_total}s\n" http://localhost:3001/api/me
   ```
2. Enable query logging:
   ```bash
   export SQL_LOGGING=true
   # Restart orchestrator
   ```
3. Check service health:
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:8000/health
   ```
4. Monitor resources:
   ```bash
   docker stats
   top
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Slow database queries** | See [Database Slow](#database-slow-or-unresponsive) |
| **High CPU usage** | See [High CPU Usage](#issue-high-cpu-usage) |
| **Memory pressure** | Increase memory or reduce cache size |
| **Network latency** | Check network connectivity and routing |
| **Too many connections** | See [Connection Pool Exhausted](#issue-connection-pool-exhausted) |
| **Cache misses** | Warm cache or increase cache size |

**Next Steps**:
- Enable detailed logging: `export LOG_LEVEL=debug`
- Use APM tool (New Relic, DataDog) for profiling
- Identify slowest endpoints and optimize queries

---

### Issue: Analysis Jobs Stuck or Taking Forever

**Symptoms**:
- Analysis job status stays "PENDING" or "RUNNING"
- Job doesn't complete after hours
- No new analysis jobs starting

**Diagnosis Steps**:
1. Check job queue:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/jobs?status=RUNNING
   ```
2. Check worker status:
   ```bash
   curl http://localhost:8000/health
   ```
3. Check worker logs:
   ```bash
   tail -f /data/logs/worker.log
   ```
4. Check Redis job queue:
   ```bash
   redis-cli LLEN bull:jobs:pending
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Worker not running** | Start worker: `docker start worker` |
| **Worker out of memory** | Increase worker memory or reduce job size |
| **Stuck job holding resources** | Cancel job: `PATCH /api/jobs/{id}` with status=CANCELLED |
| **Long-running analysis** | Optimize analysis parameters; try smaller dataset |
| **Worker and orchestrator can't communicate** | Check Docker network or firewall rules |
| **Job spec invalid** | Check job parameters in orchestrator logs |

**Next Steps**:
- Check worker resource usage: `docker stats worker`
- Cancel stuck job and retry
- Break large analysis into smaller jobs

---

## Network and Connectivity

### Issue: Cannot Access ResearchFlow from Browser

**Symptoms**:
- "Cannot reach server" error
- "Connection refused" or "Connection timeout"
- Browser shows ERR_CONNECTION_REFUSED

**Diagnosis Steps**:
1. Check if orchestrator is running:
   ```bash
   curl http://localhost:3001/health
   ```
2. Check port binding:
   ```bash
   netstat -tlnp | grep 3001
   ```
3. Check firewall:
   ```bash
   sudo ufw status
   sudo iptables -L -n | grep 3001
   ```
4. Check DNS:
   ```bash
   nslookup researchflow.example.com
   dig researchflow.example.com
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Service not running** | Start service: `docker start orchestrator` |
| **Wrong URL** | Check configured URL in environment |
| **Firewall blocking** | Allow port: `ufw allow 3001` |
| **DNS not resolving** | Check DNS server or update /etc/hosts |
| **Reverse proxy issue** | Check nginx/load balancer configuration |
| **SSL certificate issue** | Check certificate validity: `openssl s_client -connect host:443` |

**Next Steps**:
```bash
# Check service
docker ps | grep orchestrator

# Check port
netstat -tlnp | grep -E "3001|443"

# Check firewall
sudo ufw status | grep 3001

# Test connectivity
curl -v https://researchflow.example.com
```

---

### Issue: WebSocket Connection Fails (Real-Time Collaboration)

**Symptoms**:
- Collaboration features not working
- "Cannot connect to collab service" error
- Other users' edits not appearing

**Diagnosis Steps**:
1. Check collab service:
   ```bash
   curl http://localhost:3002/health
   ```
2. Check WebSocket connection:
   ```bash
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:3002/
   ```
3. Check logs:
   ```bash
   docker logs -f collab
   ```
4. Check Redis:
   ```bash
   redis-cli PING
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Collab service not running** | Start: `docker start collab` |
| **WebSocket port not exposed** | Expose port 3002: `docker run -p 3002:3002` |
| **Firewall blocking WebSocket** | Allow port 3002: `ufw allow 3002` |
| **Redis not accessible** | Check Redis connection (see Redis issues) |
| **CORS issues** | Check CORS configuration in collab service |

**Next Steps**:
- Verify collab service is running: `docker ps | grep collab`
- Test WebSocket: `wscat -c ws://localhost:3002/`
- Check browser console for errors

---

## File and Storage Issues

### Issue: Cannot Upload Large Files

**Symptoms**:
- Upload hangs at certain percentage
- "Request payload too large" error
- File upload fails with timeout

**Diagnosis Steps**:
1. Check file size limit:
   ```bash
   echo $FILE_UPLOAD_MAX_SIZE
   ```
2. Check disk space:
   ```bash
   df -h /data/
   ```
3. Check network:
   ```bash
   ping -c 4 8.8.8.8
   # Check bandwidth utilization
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **File too large** | Split file or increase limit: `export FILE_UPLOAD_MAX_SIZE=2000000000` (2GB) |
| **Disk full** | See [Insufficient Disk Space](#issue-insufficient-disk-space-during-export) |
| **Network timeout** | Increase timeout: `export UPLOAD_TIMEOUT_SECONDS=600` |
| **Request size limit in nginx** | Increase in nginx.conf: `client_max_body_size 2g` |
| **Browser limit** | Use different browser or upload from server directly |

**Next Steps**:
- Split large file into chunks
- Upload over stable connection
- Use API upload with chunking: `POST /api/upload/chunk`

---

### Issue: Files Not Accessible After Upload

**Symptoms**:
- File uploaded successfully but can't download
- "File not found" error
- Artifacts directory not accessible

**Diagnosis Steps**:
1. Check if file exists:
   ```bash
   ls -la /data/artifacts/projectId/
   ```
2. Check permissions:
   ```bash
   stat /data/artifacts/projectId/filename
   ```
3. Check database record:
   ```bash
   psql -c "SELECT * FROM artifacts WHERE id='..'"
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **File not found** | Check database for artifact record |
| **Permission denied** | Fix permissions: `chmod 644 /data/artifacts/*` |
| **Wrong path** | Verify ARTIFACT_PATH environment variable |
| **File deleted** | Restore from backup if available |
| **Storage unmounted** | Check: `df -h` and remount if needed |

**Next Steps**:
- Verify file in database: `SELECT filename, path, created_at FROM artifacts`
- Check actual path: `find /data/ -name filename`
- Review upload logs for errors

---

## Collaboration and Real-Time Features

### Issue: Collaborative Editing Not Syncing

**Symptoms**:
- Multiple users can edit same document
- Changes from other users not appearing
- Document reverts after refresh
- Merge conflicts

**Diagnosis Steps**:
1. Check collab service logs:
   ```bash
   docker logs -f collab | grep -i "error\|sync"
   ```
2. Check Redis Y.js documents:
   ```bash
   redis-cli KEYS "y:*" | head -5
   redis-cli GET "y:docId"
   ```
3. Check for document locks:
   ```bash
   redis-cli HGETALL "doc:locks"
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Connection lost** | Reconnect: Refresh page or re-open document |
| **Redis data corrupted** | Flush and reload: `redis-cli DEL y:*` (will lose edits) |
| **CRDT conflict** | System auto-merges; if broken, restore from version history |
| **Document locked** | Admin can unlock: `redis-cli HDEL doc:locks docId` |
| **Collab service crashed** | Restart: `docker restart collab` |
| **Network partition** | Ensure all users on same network |

**Next Steps**:
- Reload document from version history if needed
- Check Y.js library version compatibility
- Review merge logs: `grep -i "merge\|conflict" /data/logs/collab.log`

---

### Issue: Presence Indicators Not Showing

**Symptoms**:
- Don't see other users' cursors
- "Active users" list empty
- Presence updates delayed

**Diagnosis Steps**:
1. Check presence tracking:
   ```bash
   redis-cli HGETALL "presence:docId"
   ```
2. Check WebSocket connections:
   ```bash
   netstat -tnp | grep 3002
   ```
3. Check logs for connection events:
   ```bash
   grep -i "presence\|connect" /data/logs/collab.log
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Presence feature disabled** | Enable: `export FEATURE_PRESENCE=true` |
| **WebSocket disconnected** | Refresh page or check network |
| **Redis issue** | See Redis troubleshooting section |
| **High latency** | Check network; presence updates may be delayed |

**Next Steps**:
- Reload document
- Check browser console for WebSocket errors
- Verify collab service health

---

## Analysis and Job Failures

### Issue: Analysis Produces Wrong Results

**Symptoms**:
- Statistics don't match manual calculations
- Figures look incorrect
- p-values seem wrong

**Diagnosis Steps**:
1. Check data:
   - Were correct variables selected?
   - Is data properly formatted?
   - Missing values handled correctly?
2. Check parameters:
   - Significance level (alpha)
   - Test type (parametric vs non-parametric)
   - Assumptions checked?
3. Check worker logs:
   ```bash
   grep -i "analysis\|error" /data/logs/worker.log
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Wrong variables selected** | Re-run with correct variable mapping |
| **Data quality issues** | Clean data: remove duplicates, handle missing values |
| **Wrong test type** | Check assumptions; select appropriate test |
| **Rounding differences** | Small differences expected; check significant figures |
| **Computational error** | Check if result exceeds precision limits |

**Next Steps**:
- Validate with known dataset
- Compare with standard statistical software (R, Python)
- Review methodology with statistician

---

### Issue: Worker Process Crashes During Analysis

**Symptoms**:
- Job starts then fails with "WORKER_ERROR"
- Worker pod restarts repeatedly
- Analysis never completes

**Diagnosis Steps**:
1. Check worker logs:
   ```bash
   tail -f /data/logs/worker.log | grep -i "error\|crash"
   ```
2. Check for memory issues:
   ```bash
   docker stats worker  # Watch memory usage
   ```
3. Check for Python errors:
   ```bash
   python -m py_compile /app/src/workflow.py
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Out of memory** | Increase memory limit or process smaller datasets |
| **Python version conflict** | Verify Python 3.10+; rebuild image |
| **Missing dependency** | Install: `pip install -r requirements.txt` |
| **Unhandled exception** | Check worker logs; review analysis code |
| **Timeout** | Increase: `export JOB_TIMEOUT_SECONDS=3600` |

**Next Steps**:
- Check system memory: `free -h`
- Review worker container memory limit: `docker inspect worker | grep -i memory`
- Enable debug logging: `export LOG_LEVEL=debug`

---

### Issue: "Invalid Data Format" During Analysis

**Symptoms**:
- Analysis won't start
- "Pandera validation failed" error
- Column type mismatch

**Diagnosis Steps**:
1. Check data schema:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/datasets/{datasetId}/schema
   ```
2. View data preview:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/datasets/{datasetId}/preview
   ```
3. Check validation errors:
   ```bash
   grep -i "pandera\|validation" /data/logs/worker.log
   ```

**Solutions**:

| Issue | Solution |
|-------|----------|
| **Wrong column type** | Update type: Set column as numeric, categorical, etc. |
| **Missing required field** | Add missing column or make field optional |
| **Invalid data in column** | Clean data: remove non-numeric from numeric column |
| **Encoding issue** | Re-upload with UTF-8 encoding |
| **Schema outdated** | Refresh schema: Upload data again |

**Next Steps**:
- Review data preview for obvious issues
- Validate data file with online CSV validator
- Check for special characters or encoding issues

---

## General Debugging Tips

### Enable Debug Logging

```bash
# For Orchestrator
export LOG_LEVEL=debug
docker restart orchestrator

# For Worker
export LOG_LEVEL=debug
docker restart worker

# Check logs
docker logs -f orchestrator | grep -i error
docker logs -f worker | tail -100
```

### Collect Diagnostic Information

When reporting issues, collect:

```bash
# System info
uname -a
df -h
free -h

# Service status
docker ps -a
curl http://localhost:3001/health
curl http://localhost:8000/health

# Database status
psql -c "SELECT version()"
psql -c "SELECT count(*) FROM pg_stat_activity"

# Recent errors
tail -100 /data/logs/*.log | grep -i error
```

### Common Solutions

1. **Service not responding**: Restart it
   ```bash
   docker restart service_name
   ```

2. **Permission errors**: Fix permissions
   ```bash
   sudo chown -R app:app /data/
   sudo chmod -R 755 /data/
   ```

3. **Cache issues**: Clear cache
   ```bash
   redis-cli FLUSHDB
   ```

4. **Database issues**: Check and fix
   ```bash
   psql -c "VACUUM ANALYZE"
   ```

5. **Need to restart everything**:
   ```bash
   docker-compose restart
   # or
   docker restart orchestrator worker collab postgres redis
   ```

---

## Getting Help

### When to Contact Support

Contact support@researchflow.io if you:
- Have tried basic troubleshooting
- Need help interpreting errors
- Found a bug
- Have a security concern

### Information to Include

1. **Error Message**: Exact error text
2. **Steps to Reproduce**: How to make it happen again
3. **System Info**: OS, browser, ResearchFlow version
4. **Logs**: Relevant log excerpts (sanitize sensitive data)
5. **Impact**: How many users affected, severity

### Where to Find Help

- **Documentation**: docs.researchflow.io
- **Knowledge Base**: kb.researchflow.io
- **Community Forum**: community.researchflow.io
- **Email**: support@researchflow.io
- **Chat**: Available during business hours

---

For architecture details, see [Architecture Overview](./ARCHITECTURE_OVERVIEW.md)

For deployment help, see [Deployment Guide](./DEPLOYMENT.md)

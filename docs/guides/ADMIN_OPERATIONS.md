# ResearchFlow Admin Operations Guide

> **Comprehensive administration and operational guide for ResearchFlow system administrators**
> Last Updated: 2026-01-28 | Version: 1.0

## Table of Contents

1. [Admin Dashboard Overview](#admin-dashboard-overview)
2. [User Management](#user-management)
3. [Role Assignments](#role-assignments)
4. [System Health Monitoring](#system-health-monitoring)
5. [Audit Logs and Access Control](#audit-logs-and-access-control)
6. [Governance Management](#governance-management)
7. [Backup and Restore Procedures](#backup-and-restore-procedures)
8. [System Configuration](#system-configuration)
9. [Troubleshooting](#troubleshooting)

---

## Admin Dashboard Overview

### Accessing the Admin Panel

1. Log in as an ADMIN user
2. Click your profile icon (top-right)
3. Select **"Admin Panel"** or **"System Administration"**
4. You'll see the Admin Dashboard with key metrics

### Dashboard Components

The Admin Dashboard displays:

- **System Status**: Green/yellow/red indicator of overall system health
- **Active Users**: Number of currently logged-in users
- **Projects**: Total projects, active projects, archived projects
- **Storage Usage**: Current storage utilization percentage
- **Governance Queue**: Number of pending governance reviews
- **Recent Activities**: Latest system events and user actions
- **Alerts**: Critical system issues requiring attention

### Quick Actions

From the dashboard, you can:

- **New User**: Add a new user account (Admin, Steward, Researcher, Viewer)
- **View Audit Logs**: Access complete activity logs
- **System Settings**: Configure system-wide parameters
- **Backup Now**: Trigger an immediate backup
- **View Health**: Check service status and uptime

---

## User Management

### Adding Users

#### Manual User Creation

1. From Admin Panel, click **"User Management"** → **"Add User"**
2. Fill in user details:
   - **Email Address**: Institutional email (required, must be unique)
   - **First Name**: User's first name
   - **Last Name**: User's last name
   - **Role**: VIEWER, RESEARCHER, STEWARD, or ADMIN
   - **Organization/Department**: For institutional categorization
   - **Title/Position**: User's job title
3. Configure access:
   - **Projects**: Pre-assign to specific projects (optional)
   - **Team**: Add to teams (optional)
4. Click **"Create User"**
5. User will receive an email with account activation link
6. They must set their password via the activation email

#### Bulk User Import

For importing multiple users:

1. Click **"User Management"** → **"Bulk Import"**
2. Download the **CSV Template**
3. Fill in the template with user information:
   ```csv
   Email,FirstName,LastName,Role,Department,ActivationEmail
   john.doe@hospital.org,John,Doe,RESEARCHER,Cardiology,yes
   jane.smith@hospital.org,Jane,Smith,STEWARD,Compliance,yes
   ```
4. Upload the CSV file
5. Review the preview
6. Click **"Import Users"**
7. Activation emails will be sent automatically

### Modifying User Accounts

1. From **"User Management"**, find and click the user
2. Edit fields:
   - **Name**: Update name information
   - **Email**: Change email address (will trigger reverification)
   - **Department**: Update organizational assignment
   - **Status**: Active, inactive, or suspended
3. Click **"Save Changes"**

### Deactivating or Removing Users

#### Deactivate (Temporary Disable)
1. Go to User Management
2. Select the user
3. Click **"Deactivate"**
4. User cannot log in but data/access remains intact
5. Can be reactivated later

#### Remove (Permanent Delete)
1. Go to User Management
2. Select the user
3. Click **"Remove User"**
4. Confirm the action (irreversible)
5. User's personal data is deleted per GDPR/compliance policies
6. Project ownership is transferred to admins
7. Audit records retained for compliance

### Resetting User Passwords

If a user is locked out:

1. Go to User Management
2. Select the user
3. Click **"Send Password Reset"**
4. User will receive password reset email
5. They can set a new password via the email link

### User Status and Activity

#### Viewing User Activity
1. Click **"User Management"** → Select a user
2. View tabs:
   - **Profile**: Basic user information
   - **Activity**: Recent logins, actions, resource access
   - **Projects**: Assigned projects and roles
   - **Devices**: Connected devices and sessions
   - **Audit Trail**: Detailed action history

#### Session Management
1. From user profile, scroll to **"Active Sessions"**
2. View current login sessions:
   - Browser type and version
   - IP address and location
   - Login time
   - Last activity
3. Click **"Revoke Session"** to force logout on that device

---

## Role Assignments

### Understanding Roles

| Role | PHI Access | Governance Approval | Admin Functions | Project Management |
|------|-----------|-------------------|-----------------|-------------------|
| **VIEWER** | Read-only (logged) | No | No | No |
| **RESEARCHER** | Full | No | No | Yes |
| **STEWARD** | Read + Audit | Yes (Approve) | No | Limited |
| **ADMIN** | Full | Yes | Yes | Yes |

### Assigning Roles to Users

#### Organization-Level Role
1. Go to **"User Management"** → Select user
2. Find **"Organization Role"**
3. Click **"Edit"**
4. Choose role: VIEWER, RESEARCHER, STEWARD, ADMIN
5. Click **"Update Role"**

#### Project-Level Role
1. Go to **"Projects"** → Select project
2. Click **"Settings"** → **"Team"**
3. Find user in the member list
4. Click the role dropdown next to their name
5. Select new role: EDITOR, VIEWER, STEWARD
6. Click **"Save"**

#### Changing Multiple Users' Roles

1. Go to **"User Management"**
2. Use checkboxes to select multiple users
3. Click **"Bulk Actions"** → **"Change Role"**
4. Select new role
5. Click **"Apply"**

### Role Delegation and Coverage

For continuity:

1. Go to **"User Management"** → **"Role Coverage"**
2. This shows:
   - Users with critical roles (ADMIN, STEWARD)
   - Whether coverage is adequate
   - Recommendations for delegation
3. To delegate:
   - Select user who should take on responsibilities
   - Choose specific permissions to delegate
   - Set start and end dates for delegation
   - Delegate will have all permissions of that role during the period

---

## System Health Monitoring

### System Status Dashboard

1. From Admin Panel, click **"System Status"** or **"Monitoring"**
2. View overall system health:
   - **System Status**: Operational, Degraded, Maintenance
   - **Uptime**: Percentage uptime over selected period
   - **Response Time**: Average API response time
   - **Error Rate**: Percentage of failed requests

### Service Status

View individual service status:

- **Orchestrator** (Node.js API):
  - Status: Running, Starting, Stopped, Error
  - CPU/Memory: Current utilization
  - Response Time: API latency
  - Request Volume: Requests per second

- **Worker** (Python Compute):
  - Status: Running, Starting, Stopped, Error
  - Queued Jobs: Number of pending analyses
  - Active Jobs: Currently processing
  - Success Rate: % of successful completions

- **Database** (PostgreSQL):
  - Status: Connected, Disconnected, Error
  - Connection Pool: Active/max connections
  - Query Performance: Average query time
  - Storage: Used/total space

- **Redis**:
  - Status: Connected, Disconnected, Error
  - Memory Usage: Used/max memory
  - Operations: Commands per second
  - Cache Hit Rate: % of cache hits

- **Collaboration Service** (Hocuspocus):
  - Status: Running, Stopped, Error
  - Connected Users: Active collaboration sessions
  - Document Count: Documents being edited

### Resource Monitoring

#### CPU and Memory
1. Click **"Resource Usage"**
2. View graphs for:
   - CPU usage by service
   - Memory usage by service
   - Disk I/O operations
3. Set alerts:
   - Click **"Set Alert"**
   - Define threshold (e.g., CPU > 80%)
   - Choose notification method (email, Slack, PagerDuty)

#### Disk Space
1. From **"System Status"**, find **"Storage"** section
2. View:
   - **Artifacts**: /data/artifacts usage
   - **Manifests**: /data/manifests usage
   - **Logs**: /data/logs usage
   - **Database**: PostgreSQL data directory
3. To clean up old files:
   - Click **"Storage Management"**
   - Select data type to clean
   - Choose retention policy (e.g., delete files > 30 days old)
   - Click **"Analyze"** to preview what will be deleted
   - Click **"Execute Cleanup"** to proceed

#### Network Monitoring
1. View network metrics:
   - Bandwidth usage (incoming/outgoing)
   - Connection latency to dependent services
   - DNS resolution times
   - SSL/TLS certificate status
2. Check API rate limiting:
   - Requests per user
   - Requests per IP
   - Bulk operation limits

### Performance Metrics

1. Click **"Performance"** from the monitoring menu
2. View metrics:
   - **API Response Time**: 50th, 95th, 99th percentile latencies
   - **Database Query Time**: Slow queries, indexing recommendations
   - **Job Processing Time**: Average time for analyses
   - **Cache Performance**: Hit rate, eviction rate

### Creating Alerts

1. Click **"Alerts"** → **"Create Alert"**
2. Configure:
   - **Metric**: Choose what to monitor
   - **Threshold**: When to trigger (e.g., CPU > 85%)
   - **Duration**: How long threshold must persist (e.g., 5 minutes)
   - **Severity**: Critical, High, Medium, Low
   - **Notification**: Email, Slack, PagerDuty, webhook
   - **Recipients**: Who should be notified
3. Click **"Save Alert"**

---

## Audit Logs and Access Control

### Accessing Audit Logs

1. From Admin Panel, click **"Audit Logs"**
2. View all recorded activities in chronological order
3. Each log entry contains:
   - **Timestamp**: When action occurred (ISO 8601 format)
   - **User**: Email/ID of user who performed action
   - **Action**: What was done (e.g., FILE_UPLOAD, DATA_EXPORT, USER_CREATED)
   - **Resource**: What was affected (project ID, dataset name, etc.)
   - **Status**: Success or failure
   - **Details**: Action-specific information
   - **IP Address**: Source IP of the request
   - **User Agent**: Browser/client information
   - **Entry Hash**: For chain integrity verification

### Filtering and Searching

1. Use filters to narrow results:
   - **Date Range**: Select start and end dates
   - **User**: Filter by specific users
   - **Action Type**: Filter by action (upload, export, delete, etc.)
   - **Resource**: Filter by project, dataset, manuscript
   - **Status**: Successful or failed operations only
   - **Severity**: Critical, high, medium, low impact actions
2. Use **"Search"** to find specific entries by:
   - Free text search
   - Resource ID
   - IP address
   - User email

### Analyzing Audit Data

1. Once filtered, you can:
   - **Export to CSV**: Download results for external analysis
   - **Download as PDF**: Generate compliance report
   - **View Details**: Click any entry to see full information
   - **View Chain**: See related actions (e.g., all actions in a project)

### Chain Integrity Verification

ResearchFlow uses cryptographic chaining to ensure audit logs cannot be tampered with:

1. Each audit entry contains a hash of the previous entry
2. To verify integrity:
   - Click **"Verify Chain"**
   - System will check the hash chain for breaks
   - Any tampering will be detected and reported
   - Results can be exported as compliance evidence

### Retention and Archival

1. Go to **"Audit Management"** → **"Retention Policy"**
2. Configure:
   - **Retention Period**: Default 365 days (configurable for compliance)
   - **Archive Method**: Where to archive old logs (S3, cold storage, etc.)
   - **Deletion Policy**: Whether to delete after archival
3. View current status:
   - **Current Size**: Total audit log size
   - **Entries**: Total number of audit records
   - **Coverage**: Oldest and newest entries
4. To export for archival:
   - Click **"Export Old Logs"**
   - Select date range
   - Choose format (JSON, CSV, or encrypted archive)
   - Click **"Export"** and download

### Access Control Audit

To audit who has access to what:

1. Click **"Access Control"** → **"Access Matrix"**
2. View a matrix of:
   - Users (rows) vs. Projects/Resources (columns)
   - Access level for each combination
   - Last access timestamp
   - Access change history
3. To review changes:
   - Click **"Access Change Log"**
   - See when permissions were modified and by whom
   - Find orphaned access (users who should no longer have access)

---

## Governance Management

### Governance Configuration

1. From Admin Panel, click **"Governance"** → **"Configuration"**
2. Set system governance mode:
   - **DEMO**: For testing and development (PHI redacted)
   - **LIVE**: For production (real PHI allowed with audit logging)
   - **STANDBY**: Maintenance mode (read-only, no processing)
3. Configure governance rules:
   - **PHI Scanning**: Enable/disable automatic PHI detection
   - **Required Approvals**: For what actions is approval required?
   - **Review Time SLA**: How long stewards have to review requests
   - **Auto-Escalation**: Escalate after timeout?

### Governance Review Queue

1. Click **"Governance"** → **"Review Queue"**
2. View pending requests:
   - **Request ID**: Unique identifier
   - **Type**: Data export, team access, PHI access, etc.
   - **Submitted By**: User who requested
   - **Submitted Date**: When request was made
   - **Status**: Pending, In Review, Approved, Rejected, Escalated
   - **SLA Status**: Green (within SLA) or Red (overdue)

3. To review a request:
   - Click the request
   - Read the request details:
     - What action is being requested?
     - What data is involved?
     - Who will have access?
     - Justification provided
   - Review supporting documentation
   - Make your decision:
     - **Approve**: Request is appropriate and authorized
     - **Conditional Approve**: Approve with modifications (e.g., restricted users)
     - **Request Info**: Ask for additional information
     - **Deny**: Request does not meet governance requirements
   - Add comments/explanation
   - Click **"Submit Decision"**

4. Applicant will be notified of your decision
5. If approved, their requested action will proceed
6. If denied, they can appeal or modify request

### Governance Policies and Rules

1. Go to **"Governance"** → **"Policies"**
2. Define policies for different scenarios:
   - When PHI data export requires steward approval
   - Who can access restricted datasets
   - When team member additions need governance review
   - Data retention and deletion policies
3. Each policy specifies:
   - **Condition**: When the policy applies
   - **Action**: What requires approval
   - **Approvers**: Who must approve
   - **SLA**: Time limit for decision
   - **Escalation**: Who to escalate to if overdue

### Escalation Management

When governance reviews are overdue:

1. Escalation triggers automatically based on SLA
2. You'll see **"Escalated Requests"** in the dashboard
3. To resolve an escalated request:
   - Click the request
   - Contact the assigned steward (if not assigned to you)
   - Make a decision (approve/deny)
   - If no steward is available, an admin can make the decision

### Governance Reporting

1. Click **"Governance"** → **"Reports"**
2. Generate reports on:
   - **Approval Rate**: % of approved vs. denied requests
   - **Review Time**: Average time to approval
   - **SLA Compliance**: % of reviews completed within SLA
   - **Trend Analysis**: How review volume changes over time
3. Export reports as PDF for compliance documentation

---

## Backup and Restore Procedures

### Backup Overview

ResearchFlow maintains multiple backup types:

| Type | Frequency | Retention | Location | RTO |
|------|-----------|-----------|----------|-----|
| **Hourly Incremental** | Every 1 hour | 7 days | Local/Cloud | 1 hour |
| **Daily Full** | Every 24 hours | 30 days | Cloud | 4 hours |
| **Weekly Archive** | Every 7 days | 90 days | Cold storage | 12 hours |
| **Monthly Snapshot** | Monthly | 12 months | Archive | 24 hours |

- **RTO** (Recovery Time Objective) = how long to restore from that backup

### Initiating a Manual Backup

1. From Admin Panel, click **"Backup & Restore"**
2. Click **"Backup Now"**
3. Choose what to backup:
   - **Full Backup**: Everything (database, artifacts, configs)
   - **Database Only**: PostgreSQL data
   - **Artifacts Only**: All files and analysis outputs
   - **Configuration**: System settings and feature flags
4. Enter a backup label (e.g., "Pre-Release-2026-01-28")
5. Click **"Start Backup"**
6. Monitor progress in the **"Backup Status"** section
7. Once complete, you can:
   - **Download**: Save locally for off-site storage
   - **Test Restore**: Verify backup integrity
   - **Delete**: Remove if no longer needed

### Backup Verification

1. Go to **"Backup & Restore"** → **"Backup History"**
2. For each backup, click **"Verify"**
3. System will:
   - Check file integrity (checksums)
   - Verify database consistency
   - Test restore to a temporary environment
   - Report any issues
4. **Healthy** backups show a green checkmark
5. **Degraded** backups show a warning (may have some data loss)

### Restoring from Backup

#### Planning a Restore

Before restoring, consider:
- How much data will be lost (since last backup)?
- Will services be unavailable during restore?
- Should you notify users before restoring?

#### Performing a Restore

1. Go to **"Backup & Restore"** → **"Restore"**
2. Select which backup to restore from
3. Choose restore scope:
   - **Full Restore**: Replace everything with backup
   - **Database Only**: Restore just database, keep artifacts
   - **Selective Restore**: Specific tables or projects
4. Review the impact:
   - Data as of: [timestamp]
   - What will be restored
   - What will be lost
5. Click **"Prepare Restore"**
6. System will:
   - Verify backup integrity
   - Check for compatibility issues
   - Create a temporary restore environment for testing
7. Once ready, click **"Execute Restore"**
8. Services will be taken offline
9. Restoration progress will be displayed
10. Services will restart once complete
11. Verify all systems are operational

#### Post-Restore Verification

After restoration:

1. Check that all services are running:
   - Click **"System Status"** to verify
2. Spot check data:
   - Log in and verify some projects exist
   - Check a few recent analyses
   - Verify users can log in
3. Check audit logs:
   - Confirm data is present up to restore point
   - Check for any error messages around restore time
4. Notify users:
   - Send email explaining restore
   - Inform them of data cutoff time
   - List any manual actions they need to take

### Disaster Recovery Plan

In case of complete system failure:

1. **Assess Damage**:
   - Which systems are down?
   - How much data is at risk?
   - How long have they been down?

2. **Activate Contingency**:
   - If main data center is down, activate failover
   - Use read replica of database if primary is corrupted
   - Restore from latest cloud backup

3. **Communication**:
   - Post status updates to status page
   - Email affected users with timeline
   - Provide interim access if available

4. **Recovery Steps**:
   - Restore from most recent verified backup
   - Verify data integrity
   - Bring services up gradually (database, then APIs)
   - Perform health checks
   - Open to users once verified

5. **Post-Recovery**:
   - Run full system diagnostics
   - Identify root cause of failure
   - Implement preventive measures
   - Document lessons learned

### Backup Storage

1. Go to **"Backup & Restore"** → **"Storage Configuration"**
2. Configure backup destinations:
   - **Local**: Store on application server
   - **S3**: Store in AWS S3 bucket
   - **Azure**: Store in Azure Blob Storage
   - **GCS**: Store in Google Cloud Storage
3. For each destination, set:
   - **Credentials**: Connection credentials
   - **Bucket/Path**: Where to store
   - **Encryption**: Enable encryption at rest
   - **Retention**: Auto-delete old backups
4. Test the connection
5. Click **"Save"**

---

## System Configuration

### Email Configuration

1. Go to **"System Settings"** → **"Email"**
2. Configure SMTP settings:
   - **SMTP Server**: mail.example.com
   - **Port**: 587 (TLS) or 465 (SSL)
   - **Username**: SMTP account username
   - **Password**: SMTP account password
   - **From Address**: noreply@researchflow.yourinstitution.org
   - **From Name**: ResearchFlow Alerts
3. Click **"Test Email"** to verify configuration
4. Test email will be sent to your current email address
5. Once verified, click **"Save"**

### API Key Management

1. Go to **"System Settings"** → **"API Keys"**
2. View existing keys:
   - **Key ID**: Unique identifier
   - **Created**: When the key was created
   - **Last Used**: Last time this key was used
   - **Permissions**: What this key can access
3. To create a new key:
   - Click **"Generate New Key"**
   - Name the key (e.g., "Integration with Epic EHR")
   - Select permissions
   - Set expiration (e.g., 90 days)
   - Click **"Generate"**
   - Copy the key and store securely (you won't see it again)
4. To rotate a key:
   - Click **"Rotate"** on the key
   - New key will be generated
   - Old key continues to work for 24 hours (grace period)
   - Update all integrations to use the new key
   - After grace period, old key stops working
5. To revoke a key:
   - Click **"Revoke"**
   - Confirm the action
   - Key stops working immediately

### Feature Flags

1. Go to **"System Settings"** → **"Feature Flags"**
2. View all feature flags:
   - **Flag Name**: Identifier
   - **Description**: What the feature does
   - **Status**: Enabled or Disabled
   - **Rollout**: Percentage of users with access (0-100%)
3. To enable a feature:
   - Find the flag
   - Click **"Enable"**
   - Set rollout percentage (e.g., 10% for gradual rollout)
   - Click **"Save"**
4. To disable a feature:
   - Find the flag
   - Click **"Disable"**
   - Confirm the action
5. Common flags:
   - `FEATURE_BATCH_PROCESSING`: Enable batch analysis
   - `FEATURE_VOICE_COMMANDS`: Enable voice input
   - `FEATURE_SEMANTIC_SEARCH`: Enable semantic search
   - `FEATURE_XR_PREVIEW`: Enable XR preview

### SSL/TLS Certificate Management

1. Go to **"System Settings"** → **"Security"** → **"Certificates"**
2. View current certificate:
   - **Subject**: Domain name
   - **Issuer**: Certificate authority
   - **Issued**: Start date
   - **Expires**: Expiration date
   - **Status**: Valid, Expiring Soon, Expired
3. To upload a new certificate:
   - Click **"Upload Certificate"**
   - Select certificate file (.pem or .crt)
   - Select private key file (.key)
   - Click **"Upload"**
   - Services will be restarted with new certificate
4. For automatic renewal:
   - Click **"Enable Auto-Renewal"**
   - If using Let's Encrypt, this is automatic
   - System will renew 30 days before expiration

### Maintenance Windows

1. Go to **"System Settings"** → **"Maintenance"**
2. Schedule maintenance:
   - Click **"Schedule Maintenance Window"**
   - Select date and time
   - Enter duration (e.g., 2 hours)
   - Add description (e.g., "Database schema upgrade")
3. During maintenance:
   - Users will see a maintenance banner
   - New analyses cannot be started
   - However, users can still view existing data
4. Notifications:
   - Users are emailed 24 hours before
   - Reminder 1 hour before
   - Notification when maintenance begins
   - Notification when complete

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: High CPU Usage

**Symptoms**: CPU usage consistently above 80%

**Diagnosis**:
1. Go to **"System Status"** → **"Performance"**
2. Identify which service is using CPU (Orchestrator, Worker, Database)

**Solutions**:
- **If Worker**: Too many concurrent analyses
  - Check **"Job Queue"** for stuck jobs
  - Cancel long-running jobs if needed
  - Increase worker resources (scale horizontally)
- **If Orchestrator**: High API traffic
  - Check for API abuse or bot traffic
  - Enable rate limiting if not already on
  - Scale orchestrator replicas
- **If Database**: Slow queries
  - Run **"Query Analyzer"** to find slow queries
  - Create indexes on frequently-queried columns
  - Consider query optimization

#### Issue: Out of Memory

**Symptoms**: Services crashing with out-of-memory errors

**Diagnosis**:
1. Go to **"System Status"** → **"Resource Usage"**
2. Check memory usage for each service

**Solutions**:
- Identify which service is using memory
- Check for memory leaks in worker processes
- Increase memory allocation to affected service
- Review and optimize large analyses
- Enable caching and data pagination

#### Issue: Database Connection Failures

**Symptoms**: Errors like "Could not connect to database" or "Connection pool exhausted"

**Diagnosis**:
1. Check **"System Status"** → **"Services"** → **"Database"**
2. Try: Click **"Test Connection"**

**Solutions**:
- **If connection refused**:
  - Verify database service is running
  - Check database credentials in environment variables
  - Verify network connectivity (firewall rules)
- **If connection pool exhausted**:
  - Increase `DATABASE_POOL_SIZE` in environment
  - Review long-running queries that hold connections
  - Implement connection pooling on application side

#### Issue: Slow API Responses

**Symptoms**: API requests taking longer than normal

**Diagnosis**:
1. Go to **"System Status"** → **"Performance"**
2. Check response time percentiles
3. Identify slow endpoints using **"API Performance"** breakdown

**Solutions**:
- Check database query performance (slow queries)
- Review API payload sizes (implement pagination)
- Check for external API calls (literature search, embeddings)
- Scale horizontally if all else is fine
- Review for cache misses

#### Issue: PHI Scanner Not Working

**Symptoms**: PHI not being detected/redacted when expected

**Diagnosis**:
1. Go to **"Monitoring"** → **"PHI Scanner Status"**
2. Check if scanner is running
3. Review recent PHI scan logs

**Solutions**:
- Restart PHI scanner service
- Check if patterns are up to date
- Test with known PHI patterns
- Review false negatives (submit examples for pattern improvement)
- Verify GOVERNANCE_MODE setting (should be LIVE to detect real PHI)

#### Issue: Users Cannot Log In

**Symptoms**: "Authentication failed" or "Invalid credentials" errors

**Diagnosis**:
1. Check if user account exists: **"User Management"** → search for user
2. Check user status: Active, Suspended, Inactive
3. Check user's MFA status

**Solutions**:
- **If account not found**: Create account for user
- **If account suspended**: Check audit logs for why
  - May be due to too many failed login attempts
  - Click **"Unsuspend"** to reactivate
- **If MFA issues**:
  - User can click "Can't access your authenticator?" during login
  - Send password reset which disables MFA temporarily
  - User must reconfigure MFA after password reset
- **If all else fails**: Reset password and send user new password reset link

#### Issue: Storage Running Out

**Symptoms**: "Storage quota exceeded" errors or disk full warnings

**Diagnosis**:
1. Go to **"System Status"** → **"Storage"**
2. See what's using space (artifacts, logs, database)

**Solutions**:
- **Clean up old artifacts**: Delete projects no longer needed
- **Archive old logs**: Move logs to cold storage
- **Compress data**: Archive old datasets
- **Increase storage**: Add new storage volume or expand cloud storage
- **Implement retention policies**: Auto-delete old data

#### Issue: Job Queue Backing Up

**Symptoms**: Analysis jobs waiting long time before starting

**Diagnosis**:
1. Go to **"Monitoring"** → **"Job Queue"**
2. See how many jobs are queued
3. Check worker utilization

**Solutions**:
- **If queue growing**: Workers are overwhelmed
  - Increase number of worker replicas
  - Prioritize high-priority jobs (canceling low-priority)
  - Optimize job processing (split into smaller jobs)
- **If workers idle**: Job submission issue
  - Check if orchestrator is healthy
  - Restart orchestrator service
  - Check API logs for errors

#### Issue: Governance Reviews Not Appearing

**Symptoms**: Governance reviews submitted but don't appear in review queue

**Diagnosis**:
1. Check **"Governance"** → **"Review Queue"**
2. Search for the specific review
3. Check if it's in a different status (Approved, Denied)

**Solutions**:
- Review may have been auto-approved (check settings)
- Check if you have permission to see review
- Try filtering with different criteria
- Check audit logs for when review was submitted

#### Issue: Backup Failures

**Symptoms**: "Backup failed" notifications

**Diagnosis**:
1. Go to **"Backup & Restore"** → **"Backup History"**
2. Click on failed backup to see error message

**Solutions**:
- **If storage full**: Delete old backups or increase storage
- **If permission denied**: Check backup destination credentials
- **If database locked**: Wait for any running operations to complete
- **If network timeout**: Check connectivity to backup destination
- **If credential expired**: Update credentials in configuration

#### Issue: SSL Certificate Expiring Soon

**Symptoms**: Security warnings or "Certificate expiring" alert

**Diagnosis**:
1. Go to **"System Settings"** → **"Security"** → **"Certificates"**
2. Check expiration date

**Solutions**:
- If auto-renewal is enabled, no action needed
- If manual renewal:
  - Obtain new certificate from CA
  - Upload to system (instructions above)
  - Verify HTTPS works after upload
- If using Let's Encrypt:
  - Ensure renewal service is running
  - Check logs for renewal errors

---

## Best Practices

1. **Regular Backups**: Run backups at least daily
2. **Monitor Health**: Check system status dashboard weekly
3. **Audit Reviews**: Review audit logs monthly for suspicious activity
4. **User Cleanup**: Periodically deactivate/remove unused accounts
5. **Certificate Management**: Don't wait until last minute to renew SSL certs
6. **Test Restores**: Periodically test backup restores to ensure they work
7. **Documentation**: Keep notes on configuration changes
8. **Communication**: Use maintenance windows to inform users
9. **Security Updates**: Apply security patches promptly
10. **Governance Compliance**: Ensure all required governance reviews are being processed

---

## Support and Escalation

### Getting Help

- **Documentation**: /docs/admin/
- **Email Support**: admin-support@researchflow.io
- **Escalation**: If critical issue, contact system vendor

### Information to Provide When Reporting Issues

1. **System Version**: Can be found in System Status
2. **Affected Service**: Orchestrator, Worker, Database, etc.
3. **Error Messages**: Exact error text
4. **Reproduce Steps**: How to reproduce the issue
5. **Impact**: How many users affected, critical/non-critical
6. **Logs**: Relevant error logs (can attach from admin panel)
7. **Recent Changes**: Any changes made before issue started

---

For detailed API documentation, see [REST API Guide](../api/README.md)

For deployment and infrastructure details, see [Deployment Guide](../DEPLOYMENT.md)

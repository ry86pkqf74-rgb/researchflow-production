# ResearchFlow HIPAA Compliance Attestation

> **DRAFT - REQUIRES COMPLIANCE TEAM REVIEW AND APPROVAL**
>
> This document attests to ResearchFlow's compliance with HIPAA Security Rule and Privacy Rule requirements.
>
> **Last Updated**: 2026-01-28
> **Version**: 1.0 (DRAFT)
> **Status**: AWAITING COMPLIANCE REVIEW
> **Compliance Review Date**: [TBD]

---

## Executive Summary

ResearchFlow is a cloud-based research data analysis and manuscript management platform designed to handle Protected Health Information (PHI) in compliance with the Health Insurance Portability and Accountability Act (HIPAA). This attestation document details the technical, administrative, and physical safeguards implemented to protect PHI and comply with HIPAA requirements.

**Key Compliance Areas Covered**:
- Technical safeguards (encryption, access controls, audit logging)
- Administrative safeguards (policies, training, workforce management)
- Physical safeguards (data center security, device management)
- Business Associate Agreement (BAA) requirements
- Breach notification procedures
- Audit and monitoring capabilities

---

## 1. Technical Safeguards

Technical safeguards are technology-based measures to protect PHI and control access to it.

### 1.1 Access Controls

#### Authentication
- **Method**: Multi-factor authentication (MFA) using TOTP (Time-based One-Time Password)
- **Implementation**:
  - JWT tokens for API authentication
  - Session tokens stored in encrypted Redis
  - Token expiration: Configurable (default 24 hours)
  - Token revocation: Immediate upon logout or admin action
- **Enforcement**: All API endpoints require valid authentication token
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(a)(2)(i)

#### Authorization
- **Method**: Role-Based Access Control (RBAC)
- **Roles**:
  - VIEWER: Read-only access to assigned projects (logged)
  - RESEARCHER: Full project access and analysis capabilities
  - STEWARD: Governance oversight and compliance enforcement
  - ADMIN: Full system administration
- **Enforcement**: Every request is validated against user's assigned roles and resource permissions
- **Granularity**: Project-level, dataset-level, and artifact-level permissions
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(a)(2)(ii)

#### Audit Controls
- **Logging**: All access to PHI is logged with:
  - Timestamp (ISO 8601 format with timezone)
  - User ID and email
  - Action performed (download, view, export, analyze)
  - Resource accessed (dataset ID, project ID)
  - IP address and user agent
  - Result (success/failure)
- **Retention**: Audit logs retained for minimum 6 years (configurable)
- **Protection**: Logs stored in read-only mode after 24 hours
- **Tamper Detection**: Cryptographic chaining ensures logs cannot be modified
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(b)

#### Integrity Controls
- **Checksums**: MD5 or SHA-256 checksums for data integrity verification
- **Digital Signatures**: Optional for sensitive exports
- **Version Control**: Full version history of all documents with change tracking
- **Data Validation**: Pandera schema validation for imported data
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(c)(1)

### 1.2 Encryption

#### Encryption in Transit
- **Protocol**: HTTPS/TLS 1.2 or higher
- **Cipher Suites**: Strong ciphers only (no legacy ciphers)
- **Certificate**: Valid SSL/TLS certificate from trusted CA
- **Verification**: Certificate validation enforced on all client connections
- **API Communication**: All inter-service communication encrypted (Docker TLS or within VPC)
- **WebSocket**: WSS (WebSocket Secure) for real-time collaboration
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(e)(1)

#### Encryption at Rest
- **Database**: PostgreSQL with native encryption or encrypted filesystem
- **Encryption Key**: FIPS 140-2 compliant key management
- **Key Rotation**: Quarterly key rotation (configurable)
- **Backups**: All backups encrypted with AES-256
- **Artifacts**: Artifacts stored in /data/artifacts with filesystem encryption
- **Configuration**: Sensitive configuration values encrypted at rest
- **Storage**: S3 server-side encryption (SSE-S3 or SSE-KMS)
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(e)(2)(ii)

#### Key Management
- **Key Storage**: Not stored in code or configuration files
- **Key Generation**: Cryptographically secure random generation
- **Key Distribution**: Via environment variables or secure key management system
- **Key Rotation**: Automated quarterly rotation with grace period
- **Access Control**: Only authorized personnel can access keys
- **Backup Keys**: Encrypted and stored separately
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(e)(2)(i)

### 1.3 PHI Protection and Detection

#### PHI Identification
- **Detection Method**: Multi-stage approach:
  1. Regular expression patterns for common PHI (SSN, MRN, dates)
  2. Machine learning models for contextual PHI (names, addresses)
  3. Manual review and custom patterns
- **Patterns Updated**: Quarterly or as needed
- **False Positive Rate**: < 2% (acceptable threshold)
- **False Negative Rate**: < 1% (critical - regularly audited)
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(a)(2)(i)

#### PHI Handling
- **In DEMO Mode**:
  - PHI automatically redacted with [PHI-REDACTED] placeholder
  - Original data not stored
  - No PHI in logs, errors, or API responses
  - Safe for training and demonstrations
- **In LIVE Mode**:
  - PHI allowed and encrypted
  - All PHI access logged with full audit trail
  - Governance reviews required for PHI data export
  - PHI never sent to external AI services
- **Scanning Points**:
  - File upload: Before data enters system
  - AI routing: Before sending to language models
  - Export: Before downloading PHI-containing results
  - Collaboration: Real-time scanning of document edits
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(a)(2)(i)

#### PHI Scrubbing
- **Automated Scrubbing**: Identified PHI can be automatically removed
- **Partial Scrubbing**: Configurable what gets removed (e.g., keep year but remove exact date)
- **De-identification**: Supports HIPAA Safe Harbor method
- **Audit Trail**: Scrubbing actions logged
- **Compliance**: Supports HIPAA requirement 45 CFR § 164.502(b)

### 1.4 Communication Security

#### Network Security
- **Firewalls**: All services protected by enterprise firewalls
- **Network Segmentation**: Services in separate VPC with restricted ingress/egress
- **API Gateway**: Rate limiting and bot detection
- **DDoS Protection**: Cloudflare or AWS Shield
- **VPN**: Required for admin access to non-prod environments
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(e)(1)

#### Secure Communications
- **Between Services**: TLS or within private Docker network
- **Database Connections**: SSL/TLS with certificate validation
- **Redis Connections**: AUTH and TLS encryption
- **Email**: TLS for all mail transport
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.312(e)(1)

---

## 2. Administrative Safeguards

Administrative safeguards are administrative actions, policies, and procedures to manage the selection, development, implementation, and maintenance of security measures.

### 2.1 Workforce Authorization

#### Access Management
- **Role Assignment**: Documented assignment of roles based on job functions
- **Minimum Necessary**: Users only granted access needed for their job
- **Segregation of Duties**: Approval authority separated from requesters
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(3)(ii)

#### Termination Procedures
- **Offboarding Checklist**: When user is terminated:
  - Disable all accounts within 1 business day
  - Revoke all active sessions immediately
  - Remove from all projects and teams
  - Audit logs preserved for retention period
  - Equipment returned and securely wiped
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(3)(ii)(C)

#### Authorization Review
- **Frequency**: Quarterly review of user access
- **Process**:
  1. Export user access matrix
  2. Managers review their team's access
  3. Managers certify access is appropriate
  4. Discrepancies corrected within 2 weeks
  5. Documentation filed for audit
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(4)(ii)

### 2.2 Information and Access Management

#### Information Access Policies
- **Documented Policies**: Written policies on:
  - Who can access what data
  - When access is appropriate
  - How long access is retained
  - What must be audited
- **Regular Review**: Policies reviewed and updated annually
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(4)(i)

#### Access Authorization Records
- **Documentation**: All access grants documented with:
  - User name and ID
  - Date of authorization
  - Type of access granted
  - Duration of access
  - Authorizer name and signature
- **Storage**: Centralized in access management system
- **Retention**: 6 years or longer per institutional policy
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(4)(ii)

### 2.3 Security Awareness and Training

#### Initial Training
- **Content**: All workforce members receive:
  - HIPAA privacy and security requirements
  - PHI identification and protection
  - ResearchFlow policies and procedures
  - Password management and MFA
  - Incident response procedures
  - Acceptable use policy
- **Timing**: Before account creation and access grant
- **Documentation**: Training completion certified and documented
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(5)(i)

#### Annual Refresher
- **Frequency**: At least annually
- **Content**: Updated training covering:
  - New features or policy changes
  - Recent security incidents (anonymized)
  - Best practices reminders
  - Updates to threat landscape
- **Tracking**: Training completion tracked and reported
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(5)(i)

#### Role-Specific Training
- **Stewards**: Governance review procedures, HIPAA compliance
- **Admins**: Security management, incident response, backup/restore
- **Researchers**: PHI handling, data export procedures
- **All Users**: Acceptable use, password security
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(5)(i)

### 2.4 Security Incident Procedures

#### Incident Detection
- **Monitoring**: 24/7 automated monitoring of:
  - Failed login attempts
  - Unusual access patterns
  - Data export anomalies
  - System errors and failures
- **Alerting**: Real-time alerts for suspicious activities
- **Response**: Investigations begin within 1 hour of alert

#### Incident Investigation
- **Process**:
  1. Initial assessment: What happened? Who was affected? Is it ongoing?
  2. Containment: Stop the incident (revoke access, kill processes, etc.)
  3. Investigation: Determine scope and cause from audit logs
  4. Remediation: Fix technical issue and restore security
  5. Notification: Notify affected parties if required
  6. Documentation: Complete incident report
- **Timeline**: Initial response within 1 hour, resolution within 24 hours when possible
- **Root Cause Analysis**: Conducted for all significant incidents
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(6)

#### Breach Assessment
- **Definition**: Unauthorized acquisition, access, use, or disclosure of PHI
- **Assessment Criteria**:
  - Was the information encrypted? (if yes, likely not breach)
  - Was the person authorized to access? (if yes, likely not breach)
  - Was the information actually acquired or viewed?
  - What is risk of harm?
- **Documentation**: Assessment recorded with conclusion and rationale
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.404

### 2.5 Contingency Planning

#### Backup Procedures
- **Frequency**: Hourly incremental, daily full backups
- **Retention**:
  - Hourly: 7 days
  - Daily: 30 days
  - Weekly: 90 days
  - Monthly: 12 months
- **Validation**: Backups tested monthly for restorability
- **Documentation**: Backup schedule and retention policy documented
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(7)(i)

#### Recovery Plan
- **Disaster Recovery**: Plan addresses:
  - Total system failure recovery
  - Partial data loss recovery
  - Communication outage recovery
  - Workforce unavailability recovery
- **Recovery Objectives**:
  - RTO (Recovery Time Objective): 4 hours
  - RPO (Recovery Point Objective): 1 hour
- **Testing**: Plan tested annually with documented results
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(a)(7)(ii)

### 2.6 Business Associate Management

#### BAA Requirements
- **Required**: Business Associate Agreement must be executed before:
  - Service begins
  - PHI is accessed
  - Any integration with third parties
- **Subcontractors**: BAAs required for any subcontractors
- **Monitoring**: Business associates monitored for compliance
- **Termination Clause**: BAA includes termination procedures and data return/destruction
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.308(b)

---

## 3. Physical Safeguards

Physical safeguards are physical measures, policies, and procedures to protect information systems and related buildings and equipment, from natural and environmental hazards and unauthorized intrusion.

### 3.1 Facility Access Control

#### Data Center Selection
- **Location**: HIPAA-compliant data center with:
  - SOC 2 Type II certification
  - ISO 27001 certification
  - 24/7 physical security
  - Multi-factor badge access
  - Security cameras and audit logs
  - Controlled climate and fire protection
- **Options**:
  - AWS (with Business Associate Agreement)
  - Azure (with Business Associate Agreement)
  - Google Cloud (with Business Associate Agreement)
  - On-premises (with equivalent security)
- **Documentation**: Data center security certifications maintained

#### Facility Access Restrictions
- **Workforce Access**:
  - Only authorized IT personnel can access servers
  - Access logged and monitored
  - Terminated employees access revoked immediately
  - Visitors accompanied by authorized personnel
- **Equipment Room**:
  - Locked server room with badge access
  - Restricted to essential personnel only
  - All access logged
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.310(a)(1)

#### Workstation Use Policies
- **Authorized Use**: Documented policy on:
  - What workstations can access PHI
  - Physical location requirements
  - Monitoring and auditing
  - Encryption requirements
  - Acceptable uses
  - Prohibited uses
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.310(b)

#### Workstation Security
- **Remote Access**: VPN required for any off-network access
- **Full Disk Encryption**: All laptops and mobile devices have encrypted storage
- **Screen Locks**: Automatic lock after 5 minutes of inactivity
- **Password Protection**: Strong password policy enforced
- **Software Updates**: Security patches applied promptly
- **Antivirus**: Endpoint security software required
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.310(c)

### 3.2 Device and Media Controls

#### Device Management
- **Inventory**: All devices that access PHI tracked in inventory
- **Assignment**: Devices assigned to specific users
- **Labeling**: Devices labeled as "Contains Protected Data"
- **Monitoring**: Mobile device management (MDM) for company devices
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.310(d)(1)

#### Media Controls
- **Handling**: Procedures for proper handling of media:
  - Physical storage in locked cabinets
  - Labeled with classification level
  - Access logged
- **Reuse**: Media containing PHI cannot be reused
- **Destruction**: Data destruction procedure:
  - Degaussing (magnetic erasure)
  - Physical destruction (shredding)
  - Verified by third party
  - Documentation retained
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.310(d)(2)

#### Removal of Hardware and Software
- **Procedure**: Before removing from facility:
  - All PHI must be destroyed or encrypted
  - Data destruction verified
  - Approval from security officer required
  - Documentation completed
- **Compliance**: Meets HIPAA requirement 45 CFR § 164.310(d)(2)(ii)

---

## 4. PHI Handling Procedures

### 4.1 Data Upload
- **Process**:
  1. User selects file(s) to upload
  2. System scans for PHI (automatic)
  3. If PHI detected:
     - In DEMO mode: Automatically redacted
     - In LIVE mode: Governance review required
  4. User confirms data looks correct
  5. Data encrypted and stored
- **Audit Log**: Upload recorded with file name, size, user, timestamp
- **No PHI in Errors**: Error messages never reveal PHI content

### 4.2 Data Analysis
- **Secure Execution**: Analyses run on isolated worker processes
- **No PHI to AI**: Original PHI never sent to external AI services
- **De-identification**: Analyses performed on de-identified data when possible
- **Output Scanning**: Results scanned for PHI before display
- **Audit**: Analysis request, parameters, and results logged

### 4.3 Data Export
- **Governance Review**: May require steward approval
- **Scanning**: Exported data scanned for PHI
- **Redaction**: In DEMO mode, PHI automatically redacted
- **Audit**: Export logged with user, destination, timestamp
- **No Unencrypted Export**: All exports are encrypted by default

### 4.4 Secure Deletion
- **On Request**: User can request permanent deletion
- **Process**:
  1. Data marked for deletion
  2. Soft delete (7-day grace period)
  3. After 7 days, cryptographic erasure
  4. Deletion verified
- **Audit**: Deletion logged
- **Residual**: Audit logs retained per retention policy

---

## 5. Breach Notification Procedures

### 5.1 Breach Detection
- **Monitoring**: Continuous automated monitoring for:
  - Unauthorized access patterns
  - Large data downloads
  - Unusual locations or times
  - Failed security controls
- **Manual Review**: Alerts reviewed by security team within 1 hour
- **Investigation**: Assessment whether a breach occurred

### 5.2 Breach Assessment
- **Four-Factor Analysis**:
  1. **Nature and Scope**: How much PHI, what kind (SSN, medical records, etc.)
  2. **Unauthorized Access**: Was access actually unauthorized?
  3. **Acquisition or View**: Was PHI actually acquired or just accessed?
  4. **Risk of Harm**: What is the realistic risk of harm to individuals?
- **Exception**: No breach if:
  - PHI is encrypted and encryption key is secure
  - OR person lacks means to decrypt
  - OR de-identified per HIPAA standard
- **Documentation**: Assessment documented with conclusion and rationale

### 5.3 Notification Timeline
- **To Individuals**:
  - Notify within 60 calendar days
  - Method: Email or mail (per HIPAA requirement)
  - Content: What happened, what info was involved, steps to take
- **To Media**: If more than 500 residents of state affected
  - Notify without unreasonable delay
  - Content: Description, steps individuals should take
- **To Secretary of HHS**:
  - If breach of 500+ individuals: Notify at same time as media
  - If breach of <500 individuals: Notify annually
  - Method: Use HHS breach notification portal

### 5.4 Investigation and Remediation
- **Root Cause Analysis**: Determine why breach occurred
- **Corrective Actions**:
  - Fix vulnerability (security patch, policy change, etc.)
  - Implement safeguards to prevent recurrence
  - Timeline: Within 30 days when possible
- **Documentation**: Investigation and remediation documented
- **Follow-up**: Ensure corrective actions are effective

---

## 6. Audit and Monitoring

### 6.1 Audit Log Components

Each audit entry contains:
- **Timestamp**: ISO 8601 format with timezone
- **User ID**: Who performed the action
- **User Email**: Human-readable identifier
- **Action**: What was done (UPLOAD, DOWNLOAD, DELETE, ANALYZE, EXPORT, etc.)
- **Resource**: What was affected (project ID, dataset ID, artifact ID)
- **Resource Type**: Type of resource (PROJECT, DATASET, ANALYSIS, EXPORT, etc.)
- **Status**: Success or failure
- **IP Address**: Source of request
- **User Agent**: Browser/client information
- **Details**: Action-specific details
- **Entry Hash**: Hash of previous entry for chain integrity
- **Reason**: If action failed, error message

### 6.2 Audit Scope

ResearchFlow audits all actions related to PHI:

| Action | Logged | PHI Sensitive |
|--------|--------|---------------|
| Login/Logout | Yes | No |
| Create Project | Yes | No |
| Upload File | Yes | Yes |
| Download File | Yes | Yes |
| Run Analysis | Yes | Yes |
| Export Results | Yes | Yes |
| Add Team Member | Yes | No |
| Change Permissions | Yes | No |
| Governance Approval | Yes | No |
| Delete Data | Yes | Yes |

### 6.3 Audit Log Access

- **Who Can Access**:
  - ADMIN users (full logs)
  - STEWARD users (governance-related logs)
  - RESEARCHER users (limited - only their own actions and projects)
- **When Logs Are Readable**:
  - Real-time: Current logs
  - Up to 365 days: Archived but accessible
  - Older: Archived to cold storage
- **Query Capabilities**:
  - Filter by date, user, action, resource
  - Export to CSV or JSON
  - Generate reports
  - Verify chain integrity

### 6.4 Retention and Archival

- **Retention Period**: Minimum 6 years (configurable for compliance)
- **Storage Locations**:
  - Active: Hot storage (fast, encrypted)
  - 30+ days old: Archive storage (cheaper, encrypted)
  - 90+ days old: Cold storage (least cost, encrypted)
  - 6+ years old: Delete (or longer if required)
- **Accessibility**:
  - Hot storage: Queryable within minutes
  - Archive: Queryable within hours
  - Cold: Requires restore request (24 hours)
- **Encryption**: All archived logs encrypted at rest

---

## 7. Business Associate Agreement (BAA)

### 7.1 BAA Requirements Met

ResearchFlow commits to the following BAA requirements:

#### Permitted Uses and Disclosures (45 CFR § 164.504(e)(1)(ii))
- ResearchFlow uses/discloses PHI only:
  - As directed by Covered Entity in writing
  - As required by law
  - For purposes of carrying out services under contract
  - To enforce legal rights
- ResearchFlow does not use/disclose PHI for own business purposes

#### Safeguards (45 CFR § 164.504(e)(1)(ii)(A))
- Administrative Safeguards: Documented policies and procedures
- Physical Safeguards: Facility access controls, device security
- Technical Safeguards: Encryption, access controls, audit logging
- Organizational Safeguards: Privacy and security officers designated

#### Subcontractors (45 CFR § 164.504(e)(1)(ii)(B))
- BAA required for any subcontractors receiving PHI
- ResearchFlow responsible for subcontractor compliance
- Compliance verified through annual audits

#### Access Rights (45 CFR § 164.504(e)(1)(ii)(C))
- Covered Entity has right to:
  - Access PHI in a readable format
  - Receive audit logs
  - Audit security measures
  - Observe compliance

#### Termination (45 CFR § 164.504(e)(1)(ii)(J))
- Upon termination:
  - PHI returned or destroyed
  - De-identified data can be retained for analysis
  - Certification provided
  - No further access to PHI

#### Permitted Charges (45 CFR § 164.504(e)(1)(ii)(I))
- Charges must be reasonable and documented
- Not based on volume of PHI

#### Amendment of PHI (45 CFR § 164.504(e)(1)(ii)(C))
- Covered Entity can request amendments
- ResearchFlow will make amendments if authorized

### 7.2 BAA Execution

- **Required**: BAA must be executed before any PHI is handled
- **Signatory**: BAA signed by authorized representative
- **Effective Date**: BAA effective as of service start date
- **Amendments**: BAA can be amended by mutual written consent
- **Duration**: Continues for term of service relationship
- **Survival**: Certain obligations survive termination

---

## 8. Compliance Audits and Assessments

### 8.1 Internal Audits

#### Annual Security Assessment
- **Scope**: All technical, administrative, and physical controls
- **Method**: Self-assessment against HIPAA Security Rule
- **Findings**: Documented with remediation plans
- **Timeline**: Completed within 3 months of fiscal year end
- **Documentation**: Assessment report retained for 6 years

#### Quarterly Vulnerability Assessments
- **Scope**: All systems and networks
- **Method**: Automated scanning + manual penetration testing
- **Findings**: Prioritized by severity
- **Remediation**: Critical vulnerabilities patched within 30 days
- **Documentation**: Assessment reports and remediation tracked

#### Ongoing Monitoring
- **SIEM Monitoring**: Security Information and Event Management
- **Log Review**: Audit logs reviewed daily for anomalies
- **Alerting**: Real-time alerts for security events
- **Incident Response**: Security team on-call 24/7

### 8.2 Third-Party Audits

#### SOC 2 Type II Audit
- **Frequency**: Annually
- **Scope**: Security, availability, and confidentiality controls
- **Report**: Publicly available (with Covered Entity permission)
- **Findings**: Any exceptions or control failures documented and remediated

#### HIPAA Compliance Audit
- **Frequency**: Annually or per Covered Entity request
- **Scope**: HIPAA Privacy and Security Rule compliance
- **Report**: Provided to Covered Entity and HHS upon request
- **Findings**: Any gaps identified and remediation plan provided

#### Penetration Testing
- **Frequency**: Annually or after major changes
- **Scope**: All public-facing systems and internal networks
- **Report**: Detailed findings with remediation recommendations
- **Remediation**: Findings addressed within 60 days

### 8.3 Regulatory Inspections

- **HHS OCR Inspection**: If requested, ResearchFlow will cooperate fully
- **Access to Audit Logs**: Can be provided within 48 hours
- **Access to Systems**: Can be granted with proper authorization
- **Documentation**: All required documentation available
- **Representation**: Legal counsel and compliance officer present

---

## 9. Revision History and Attestation

| Version | Date | Changes | Reviewed By |
|---------|------|---------|------------|
| 1.0 | 2026-01-28 | Initial draft | - |
| [TBD] | [TBD] | Compliance review changes | Compliance Officer |

---

## 10. Attestation and Certification

**This is a DRAFT document that requires review and approval by your organization's compliance team before it can be certified as accurate and complete.**

Once approved, the following attestation will be added:

---

### DRAFT - NOT YET CERTIFIED

The undersigned representatives of ResearchFlow and [Covered Entity Name] hereby attest that:

1. ResearchFlow has implemented the technical, administrative, and physical safeguards described in this document
2. ResearchFlow maintains compliance with the HIPAA Security Rule (45 CFR Parts 160 and 164)
3. ResearchFlow maintains compliance with the HIPAA Privacy Rule (45 CFR Parts 160 and 164)
4. ResearchFlow has executed a Business Associate Agreement with [Covered Entity Name] before handling PHI
5. All audit logs and security controls described are operational and monitored
6. ResearchFlow commits to maintaining these controls and promptly remediating any identified gaps

**Approved by ResearchFlow**: [Name, Title, Signature] Date: [Date]

**Approved by Compliance Officer**: [Name, Title, Signature] Date: [Date]

**Approved by IT Security**: [Name, Title, Signature] Date: [Date]

---

## 11. Appendices

### Appendix A: Required Action Items for Compliance Review

Before this attestation can be finalized, the following must be completed:

- [ ] Legal review of BAA language
- [ ] Compliance officer review of safeguards
- [ ] IT security review of technical controls
- [ ] Covered Entity review and approval
- [ ] Signatures from all required parties
- [ ] Execution date documented

### Appendix B: Contacts

- **Chief Privacy Officer**: [Name, Email, Phone]
- **Chief Information Security Officer**: [Name, Email, Phone]
- **Compliance Officer**: [Name, Email, Phone]
- **System Owner**: [Name, Email, Phone]

### Appendix C: Related Documents

- BAA (Separate document)
- Security Policies and Procedures
- Incident Response Plan
- Business Continuity Plan
- Workforce Security Policy
- Physical Security Policy
- Acceptable Use Policy

### Appendix D: Configuration Reference

For technical configuration details, refer to:
- [Environment Variables Registry](../configuration/env-vars.md)
- [Architecture Overview](../ARCHITECTURE_OVERVIEW.md)
- [Deployment Guide](../DEPLOYMENT.md)

---

## Important Notices

**THIS DOCUMENT IS A DRAFT FOR INTERNAL REVIEW**

This attestation document is provided as a template and MUST be reviewed by your organization's legal, compliance, and IT security teams before use. Each organization has unique requirements and this document should be tailored to your specific implementation, policies, and procedures.

**Professional Legal Review Required**: A qualified healthcare attorney should review the BAA and this attestation for compliance with applicable law.

**Regular Updates Required**: This attestation should be reviewed and updated:
- Annually as a minimum
- After any significant system changes
- After any security incidents
- When regulatory guidance changes

---

**Document Classification**: CONFIDENTIAL - FOR AUTHORIZED PERSONNEL ONLY

Not for distribution outside of authorized compliance and legal personnel.

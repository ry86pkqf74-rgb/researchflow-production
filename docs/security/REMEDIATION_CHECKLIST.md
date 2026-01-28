# Security Remediation Checklist
## ResearchFlow Production - ROS-15

**Status:** ACTIONABLE CHECKLIST
**Created:** January 28, 2026
**Last Updated:** January 28, 2026

---

## PHASE 1: CRITICAL (Weeks 1-4) - MUST DO BEFORE PRODUCTION

### Category: Authentication (Production Readiness)

#### [ ] Implement Production Authentication System
- **Priority:** P0 - CRITICAL
- **Task:** Replace mock authentication with real system
- **Options:**
  - [ ] OAuth2 (Google, Microsoft, GitHub)
  - [ ] Proprietary JWT-based system
  - [ ] Session-based with database persistence
- **Acceptance Criteria:**
  - Real users can authenticate
  - Tokens issued with proper expiration
  - Secret rotation mechanism in place
  - Production deployed and tested
- **Effort:** 2-3 weeks
- **Owner:** (Assign)
- **Dependencies:** None
- **Files to Modify:**
  - `services/orchestrator/src/middleware/auth.ts` (replace mock)
  - `services/collab/src/auth.ts` (update validation)
  - Environment configuration for JWT secret

#### [ ] Implement Account Status Management
- **Priority:** P0 - CRITICAL
- **Task:** Enable/disable accounts, account suspension
- **Implementation:**
  - [ ] Add `isActive` flag to user model
  - [ ] Add `suspendedAt` timestamp field
  - [ ] Add `suspensionReason` field
  - [ ] Check status before granting access
  - [ ] Log suspension events
- **Acceptance Criteria:**
  - Inactive accounts cannot authenticate
  - Suspension reasons tracked in audit log
  - Admin can suspend/reactivate accounts
- **Effort:** 1-2 days
- **Owner:** (Assign)
- **Files to Modify:**
  - Database schema (Prisma)
  - Auth middleware
  - User management routes

#### [ ] Implement Session Management
- **Priority:** P0 - CRITICAL
- **Task:** Session timeout, invalidation, binding
- **Implementation:**
  - [ ] Inactivity timeout (30 minutes recommended)
  - [ ] Absolute timeout (8 hours recommended)
  - [ ] Session invalidation on logout
  - [ ] Session binding to IP/User-Agent
  - [ ] Concurrent session limits
- **Acceptance Criteria:**
  - Sessions expire after inactivity
  - Logout invalidates session
  - Sessions cannot be reused after timeout
  - Admin can invalidate user sessions
- **Effort:** 1-2 weeks
- **Owner:** (Assign)
- **Files to Create:**
  - `services/orchestrator/src/services/sessionService.ts`
  - `services/orchestrator/src/middleware/sessionTimeout.ts`
- **Files to Modify:**
  - Database schema
  - Auth routes
  - Express session configuration

#### [ ] Implement Login Rate Limiting
- **Priority:** P0 - CRITICAL
- **Task:** Prevent brute-force attacks
- **Implementation:**
  - [ ] 5 failed attempts = 15 minute lockout
  - [ ] Exponential backoff for repeated failures
  - [ ] Track by IP and email address
  - [ ] Alert security team on suspicious patterns
- **Acceptance Criteria:**
  - 5 failed logins trigger 15-min lockout
  - Lockout increases exponentially
  - Events logged for audit
  - No bypass mechanisms
- **Effort:** 2-3 days
- **Owner:** (Assign)
- **Dependencies:** express-rate-limit (already in dependencies)
- **Files to Modify:**
  - `services/orchestrator/src/routes/auth.ts` (add rate limiting)
  - `services/orchestrator/src/services/authService.ts`

### Category: Input Validation

#### [ ] Add File Upload Validation Schema
- **Priority:** P0 - CRITICAL
- **Task:** Validate file uploads
- **Implementation:**
  - [ ] Create Zod schema for file metadata
  - [ ] Validate filename (max 255 chars, no path traversal)
  - [ ] Validate MIME type (allowlist)
  - [ ] Validate file size (max 10MB recommended)
  - [ ] Scan for malicious patterns
- **Schema Template:**
  ```typescript
  const fileUploadSchema = z.object({
    filename: z.string()
      .max(255)
      .regex(/\.[a-z0-9]+$/i, 'Must have extension'),
    mimetype: z.enum([
      'application/pdf',
      'text/plain',
      'application/json'
    ]),
    size: z.number()
      .max(10 * 1024 * 1024, 'Max 10MB'),
  });
  ```
- **Acceptance Criteria:**
  - Only allowed file types accepted
  - File size enforced
  - Filenames sanitized
  - Invalid files rejected with clear error
- **Effort:** 2-3 hours
- **Owner:** (Assign)
- **Files to Create:**
  - `services/orchestrator/src/schemas/file-upload.schema.ts`
- **Files to Modify:**
  - Upload routes (apply validation)
  - Multer configuration

#### [ ] Add WebSocket Message Validation
- **Priority:** P0 - CRITICAL
- **Task:** Validate real-time collaboration messages
- **Implementation:**
  - [ ] Create Zod schemas for each message type
  - [ ] Validate cursor position messages
  - [ ] Validate edit delta messages
  - [ ] Validate user presence messages
  - [ ] Validate system messages
- **Acceptance Criteria:**
  - All message types validated
  - Invalid messages rejected
  - Validation errors logged
  - No injection possible via WebSocket
- **Effort:** 4-6 hours
- **Owner:** (Assign)
- **Files to Modify:**
  - `services/orchestrator/src/collaboration/websocket-server.ts`
- **Files to Create:**
  - `services/orchestrator/src/schemas/websocket.schema.ts`

### Category: SSRF Protection

#### [ ] Formalize SSRF Protections with URL Allowlist
- **Priority:** P0 - CRITICAL
- **Task:** Implement URL validation for external API calls
- **Implementation:**
  - [ ] Create allowlist of external domains
  - [ ] Implement `validateExternalUrl()` function
  - [ ] Block private IP ranges (10.0.0.0/8, etc.)
  - [ ] Block localhost and loopback (127.0.0.1)
  - [ ] Block metadata service (169.254.169.254)
  - [ ] Validate all external API URLs
- **Allowlist Template:**
  ```typescript
  const ALLOWED_DOMAINS = new Set([
    'eutils.ncbi.nlm.nih.gov',      // PubMed
    'api.semanticscholar.org',       // Semantic Scholar
    'arxiv.org',                      // ArXiv
    'worker',                         // Internal service
  ]);

  function validateExternalUrl(url: string): boolean {
    try {
      const parsed = new URL(url);

      // Block private ranges
      if (/^(10|172\.16|192\.168|127)\./.test(parsed.hostname)) {
        return false;
      }

      // Block metadata
      if (parsed.hostname === '169.254.169.254') {
        return false;
      }

      // Check allowlist
      return ALLOWED_DOMAINS.has(parsed.hostname);
    } catch {
      return false;
    }
  }
  ```
- **Acceptance Criteria:**
  - All external URLs validated
  - Only whitelisted domains allowed
  - Private addresses blocked
  - Metadata endpoints blocked
  - Attempts logged
- **Effort:** 2-3 days
- **Owner:** (Assign)
- **Files to Create:**
  - `services/orchestrator/src/utils/ssrf-validator.ts`
- **Files to Modify:**
  - External API client files
  - Routes making external calls

---

## PHASE 2: IMPORTANT (Weeks 5-8) - AFTER LAUNCH

### Category: Authentication Enhancement

#### [ ] Implement MFA (Multi-Factor Authentication)
- **Priority:** P1 - IMPORTANT
- **Task:** Add second factor for sensitive operations
- **Implementation:**
  - [ ] TOTP-based second factor for admins
  - [ ] Email verification codes for stewards
  - [ ] Recovery codes for account lockout
  - [ ] Backup authentication methods
- **Acceptance Criteria:**
  - Admin accounts require MFA
  - TOTP setup process documented
  - Recovery codes provided
  - MFA status tracked in audit log
- **Effort:** 1 week
- **Owner:** (Assign)
- **Libraries:** speakeasy or authenticator

#### [ ] Implement Account Lockout Policy
- **Priority:** P1 - IMPORTANT
- **Task:** Lock accounts after failed attempts
- **Implementation:**
  - [ ] Track failed login attempts
  - [ ] Lock after 5 failures
  - [ ] Exponential backoff (15min, 30min, 1hr)
  - [ ] Manual unlock by admin
  - [ ] Auto-unlock after lockout period
  - [ ] Send email notifications
- **Acceptance Criteria:**
  - Account locked after 5 attempts
  - Lockout increases exponentially
  - Email sent to account holder
  - Admin can unlock accounts
  - Events logged in audit trail
- **Effort:** 2-3 days
- **Owner:** (Assign)
- **Files to Modify:**
  - Auth service
  - Auth routes
  - User model

#### [ ] Implement CSRF Protection
- **Priority:** P1 - IMPORTANT
- **Task:** Prevent cross-site request forgery
- **Implementation:**
  - [ ] Add SameSite cookie attribute
  - [ ] Generate CSRF tokens for forms
  - [ ] Validate tokens on POST/PUT/DELETE
  - [ ] Error on missing/invalid tokens
- **Acceptance Criteria:**
  - CSRF tokens generated
  - Tokens validated on state changes
  - SameSite=Strict set on cookies
  - No CSRF vulnerabilities in testing
- **Effort:** 2-3 days
- **Owner:** (Assign)
- **Libraries:** csurf or similar

### Category: Monitoring & Alerting

#### [ ] Deploy Security Event Alerting
- **Priority:** P1 - IMPORTANT
- **Task:** Create alerts for security events
- **Alerts to Implement:**
  - [ ] Failed login attempts (>5 in 15 min)
  - [ ] Account lockouts
  - [ ] Permission denials (>10%)
  - [ ] Data export operations
  - [ ] API errors (>5% rate)
  - [ ] Unusual IP addresses
  - [ ] Concurrent session anomalies
- **Acceptance Criteria:**
  - Alerts configured in monitoring system
  - On-call rotation receives alerts
  - Alert escalation policy documented
  - False positive rate <5%
- **Effort:** 3-4 days
- **Owner:** (Assign)
- **Tools:** PagerDuty, Slack, Email

#### [ ] Implement WebSocket Message Validation
- **Priority:** P1 - IMPORTANT
- **Task:** Add schema validation to real-time messages
- **Already listed above** - consolidate with Phase 1 if possible

### Category: API Security

#### [ ] Implement Request Signing for API Calls
- **Priority:** P1 - IMPORTANT
- **Task:** Add HMAC signatures to requests
- **Implementation:**
  - [ ] Create request signing utility
  - [ ] Add signature to X-Signature header
  - [ ] Include timestamp in signature
  - [ ] Validate signature on receipt
  - [ ] Prevent replay attacks
- **Acceptance Criteria:**
  - All API calls signed
  - Signatures validated
  - Replay protection implemented
  - No unsigned calls allowed
- **Effort:** 1 week
- **Owner:** (Assign)
- **Files to Create:**
  - `services/orchestrator/src/utils/request-signer.ts`

---

## PHASE 3: ENHANCEMENT (Weeks 9+) - ONGOING

### Category: Frontend Security

#### [ ] Add Frontend Input Validation
- **Priority:** P2 - NICE TO HAVE
- **Task:** Client-side validation for UX
- **Implementation:**
  - [ ] Create Zod schemas for forms
  - [ ] Add validation to form components
  - [ ] Show real-time error messages
  - [ ] Prevent invalid submission
- **Acceptance Criteria:**
  - All forms have client validation
  - Clear error messages
  - No invalid requests to server
  - Improved user experience
- **Effort:** 1-2 weeks
- **Owner:** (Assign)
- **Files to Create:**
  - `services/web/src/schemas/*`
  - `services/web/src/components/forms/*`

#### [ ] Implement API Documentation Generation
- **Priority:** P2 - NICE TO HAVE
- **Task:** Auto-generate OpenAPI/Swagger from schemas
- **Implementation:**
  - [ ] Extract schemas from code
  - [ ] Generate OpenAPI spec
  - [ ] Create Swagger UI
  - [ ] Keep docs synchronized
- **Acceptance Criteria:**
  - API docs auto-generated
  - All endpoints documented
  - Schemas match code
  - Developers reference docs
- **Effort:** 3-4 days
- **Owner:** (Assign)
- **Libraries:** ts-rest, OpenAPI Generator

#### [ ] Create Security Dashboards
- **Priority:** P2 - NICE TO HAVE
- **Task:** Visual monitoring of security metrics
- **Dashboards:**
  - [ ] Authentication metrics
  - [ ] Permission enforcement
  - [ ] Data access patterns
  - [ ] Error rates
  - [ ] SSRF attempt tracking
- **Acceptance Criteria:**
  - Dashboards created
  - Real-time metrics displayed
  - Historical trends visible
  - Team has access
- **Effort:** 1 week
- **Owner:** (Assign)
- **Tools:** Grafana, CloudWatch, custom

### Category: Infrastructure

#### [ ] Automate Log Retention
- **Priority:** P2 - NICE TO HAVE
- **Task:** Implement log archival policy
- **Implementation:**
  - [ ] Keep active logs 90 days
  - [ ] Archive to cold storage
  - [ ] Encrypt archived logs
  - [ ] Verify archive integrity
  - [ ] Document retention policy
- **Acceptance Criteria:**
  - Logs automatically archived
  - Encryption enforced
  - Retrieval process documented
  - Compliance met
- **Effort:** 2-3 days
- **Owner:** (Assign)

#### [ ] Implement Automated Dependency Updates
- **Priority:** P2 - NICE TO HAVE
- **Task:** Keep dependencies current
- **Implementation:**
  - [ ] Dependabot or similar enabled
  - [ ] Automated patch updates
  - [ ] Weekly security scan
  - [ ] PR review process
  - [ ] Automated testing on updates
- **Acceptance Criteria:**
  - Dependencies updated weekly
  - Security patches within 48 hours
  - No manual updates needed
  - All tests pass on updates
- **Effort:** 1-2 days
- **Owner:** (Assign)

### Category: Documentation

#### [ ] Document Security Architecture
- **Priority:** P2 - NICE TO HAVE
- **Task:** Create security documentation
- **Documents:**
  - [ ] Threat model
  - [ ] Security architecture diagram
  - [ ] Data flow diagram
  - [ ] Access control matrix
  - [ ] Incident response playbooks
  - [ ] Security configuration guide
- **Acceptance Criteria:**
  - All docs complete and reviewed
  - Diagrams up-to-date
  - Playbooks tested
  - Team trained
- **Effort:** 1-2 weeks
- **Owner:** (Assign)

#### [ ] Conduct Security Training
- **Priority:** P2 - NICE TO HAVE
- **Task:** Train team on security practices
- **Topics:**
  - [ ] OWASP Top 10
  - [ ] Secure coding practices
  - [ ] Threat modeling
  - [ ] Incident response
  - [ ] Privacy/compliance
- **Acceptance Criteria:**
  - All team members trained
  - Quiz passed
  - Security awareness improved
  - Practices followed
- **Effort:** 2-3 days
- **Owner:** (Assign)

---

## Testing & Validation Checklist

### Unit Tests
- [ ] Zod schema boundary testing
- [ ] Password hashing verification
- [ ] RBAC permission combinations
- [ ] Error handler responses
- [ ] JWT token generation/validation
- [ ] Session timeout logic

### Integration Tests
- [ ] End-to-end authentication flow
- [ ] Permission enforcement across routes
- [ ] Data integrity with concurrent updates
- [ ] External API error handling
- [ ] File upload workflow
- [ ] WebSocket real-time messaging

### Security Tests
- [ ] SSRF attack vectors
- [ ] SQL injection attempts
- [ ] XSS payload handling
- [ ] CSRF protection validation
- [ ] Session fixation prevention
- [ ] Brute-force attack prevention
- [ ] Rate limit enforcement
- [ ] Authorization bypass attempts

### Performance Tests
- [ ] Validation parsing (target: <1ms)
- [ ] RBAC lookup performance
- [ ] Large object validation
- [ ] Concurrent validation requests
- [ ] File upload handling
- [ ] WebSocket message throughput

### Compliance Tests
- [ ] OWASP Top 10 re-assessment
- [ ] Data privacy validation
- [ ] Audit log completeness
- [ ] Error message sanitization
- [ ] Secret entropy verification

---

## Approval & Sign-Off Process

### Step 1: Security Review
- [ ] Assign security lead reviewer
- [ ] Review all documentation
- [ ] Approve remediation plan
- [ ] Assign reviewers for code changes

### Step 2: Implementation
- [ ] Create tickets for each item
- [ ] Assign team members
- [ ] Schedule sprints
- [ ] Monitor progress

### Step 3: Code Review
- [ ] Security review of all changes
- [ ] Test coverage verification
- [ ] Architecture review
- [ ] Approval required before merge

### Step 4: Testing
- [ ] Run security test suite
- [ ] Penetration testing (optional)
- [ ] Vulnerability scanning
- [ ] Performance validation

### Step 5: Final Sign-Off
- [ ] Security lead approval
- [ ] CTO approval for production
- [ ] Deployment to production
- [ ] Post-deployment monitoring

---

## Tracking & Status Updates

### Weekly Status Template
```
Week of: [DATE]

Completed:
- [Task name] - [%]
- [Task name] - [%]

In Progress:
- [Task name] - [%]
- [Task name] - [%]

Blocked:
- [Task name] - Reason: [...]

Next Week:
- [Task name]
- [Task name]

Notes:
- [Any relevant updates]
```

### Project Timeline
```
Week 1:  Production auth + sessions
Week 2:  Rate limiting + file validation
Week 3:  WebSocket validation + SSRF
Week 4:  Testing & hardening
Week 5:  MFA + account lockout
Week 6:  CSRF protection + alerting
Week 7:  Buffer/testing
Week 8:  Final hardening
```

---

## Success Criteria

### Phase 1 Complete (Critical)
- [ ] Production authentication working
- [ ] All sessions expire properly
- [ ] Rate limiting prevents brute-force
- [ ] All file uploads validated
- [ ] SSRF protection formalized
- [ ] All tests passing
- [ ] Security team approval

### Phase 2 Complete (Important)
- [ ] MFA implemented for admins
- [ ] Account lockout policy active
- [ ] CSRF protection enabled
- [ ] Security alerts configured
- [ ] Team trained on alerts
- [ ] All tests passing

### Phase 3 Complete (Enhancement)
- [ ] Frontend validation implemented
- [ ] Security dashboards created
- [ ] API docs auto-generated
- [ ] Log retention automated
- [ ] Dependency updates automated
- [ ] Security docs complete
- [ ] Team fully trained

---

## Escalation Contacts

**Security Lead:** (Name) - [Contact]
**CTO:** (Name) - [Contact]
**On-Call:** (Team) - [Contact]
**Incident Response:** (Team) - [Contact]

---

## References

- OWASP_AUDIT_REPORT.md - Detailed vulnerability assessment
- INPUT_VALIDATION_AUDIT.md - Schema coverage analysis
- SECURITY_AUDIT_SUMMARY.md - Executive summary

---

**Document Status:** ACTIVE
**Last Updated:** January 28, 2026
**Classification:** Internal - Security Review
**Version:** 1.0

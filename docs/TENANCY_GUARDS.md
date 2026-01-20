# Multi-Tenancy Guards

> **Last Updated:** 2025
> **Status:** Production Ready
> **Covers:** Tasks 81, 85, 95 (Multi-Tenant Security)

## Overview

ResearchFlow implements strict multi-tenancy isolation to ensure data separation between organizations while supporting flexible access control for collaboration scenarios.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Request Flow                             │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Request │───▶│   Auth   │───▶│  Tenant  │───▶│   RBAC   │  │
│  │  Entry   │    │  Verify  │    │  Context │    │  Check   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                        │        │
│                                                        ▼        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Handler Execution                      │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │              Tenant-Scoped Queries                   │ │  │
│  │  │  SELECT * FROM artifacts WHERE tenant_id = :tenant   │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tenant Isolation Model

### Organization Structure

```typescript
interface Organization {
  id: UUID;
  slug: string;           // Unique, URL-safe identifier
  name: string;
  tier: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
  isActive: boolean;
  settings: OrganizationSettings;
}

interface OrgMembership {
  userId: UUID;
  organizationId: UUID;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  isActive: boolean;
  joinedAt: DateTime;
  invitedBy?: UUID;
}
```

### Tenant Context Middleware

Every request must establish tenant context:

```typescript
// services/orchestrator/src/middleware/org-context.ts
export async function orgContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Extract org from request (header, path param, or query)
  const orgId = extractOrgId(req);

  // Verify membership
  const membership = await getMembership(userId, orgId);
  if (!membership || !membership.isActive) {
    return res.status(403).json({ error: 'Not a member of this organization' });
  }

  // Attach context
  req.orgContext = {
    organizationId: orgId,
    userId,
    role: membership.role,
    tier: membership.organization.tier,
  };

  next();
}
```

### Enforcement Points

Tenant isolation is enforced at three layers:

| Layer | Implementation | Purpose |
|-------|---------------|---------|
| **API Router** | Middleware extracts/validates org context | Early rejection |
| **Service Layer** | All queries scoped to `tenant_id` | Data isolation |
| **Database** | Row-level security (RLS) policies | Defense in depth |

#### Service Layer Example

```typescript
// Every service method must include tenant scope
export async function getArtifacts(
  researchId: string,
  orgContext: OrgContext
): Promise<Artifact[]> {
  // Verify research belongs to org
  const research = await db.query(`
    SELECT * FROM researches
    WHERE id = $1 AND organization_id = $2
  `, [researchId, orgContext.organizationId]);

  if (!research) {
    throw new NotFoundError('Research not found');
  }

  return db.query(`
    SELECT * FROM artifacts
    WHERE research_id = $1
  `, [researchId]);
}
```

#### WebSocket Layer

Real-time connections also enforce tenant isolation:

```typescript
// services/collab/src/server.ts
onAuthenticate: async ({ token, documentName }) => {
  const decoded = verifyJwt(token);
  const [type, resourceId] = documentName.split(':');

  // Verify user has access to resource's tenant
  const resource = await getResource(type, resourceId);
  const membership = await getMembership(decoded.userId, resource.organizationId);

  if (!membership) {
    throw new Error('Access denied');
  }

  return { user: { id: decoded.userId, role: membership.role } };
}
```

## Role-Based Access Control (RBAC)

### Role Hierarchy

```
OWNER
  └── ADMIN
        └── MEMBER
              └── VIEWER
```

### Permission Matrix

| Action | OWNER | ADMIN | MEMBER | VIEWER |
|--------|-------|-------|--------|--------|
| View artifacts | ✅ | ✅ | ✅ | ✅ |
| Create artifacts | ✅ | ✅ | ✅ | ❌ |
| Edit artifacts | ✅ | ✅ | ✅ | ❌ |
| Delete artifacts | ✅ | ✅ | ❌ | ❌ |
| Manage members | ✅ | ✅ | ❌ | ❌ |
| Billing/settings | ✅ | ❌ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ | ❌ |

### RBAC Middleware

```typescript
// services/orchestrator/src/middleware/rbac.ts
export function requireRole(...allowedRoles: OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { role } = req.orgContext;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: role,
      });
    }

    next();
  };
}

// Usage in routes
router.delete('/artifacts/:id',
  requireRole('OWNER', 'ADMIN'),
  deleteArtifactHandler
);
```

### UI Permission Bindings (Task 81)

Map roles to UI affordances to prevent optimistic UI leaks:

```typescript
// services/web/src/hooks/usePermissions.ts
export function usePermissions() {
  const { role } = useOrgContext();

  return {
    canCreateArtifact: role !== 'VIEWER',
    canEditArtifact: role !== 'VIEWER',
    canDeleteArtifact: role === 'OWNER' || role === 'ADMIN',
    canManageMembers: role === 'OWNER' || role === 'ADMIN',
    canAccessBilling: role === 'OWNER',
    canExportData: role !== 'VIEWER',
  };
}

// Component usage
function ArtifactActions({ artifact }) {
  const { canDeleteArtifact } = usePermissions();

  return (
    <div>
      <EditButton artifact={artifact} />
      {canDeleteArtifact && <DeleteButton artifact={artifact} />}
    </div>
  );
}
```

## Guest Access Modes (Task 85)

### Share Token System

Time-boxed tokens for external access:

```typescript
interface ArtifactShare {
  id: UUID;
  artifactId: UUID;
  tokenHash: string;      // SHA-256, never store raw
  permission: 'VIEW' | 'COMMENT' | 'REVIEW';
  expiresAt: DateTime;
  createdBy: UUID;
  accessCount: number;
  lastAccessedAt?: DateTime;
}
```

### Guest Permission Levels

| Mode | Permissions |
|------|-------------|
| **VIEW** | Read-only access |
| **COMMENT** | View + add comments |
| **REVIEW** | View + comment + score |

### Token Validation

```typescript
export async function validateShareToken(
  artifactId: string,
  token: string
): Promise<ShareValidation> {
  const tokenHash = sha256(token);

  const share = await db.query(`
    SELECT * FROM artifact_shares
    WHERE artifact_id = $1
      AND token_hash = $2
      AND expires_at > NOW()
      AND revoked_at IS NULL
  `, [artifactId, tokenHash]);

  if (!share) {
    return { valid: false, reason: 'Invalid or expired token' };
  }

  // Update access tracking
  await db.query(`
    UPDATE artifact_shares
    SET access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE id = $1
  `, [share.id]);

  // Log for audit
  await auditService.log({
    type: 'SHARE_ACCESS',
    artifactId,
    shareId: share.id,
    permission: share.permission,
  });

  return {
    valid: true,
    permission: share.permission,
    expiresAt: share.expiresAt,
  };
}
```

### Share Management API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/artifacts/:id/shares` | POST | Create share link |
| `/api/artifacts/:id/shares` | GET | List shares |
| `/api/shares/:id` | DELETE | Revoke share |
| `/api/shares/:id/extend` | POST | Extend expiration |

## Tier Gating

### Subscription Tiers

```typescript
const TIER_LIMITS = {
  FREE: {
    maxMembers: 3,
    maxResearches: 5,
    maxStorageGB: 1,
    features: ['basic_collaboration'],
  },
  PRO: {
    maxMembers: 10,
    maxResearches: 25,
    maxStorageGB: 10,
    features: ['basic_collaboration', 'peer_review', 'export'],
  },
  TEAM: {
    maxMembers: 50,
    maxResearches: 100,
    maxStorageGB: 50,
    features: ['basic_collaboration', 'peer_review', 'export', 'integrations', 'sso'],
  },
  ENTERPRISE: {
    maxMembers: Infinity,
    maxResearches: Infinity,
    maxStorageGB: 500,
    features: ['*'],
  },
};
```

### Tier Gate Middleware

```typescript
// services/orchestrator/src/middleware/tier-gate.ts
export function requireFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { tier } = req.orgContext;
    const tierConfig = TIER_LIMITS[tier];

    const hasFeature = tierConfig.features.includes('*') ||
                       tierConfig.features.includes(feature);

    if (!hasFeature) {
      return res.status(403).json({
        error: 'Feature not available',
        feature,
        currentTier: tier,
        requiredTier: getMinimumTierForFeature(feature),
      });
    }

    next();
  };
}
```

## Security Best Practices

### Defense in Depth

1. **Authentication** - Verify identity (JWT)
2. **Authorization** - Check role permissions
3. **Tenant Isolation** - Scope all queries
4. **Input Validation** - Sanitize and validate
5. **Audit Logging** - Record all access

### Common Vulnerabilities & Mitigations

| Vulnerability | Mitigation |
|---------------|------------|
| IDOR (Insecure Direct Object Reference) | Always verify tenant ownership |
| Privilege Escalation | Validate role on every request |
| Token Leakage | Hash tokens, short expiry |
| Cross-Tenant Data Leak | RLS policies as backup |

### Audit Trail

All security-relevant actions are logged:

```typescript
interface SecurityAuditEvent {
  timestamp: DateTime;
  eventType: 'ACCESS' | 'CREATE' | 'UPDATE' | 'DELETE' | 'PERMISSION_CHANGE';
  userId: UUID;
  organizationId: UUID;
  resourceType: string;
  resourceId: UUID;
  action: string;
  result: 'SUCCESS' | 'DENIED';
  metadata?: Record<string, unknown>;
}
```

## Testing Tenant Isolation

### Unit Tests

```typescript
describe('TenantIsolation', () => {
  it('should reject access to other org resources', async () => {
    const userA = await createUser({ orgId: 'org-a' });
    const userB = await createUser({ orgId: 'org-b' });
    const artifactA = await createArtifact({ orgId: 'org-a' });

    const response = await request(app)
      .get(`/api/artifacts/${artifactA.id}`)
      .set('Authorization', `Bearer ${userB.token}`);

    expect(response.status).toBe(404); // Not 403 to prevent enumeration
  });
});
```

### Integration Tests

```bash
# Run tenant isolation tests
npm run test:tenant-isolation

# Verify RLS policies
npm run test:rls-policies
```

## Related Documentation

- [COLLABORATION_MODEL.md](./COLLABORATION_MODEL.md) - Collaboration features
- [AUDIT_CHAIN_COLLAB.md](./AUDIT_CHAIN_COLLAB.md) - Audit chain details
- [GOVERNANCE_MODES.md](./GOVERNANCE_MODES.md) - DEMO/LIVE/STANDBY modes

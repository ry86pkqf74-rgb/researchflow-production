// Re-export all types
// schema.ts includes imports from other files, so we export it first
export * from './schema';
// Then export types.ts for additional types not in schema
export * from './types';

// Export roles and RBAC types (explicit to avoid conflicts with schema.ts UserRole)
export {
  type RoleName,
  type Permission,
  type RoleConfig,
  ROLE_CONFIGS,
  ROLES,
  type Role,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  ROLE_DESCRIPTIONS,
  type User,
  type UserWithRole,
  InsufficientPermissionsError,
  hasPermission,
  hasMinimumRole,
  hasPermissionByRole,
  hasMinimumRoleByName
} from './roles';

// Export governance types for mode separation
export * from './governance';

// Export policy types for centralized authorization (excluding duplicates)
export {
  type GovernanceMode,
  type PolicyContext,
  type PolicyDecision,
  type PolicyEngine,
  DEMO_ALLOWED_ACTIONS,
  DEMO_BLOCKED_RESOURCES,
  HIGH_RISK_ACTIONS
  // Note: UserRole and ROLE_PERMISSIONS excluded - use versions from roles.ts
} from './policy';

// Export topic declaration types for dual-mode (quick/pico) entry
export * from './topic-declaration';
// Export research brief types for AI-generated briefs
export * from './research-brief';

// Export literature types for Phase C literature search
export * from './literature';

// Export quality types for Phase C data quality dashboard
export * from './quality';

// Export organization types for Phase E multi-tenancy
export * from './organization';

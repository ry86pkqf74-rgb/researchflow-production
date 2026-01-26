import { useAuthStore } from '../stores/auth-store';
import { useOrgStore, type OrgCapability } from '../stores/org-store';
import type { Permission } from '@/types/api';

/**
 * Unified Permissions Hook (Task 102 - Role-Adaptive Navigation)
 *
 * Combines system-level permissions (from user role) and organization-level
 * capabilities (from org membership) into a single convenient interface.
 *
 * @example
 * ```tsx
 * const permissions = usePermissions();
 *
 * if (permissions.canCreate) {
 *   return <CreateProjectButton />;
 * }
 *
 * if (permissions.isSteward) {
 *   return <ApprovalQueue />;
 * }
 * ```
 */

interface Permissions {
  // System-level (from user role)
  hasSystemPermission: (permission: Permission) => boolean;
  isSystemAdmin: boolean;
  isSteward: boolean;
  isResearcher: boolean;
  isViewer: boolean;

  // Org-level (from org membership)
  hasOrgCapability: (capability: OrgCapability) => boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canManageMembers: boolean;
  isOrgAdmin: boolean;

  // Combined checks
  canPerformAction: (action: string) => boolean;

  // Role information
  systemRole: string | null;
  orgRole: string | null;
}

export function usePermissions(): Permissions {
  const { user, hasPermission } = useAuthStore();
  const orgStore = useOrgStore();

  return {
    // System-level permissions
    hasSystemPermission: (permission: Permission) => {
      return hasPermission ? hasPermission(permission) : false;
    },
    isSystemAdmin: user?.role === 'ADMIN',
    isSteward: user?.role === 'STEWARD',
    isResearcher: user?.role === 'RESEARCHER',
    isViewer: user?.role === 'VIEWER',

    // Org-level capabilities
    hasOrgCapability: orgStore.hasCapability,
    canCreate: orgStore.canCreate,
    canEdit: orgStore.canEdit,
    canDelete: orgStore.canDelete,
    canExport: orgStore.canExport,
    canManageMembers: orgStore.canManageMembers,
    isOrgAdmin: orgStore.isAdmin,

    // Combined action checking
    canPerformAction: (action: string) => {
      // Map common UI actions to specific checks
      const actionMap: Record<string, () => boolean> = {
        'create_project': () => orgStore.canCreate,
        'edit_project': () => orgStore.canEdit,
        'delete_project': () => orgStore.canDelete,
        'export_data': () => orgStore.canExport,
        'invite_member': () => orgStore.canManageMembers,
        'view_settings': () => orgStore.isAdmin,
        'view_audit': () => hasPermission ? hasPermission('VIEW_AUDIT_LOGS') : false,
        'approve_request': () => hasPermission ? hasPermission('APPROVE_OPERATIONS') : false,
      };

      return actionMap[action]?.() ?? false;
    },

    // Role information
    systemRole: user?.role ?? null,
    orgRole: orgStore.membership?.role ?? null,
  };
}

import { usePermissions } from '../../hooks/usePermissions';
import { useOrgStore } from '../../stores/org-store';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  Home,
  FolderOpen,
  PlusCircle,
  FileText,
  CheckCircle,
  Download,
  Users,
  Settings,
} from 'lucide-react';

/**
 * Adaptive Navigation Component (Task 102)
 *
 * Renders navigation items conditionally based on:
 * - Organization capabilities (from membership role)
 * - System permissions (from user role)
 *
 * Navigation items are hidden if user lacks required permissions,
 * preventing unauthorized access attempts and improving UX.
 */

interface NavItem {
  label: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  requireCapability?: string;
  requireSystemPermission?: string;
  badge?: string | number;
}

export function AdaptiveNavigation() {
  const permissions = usePermissions();
  const { org } = useOrgStore();
  const location = useLocation();

  // Define navigation structure with permission requirements
  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: Home,
    },
    {
      label: 'Research Projects',
      path: '/projects',
      icon: FolderOpen,
      requireCapability: 'view_research',
    },
    {
      label: 'Create Project',
      path: '/projects/new',
      icon: PlusCircle,
      requireCapability: 'create_research',
    },
    {
      label: 'Artifacts',
      path: '/artifacts',
      icon: FileText,
      requireCapability: 'view_research',
    },
    {
      label: 'Approvals',
      path: '/approvals',
      icon: CheckCircle,
      requireSystemPermission: 'APPROVE',
    },
    {
      label: 'Data Export',
      path: '/export',
      icon: Download,
      requireCapability: 'export',
    },
    {
      label: 'Team',
      path: '/team',
      icon: Users,
      requireCapability: 'manage_members',
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      requireCapability: 'admin',
    },
  ];

  // Filter nav items based on user permissions
  const visibleItems = navItems.filter((item) => {
    // Check org capability requirement
    if (item.requireCapability) {
      const hasCapability = permissions.hasOrgCapability(item.requireCapability as any);
      if (!hasCapability) {
        return false;
      }
    }

    // Check system permission requirement
    if (item.requireSystemPermission) {
      const hasPermission = permissions.hasSystemPermission(item.requireSystemPermission as any);
      if (!hasPermission) {
        return false;
      }
    }

    return true;
  });

  // Show message if no org selected
  if (!org) {
    return (
      <nav className="space-y-1 px-3 py-4">
        <p className="text-sm text-muted-foreground">
          No organization selected
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Select an organization to view navigation
        </p>
      </nav>
    );
  }

  return (
    <nav className="space-y-1 px-3 py-4">
      {visibleItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

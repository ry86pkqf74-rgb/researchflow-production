/**
 * RBAC-aware Navigation Component (Phase 4C - RUN-010)
 *
 * Responsive navigation that shows/hides items based on user role and permissions.
 * Highlights governance features for stewards.
 *
 * Supported Roles:
 * - admin: Full access to all features
 * - steward: Governance, IRB, and approval access
 * - researcher: Project and run management
 * - viewer: Read-only access
 *
 * Features:
 * - Role-based menu visibility
 * - Governance highlighting for stewards
 * - Active route highlighting
 * - Responsive mobile/desktop
 * - User profile menu
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  FolderKanban,
  Zap,
  Shield,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  BookOpen,
  BarChart3,
  Lock,
} from 'lucide-react';

export type UserRole = 'admin' | 'steward' | 'researcher' | 'viewer';

export interface NavConfig {
  role: UserRole;
  userId: string;
  userName?: string;
  userEmail?: string;
  avatar?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
  isGovernance?: boolean;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Home',
    href: '/home',
    icon: <Home className="h-4 w-4" />,
    roles: ['admin', 'steward', 'researcher', 'viewer'],
  },
  {
    label: 'Projects',
    href: '/projects-runs',
    icon: <FolderKanban className="h-4 w-4" />,
    roles: ['admin', 'researcher'],
  },
  {
    label: 'Runs',
    href: '/runs',
    icon: <Zap className="h-4 w-4" />,
    roles: ['admin', 'researcher'],
  },
  {
    label: 'Governance',
    href: '/governance',
    icon: <Shield className="h-4 w-4" />,
    roles: ['admin', 'steward'],
    isGovernance: true,
  },
  {
    label: 'Approvals',
    href: '/approvals',
    icon: <Lock className="h-4 w-4" />,
    roles: ['admin', 'steward'],
    isGovernance: true,
    badge: 'Steward',
  },
  {
    label: 'IRB Management',
    href: '/irb-management',
    icon: <BookOpen className="h-4 w-4" />,
    roles: ['admin', 'steward'],
    isGovernance: true,
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ['admin', 'steward', 'researcher'],
  },
  {
    label: 'Team',
    href: '/team',
    icon: <Users className="h-4 w-4" />,
    roles: ['admin'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
    roles: ['admin', 'steward', 'researcher'],
  },
];

interface RBACNavProps {
  config: NavConfig;
  onLogout?: () => void;
  className?: string;
}

export function RBACNav({
  config,
  onLogout,
  className,
}: RBACNavProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Filter nav items based on user role
  const visibleItems = navItems.filter((item) =>
    item.roles.includes(config.role)
  );

  // Separate governance and regular items
  const regularItems = visibleItems.filter((item) => !item.isGovernance);
  const governanceItems = visibleItems.filter((item) => item.isGovernance);

  const isActive = (href: string) => location === href;

  const NavLink = ({ item }: { item: NavItem }) => (
    <Link href={item.href}>
      <a
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
          isActive(item.href)
            ? 'bg-blue-100 text-blue-900'
            : 'text-gray-700 hover:bg-gray-100',
          item.isGovernance && 'text-purple-700'
        )}
        onClick={() => setMobileOpen(false)}
      >
        {item.icon}
        <span>{item.label}</span>
        {item.badge && (
          <Badge
            variant="secondary"
            className={cn(
              'ml-auto text-xs',
              item.isGovernance && 'bg-purple-100 text-purple-700'
            )}
          >
            {item.badge}
          </Badge>
        )}
      </a>
    </Link>
  );

  return (
    <>
      {/* Desktop Navigation */}
      <nav
        className={cn(
          'hidden md:flex flex-col gap-1 py-4 px-2',
          className
        )}
      >
        {/* Regular Items */}
        {regularItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {/* Governance Section */}
        {governanceItems.length > 0 && (
          <>
            <div className="my-2 px-3">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-purple-600" />
                <p className="text-xs font-semibold text-purple-600">GOVERNANCE</p>
              </div>
            </div>
            {governanceItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </>
        )}

        {/* Bottom Divider */}
        <div className="my-2 border-t" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium w-full',
                'text-gray-700 hover:bg-gray-100'
              )}
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-xs font-bold">
                {config.userName?.[0] || config.userEmail?.[0] || 'U'}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="truncate text-xs">{config.userName || config.userEmail}</p>
                <p className="text-xs text-gray-600 capitalize">
                  {config.role}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <a className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </a>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onLogout}
              className="text-red-600 cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col gap-1 mt-6">
              {/* Regular Items */}
              {regularItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}

              {/* Governance Section */}
              {governanceItems.length > 0 && (
                <>
                  <div className="my-3 px-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-purple-600" />
                      <p className="text-xs font-semibold text-purple-600">
                        GOVERNANCE
                      </p>
                    </div>
                  </div>
                  {governanceItems.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </>
              )}

              {/* Bottom Divider */}
              <div className="my-3 border-t" />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium w-full',
                      'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-xs font-bold">
                      {config.userName?.[0] || config.userEmail?.[0] || 'U'}
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <p className="truncate text-xs">
                        {config.userName || config.userEmail}
                      </p>
                      <p className="text-xs text-gray-600 capitalize">
                        {config.role}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <a className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Settings
                      </a>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onLogout}
                    className="text-red-600 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

export default RBACNav;

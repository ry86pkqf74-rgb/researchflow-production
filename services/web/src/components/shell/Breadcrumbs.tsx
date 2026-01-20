import { Link, useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Breadcrumb Navigation Component (Task 11)
 *
 * Provides hierarchical navigation breadcrumbs for deep views:
 * - Stage detail view
 * - Artifact detail view
 * - Settings subpages
 *
 * Features:
 * - Auto-generates breadcrumbs from URL path
 * - Custom overrides via props
 * - Accessible with proper ARIA labels
 * - Responsive with truncation on mobile
 */

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  /** Show home icon as first item */
  showHome?: boolean;
  /** Custom separator */
  separator?: React.ReactNode;
}

// Route label mappings for auto-generation
const routeLabels: Record<string, string> = {
  '': 'Home',
  'dashboard': 'Dashboard',
  'workflow': 'Workflow',
  'workflows': 'Workflows',
  'pipeline': 'Pipeline',
  'projects': 'Projects',
  'artifacts': 'Artifacts',
  'settings': 'Settings',
  'governance': 'Governance',
  'governance-console': 'Governance Console',
  'quality': 'Quality',
  'search': 'Search',
  'community': 'Community',
  'onboarding': 'Onboarding',
  'billing': 'Billing',
  'review-sessions': 'Review Sessions',
  'org': 'Organization',
  'sap': 'Statistical Analysis Plan',
  'xr': 'XR Preview',
  'import': 'Import Bundle',
};

// Stage labels for workflow stages
const stageLabels: Record<string, string> = {
  '1': 'Hypothesis Generation',
  '2': 'Literature Review',
  '3': 'Experimental Design',
  '4': 'Data Collection',
  '5': 'Data Preprocessing',
  '6': 'Analysis',
  '7': 'Statistical Modeling',
  '8': 'Visualization',
  '9': 'Interpretation',
  '10': 'Validation',
  '11': 'Iteration',
  '12': 'Documentation',
  '13': 'Internal Review',
  '14': 'Ethical Review',
  '15': 'Artifact Bundling',
  '16': 'Collaboration Handoff',
  '17': 'Archiving',
  '18': 'Impact Assessment',
  '19': 'Dissemination',
  '20': 'Conference Preparation',
};

function getLabel(segment: string, prevSegment?: string): string {
  // Handle stage numbers in workflow context
  if (prevSegment === 'stage' || prevSegment === 'stages') {
    return stageLabels[segment] || `Stage ${segment}`;
  }

  // Check route labels
  if (routeLabels[segment]) {
    return routeLabels[segment];
  }

  // Handle UUIDs or IDs - show shortened version
  if (segment.length > 20 || /^[a-f0-9-]{36}$/i.test(segment)) {
    return segment.substring(0, 8) + '...';
  }

  // Capitalize and humanize
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    const prevSegment = index > 0 ? segments[index - 1] : undefined;

    items.push({
      label: getLabel(segment, prevSegment),
      href: isLast ? undefined : currentPath,
    });
  });

  return items;
}

export function Breadcrumbs({
  items,
  className,
  showHome = true,
  separator,
}: BreadcrumbsProps) {
  const [location] = useLocation();

  // Use provided items or auto-generate from path
  const breadcrumbItems = items || generateBreadcrumbsFromPath(location);

  // Don't show breadcrumbs on home page
  if (location === '/' || breadcrumbItems.length === 0) {
    return null;
  }

  const separatorElement = separator || (
    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center space-x-1 text-sm', className)}
    >
      <ol className="flex items-center space-x-1 flex-wrap">
        {showHome && (
          <li className="flex items-center">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent"
              aria-label="Home"
            >
              <Home className="h-4 w-4" />
            </Link>
            {breadcrumbItems.length > 0 && (
              <span className="ml-1">{separatorElement}</span>
            )}
          </li>
        )}

        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;

          return (
            <li key={index} className="flex items-center">
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-accent truncate max-w-[150px] sm:max-w-[200px]"
                  title={item.label}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-foreground font-medium px-1.5 py-0.5 truncate max-w-[150px] sm:max-w-[200px]"
                  aria-current="page"
                  title={item.label}
                >
                  {item.label}
                </span>
              )}

              {!isLast && <span className="ml-1">{separatorElement}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Hook to build breadcrumbs programmatically
 */
export function useBreadcrumbs() {
  const [location] = useLocation();

  const setBreadcrumbs = (items: BreadcrumbItem[]) => {
    // This could be extended to use a store or context
    // For now, just return the items for component use
    return items;
  };

  const autoGenerate = () => {
    return generateBreadcrumbsFromPath(location);
  };

  return {
    location,
    setBreadcrumbs,
    autoGenerate,
    stageLabels,
    routeLabels,
  };
}

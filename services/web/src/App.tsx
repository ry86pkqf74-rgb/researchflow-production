import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AIApprovalGateProvider } from "@/components/ui/ai-approval-gate";
import { PhiGateProvider } from "@/components/ui/phi-gate";
import { SafetyBanner } from "@/components/safety/safety-banner";
import { ModeBanner } from "@/components/mode/ModeBanner";
import { DemoWatermark } from "@/components/governance/DemoWatermark";
import { AuthGate } from "@/components/mode/AuthGate";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { useModeStore } from "@/stores/mode-store";
import { useOrgStore } from "@/stores/org-store";
import { useAuth } from "@/hooks/use-auth";
import { useAppShortcuts } from "@/hooks/useGlobalShortcuts";
import { Loader2, Home as HomeIcon, LayoutDashboard, Workflow, Shield, Settings as SettingsIcon } from "lucide-react";
import '@/i18n'; // Initialize i18n
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import DemoLanding from "@/pages/demo-landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import WorkflowPage from "@/pages/workflow";
import GovernancePage from "@/pages/governance";
import GovernanceConsole from "@/pages/governance-console";
import PipelineDashboard from "@/pages/pipeline-dashboard";
import SAPBuilder from "@/pages/SAPBuilder";
import QualityDashboard from "@/pages/quality-dashboard";
import OrgSettings from "@/pages/org-settings";
import ReviewSessions from "@/pages/review-sessions";
import Billing from "@/pages/billing";
import SearchPage from "@/pages/search";
import Community from "@/pages/community";
import Onboarding from "@/pages/onboarding";
import Settings from "@/pages/settings";
import NotificationsPage from "@/pages/notifications";
import XRPage from "@/pages/xr";
import ImportBundlePage from "@/pages/import-bundle";
import WorkflowsPage from "@/pages/workflows";
import ProjectsPage from "@/pages/projects";
import ProjectDetailPage from "@/pages/projects/project-detail";
import SpreadsheetCellParse from "@/pages/spreadsheet-cell-parse";
import { OrgSelector } from "@/components/org";
import { AdaptiveNavigation } from "@/components/nav";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";

// Lazy load components that depend on reactflow (which may fail to load)
// This prevents the entire app from failing if reactflow is unavailable
const WorkflowBuilderPage = lazy(() => import("@/pages/workflow-builder"));

/**
 * Mode Initializer
 *
 * Determines the effective mode based on:
 * - DEMO: Unauthenticated users
 * - LIVE: Authenticated + AI enabled
 * - OFFLINE: Authenticated + AI disabled
 */
function ModeInitializer() {
  const setMode = useModeStore((state) => state.setMode);
  const aiEnabled = useModeStore((state) => state.aiEnabled);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    // Determine mode based on auth status and AI setting
    let effectiveMode: 'DEMO' | 'LIVE' | 'OFFLINE';

    if (!isAuthenticated) {
      effectiveMode = 'DEMO';
    } else if (aiEnabled) {
      effectiveMode = 'LIVE';
    } else {
      effectiveMode = 'OFFLINE';
    }

    console.log('[ModeInitializer] Setting mode:', effectiveMode, '(authenticated:', isAuthenticated, ', aiEnabled:', aiEnabled, ')');
    setMode(effectiveMode);
  }, [isAuthenticated, aiEnabled, authLoading, setMode]);

  return null;
}

/**
 * Organization Context Initializer (Task 102)
 *
 * Fetches organization context when user is authenticated.
 * Runs after mode is initialized. Works for both LIVE and OFFLINE modes.
 */
function OrgInitializer() {
  const { isLive, isOffline, isLoading: modeLoading } = useModeStore();
  const { user } = useAuth();
  const { fetchContext } = useOrgStore();

  useEffect(() => {
    // Fetch org context when user is authenticated (LIVE or OFFLINE mode)
    const isAuthenticated = isLive || isOffline;
    if (!modeLoading && isAuthenticated && user) {
      fetchContext().catch((error) => {
        console.error('[OrgInitializer] Failed to fetch org context:', error);
      });
    }
  }, [modeLoading, isLive, isOffline, user, fetchContext]);

  return null;
}

/**
 * Loading screen shown while mode is resolving
 */
function ModeLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" data-testid="mode-loader">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" aria-label="Loading" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Global Shortcuts Initializer
 *
 * Installs global keyboard shortcuts (Task 17)
 */
function ShortcutsInitializer() {
  useAppShortcuts();
  return null;
}

/**
 * Main Layout with Adaptive Navigation (Task 102)
 *
 * Provides sidebar with org selector and role-adaptive navigation
 * for authenticated pages in LIVE or OFFLINE mode.
 * Includes breadcrumbs for deep navigation (Task 11).
 */
function MainLayout({ children }: { children: React.ReactNode }) {
  const { isLive, isOffline } = useModeStore();
  const { user, isAuthenticated } = useAuth();

  // Show sidebar when authenticated (LIVE or OFFLINE mode)
  const showSidebar = (isLive || isOffline) && isAuthenticated;
  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen pt-7">
      {/* Sidebar with user info and navigation */}
      <aside className="w-52 min-w-52 border-r bg-muted/10 flex flex-col shrink-0">
        <div className="p-3 border-b">
          <div className="flex flex-col">
            <span className="font-medium text-sm truncate">{user?.displayName || user?.email || 'User'}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {user?.role?.toLowerCase() || 'researcher'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* SPA navigation links using wouter Link */}
          <nav className="space-y-1 px-2 py-3">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <HomeIcon className="h-4 w-4 shrink-0" />
              <span>Pipeline</span>
            </Link>
            <Link
              to="/pipeline"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/workflows"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Workflow className="h-4 w-4 shrink-0" />
              <span>Workflows</span>
            </Link>
            <Link
              to="/governance"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>Governance</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <SettingsIcon className="h-4 w-4 shrink-0" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

/**
 * Lazy loading fallback component
 */
function LazyFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Loading...</span>
    </div>
  );
}

/**
 * Protected route wrapper for LIVE/OFFLINE modes
 * Waits for mode resolution before rendering.
 * In LIVE/OFFLINE mode, requires authentication. In DEMO mode, accessible to all.
 * Supports lazy-loaded components with Suspense and ErrorBoundary for graceful failure handling.
 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLive, isOffline, isLoading } = useModeStore();

  // Wait for mode to resolve before rendering protected content
  if (isLoading) {
    return <ModeLoader />;
  }

  // LIVE or OFFLINE mode requires authentication
  if (isLive || isOffline) {
    return (
      <AuthGate requireAuth>
        <MainLayout>
          <ErrorBoundary context="Protected Route">
            <Suspense fallback={<LazyFallback />}>
              <Component />
            </Suspense>
          </ErrorBoundary>
        </MainLayout>
      </AuthGate>
    );
  }

  // DEMO mode - accessible to all
  return (
    <MainLayout>
      <ErrorBoundary context="Protected Route">
        <Suspense fallback={<LazyFallback />}>
          <Component />
        </Suspense>
      </ErrorBoundary>
    </MainLayout>
  );
}

/**
 * Home route that shows different content based on auth status:
 * - Authenticated users: Workflow interface (with sidebar in LIVE mode)
 * - Unauthenticated users: Marketing landing page
 */
function HomeRoute() {
  const { isLive, isLoading } = useModeStore();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  if (isLoading || authLoading) {
    return <ModeLoader />;
  }

  // Authenticated users always see the workflow interface
  if (isAuthenticated) {
    return (
      <MainLayout>
        <WorkflowPage />
      </MainLayout>
    );
  }

  // Unauthenticated users see the marketing landing page
  return <Home />;
}

function Router() {
  return (
    <Switch>
      {/* Home route - shows workflow in LIVE mode, landing page in DEMO mode */}
      <Route path="/">
        {() => <HomeRoute />}
      </Route>

      {/* Explicit workflow route - always shows workflow (protected in LIVE mode) */}
      <Route path="/workflow">
        {() => <ProtectedRoute component={WorkflowPage} />}
      </Route>

      {/* Marketing/demo landing page - always accessible */}
      <Route path="/demo" component={DemoLanding} />
      <Route path="/landing" component={Home} />

      {/* Auth routes - always accessible */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />

      {/* Legal/compliance pages - always accessible */}
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />

      {/* Protected routes - require auth in LIVE mode */}
      <Route path="/governance">
        {() => <ProtectedRoute component={GovernancePage} />}
      </Route>
      <Route path="/governance-console">
        {() => <ProtectedRoute component={GovernanceConsole} />}
      </Route>
      <Route path="/pipeline">
        {() => <ProtectedRoute component={PipelineDashboard} />}
      </Route>
      <Route path="/sap/:topicId/:researchId">
        {() => <ProtectedRoute component={SAPBuilder} />}
      </Route>
      <Route path="/quality">
        {() => <ProtectedRoute component={QualityDashboard} />}
      </Route>
      <Route path="/org/:orgId/settings">
        {() => <ProtectedRoute component={OrgSettings} />}
      </Route>
      <Route path="/review-sessions">
        {() => <ProtectedRoute component={ReviewSessions} />}
      </Route>
      <Route path="/org/:orgId/billing">
        {() => <ProtectedRoute component={Billing} />}
      </Route>
      <Route path="/search">
        {() => <ProtectedRoute component={SearchPage} />}
      </Route>
      <Route path="/community">
        {() => <ProtectedRoute component={Community} />}
      </Route>
      <Route path="/onboarding">
        {() => <ProtectedRoute component={Onboarding} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/notifications">
        {() => <ProtectedRoute component={NotificationsPage} />}
      </Route>
      <Route path="/xr">
        {() => <ProtectedRoute component={XRPage} />}
      </Route>
      <Route path="/import">
        {() => <ProtectedRoute component={ImportBundlePage} />}
      </Route>

      {/* Project Manager Routes (Phase 1) */}
      <Route path="/projects">
        {() => <ProtectedRoute component={ProjectsPage} />}
      </Route>
      <Route path="/projects/:id">
        {() => <ProtectedRoute component={ProjectDetailPage} />}
      </Route>

      <Route path="/workflows">
        {() => <ProtectedRoute component={WorkflowsPage} />}
      </Route>
      <Route path="/workflows/:id">
        {() => <ProtectedRoute component={WorkflowBuilderPage} />}
      </Route>
      <Route component={NotFound} />
      <Route path="/extraction/spreadsheet">
        {() => <ProtectedRoute component={SpreadsheetCellParse} />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="ros-theme">
      <QueryClientProvider client={queryClient}>
        <ModeInitializer />
        <OrgInitializer />
        <ShortcutsInitializer />
        <AIApprovalGateProvider initialMode="REQUIRE_EACH">
          <PhiGateProvider>
            <TooltipProvider>
              <SafetyBanner />
              <ModeBanner />
              <DemoWatermark />
              <div className="min-h-screen">
                <Toaster />
                <Router />
              </div>
            </TooltipProvider>
          </PhiGateProvider>
        </AIApprovalGateProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

import { useEffect } from "react";
import { Switch, Route } from "wouter";
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
import { useModeStore } from "@/stores/mode-store";
import { useOrgStore } from "@/stores/org-store";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import DemoLanding from "@/pages/demo-landing";
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
import XRPage from "@/pages/xr";
import ImportBundlePage from "@/pages/import-bundle";
import { OrgSelector } from "@/components/org";
import { AdaptiveNavigation } from "@/components/nav";

function ModeInitializer() {
  const setMode = useModeStore((state) => state.setMode);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchMode() {
      try {
        const response = await fetch('/api/governance/mode', {
          credentials: 'include',
        });
        
        if (cancelled) return;
        
        if (response.ok) {
          const data = await response.json();
          if (data.mode === 'LIVE' || data.mode === 'DEMO') {
            setMode(data.mode);
          } else {
            setMode('DEMO');
          }
        } else {
          setMode('DEMO');
        }
      } catch {
        if (!cancelled) {
          setMode('DEMO');
        }
      }
    }
    
    fetchMode();
    
    return () => {
      cancelled = true;
    };
  }, [setMode]);

  return null;
}

/**
 * Organization Context Initializer (Task 102)
 *
 * Fetches organization context when user is authenticated.
 * Runs after mode is initialized.
 */
function OrgInitializer() {
  const { isLive, isLoading: modeLoading } = useModeStore();
  const { user } = useAuthStore();
  const { fetchContext } = useOrgStore();

  useEffect(() => {
    // Only fetch org context in LIVE mode when user is authenticated
    if (!modeLoading && isLive && user) {
      fetchContext().catch((error) => {
        console.error('[OrgInitializer] Failed to fetch org context:', error);
      });
    }
  }, [modeLoading, isLive, user, fetchContext]);

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
 * Main Layout with Adaptive Navigation (Task 102)
 *
 * Provides sidebar with org selector and role-adaptive navigation
 * for authenticated pages in LIVE mode.
 */
function MainLayout({ children }: { children: React.ReactNode }) {
  const { isLive } = useModeStore();
  const { user } = useAuthStore();

  // Only show sidebar in LIVE mode when authenticated
  if (!isLive || !user) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar with org selector and adaptive navigation */}
      <aside className="w-64 border-r bg-muted/10 flex flex-col">
        <div className="p-4 border-b">
          <OrgSelector />
        </div>

        <div className="flex-1 overflow-y-auto">
          <AdaptiveNavigation />
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
 * Protected route wrapper for LIVE mode
 * Waits for mode resolution before rendering.
 * In LIVE mode, requires authentication. In DEMO mode, accessible to all.
 */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLive, isLoading } = useModeStore();

  // Wait for mode to resolve before rendering protected content
  if (isLoading) {
    return <ModeLoader />;
  }

  if (isLive) {
    return (
      <AuthGate requireAuth>
        <MainLayout>
          <Component />
        </MainLayout>
      </AuthGate>
    );
  }

  return (
    <MainLayout>
      <Component />
    </MainLayout>
  );
}

/**
 * Home route that shows different content based on mode:
 * - DEMO mode: Marketing landing page
 * - LIVE mode: Workflow interface (requires auth)
 */
function HomeRoute() {
  const { isLive, isLoading } = useModeStore();

  if (isLoading) {
    return <ModeLoader />;
  }

  // In LIVE mode, show the workflow interface with auth requirement
  if (isLive) {
    return (
      <AuthGate requireAuth>
        <MainLayout>
          <WorkflowPage />
        </MainLayout>
      </AuthGate>
    );
  }

  // In DEMO mode, show the marketing landing page (no sidebar)
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
      <Route path="/xr">
        {() => <ProtectedRoute component={XRPage} />}
      </Route>
      <Route path="/import">
        {() => <ProtectedRoute component={ImportBundlePage} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="ros-theme">
      <QueryClientProvider client={queryClient}>
        <ModeInitializer />
        <OrgInitializer />
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

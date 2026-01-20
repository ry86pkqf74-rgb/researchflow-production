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
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import DemoLanding from "@/pages/demo-landing";
import GovernancePage from "@/pages/governance";
import GovernanceConsole from "@/pages/governance-console";
import PipelineDashboard from "@/pages/pipeline-dashboard";
import SAPBuilder from "@/pages/SAPBuilder";
import OfflinePage from "@/pages/offline";
import { lazy, Suspense } from "react";

// Feature-gated lazy imports
const CommunityPage = lazy(() => import("@/pages/community"));
const AnalyticsPage = lazy(() => import("@/pages/analytics"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const SearchPage = lazy(() => import("@/pages/search"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const ThemeSettingsPage = lazy(() => import("@/pages/settings/theme"));

// Feature flags from env
const FEATURE_FORUM = import.meta.env.VITE_FEATURE_FORUM === 'true';
const FEATURE_XR = import.meta.env.VITE_FEATURE_XR === 'true';

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
        <Component />
      </AuthGate>
    );
  }
  
  return <Component />;
}

function LazyRoute({ component: Component }: { component: React.LazyExoticComponent<React.ComponentType> }) {
  return (
    <Suspense fallback={<ModeLoader />}>
      <Component />
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes - accessible in both DEMO and LIVE modes */}
      <Route path="/" component={Home} />
      <Route path="/demo" component={DemoLanding} />
      <Route path="/offline" component={OfflinePage} />
      <Route path="/onboarding">
        {() => <LazyRoute component={OnboardingPage} />}
      </Route>

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
      <Route path="/analytics">
        {() => <ProtectedRoute component={() => <LazyRoute component={AnalyticsPage} />} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={() => <LazyRoute component={ProfilePage} />} />}
      </Route>
      <Route path="/search">
        {() => <ProtectedRoute component={() => <LazyRoute component={SearchPage} />} />}
      </Route>
      <Route path="/settings/theme">
        {() => <ProtectedRoute component={() => <LazyRoute component={ThemeSettingsPage} />} />}
      </Route>

      {/* Feature-gated routes */}
      {FEATURE_FORUM && (
        <Route path="/community">
          {() => <ProtectedRoute component={() => <LazyRoute component={CommunityPage} />} />}
        </Route>
      )}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="ros-theme">
      <QueryClientProvider client={queryClient}>
        <ModeInitializer />
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

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

function Router() {
  return (
    <Switch>
      {/* Public routes - accessible in both DEMO and LIVE modes */}
      <Route path="/" component={Home} />
      <Route path="/demo" component={DemoLanding} />
      
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

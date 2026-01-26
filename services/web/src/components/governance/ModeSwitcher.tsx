import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, WifiOff, Lock, Info } from "lucide-react";
import { GovernanceMode } from "@/hooks/useGovernanceMode";
import { toast } from "@/hooks/use-toast";
import { useModeStore } from "@/stores/mode-store";
import { useAuth } from "@/hooks/use-auth";

interface ModeSwitcherProps {
  currentMode: GovernanceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ModeSwitcher - AI Enablement Toggle
 *
 * Mode Logic (automatic based on state):
 * - DEMO: Unauthenticated (landing page only)
 * - LIVE: Authenticated + AI enabled
 * - OFFLINE: Authenticated + AI disabled
 */
export function ModeSwitcher({ currentMode, open, onOpenChange }: ModeSwitcherProps) {
  const { isAuthenticated } = useAuth();
  const aiEnabled = useModeStore((state) => state.aiEnabled);
  const setAIEnabled = useModeStore((state) => state.setAIEnabled);
  const setModeStore = useModeStore((state) => state.setMode);

  const handleAIToggle = (enabled: boolean) => {
    setAIEnabled(enabled);

    // Update mode based on new AI setting
    if (isAuthenticated) {
      const newMode = enabled ? 'LIVE' : 'OFFLINE';
      setModeStore(newMode);

      toast({
        title: enabled ? "AI Enabled" : "AI Disabled",
        description: enabled
          ? "You are now in Live Mode with AI assistance"
          : "You are now in Offline Mode without AI",
      });
    }

    onOpenChange(false);
  };

  // For unauthenticated users, show login prompt
  if (!isAuthenticated) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Login Required
            </DialogTitle>
            <DialogDescription>
              You are currently viewing the Demo. Log in to access the full system.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Demo Mode</strong> allows you to explore the interface with synthetic data.
                <br /><br />
                <a href="/login" className="text-primary underline font-medium">
                  Log in
                </a> to access Live Mode with AI assistance or Offline Mode without AI.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Continue Demo
            </Button>
            <Button onClick={() => window.location.href = '/login'}>
              Log In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // For authenticated users, show AI toggle
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
          <DialogDescription>
            Control AI assistance for your research workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Mode Display */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-3">
              {aiEnabled ? (
                <Zap className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium">
                  {aiEnabled ? "Live Mode" : "Offline Mode"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {aiEnabled
                    ? "AI assistance is enabled"
                    : "Working without AI assistance"}
                </p>
              </div>
            </div>
          </div>

          {/* AI Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-1">
              <Label htmlFor="ai-toggle" className="font-medium cursor-pointer">
                Enable AI Assistance
              </Label>
              <p className="text-sm text-muted-foreground">
                AI helps with literature search, analysis, and manuscript drafting
              </p>
            </div>
            <Switch
              id="ai-toggle"
              checked={aiEnabled}
              onCheckedChange={handleAIToggle}
            />
          </div>

          {/* Mode Explanation */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <Zap className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Live Mode</p>
                <p className="text-xs text-muted-foreground">
                  Full AI-powered features including literature search, IRB generation, statistical analysis, and manuscript drafting.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <WifiOff className="h-4 w-4 text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Offline Mode</p>
                <p className="text-xs text-muted-foreground">
                  Work without AI assistance. Manual data entry and analysis only. No AI API calls.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

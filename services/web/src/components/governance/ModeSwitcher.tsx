import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle2, Database, Power, Zap, Lock } from "lucide-react";
import { GovernanceMode } from "@/hooks/useGovernanceMode";
import { toast } from "@/hooks/use-toast";
import { useModeStore } from "@/stores/mode-store";
import { useAuth } from "@/hooks/use-auth";

interface ModeSwitcherProps {
  currentMode: GovernanceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ModeOption {
  value: GovernanceMode;
  label: string;
  description: string;
  icon: typeof Database;
  warning?: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "DEMO",
    label: "Demo Mode",
    description: "Safe exploration with synthetic data. No real patient data accessible.",
    icon: Database,
  },
  {
    value: "LIVE",
    label: "Live Mode",
    description: "Full system access with real data and all features enabled.",
    icon: Zap,
    warning: "This enables access to real patient data. Ensure proper IRB approval.",
  },
];

async function changeMode(mode: GovernanceMode): Promise<{ mode: GovernanceMode }> {
  const token = localStorage.getItem('auth_token');
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ` + token;
  }
  
  const response = await fetch("/api/governance/mode", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ mode }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to change mode", message: "Unknown error" }));
    const errorMessage = error.message || error.error || response.status + ": " + response.statusText;
    throw new Error(errorMessage);
  }

  return response.json();
}

export function ModeSwitcher({ currentMode, open, onOpenChange }: ModeSwitcherProps) {
  const [selectedMode, setSelectedMode] = useState<GovernanceMode>(currentMode);
  const queryClient = useQueryClient();
  const setModeStore = useModeStore((state) => state.setMode);
  const { isAuthenticated } = useAuth();

  const mutation = useMutation({
    mutationFn: changeMode,
    onSuccess: (data) => {
      setModeStore(data.mode);

      queryClient.invalidateQueries({ queryKey: ["/api/governance/mode"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/state"] });

      toast({
        title: "Mode changed successfully",
        description: "Switched to " + data.mode + " mode",
      });

      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to change mode",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canSwitchToLive = isAuthenticated;

  const selectedOption = MODE_OPTIONS.find((opt) => opt.value === selectedMode);
  const hasChanged = selectedMode !== currentMode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Switch Governance Mode</DialogTitle>
          <DialogDescription>
            Change the system's governance mode. This affects data access and feature availability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={selectedMode}
            onValueChange={(value) => {
              if (value === 'LIVE' && !canSwitchToLive) {
                toast({
                  title: "Authentication Required",
                  description: "Please log in to switch to Live Mode",
                  variant: "destructive",
                });
                return;
              }
              setSelectedMode(value as GovernanceMode);
            }}
            disabled={mutation.isPending}
          >
            <div className="space-y-3">
              {MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedMode === option.value;
                const isCurrent = currentMode === option.value;
                const isLocked = option.value === 'LIVE' && !canSwitchToLive;

                return (
                  <div
                    key={option.value}
                    className={"relative flex items-start space-x-3 rounded-lg border p-4 transition-colors " +
                      (isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50") +
                      (isCurrent ? " ring-2 ring-green-500 ring-offset-2" : "") +
                      (isLocked ? " opacity-50 cursor-not-allowed" : "")}
                  >
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="mt-1"
                      disabled={isLocked}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <Label
                          htmlFor={option.value}
                          className={"font-medium flex items-center gap-2 " + (isLocked ? "cursor-not-allowed" : "cursor-pointer")}
                        >
                          {option.label}
                          {isCurrent && (
                            <span className="text-xs text-green-600 dark:text-green-400">
                              (Current)
                            </span>
                          )}
                          {isLocked && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <Lock className="h-3 w-3" />
                              Login Required
                            </span>
                          )}
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                      {isLocked && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          <a href="/login" className="underline hover:no-underline">Log in</a> to access Live Mode
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </RadioGroup>

          {selectedOption?.warning && hasChanged && canSwitchToLive && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{selectedOption.warning}</AlertDescription>
            </Alert>
          )}

          {!hasChanged && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>You are currently in {currentMode} mode</AlertDescription>
            </Alert>
          )}

          {selectedMode === 'LIVE' && !canSwitchToLive && hasChanged && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                You must <a href="/login" className="underline font-medium">log in</a> to switch to Live Mode
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate(selectedMode)}
            disabled={!hasChanged || mutation.isPending || (selectedMode === 'LIVE' && !canSwitchToLive)}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mutation.isPending ? "Switching..." : "Switch Mode"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Shield, Lock, AlertTriangle, Info, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GovernanceModeControl } from "./GovernanceModeControl";
import { BLOCKED_MESSAGES, getBlockedMessage } from "@/lib/blocked-messages";

export interface BlockedActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageCode: keyof typeof BLOCKED_MESSAGES;
  attemptedAction?: string;
  userRole?: string;
}

const MESSAGE_ICONS: Record<keyof typeof BLOCKED_MESSAGES, typeof Shield> = {
  DEMO_PHI_ACCESS: Shield,
  INSUFFICIENT_ROLE: Lock,
  EXPORT_RESTRICTED: Lock,
  PHI_REVEAL_RESTRICTED: Shield,
  AUDIT_REQUIRED: Info,
};

export function BlockedActionModal({
  isOpen,
  onClose,
  messageCode,
  attemptedAction,
  userRole,
}: BlockedActionModalProps) {
  const params: Record<string, string> = {};
  if (userRole) params.role = userRole;
  if (attemptedAction) params.action = attemptedAction;

  const message = getBlockedMessage(messageCode, params);
  const Icon = MESSAGE_ICONS[messageCode] || AlertTriangle;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
        aria-labelledby="blocked-action-title"
        aria-describedby="blocked-action-description"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Icon className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            </div>
            <DialogTitle id="blocked-action-title" className="text-amber-900 dark:text-amber-100">
              {message.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <DialogDescription id="blocked-action-description" className="text-amber-800 dark:text-amber-200">
            {message.description}
          </DialogDescription>

          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-700 dark:text-amber-300">Current mode:</span>
            <GovernanceModeControl variant="compact" />
          </div>

          <div className="bg-amber-100/50 dark:bg-amber-900/20 rounded-md p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">What you can do:</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{message.suggestion}</p>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {message.learnMoreUrl && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
            >
              <a href={message.learnMoreUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" aria-hidden="true" />
                Learn More
              </a>
            </Button>
          )}
          <Button onClick={onClose} className="ml-auto">
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

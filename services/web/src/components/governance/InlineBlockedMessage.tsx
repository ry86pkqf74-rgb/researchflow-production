import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InlineBlockedMessageProps {
  reason: string;
  actionType: 'view' | 'edit' | 'export' | 'reveal';
  compact?: boolean;
  onLearnMore?: () => void;
}

const ACTION_LABELS: Record<InlineBlockedMessageProps['actionType'], string> = {
  view: 'View',
  edit: 'Edit',
  export: 'Export',
  reveal: 'Reveal',
};

export function InlineBlockedMessage({
  reason,
  actionType,
  compact = false,
  onLearnMore,
}: InlineBlockedMessageProps) {
  const actionLabel = ACTION_LABELS[actionType];

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1 dark:bg-amber-950/20 dark:border-amber-800"
        role="alert"
        aria-live="polite"
      >
        <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs text-amber-700 dark:text-amber-300">{reason}</span>
        {onLearnMore && (
          <button
            onClick={onLearnMore}
            className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 underline ml-1"
          >
            Learn more
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md p-3 dark:bg-amber-950/20 dark:border-amber-800"
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
          {actionLabel} Blocked
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">{reason}</p>
        {onLearnMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onLearnMore}
            className="mt-2 h-auto p-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          >
            Learn more
          </Button>
        )}
      </div>
    </div>
  );
}

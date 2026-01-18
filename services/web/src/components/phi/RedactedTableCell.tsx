import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { usePhiRedaction, type PhiType } from "./hooks/usePhiRedaction";
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RedactedTableCellProps {
  id: string;
  children: React.ReactNode;
  phiType: PhiType;
  isRevealed?: boolean;
  onToggle?: (id: string, revealed: boolean) => void;
  className?: string;
}

export function RedactedTableCell({
  id,
  children,
  phiType,
  isRevealed: isRevealedProp,
  onToggle,
  className,
}: RedactedTableCellProps) {
  const [isToggling, setIsToggling] = useState(false);
  const { 
    canReveal: hookCanReveal, 
    isRevealed: hookIsRevealed, 
    reveal, 
    hide, 
    logRevealAttempt 
  } = usePhiRedaction();

  const canReveal = hookCanReveal;
  const revealed = hookCanReveal && (isRevealedProp ?? hookIsRevealed(id));

  const handleToggle = useCallback(async () => {
    if (!canReveal || isToggling) return;

    setIsToggling(true);
    try {
      if (revealed) {
        hide(id);
        onToggle?.(id, false);
      } else {
        const success = await reveal(id);
        await logRevealAttempt(id, phiType, success);
        if (success) {
          onToggle?.(id, true);
        }
      }
    } finally {
      setIsToggling(false);
    }
  }, [canReveal, isToggling, revealed, id, phiType, hide, reveal, logRevealAttempt, onToggle]);

  return (
    <td
      className={cn(
        "relative border-l-2 transition-all duration-200",
        revealed ? "border-l-green-400" : "border-l-amber-400",
        className
      )}
      data-testid={`cell-phi-${id}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex-1 transition-all duration-200",
            !revealed && "blur-[4px] select-none pointer-events-none"
          )}
          data-testid={revealed ? `content-revealed-${id}` : `content-blurred-${id}`}
        >
          {children}
        </div>

        {canReveal && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0 shrink-0",
              revealed 
                ? "text-green-600 hover:text-green-700" 
                : "text-amber-500 hover:text-amber-600"
            )}
            onClick={handleToggle}
            disabled={isToggling}
            data-testid={`button-toggle-${id}`}
          >
            {isToggling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : revealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">
              {revealed ? "Hide PHI" : "Reveal PHI"}
            </span>
          </Button>
        )}

        {!canReveal && !revealed && (
          <span
            className="shrink-0"
            title="You do not have permission to view this PHI"
            data-testid={`indicator-locked-cell-${id}`}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
          </span>
        )}
      </div>
    </td>
  );
}

export interface RedactedTableRowProps {
  children: React.ReactNode;
  hasPhi?: boolean;
  className?: string;
}

export function RedactedTableRow({
  children,
  hasPhi = false,
  className,
}: RedactedTableRowProps) {
  return (
    <tr
      className={cn(
        hasPhi && "bg-amber-50/50 dark:bg-amber-900/10",
        className
      )}
      data-testid={hasPhi ? "row-contains-phi" : undefined}
    >
      {children}
    </tr>
  );
}

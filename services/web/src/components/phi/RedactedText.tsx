import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePhiRedaction, type PhiType } from "./hooks/usePhiRedaction";

export interface RedactedTextProps {
  id: string;
  text: string;
  phiType: PhiType;
  canReveal?: boolean;
  onRevealAttempt?: (id: string, phiType: PhiType) => Promise<boolean>;
  className?: string;
  maskCharacter?: string;
  maskLength?: number;
}

export function RedactedText({
  id,
  text,
  phiType,
  canReveal: canRevealProp,
  onRevealAttempt,
  className,
  maskCharacter = "•",
  maskLength,
}: RedactedTextProps) {
  const [isRevealing, setIsRevealing] = useState(false);
  const { canReveal: hookCanReveal, isRevealed, reveal, hide, logRevealAttempt } = usePhiRedaction();

  const canReveal = hookCanReveal && (canRevealProp ?? true);
  const revealed = hookCanReveal && isRevealed(id);

  const maskedText = maskLength
    ? maskCharacter.repeat(maskLength)
    : maskCharacter.repeat(Math.max(text.length, 6));

  const handleRevealClick = useCallback(async () => {
    if (!canReveal || isRevealing) return;

    setIsRevealing(true);
    try {
      let success = false;

      if (onRevealAttempt) {
        success = await onRevealAttempt(id, phiType);
      } else {
        success = await reveal(id);
      }

      await logRevealAttempt(id, phiType, success);
    } finally {
      setIsRevealing(false);
    }
  }, [canReveal, isRevealing, id, phiType, onRevealAttempt, reveal, logRevealAttempt]);

  const handleHideClick = useCallback(() => {
    hide(id);
  }, [hide, id]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        className
      )}
      data-testid={`redacted-text-${id}`}
    >
      <span
        className={cn(
          "px-2 py-0.5 rounded transition-all duration-200",
          revealed
            ? "bg-amber-100 dark:bg-amber-900/30 text-foreground font-mono text-sm"
            : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 font-mono"
        )}
        data-testid={revealed ? `text-revealed-${id}` : `text-masked-${id}`}
      >
        {revealed ? text : maskedText}
      </span>

      {revealed ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleHideClick}
          data-testid={`button-hide-${id}`}
        >
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="sr-only">Hide PHI</span>
        </Button>
      ) : canReveal ? (
        <Button
          variant="default"
          size="sm"
          className="h-6 px-2 text-xs bg-amber-500 hover:bg-amber-600 text-white gap-1"
          onClick={handleRevealClick}
          disabled={isRevealing}
          data-testid={`button-reveal-${id}`}
        >
          {isRevealing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
          Show
        </Button>
      ) : (
        <span
          className="inline-flex items-center text-xs text-muted-foreground"
          title="You do not have permission to view this PHI"
          data-testid={`indicator-locked-${id}`}
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
        </span>
      )}
    </span>
  );
}

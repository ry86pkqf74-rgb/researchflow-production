import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export interface PhiMatch {
  start: number;
  end: number;
  type: string;
  value: string;
}

export interface RedactionPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalText: string;
  phiMatches: PhiMatch[];
  onConfirmRedaction: (redactedText: string) => Promise<void>;
  onCancel: () => void;
}

function highlightPhi(text: string, matches: PhiMatch[]): React.ReactNode[] {
  if (matches.length === 0) {
    return [<span key="text">{text}</span>];
  }

  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);
  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedMatches.forEach((match, idx) => {
    if (match.start > lastIndex) {
      result.push(
        <span key={`text-${idx}`}>{text.slice(lastIndex, match.start)}</span>
      );
    }

    result.push(
      <span
        key={`phi-${idx}`}
        className="bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 px-1 rounded font-medium"
        title={`${match.type}: ${match.value}`}
      >
        {text.slice(match.start, match.end)}
      </span>
    );

    lastIndex = match.end;
  });

  if (lastIndex < text.length) {
    result.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }

  return result;
}

function applyRedaction(text: string, matches: PhiMatch[]): string {
  if (matches.length === 0) return text;

  const sortedMatches = [...matches].sort((a, b) => b.start - a.start);
  let result = text;

  sortedMatches.forEach((match) => {
    const placeholder = `[REDACTED-${match.type.toUpperCase()}]`;
    result = result.slice(0, match.start) + placeholder + result.slice(match.end);
  });

  return result;
}

export function RedactionPreviewModal({
  open,
  onOpenChange,
  originalText,
  phiMatches,
  onConfirmRedaction,
  onCancel,
}: RedactionPreviewModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const redactedText = applyRedaction(originalText, phiMatches);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirmRedaction(redactedText);
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const phiTypes = [...new Set(phiMatches.map((m) => m.type))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl max-h-[90vh]"
        data-testid="modal-redaction-preview"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <DialogTitle>Redaction Preview</DialogTitle>
              <DialogDescription>
                Review the original text and redacted version side-by-side
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {phiMatches.length} PHI item{phiMatches.length !== 1 ? "s" : ""}{" "}
              detected:
            </span>
            {phiTypes.map((type) => (
              <Badge
                key={type}
                variant="outline"
                className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
              >
                {type} (
                {phiMatches.filter((m) => m.type === type).length})
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Eye className="w-4 h-4 text-red-500" />
                <span>Original Text</span>
                <Badge
                  variant="destructive"
                  className="text-xs"
                >
                  Contains PHI
                </Badge>
              </div>
              <ScrollArea
                className="h-[300px] rounded-lg border bg-card p-4"
                data-testid="panel-original-text"
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
                  {highlightPhi(originalText, phiMatches)}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <EyeOff className="w-4 h-4 text-green-500" />
                <span>Redacted Text</span>
                <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Safe
                </Badge>
              </div>
              <ScrollArea
                className="h-[300px] rounded-lg border bg-card p-4"
                data-testid="panel-redacted-text"
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
                  {redactedText.split(/(\[REDACTED-[A-Z]+\])/).map((part, idx) =>
                    part.startsWith("[REDACTED-") ? (
                      <span
                        key={idx}
                        className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1 rounded font-medium"
                      >
                        {part}
                      </span>
                    ) : (
                      <span key={idx}>{part}</span>
                    )
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-red-500">PHI Detected</span>
              <ArrowRight className="w-4 h-4" />
              <span className="text-green-500">Safely Redacted</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isConfirming}
            data-testid="button-redaction-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="bg-green-600 hover:bg-green-700 text-white"
            data-testid="button-redaction-confirm"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Confirm Redaction
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

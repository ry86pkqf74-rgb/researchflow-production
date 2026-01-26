import { AlertTriangle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FatiguePolicyBannerProps {
  variant?: "default" | "compact";
  className?: string;
  showLearnMore?: boolean;
}

export function FatiguePolicyBanner({
  variant = "default",
  className,
  showLearnMore = true,
}: FatiguePolicyBannerProps) {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs",
          className
        )}
        data-testid="banner-fatigue-policy-compact"
      >
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-muted-foreground">
          AI content requires human review for accuracy and bias
        </span>
      </div>
    );
  }

  return (
    <Alert
      className={cn(
        "bg-amber-500/10 border-amber-500/30",
        className
      )}
      data-testid="banner-fatigue-policy"
    >
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-600 dark:text-amber-400 font-semibold">
        AI Governance Notice
      </AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        <p className="mb-2">
          AI-generated content requires human review. Watch for hallucinations,
          fatigue in long sessions, and potential bias in suggestions.
        </p>
        {showLearnMore && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-primary"
            asChild
            data-testid="link-governance-policy"
          >
            <a href="/governance">
              View full governance policy
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

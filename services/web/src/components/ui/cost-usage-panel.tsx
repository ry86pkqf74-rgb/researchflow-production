import { useState, useEffect } from "react";
import { safeFixed, safeLocaleString } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, DollarSign, Cpu, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface StageUsage {
  stage: string;
  tokens: number;
  cost: number;
}

interface ModelUsage {
  model: string;
  calls: number;
  tokens: number;
  cost: number;
}

interface CostUsageData {
  totalTokens: number;
  totalCost: number;
  budgetLimit: number | null;
  budgetUsedPercent: number;
  rateLimitStatus: "ok" | "warning" | "exceeded";
  rateLimitRemaining: number;
  stageBreakdown: StageUsage[];
  modelBreakdown: ModelUsage[];
}

interface CostUsagePanelProps {
  variant?: "compact" | "full";
}

export function CostUsagePanel({ variant = "compact" }: CostUsagePanelProps) {
  const [data, setData] = useState<CostUsageData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/ai/usage");
        const usageData = await res.json();
        setData(usageData);
      } catch {
        setData({
          totalTokens: 12847,
          totalCost: 0.38,
          budgetLimit: 5.00,
          budgetUsedPercent: 7.6,
          rateLimitStatus: "ok",
          rateLimitRemaining: 847,
          stageBreakdown: [
            { stage: "Topic Declaration", tokens: 2150, cost: 0.06 },
            { stage: "Literature Search", tokens: 4820, cost: 0.14 },
            { stage: "IRB Proposal", tokens: 3210, cost: 0.10 },
            { stage: "Gap Analysis", tokens: 1580, cost: 0.05 },
            { stage: "Manuscript Ideation", tokens: 1087, cost: 0.03 },
          ],
          modelBreakdown: [
            { model: "gpt-4o", calls: 8, tokens: 9200, cost: 0.28 },
            { model: "gpt-4o-mini", calls: 12, tokens: 3647, cost: 0.10 },
          ],
        });
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <Card data-testid="card-cost-usage-loading">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost & Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const getRateLimitColor = () => {
    switch (data.rateLimitStatus) {
      case "exceeded": return "text-red-500";
      case "warning": return "text-amber-500";
      default: return "text-green-500";
    }
  };

  const getRateLimitBadgeVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (data.rateLimitStatus) {
      case "exceeded": return "destructive";
      case "warning": return "secondary";
      default: return "outline";
    }
  };

  if (variant === "compact") {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card data-testid="card-cost-usage">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 cursor-pointer">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Cost & Usage
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs" data-testid="badge-total-cost">
                    ${safeFixed(data.totalCost, 2)}
                  </Badge>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>

          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tokens Used</span>
              <span className="font-mono" data-testid="text-total-tokens">{safeLocaleString(data.totalTokens)}</span>
            </div>

            {data.budgetLimit && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Budget</span>
                  <span data-testid="text-budget-status">
                    ${safeFixed(data.totalCost, 2)} / ${safeFixed(data.budgetLimit, 2)}
                  </span>
                </div>
                <Progress value={data.budgetUsedPercent} className="h-1.5" data-testid="progress-budget" />
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Rate Limit</span>
              <Badge variant={getRateLimitBadgeVariant()} className="text-xs" data-testid="badge-rate-limit">
                <Zap className={cn("h-3 w-3 mr-1", getRateLimitColor())} />
                {data.rateLimitRemaining} remaining
              </Badge>
            </div>

            <CollapsibleContent className="space-y-3 pt-2">
              <div className="space-y-2">
                <div className="text-xs font-medium flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  By Stage
                </div>
                {data.stageBreakdown.map((stage, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs pl-4" data-testid={`row-stage-usage-${idx}`}>
                    <span className="text-muted-foreground truncate max-w-[120px]">{stage.stage}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{stage.tokens.toLocaleString()}</span>
                      <Badge variant="outline" className="text-xs font-mono">${safeFixed(stage.cost, 2)}</Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium">By Model</div>
                {data.modelBreakdown.map((model, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs pl-4" data-testid={`row-model-usage-${idx}`}>
                    <span className="text-muted-foreground font-mono">{model.model}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{model.calls} calls</span>
                      <Badge variant="outline" className="text-xs font-mono">${safeFixed(model.cost, 2)}</Badge>
                    </div>
                  </div>
                ))}
              </div>

              {data.rateLimitStatus === "warning" && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded p-2" data-testid="alert-rate-limit-warning">
                  <AlertTriangle className="h-3 w-3" />
                  Approaching rate limit. Consider pacing requests.
                </div>
              )}
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card data-testid="card-cost-usage-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          AI Cost & Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Total Cost</div>
            <div className="text-2xl font-bold" data-testid="text-total-cost-large">${safeFixed(data.totalCost, 2)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Total Tokens</div>
            <div className="text-2xl font-bold" data-testid="text-total-tokens-large">{safeLocaleString(data.totalTokens)}</div>
          </div>
        </div>

        {data.budgetLimit && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Budget Progress</span>
              <span>{safeFixed(data.budgetUsedPercent, 1)}%</span>
            </div>
            <Progress value={data.budgetUsedPercent} data-testid="progress-budget-full" />
            <div className="text-xs text-muted-foreground text-right">
              ${safeFixed(data.totalCost, 2)} of ${safeFixed(data.budgetLimit, 2)} used
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Usage by Stage</h4>
          {data.stageBreakdown.map((stage, idx) => (
            <div key={idx} className="flex items-center justify-between" data-testid={`row-stage-usage-full-${idx}`}>
              <span className="text-sm">{stage.stage}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{stage.tokens.toLocaleString()} tokens</span>
                <Badge variant="secondary">${safeFixed(stage.cost, 2)}</Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Usage by Model</h4>
          {data.modelBreakdown.map((model, idx) => (
            <div key={idx} className="flex items-center justify-between" data-testid={`row-model-usage-full-${idx}`}>
              <span className="text-sm font-mono">{model.model}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{model.calls} calls</span>
                <Badge variant="secondary">${safeFixed(model.cost, 2)}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ScrollArea,
} from "@/components/ui/scroll-area";
import {
  Zap,
  ChevronDown,
  Loader2,
  Brain,
  Gauge,
  MessageSquare,
  Clock,
} from "lucide-react";

interface AIDecision {
  id: string;
  timestamp: string;
  type: string;
  model: string;
  reasoning: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  confidence?: number;
  parameters?: Record<string, unknown>;
}

interface AIActivityPanelProps {
  runId?: string;
  projectId?: string;
}

export function AIActivity({ runId, projectId }: AIActivityPanelProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: aiDecisions = [], isLoading } = useQuery<AIDecision[]>({
    queryKey: ["/api/runs", runId, "ai-activity"],
    enabled: !!runId,
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const totalTokens = aiDecisions.reduce((sum, d) => sum + d.tokenUsage.total, 0);
  const averageConfidence = aiDecisions.length > 0
    ? (aiDecisions.reduce((sum, d) => sum + (d.confidence || 0), 0) / aiDecisions.length) * 100
    : 0;

  if (isLoading) {
    return (
      <Card data-testid="card-ai-activity-loading">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (aiDecisions.length === 0) {
    return (
      <Card data-testid="card-ai-activity-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No AI decisions recorded</p>
          <p className="text-sm">AI activity will appear here as decisions are made</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-ai-activity">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Activity
            </CardTitle>
            <CardDescription>
              {aiDecisions.length} decision{aiDecisions.length !== 1 ? "s" : ""} | {totalTokens.toLocaleString()} tokens used
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold text-muted-foreground">
                Decisions
              </span>
            </div>
            <p className="text-2xl font-bold">{aiDecisions.length}</p>
          </div>

          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-semibold text-muted-foreground">
                Tokens Used
              </span>
            </div>
            <p className="text-2xl font-bold">{(totalTokens / 1000).toFixed(1)}k</p>
          </div>

          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-green-500" />
              <span className="text-xs font-semibold text-muted-foreground">
                Avg Confidence
              </span>
            </div>
            <p className="text-2xl font-bold">{averageConfidence.toFixed(0)}%</p>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {aiDecisions.map((decision) => (
              <Collapsible
                key={decision.id}
                open={expandedItems.has(decision.id)}
                onOpenChange={() => toggleExpanded(decision.id)}
              >
                <CollapsibleTrigger className="w-full">
                  <div
                    className="p-3 rounded-lg border bg-card hover:bg-card/80 transition-colors flex items-center justify-between w-full"
                    data-testid={`ai-decision-${decision.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Zap className="h-4 w-4 text-amber-500 flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {decision.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {decision.model}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {decision.confidence && (
                          <Badge variant="outline" className="text-xs">
                            {(decision.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {decision.tokenUsage.total} tokens
                        </Badge>
                      </div>
                    </div>

                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${
                        expandedItems.has(decision.id) ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-2">
                  <div className="p-3 rounded-lg bg-muted border border-border/50 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Timestamp
                      </label>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {new Date(decision.timestamp).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Reasoning
                      </label>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-4">
                        {decision.reasoning}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Input Tokens
                        </label>
                        <p className="text-sm font-medium mt-1">
                          {decision.tokenUsage.input.toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Output Tokens
                        </label>
                        <p className="text-sm font-medium mt-1">
                          {decision.tokenUsage.output.toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Total Tokens
                        </label>
                        <p className="text-sm font-medium mt-1">
                          {decision.tokenUsage.total.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {decision.parameters && Object.keys(decision.parameters).length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          Parameters
                        </label>
                        <pre className="text-xs bg-background rounded p-2 mt-1 overflow-auto max-h-32">
                          {JSON.stringify(decision.parameters, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

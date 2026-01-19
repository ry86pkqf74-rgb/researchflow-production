/**
 * Gap Analysis Component
 *
 * Visualizes research gaps identified in literature.
 * Shows gap types, severity, and recommendations.
 */

import { useState, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Target,
  Search,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  Users,
  Calendar,
  MapPin,
  Network,
  Beaker,
  Lightbulb,
  BarChart3,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Paper, Gap, GapAnalysisResult, GapAnalysisProps } from "./types";

const GAP_TYPE_ICONS: Record<Gap["type"], React.ReactNode> = {
  topic: <Target className="h-4 w-4" />,
  methodology: <Beaker className="h-4 w-4" />,
  population: <Users className="h-4 w-4" />,
  temporal: <Calendar className="h-4 w-4" />,
  geographic: <MapPin className="h-4 w-4" />,
  network: <Network className="h-4 w-4" />,
};

const GAP_TYPE_LABELS: Record<Gap["type"], string> = {
  topic: "Topic Gap",
  methodology: "Methodology Gap",
  population: "Population Gap",
  temporal: "Temporal Gap",
  geographic: "Geographic Gap",
  network: "Network Gap",
};

const SEVERITY_COLORS: Record<Gap["severity"], string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  low: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

function GapCard({ gap, index }: { gap: Gap; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`border-l-4 ${gap.severity === "high" ? "border-l-red-500" : gap.severity === "medium" ? "border-l-amber-500" : "border-l-blue-500"}`}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  {GAP_TYPE_ICONS[gap.type]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {GAP_TYPE_LABELS[gap.type]}
                    </Badge>
                    <Badge className={SEVERITY_COLORS[gap.severity]}>
                      {gap.severity.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(gap.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-sm font-medium">{gap.description}</p>
                </div>
              </div>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            <Separator />

            {/* Evidence */}
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase">
                Evidence
              </h5>
              <ul className="space-y-1">
                {gap.evidence.map((e, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground">-</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Suggested Research */}
            <div className="p-3 bg-green-500/10 rounded-lg">
              <h5 className="text-xs font-medium text-green-600 uppercase mb-1 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Suggested Research
              </h5>
              <p className="text-sm">{gap.suggestedResearch}</p>
            </div>

            {/* Related Papers */}
            {gap.relatedPapers.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground uppercase">
                  Related Papers ({gap.relatedPapers.length})
                </h5>
                <div className="flex flex-wrap gap-1">
                  {gap.relatedPapers.slice(0, 5).map((paperId, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {paperId}
                    </Badge>
                  ))}
                  {gap.relatedPapers.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{gap.relatedPapers.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function CoverageChart({
  title,
  data,
  icon,
}: {
  title: string;
  data: Record<string, number>;
  icon: React.ReactNode;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  if (entries.length === 0) {
    return (
      <Card className="p-4">
        <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
          {icon}
          {title}
        </h4>
        <p className="text-sm text-muted-foreground">No data available</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
        {icon}
        {title}
      </h4>
      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="capitalize truncate">{key.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground shrink-0">{value}</span>
            </div>
            <Progress value={(value / max) * 100} className="h-1.5" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function TemporalTrendChart({ data }: { data: Record<number, number> }) {
  const years = Object.keys(data).map(Number).sort();
  const max = Math.max(...Object.values(data), 1);

  if (years.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4" />
        Publication Trends
      </h4>
      <div className="flex items-end gap-1 h-24">
        {years.map((year) => (
          <div key={year} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-primary/80 rounded-t transition-all"
              style={{ height: `${(data[year] / max) * 100}%`, minHeight: 4 }}
            />
            <span className="text-[10px] text-muted-foreground -rotate-45 origin-center">
              {year}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function GapAnalysisPanel({
  papers,
  query: initialQuery,
  onAnalysisComplete,
}: GapAnalysisProps) {
  const [query, setQuery] = useState(initialQuery || "");
  const [result, setResult] = useState<GapAnalysisResult | null>(null);
  const [filterType, setFilterType] = useState<Gap["type"] | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<Gap["severity"] | "all">("all");

  const analyzeMutation = useMutation({
    mutationFn: async (data: { papers: Paper[]; query: string }) => {
      const response = await apiRequest("POST", "/api/literature/analyze-gaps", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      onAnalysisComplete?.(data);
    },
  });

  const handleAnalyze = useCallback(() => {
    if (!query.trim() || papers.length === 0) return;
    analyzeMutation.mutate({ papers, query });
  }, [papers, query, analyzeMutation]);

  const filteredGaps = useMemo(() => {
    if (!result) return [];
    return result.gaps.filter((gap) => {
      if (filterType !== "all" && gap.type !== filterType) return false;
      if (filterSeverity !== "all" && gap.severity !== filterSeverity) return false;
      return true;
    });
  }, [result, filterType, filterSeverity]);

  const gapStats = useMemo(() => {
    if (!result) return { high: 0, medium: 0, low: 0, total: 0 };
    return {
      high: result.gaps.filter((g) => g.severity === "high").length,
      medium: result.gaps.filter((g) => g.severity === "medium").length,
      low: result.gaps.filter((g) => g.severity === "low").length,
      total: result.gaps.length,
    };
  }, [result]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Research Gap Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Research Topic</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your research topic for gap analysis..."
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{papers.length} papers to analyze</span>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={analyzeMutation.isPending || !query.trim() || papers.length === 0}
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Analyze Gaps
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <Separator />

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold">{result.paperCount}</div>
                <div className="text-xs text-muted-foreground">Papers Analyzed</div>
              </Card>
              <Card className="p-4 text-center border-red-500/50">
                <div className="text-2xl font-bold text-red-600">{gapStats.high}</div>
                <div className="text-xs text-muted-foreground">High Priority</div>
              </Card>
              <Card className="p-4 text-center border-amber-500/50">
                <div className="text-2xl font-bold text-amber-600">{gapStats.medium}</div>
                <div className="text-xs text-muted-foreground">Medium Priority</div>
              </Card>
              <Card className="p-4 text-center border-blue-500/50">
                <div className="text-2xl font-bold text-blue-600">{gapStats.low}</div>
                <div className="text-xs text-muted-foreground">Low Priority</div>
              </Card>
            </div>

            {/* Coverage Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <CoverageChart
                title="Topic Coverage"
                data={result.topicCoverage}
                icon={<Target className="h-4 w-4" />}
              />
              <CoverageChart
                title="Methodology Distribution"
                data={result.methodologyDistribution}
                icon={<Beaker className="h-4 w-4" />}
              />
            </div>

            <TemporalTrendChart data={result.temporalTrends} />

            {/* Filters */}
            <div className="flex gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Gap Type</Label>
                <Select
                  value={filterType}
                  onValueChange={(v) => setFilterType(v as Gap["type"] | "all")}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="topic">Topic</SelectItem>
                    <SelectItem value="methodology">Methodology</SelectItem>
                    <SelectItem value="population">Population</SelectItem>
                    <SelectItem value="temporal">Temporal</SelectItem>
                    <SelectItem value="geographic">Geographic</SelectItem>
                    <SelectItem value="network">Network</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Severity</Label>
                <Select
                  value={filterSeverity}
                  onValueChange={(v) => setFilterSeverity(v as Gap["severity"] | "all")}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Gap Cards */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Identified Gaps ({filteredGaps.length})
              </h4>
              {filteredGaps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No gaps match the current filters
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredGaps.map((gap, i) => (
                    <GapCard key={i} gap={gap} index={i} />
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  Recommendations
                </h4>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm p-3 bg-green-500/10 rounded-lg"
                    >
                      <span className="text-green-600 font-medium">{i + 1}.</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Network Stats */}
            <Card className="p-4 bg-muted/30">
              <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4" />
                Network Statistics
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold">
                    {result.networkStats.totalPapers}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Papers</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">
                    {result.networkStats.totalCitations}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Citations</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">
                    {result.networkStats.totalReferences}
                  </div>
                  <div className="text-xs text-muted-foreground">Total References</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">
                    {result.networkStats.avgCitations.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Citations</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">
                    {result.networkStats.avgReferences.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg References</div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GapAnalysisPanel;

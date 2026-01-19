/**
 * Plagiarism Checker Component
 *
 * Checks text for plagiarism and displays similarity results,
 * matches, and citation suggestions.
 */

import { useState, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ShieldAlert,
  ShieldCheck,
  FileSearch,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Copy,
  ExternalLink,
  Quote,
  FileText,
  Eye,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  SimilarityMatch,
  CitationIssue,
  PlagiarismReport,
  PlagiarismCheckerProps,
} from "./types";

const MATCH_TYPE_COLORS: Record<SimilarityMatch["matchType"], string> = {
  exact: "bg-red-500/20 border-red-500 text-red-700",
  near_exact: "bg-orange-500/20 border-orange-500 text-orange-700",
  paraphrase: "bg-amber-500/20 border-amber-500 text-amber-700",
  common_phrase: "bg-blue-500/20 border-blue-500 text-blue-700",
};

const MATCH_TYPE_LABELS: Record<SimilarityMatch["matchType"], string> = {
  exact: "Exact Match",
  near_exact: "Near Exact",
  paraphrase: "Paraphrase",
  common_phrase: "Common Phrase",
};

function SimilarityGauge({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const color =
    percentage > 30
      ? "text-red-500"
      : percentage > 15
        ? "text-amber-500"
        : "text-green-500";
  const bgColor =
    percentage > 30
      ? "bg-red-500"
      : percentage > 15
        ? "bg-amber-500"
        : "bg-green-500";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-muted/30"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={`${percentage * 3.52} 352`}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${color}`}>{percentage}%</span>
          <span className="text-xs text-muted-foreground">Similarity</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {percentage > 30 ? (
          <ShieldAlert className="h-5 w-5 text-red-500" />
        ) : percentage > 15 ? (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        ) : (
          <ShieldCheck className="h-5 w-5 text-green-500" />
        )}
        <span className="text-sm font-medium">
          {percentage > 30
            ? "High Similarity"
            : percentage > 15
              ? "Moderate Similarity"
              : "Low Similarity"}
        </span>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  index,
  onCopySource,
}: {
  match: SimilarityMatch;
  index: number;
  onCopySource: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`border-l-4 ${match.matchType === "exact" ? "border-l-red-500" : match.matchType === "near_exact" ? "border-l-orange-500" : match.matchType === "paraphrase" ? "border-l-amber-500" : "border-l-blue-500"}`}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge className={MATCH_TYPE_COLORS[match.matchType]}>
                    {MATCH_TYPE_LABELS[match.matchType]}
                  </Badge>
                  <Badge variant="outline">
                    {Math.round(match.similarityScore * 100)}% similar
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  "{match.querySegment.text.slice(0, 150)}
                  {match.querySegment.text.length > 150 ? "..." : ""}"
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Source: {match.sourceTitle}
                </p>
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

            {/* Your Text */}
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Your Text
              </h5>
              <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                <p className="text-sm">{match.querySegment.text}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Position: characters {match.querySegment.start}-{match.querySegment.end}
                </p>
              </div>
            </div>

            {/* Source Text */}
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Source Text
              </h5>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">{match.sourceSegment.text}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    From: {match.sourceTitle}
                  </p>
                  <Button variant="ghost" size="sm" onClick={onCopySource}>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            {/* Suggestion */}
            <div className="p-3 bg-green-500/10 rounded-lg">
              <h5 className="text-xs font-medium text-green-600 uppercase flex items-center gap-1 mb-1">
                <Quote className="h-3 w-3" />
                Suggestion
              </h5>
              <p className="text-sm">
                {match.matchType === "exact"
                  ? "This text appears to be directly copied. Consider using quotation marks and citing the source."
                  : match.matchType === "near_exact"
                    ? "This text is very similar to the source. Consider paraphrasing further or quoting directly with citation."
                    : match.matchType === "paraphrase"
                      ? "While paraphrased, this section is derived from the source and should be cited."
                      : "This is a common phrase and may not require citation, but review for context."}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function CitationIssueCard({ issue }: { issue: CitationIssue }) {
  return (
    <div className={`p-3 rounded-lg border ${issue.severity === "high" ? "bg-red-500/5 border-red-500/20" : issue.severity === "medium" ? "bg-amber-500/5 border-amber-500/20" : "bg-blue-500/5 border-blue-500/20"}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={`h-4 w-4 mt-0.5 shrink-0 ${issue.severity === "high" ? "text-red-500" : issue.severity === "medium" ? "text-amber-500" : "text-blue-500"}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={
                issue.severity === "high"
                  ? "text-red-600"
                  : issue.severity === "medium"
                    ? "text-amber-600"
                    : "text-blue-600"
              }
            >
              {issue.type.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            "{issue.text}"
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Source: {issue.source}
          </p>
        </div>
      </div>
    </div>
  );
}

function HighlightedText({
  text,
  matches,
}: {
  text: string;
  matches: SimilarityMatch[];
}) {
  // Sort matches by start position
  const sortedMatches = [...matches].sort(
    (a, b) => a.querySegment.start - b.querySegment.start
  );

  const segments: { text: string; isMatch: boolean; matchType?: SimilarityMatch["matchType"] }[] = [];
  let lastEnd = 0;

  for (const match of sortedMatches) {
    if (match.querySegment.start > lastEnd) {
      segments.push({
        text: text.slice(lastEnd, match.querySegment.start),
        isMatch: false,
      });
    }
    segments.push({
      text: text.slice(match.querySegment.start, match.querySegment.end),
      isMatch: true,
      matchType: match.matchType,
    });
    lastEnd = match.querySegment.end;
  }

  if (lastEnd < text.length) {
    segments.push({
      text: text.slice(lastEnd),
      isMatch: false,
    });
  }

  return (
    <TooltipProvider>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {segments.map((segment, i) =>
          segment.isMatch ? (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <span
                  className={`px-0.5 rounded cursor-help ${MATCH_TYPE_COLORS[segment.matchType!]}`}
                >
                  {segment.text}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{MATCH_TYPE_LABELS[segment.matchType!]}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span key={i}>{segment.text}</span>
          )
        )}
      </div>
    </TooltipProvider>
  );
}

export function PlagiarismChecker({
  text: initialText,
  sources: initialSources,
  onReportGenerated,
}: PlagiarismCheckerProps) {
  const [text, setText] = useState(initialText || "");
  const [report, setReport] = useState<PlagiarismReport | null>(null);
  const [showHighlighted, setShowHighlighted] = useState(false);

  const checkMutation = useMutation({
    mutationFn: async (data: { text: string; sources?: typeof initialSources }) => {
      const response = await apiRequest("POST", "/api/literature/check-plagiarism", data);
      return response.json();
    },
    onSuccess: (data) => {
      setReport(data);
      onReportGenerated?.(data);
    },
  });

  const handleCheck = useCallback(() => {
    if (!text.trim()) return;
    checkMutation.mutate({ text, sources: initialSources });
  }, [text, initialSources, checkMutation]);

  const handleCopySource = (sourceText: string) => {
    navigator.clipboard.writeText(sourceText);
  };

  const matchStats = useMemo(() => {
    if (!report) return { exact: 0, nearExact: 0, paraphrase: 0, common: 0 };
    return {
      exact: report.matches.filter((m) => m.matchType === "exact").length,
      nearExact: report.matches.filter((m) => m.matchType === "near_exact").length,
      paraphrase: report.matches.filter((m) => m.matchType === "paraphrase").length,
      common: report.matches.filter((m) => m.matchType === "common_phrase").length,
    };
  }, [report]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Plagiarism Checker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Text to Check</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type the text you want to check for plagiarism..."
              className="min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              {text.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>

          <Button
            onClick={handleCheck}
            disabled={checkMutation.isPending || !text.trim()}
            className="w-full"
          >
            {checkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <FileSearch className="h-4 w-4 mr-2" />
                Check for Plagiarism
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {report && (
          <div className="space-y-6">
            <Separator />

            {/* Summary */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Similarity Score */}
              <Card className="p-6 flex items-center justify-center">
                <SimilarityGauge score={report.overallSimilarity} />
              </Card>

              {/* Stats */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 text-center">
                    <div className="text-xl font-bold">{report.totalWords}</div>
                    <div className="text-xs text-muted-foreground">Total Words</div>
                  </Card>
                  <Card className="p-3 text-center">
                    <div className="text-xl font-bold">{report.uniqueWords}</div>
                    <div className="text-xs text-muted-foreground">Unique Words</div>
                  </Card>
                </div>

                <Card className="p-3">
                  <h5 className="text-xs font-medium text-muted-foreground mb-2">
                    Match Types
                  </h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Exact
                      </span>
                      <span>{matchStats.exact}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        Near Exact
                      </span>
                      <span>{matchStats.nearExact}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Paraphrase
                      </span>
                      <span>{matchStats.paraphrase}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Common Phrase
                      </span>
                      <span>{matchStats.common}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Highlighted View Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowHighlighted(!showHighlighted)}
              className="w-full"
            >
              <Eye className="h-4 w-4 mr-2" />
              {showHighlighted ? "Hide" : "Show"} Highlighted Text
            </Button>

            {showHighlighted && (
              <Card className="p-4">
                <ScrollArea className="h-[300px]">
                  <HighlightedText text={text} matches={report.matches} />
                </ScrollArea>
              </Card>
            )}

            {/* Matches */}
            {report.matches.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Similarity Matches ({report.matches.length})
                </h4>
                <div className="space-y-3">
                  {report.matches.map((match, i) => (
                    <MatchCard
                      key={i}
                      match={match}
                      index={i}
                      onCopySource={() => handleCopySource(match.sourceSegment.text)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Citation Issues */}
            {report.citationIssues.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2 text-amber-600">
                  <Quote className="h-4 w-4" />
                  Citation Issues ({report.citationIssues.length})
                </h4>
                <div className="space-y-2">
                  {report.citationIssues.map((issue, i) => (
                    <CitationIssueCard key={i} issue={issue} />
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Recommendations
                </h4>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm p-3 bg-green-500/10 rounded-lg"
                    >
                      <span className="text-green-600">-</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Source Breakdown */}
            {Object.keys(report.similarityBySource).length > 0 && (
              <Card className="p-4">
                <h4 className="font-medium text-sm mb-3">Similarity by Source</h4>
                <div className="space-y-2">
                  {Object.entries(report.similarityBySource)
                    .sort(([, a], [, b]) => b - a)
                    .map(([source, similarity]) => (
                      <div key={source} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="truncate">{source}</span>
                          <span className="text-muted-foreground shrink-0">
                            {Math.round(similarity * 100)}%
                          </span>
                        </div>
                        <Progress value={similarity * 100} className="h-1.5" />
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PlagiarismChecker;

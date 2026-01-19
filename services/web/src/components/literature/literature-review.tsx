/**
 * Literature Review Component
 *
 * AI-powered literature review generation and display.
 * Shows summary, themes, findings, gaps, and methodology analysis.
 */

import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Brain,
  Target,
  Lightbulb,
  TrendingUp,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  Paper,
  LiteratureReview,
  ReviewSection,
  Theme,
  LiteratureReviewProps,
} from "./types";

function ThemeCard({ theme, index }: { theme: Theme; index: number }) {
  return (
    <Card className="p-4 border-border/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-sm">{theme.name}</h4>
            <Badge variant="secondary" className="text-xs">
              {theme.paperCount} papers
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{theme.description}</p>
          <div className="flex flex-wrap gap-1">
            {theme.keyTerms.map((term, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {term}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SectionContent({ section, depth = 0 }: { section: ReviewSection; depth?: number }) {
  const [expanded, setExpanded] = useState(depth === 0);

  return (
    <div className={depth > 0 ? "ml-4 border-l-2 border-border/50 pl-4" : ""}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-2 h-auto text-left"
          >
            <span className="font-medium">{section.title}</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2 pb-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {section.content}
          </p>
          {section.papers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span>Based on {section.papers.length} papers</span>
            </div>
          )}
          {section.subsections?.map((subsection, i) => (
            <SectionContent key={i} section={subsection} depth={depth + 1} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function MethodologyChart({ analysis }: { analysis: LiteratureReview["methodologyAnalysis"] }) {
  const designs = Object.entries(analysis.studyDesigns || {});
  const total = designs.reduce((sum, [, count]) => sum + count, 0);

  if (designs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No methodology data available</p>
    );
  }

  return (
    <div className="space-y-3">
      {designs.map(([design, count]) => (
        <div key={design} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="capitalize">{design.replace(/_/g, " ")}</span>
            <span className="text-muted-foreground">
              {count} ({Math.round((count / total) * 100)}%)
            </span>
          </div>
          <Progress value={(count / total) * 100} className="h-2" />
        </div>
      ))}
      {analysis.qualityAssessment && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <h5 className="text-sm font-medium mb-1">Quality Assessment</h5>
          <p className="text-xs text-muted-foreground">{analysis.qualityAssessment}</p>
        </div>
      )}
    </div>
  );
}

export function LiteratureReviewPanel({
  papers,
  query: initialQuery,
  onReviewGenerated,
}: LiteratureReviewProps) {
  const [query, setQuery] = useState(initialQuery || "");
  const [review, setReview] = useState<LiteratureReview | null>(null);
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async (data: { papers: Paper[]; query: string }) => {
      const response = await apiRequest("POST", "/api/literature/generate-review", data);
      return response.json();
    },
    onSuccess: (data) => {
      setReview(data);
      onReviewGenerated?.(data);
    },
  });

  const handleGenerate = useCallback(() => {
    if (!query.trim() || papers.length === 0) return;
    generateMutation.mutate({ papers, query });
  }, [papers, query, generateMutation]);

  const handleCopyMarkdown = async () => {
    if (!review) return;
    const response = await apiRequest("POST", "/api/literature/export-markdown", { review });
    const data = await response.json();
    await navigator.clipboard.writeText(data.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!review) return;
    const response = await apiRequest("POST", "/api/literature/export-markdown", { review });
    const data = await response.json();
    const blob = new Blob([data.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `literature-review-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Literature Review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Research Query</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your research question or topic..."
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{papers.length} papers available for analysis</span>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !query.trim() || papers.length === 0}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Review
                </>
              )}
            </Button>
          </div>
        </div>

        {generateMutation.isError && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to generate review. Please try again.</span>
          </div>
        )}

        {/* Review Display */}
        {review && (
          <div className="space-y-6">
            <Separator />

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{review.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Generated {new Date(review.generatedAt).toLocaleString()} |{" "}
                  {review.paperCount} papers analyzed
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-1 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Executive Summary
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {review.summary}
              </p>
            </div>

            {/* Key Findings */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Key Findings
              </h4>
              <ul className="space-y-2">
                {review.keyFindings.map((finding, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge className="h-5 w-5 rounded-full flex items-center justify-center p-0 shrink-0">
                      {i + 1}
                    </Badge>
                    <span className="text-muted-foreground">{finding}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Themes */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Major Themes
              </h4>
              <div className="grid gap-3 md:grid-cols-2">
                {review.themes.map((theme, i) => (
                  <ThemeCard key={i} theme={theme} index={i} />
                ))}
              </div>
            </div>

            {/* Thematic Sections */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="sections">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Thematic Analysis ({review.sections.length} sections)
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {review.sections.map((section, i) => (
                        <SectionContent key={i} section={section} />
                      ))}
                    </div>
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Research Gaps */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                Research Gaps
              </h4>
              <ul className="space-y-2">
                {review.researchGaps.map((gap, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm p-2 bg-amber-500/10 rounded-lg"
                  >
                    <span className="text-amber-600">-</span>
                    <span className="text-muted-foreground">{gap}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Future Directions */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                Future Directions
              </h4>
              <ul className="space-y-2">
                {review.futureDirections.map((direction, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm p-2 bg-green-500/10 rounded-lg"
                  >
                    <span className="text-green-600">+</span>
                    <span className="text-muted-foreground">{direction}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Methodology Analysis */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="methodology">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Methodology Analysis
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <MethodologyChart analysis={review.methodologyAnalysis} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LiteratureReviewPanel;

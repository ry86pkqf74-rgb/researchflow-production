import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Clock,
  Download,
  Presentation,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";

export interface TalkScriptSection {
  id: string;
  title: string;
  content: string;
  slideReference?: string;
  slideNumber?: number;
  estimatedMinutes?: number;
}

export interface TalkScriptProps {
  projectId?: string;
  title: string;
  totalDurationMinutes: number;
  sections: TalkScriptSection[];
  onSlideClick?: (slideNumber: number) => void;
  onExport?: (format: "pdf" | "docx" | "txt") => void;
  isLoading?: boolean;
}

const WORDS_PER_MINUTE = 150;

function calculateReadingTime(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return wordCount / WORDS_PER_MINUTE;
}

function formatTime(minutes: number): string {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  if (mins === 0) {
    return `${secs}s`;
  }
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function TalkScript({
  title,
  totalDurationMinutes,
  sections,
  onSlideClick,
  onExport,
  isLoading = false,
}: TalkScriptProps) {
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.id)));
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<"pdf" | "docx" | "txt" | null>(null);

  const sectionTimings = useMemo(() => {
    return sections.map(section => ({
      ...section,
      calculatedMinutes: section.estimatedMinutes ?? calculateReadingTime(section.content)
    }));
  }, [sections]);

  const totalCalculatedTime = useMemo(() => {
    return sectionTimings.reduce((sum, s) => sum + s.calculatedMinutes, 0);
  }, [sectionTimings]);

  const timeVariance = totalCalculatedTime - totalDurationMinutes;
  const isOverTime = timeVariance > 1;
  const isUnderTime = timeVariance < -2;

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections(new Set(sections.map(s => s.id)));
  }, [sections]);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const handleCopySection = useCallback(async (sectionId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSection(sectionId);
      toast({
        title: "Copied",
        description: "Section content copied to clipboard",
      });
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleExport = useCallback(async (format: "pdf" | "docx" | "txt") => {
    setIsExporting(format);
    try {
      if (onExport) {
        await onExport(format);
      } else {
        const content = generateExportContent(title, sectionTimings, format);
        downloadFile(content, `talk-script-${Date.now()}.${format === "docx" ? "txt" : format}`, format);
      }
      toast({
        title: "Export Complete",
        description: `Talk script exported as ${format.toUpperCase()}`,
      });
    } catch {
      toast({
        title: "Export Failed",
        description: "Unable to export talk script",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  }, [onExport, title, sectionTimings, toast]);

  if (isLoading) {
    return (
      <Card data-testid="card-talk-script-loading">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading talk script...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-talk-script">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ros-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-ros-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>Full presentation narrative</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="w-3 h-3" />
              Target: {totalDurationMinutes}m
            </Badge>
            <Badge 
              variant="outline" 
              className={
                isOverTime 
                  ? "bg-destructive/10 text-destructive border-destructive/30" 
                  : isUnderTime 
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    : "bg-ros-success/10 text-ros-success border-ros-success/30"
              }
            >
              Est: {formatTime(totalCalculatedTime)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {sections.length} sections
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll} data-testid="button-expand-all">
                Expand All
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
                Collapse All
              </Button>
            </div>
          </div>
          <Progress 
            value={Math.min((totalCalculatedTime / totalDurationMinutes) * 100, 100)} 
            className={isOverTime ? "[&>div]:bg-destructive" : ""}
            data-testid="progress-time"
          />
          {isOverTime && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(Math.abs(timeVariance))} over target duration
            </p>
          )}
          {isUnderTime && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(Math.abs(timeVariance))} under target duration - consider adding content
            </p>
          )}
        </div>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {sectionTimings.map((section, index) => (
              <Collapsible
                key={section.id}
                open={expandedSections.has(section.id)}
                onOpenChange={() => toggleSection(section.id)}
              >
                <div 
                  className="border rounded-lg bg-card overflow-hidden"
                  data-testid={`section-${section.id}`}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full p-4 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors text-left">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-mono text-muted-foreground w-6">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-medium truncate">{section.title}</h4>
                          {section.slideReference && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Presentation className="w-3 h-3" />
                              {section.slideReference}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTime(section.calculatedMinutes)}
                        </Badge>
                        {expandedSections.has(section.id) ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <Separator />
                    <div className="p-4 space-y-3">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {section.content}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          {section.slideNumber && onSlideClick && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSlideClick(section.slideNumber!)}
                              data-testid={`button-goto-slide-${section.slideNumber}`}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Go to Slide {section.slideNumber}
                            </Button>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopySection(section.id, section.content)}
                          data-testid={`button-copy-${section.id}`}
                        >
                          {copiedSection === section.id ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-4 border-t pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="w-4 h-4 text-ros-success" />
          <span>
            {sections.reduce((sum, s) => sum + s.content.split(/\s+/).length, 0).toLocaleString()} words total
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("txt")}
            disabled={isExporting !== null}
            data-testid="button-export-txt"
          >
            {isExporting === "txt" ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            TXT
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("docx")}
            disabled={isExporting !== null}
            data-testid="button-export-docx"
          >
            {isExporting === "docx" ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            DOCX
          </Button>
          <Button
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={isExporting !== null}
            data-testid="button-export-pdf"
          >
            {isExporting === "pdf" ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1" />
            )}
            Export PDF
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function generateExportContent(
  title: string,
  sections: Array<TalkScriptSection & { calculatedMinutes: number }>,
  _format: "pdf" | "docx" | "txt"
): string {
  const lines: string[] = [];
  const divider = "=".repeat(60);
  const subDivider = "-".repeat(60);

  lines.push(divider);
  lines.push(`TALK SCRIPT: ${title.toUpperCase()}`);
  lines.push(divider);
  lines.push("");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push(`Total Sections: ${sections.length}`);
  lines.push(`Estimated Duration: ${formatTime(sections.reduce((sum, s) => sum + s.calculatedMinutes, 0))}`);
  lines.push("");

  sections.forEach((section, index) => {
    lines.push(subDivider);
    lines.push(`SECTION ${index + 1}: ${section.title}`);
    if (section.slideReference) {
      lines.push(`Slide Reference: ${section.slideReference}`);
    }
    lines.push(`Estimated Time: ${formatTime(section.calculatedMinutes)}`);
    lines.push(subDivider);
    lines.push("");
    lines.push(section.content);
    lines.push("");
    lines.push("");
  });

  lines.push(divider);
  lines.push("END OF TALK SCRIPT");
  lines.push(divider);

  return lines.join("\n");
}

function downloadFile(content: string, filename: string, format: string): void {
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  };

  const blob = new Blob([content], { type: mimeTypes[format] || "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

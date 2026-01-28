/**
 * Lay Summary Editor Component
 *
 * Provides a rich editor for lay summaries with real-time validation
 * and suggestions based on institutional requirements.
 */

import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Loader2,
  BookOpen,
  Target,
  Users,
  FileText,
  Clock,
} from "lucide-react";

interface ValidationResult {
  is_valid: boolean;
  score: number;
  word_count: number;
  missing_elements: string[];
  present_elements: string[];
  suggestions: string[];
  reading_level: string | null;
}

interface LaySummaryEditorProps {
  value: string;
  onChange: (value: string) => void;
  institutionId: string;
  studyType?: "chart_review" | "secondary_use" | "prospective" | "interventional" | "observational";
  minWords?: number;
  maxWords?: number;
}

const ELEMENT_ICONS: Record<string, React.ElementType> = {
  objectives: Target,
  population: Users,
  data_sources: FileText,
  timeframe: Clock,
  procedures: FileText,
  duration: Clock,
  recruitment: Users,
  enrollment: Users,
  consent: FileText,
};

export function LaySummaryEditor({
  value,
  onChange,
  institutionId,
  studyType = "prospective",
  minWords = 100,
  maxWords = 500,
}: LaySummaryEditorProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showGuidance, setShowGuidance] = useState(true);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const validateMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/irb/lay-summary/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary_text: text,
          study_type: studyType,
          min_words: minWords,
          max_words: maxWords,
        }),
      });
      if (!res.ok) throw new Error("Validation failed");
      return res.json() as Promise<ValidationResult>;
    },
    onSuccess: (data) => {
      setValidation(data);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Validation Failed',
        description: error.message || 'Failed to validate lay summary',
      });
    },
  });

  // Debounced validation
  const debouncedValidate = useCallback(
    (text: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        if (text.trim().length > 20) {
          validateMutation.mutate(text);
        }
      }, 500);
      setDebounceTimer(timer);
    },
    [debounceTimer, validateMutation]
  );

  useEffect(() => {
    if (value.trim().length > 20) {
      debouncedValidate(value);
    }
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [value]);

  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  const wordCountProgress = Math.min((wordCount / minWords) * 100, 100);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getReadingLevelBadge = (level: string | null) => {
    if (!level) return null;
    const isGood = level.includes("Good");
    const isAcceptable = level.includes("Acceptable");
    return (
      <Badge
        variant="outline"
        className={
          isGood
            ? "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20"
            : isAcceptable
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
            : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20"
        }
      >
        {level}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="lay-summary" className="text-base font-medium">
          Lay Summary
        </Label>
        {validation && (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getScoreColor(validation.score)}`}>
              Score: {validation.score}%
            </span>
            {getReadingLevelBadge(validation.reading_level)}
          </div>
        )}
      </div>

      <Collapsible open={showGuidance} onOpenChange={setShowGuidance}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              {institutionId === "emory" ? "Emory IRB Guidelines" : "Lay Summary Guidelines"}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showGuidance ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2 bg-muted/30">
            <CardContent className="p-4 text-sm space-y-2">
              {institutionId === "emory" ? (
                <>
                  <p className="font-medium">For Chart Reviews / Secondary Data:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                    <li>Study objectives (what you're trying to learn)</li>
                    <li>Population characteristics (who is included)</li>
                    <li>Data/specimen sources</li>
                    <li>Whether prospective or retrospective</li>
                  </ul>
                  <p className="font-medium mt-3">For All Other Studies:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                    <li>Study objectives and population</li>
                    <li>Study procedures and duration</li>
                    <li>Recruitment locations and total enrollment</li>
                    <li>Consent/assent methods</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    Write for a non-expert audience (8th grade reading level). Avoid jargon.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Describe your study objectives, population, and procedures in plain language.
                </p>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="relative">
        <Textarea
          id="lay-summary"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe your research study in plain language that a non-expert can understand..."
          rows={8}
          className="resize-none"
        />
        {validateMutation.isPending && (
          <div className="absolute top-2 right-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Word count progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Word Count</span>
          <span
            className={
              wordCount < minWords
                ? "text-amber-600"
                : wordCount > maxWords
                ? "text-red-600"
                : "text-green-600"
            }
          >
            {wordCount} / {minWords}-{maxWords} words
          </span>
        </div>
        <Progress value={wordCountProgress} className="h-1.5" />
      </div>

      {/* Validation Results */}
      {validation && (
        <div className="space-y-3">
          {/* Elements checklist */}
          <Card className="bg-muted/30">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Required Elements
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                {validation.present_elements.map((element) => {
                  const Icon = ELEMENT_ICONS[element] || CheckCircle2;
                  return (
                    <div
                      key={element}
                      className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="capitalize">{element.replace(/_/g, " ")}</span>
                    </div>
                  );
                })}
                {validation.missing_elements.map((element) => {
                  const Icon = ELEMENT_ICONS[element] || AlertCircle;
                  return (
                    <div
                      key={element}
                      className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="capitalize">{element.replace(/_/g, " ")}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Suggestions */}
          {validation.suggestions.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Suggestions</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                  {validation.suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Valid indicator */}
          {validation.is_valid && (
            <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700 dark:text-green-300">
                Lay Summary Complete
              </AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-400">
                Your lay summary meets all requirements for {institutionId} IRB submission.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

export default LaySummaryEditor;

import { useState, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  FileText,
  Image,
  BarChart,
  Loader2,
  RefreshCw,
  Lightbulb,
} from "lucide-react";

export interface Author {
  name: string;
  affiliation?: string;
  email?: string;
}

export interface SubmissionData {
  abstractText: string;
  figures: number;
  tables: number;
  authors: Author[];
}

export interface ConferenceRequirements {
  abstractWordLimit: number;
  abstractWordWarningThreshold?: number;
  maxFigures: number;
  maxTables: number;
  authorFormatPattern?: RegExp | string;
  authorFormatDescription?: string;
}

export interface ValidationResult {
  field: string;
  status: "pass" | "warning" | "fail";
  message: string;
  suggestion?: string;
  currentValue?: number | string;
  limit?: number | string;
}

export interface ValidationResponse {
  success: boolean;
  results: ValidationResult[];
  overallStatus: "pass" | "warning" | "fail";
  timestamp: string;
}

export interface SubmissionValidatorProps {
  submissionData: SubmissionData;
  conferenceRequirements: ConferenceRequirements;
  onValidationComplete?: (response: ValidationResponse) => void;
}

const DEFAULT_AUTHOR_PATTERN = /^[A-Z][a-z]+,\s[A-Z][a-z]+(\s[A-Z]\.)?$/;

function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function validateAuthorFormat(name: string, pattern: RegExp): boolean {
  return pattern.test(name);
}

function getStatusIcon(status: "pass" | "warning" | "fail") {
  switch (status) {
    case "pass":
      return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    case "fail":
      return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
  }
}

function getStatusBadgeClass(status: "pass" | "warning" | "fail") {
  switch (status) {
    case "pass":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "fail":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  }
}

function getWordCountColor(current: number, limit: number, warningThreshold?: number): string {
  const threshold = warningThreshold ?? limit * 0.9;
  if (current > limit) {
    return "text-red-600 dark:text-red-400";
  } else if (current >= threshold) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-green-600 dark:text-green-400";
}


export function SubmissionValidator({
  submissionData,
  conferenceRequirements,
  onValidationComplete,
}: SubmissionValidatorProps) {
  const { toast } = useToast();
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<"pass" | "warning" | "fail" | null>(null);

  const wordCount = useMemo(() => countWords(submissionData.abstractText), [submissionData.abstractText]);
  const wordCountPercent = useMemo(() => {
    return Math.min((wordCount / conferenceRequirements.abstractWordLimit) * 100, 100);
  }, [wordCount, conferenceRequirements.abstractWordLimit]);

  const authorPattern = useMemo(() => {
    if (!conferenceRequirements.authorFormatPattern) {
      return DEFAULT_AUTHOR_PATTERN;
    }
    if (typeof conferenceRequirements.authorFormatPattern === "string") {
      return new RegExp(conferenceRequirements.authorFormatPattern);
    }
    return conferenceRequirements.authorFormatPattern;
  }, [conferenceRequirements.authorFormatPattern]);

  const validateMutation = useMutation({
    mutationFn: async (payload: {
      abstractText: string;
      figures: number;
      tables: number;
      authors: Author[];
      requirements: ConferenceRequirements;
    }) => {
      const response = await apiRequest("POST", "/api/ros/submission/validate", {
        submissionData: {
          abstractText: payload.abstractText,
          figures: payload.figures,
          tables: payload.tables,
          authors: payload.authors,
        },
        conferenceRequirements: {
          abstractWordLimit: payload.requirements.abstractWordLimit,
          maxFigures: payload.requirements.maxFigures,
          maxTables: payload.requirements.maxTables,
          authorFormatPattern: payload.requirements.authorFormatPattern?.toString(),
        },
      });
      return response.json() as Promise<ValidationResponse>;
    },
    onSuccess: (data) => {
      setValidationResults(data.results);
      setOverallStatus(data.overallStatus);
      onValidationComplete?.(data);
      toast({
        title: "Validation Complete",
        description: `Overall status: ${data.overallStatus.toUpperCase()}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Validation Failed",
        description: error.message || "Failed to validate submission",
        variant: "destructive",
      });
    },
  });

  const runLocalValidation = useCallback(
    (field?: "abstract" | "figures" | "tables" | "authors") => {
      const results: ValidationResult[] = [];

      if (!field || field === "abstract") {
        const wc = countWords(submissionData.abstractText);
        const limit = conferenceRequirements.abstractWordLimit;
        const threshold = conferenceRequirements.abstractWordWarningThreshold ?? limit * 0.9;

        if (wc > limit) {
          results.push({
            field: "abstract",
            status: "fail",
            message: `Abstract exceeds word limit (${wc}/${limit} words)`,
            suggestion: `Remove ${wc - limit} words to meet the limit.`,
            currentValue: wc,
            limit: limit,
          });
        } else if (wc >= threshold) {
          results.push({
            field: "abstract",
            status: "warning",
            message: `Abstract approaching word limit (${wc}/${limit} words)`,
            suggestion: "Consider condensing if more content is needed.",
            currentValue: wc,
            limit: limit,
          });
        } else {
          results.push({
            field: "abstract",
            status: "pass",
            message: `Abstract within word limit (${wc}/${limit} words)`,
            currentValue: wc,
            limit: limit,
          });
        }
      }

      if (!field || field === "figures") {
        const figCount = submissionData.figures;
        const maxFigures = conferenceRequirements.maxFigures;

        if (figCount > maxFigures) {
          results.push({
            field: "figures",
            status: "fail",
            message: `Too many figures (${figCount}/${maxFigures})`,
            suggestion: `Remove ${figCount - maxFigures} figure(s) or combine into composite figures.`,
            currentValue: figCount,
            limit: maxFigures,
          });
        } else if (figCount === maxFigures) {
          results.push({
            field: "figures",
            status: "warning",
            message: `At figure limit (${figCount}/${maxFigures})`,
            currentValue: figCount,
            limit: maxFigures,
          });
        } else {
          results.push({
            field: "figures",
            status: "pass",
            message: `Figures within limit (${figCount}/${maxFigures})`,
            currentValue: figCount,
            limit: maxFigures,
          });
        }
      }

      if (!field || field === "tables") {
        const tableCount = submissionData.tables;
        const maxTables = conferenceRequirements.maxTables;

        if (tableCount > maxTables) {
          results.push({
            field: "tables",
            status: "fail",
            message: `Too many tables (${tableCount}/${maxTables})`,
            suggestion: `Remove ${tableCount - maxTables} table(s) or move to supplementary materials.`,
            currentValue: tableCount,
            limit: maxTables,
          });
        } else if (tableCount === maxTables) {
          results.push({
            field: "tables",
            status: "warning",
            message: `At table limit (${tableCount}/${maxTables})`,
            currentValue: tableCount,
            limit: maxTables,
          });
        } else {
          results.push({
            field: "tables",
            status: "pass",
            message: `Tables within limit (${tableCount}/${maxTables})`,
            currentValue: tableCount,
            limit: maxTables,
          });
        }
      }

      if (!field || field === "authors") {
        const invalidAuthors = submissionData.authors.filter(
          (author) => !validateAuthorFormat(author.name, authorPattern)
        );

        if (invalidAuthors.length > 0) {
          results.push({
            field: "authors",
            status: "fail",
            message: `${invalidAuthors.length} author(s) have invalid format`,
            suggestion: `Use format: "${conferenceRequirements.authorFormatDescription || "Last, First M."}" for: ${invalidAuthors.map((a) => a.name).join(", ")}`,
            currentValue: invalidAuthors.map((a) => a.name).join(", "),
          });
        } else if (submissionData.authors.length === 0) {
          results.push({
            field: "authors",
            status: "fail",
            message: "No authors specified",
            suggestion: "Add at least one author to the submission.",
          });
        } else {
          results.push({
            field: "authors",
            status: "pass",
            message: `All ${submissionData.authors.length} author(s) correctly formatted`,
          });
        }
      }

      return results;
    },
    [submissionData, conferenceRequirements, authorPattern]
  );

  const handleValidateAll = useCallback(() => {
    validateMutation.mutate({
      abstractText: submissionData.abstractText,
      figures: submissionData.figures,
      tables: submissionData.tables,
      authors: submissionData.authors,
      requirements: conferenceRequirements,
    });
  }, [submissionData, conferenceRequirements, validateMutation]);

  const handleValidateField = useCallback(
    (field: "abstract" | "figures" | "tables" | "authors") => {
      const results = runLocalValidation(field);
      setValidationResults((prev) => {
        const filtered = prev.filter((r) => r.field !== field);
        return [...filtered, ...results];
      });

      toast({
        title: `${field.charAt(0).toUpperCase() + field.slice(1)} Validation`,
        description: results[0]?.message || "Validation complete",
      });
    },
    [runLocalValidation, toast]
  );

  const getResultForField = useCallback(
    (field: string) => validationResults.find((r) => r.field === field),
    [validationResults]
  );

  const computedOverallStatus = useMemo(() => {
    if (overallStatus) return overallStatus;
    if (validationResults.length === 0) return null;
    if (validationResults.some((r) => r.status === "fail")) return "fail";
    if (validationResults.some((r) => r.status === "warning")) return "warning";
    return "pass";
  }, [overallStatus, validationResults]);

  return (
    <Card className="border-ros-primary/30 bg-gradient-to-br from-ros-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-ros-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-ros-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Submission Validator</CardTitle>
              <CardDescription>
                Validate your submission against conference requirements
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {computedOverallStatus && (
              <Badge className={getStatusBadgeClass(computedOverallStatus)} data-testid="badge-overall-status">
                {getStatusIcon(computedOverallStatus)}
                <span className="ml-1 capitalize">{computedOverallStatus}</span>
              </Badge>
            )}
            <Button
              onClick={handleValidateAll}
              disabled={validateMutation.isPending}
              data-testid="button-validate-all"
            >
              {validateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Validate All
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Abstract Word Count
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleValidateField("abstract")}
              data-testid="button-validate-abstract"
            >
              Validate
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span
                className={getWordCountColor(
                  wordCount,
                  conferenceRequirements.abstractWordLimit,
                  conferenceRequirements.abstractWordWarningThreshold
                )}
                data-testid="text-word-count"
              >
                {wordCount} / {conferenceRequirements.abstractWordLimit} words
              </span>
              <span className="text-muted-foreground">
                {Math.round(wordCountPercent)}%
              </span>
            </div>
            <Progress
              value={wordCountPercent}
              className="h-2"
              data-testid="progress-word-count"
            />
          </div>
          {getResultForField("abstract") && (
            <ValidationResultRow result={getResultForField("abstract")!} />
          )}
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Image className="w-4 h-4" />
                Figures
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleValidateField("figures")}
                data-testid="button-validate-figures"
              >
                Validate
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <BarChart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm" data-testid="text-figure-count">
                  {submissionData.figures} / {conferenceRequirements.maxFigures}
                </span>
              </div>
              <Badge
                variant="outline"
                className={
                  submissionData.figures > conferenceRequirements.maxFigures
                    ? "border-red-500 text-red-600 dark:text-red-400"
                    : submissionData.figures === conferenceRequirements.maxFigures
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-green-500 text-green-600 dark:text-green-400"
                }
                data-testid="badge-figure-status"
              >
                {submissionData.figures > conferenceRequirements.maxFigures
                  ? "Over limit"
                  : submissionData.figures === conferenceRequirements.maxFigures
                    ? "At limit"
                    : "OK"}
              </Badge>
            </div>
            {getResultForField("figures") && (
              <ValidationResultRow result={getResultForField("figures")!} />
            )}
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <BarChart className="w-4 h-4" />
                Tables
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleValidateField("tables")}
                data-testid="button-validate-tables"
              >
                Validate
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <BarChart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm" data-testid="text-table-count">
                  {submissionData.tables} / {conferenceRequirements.maxTables}
                </span>
              </div>
              <Badge
                variant="outline"
                className={
                  submissionData.tables > conferenceRequirements.maxTables
                    ? "border-red-500 text-red-600 dark:text-red-400"
                    : submissionData.tables === conferenceRequirements.maxTables
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-green-500 text-green-600 dark:text-green-400"
                }
                data-testid="badge-table-status"
              >
                {submissionData.tables > conferenceRequirements.maxTables
                  ? "Over limit"
                  : submissionData.tables === conferenceRequirements.maxTables
                    ? "At limit"
                    : "OK"}
              </Badge>
            </div>
            {getResultForField("tables") && (
              <ValidationResultRow result={getResultForField("tables")!} />
            )}
          </div>
        </div>

        <Separator />

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Author Formatting
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleValidateField("authors")}
              data-testid="button-validate-authors"
            >
              Validate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Expected format:{" "}
            <code className="bg-muted px-1 rounded">
              {conferenceRequirements.authorFormatDescription || "Last, First M."}
            </code>
          </p>
          <div className="flex flex-wrap gap-2">
            {submissionData.authors.map((author, idx) => {
              const isValid = validateAuthorFormat(author.name, authorPattern);
              return (
                <Badge
                  key={idx}
                  variant="outline"
                  className={
                    isValid
                      ? "border-green-500 text-green-600 dark:text-green-400"
                      : "border-red-500 text-red-600 dark:text-red-400"
                  }
                  data-testid={`badge-author-${idx}`}
                >
                  {isValid ? (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  ) : (
                    <XCircle className="w-3 h-3 mr-1" />
                  )}
                  {author.name}
                </Badge>
              );
            })}
            {submissionData.authors.length === 0 && (
              <span className="text-sm text-muted-foreground">No authors added</span>
            )}
          </div>
          {getResultForField("authors") && (
            <ValidationResultRow result={getResultForField("authors")!} />
          )}
        </div>

        {validationResults.length > 0 && validationResults.some((r) => r.status === "fail") && (
          <Alert variant="destructive" data-testid="alert-validation-errors">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Validation Errors</AlertTitle>
            <AlertDescription>
              Please address the issues above before submitting.
            </AlertDescription>
          </Alert>
        )}

        {validationResults.length > 0 &&
          !validationResults.some((r) => r.status === "fail") &&
          validationResults.some((r) => r.status === "warning") && (
            <Alert data-testid="alert-validation-warnings">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                Review the warnings above. Submission is allowed but consider improvements.
              </AlertDescription>
            </Alert>
          )}

        {validationResults.length > 0 &&
          !validationResults.some((r) => r.status === "fail") &&
          !validationResults.some((r) => r.status === "warning") && (
            <Alert className="border-green-500/50 bg-green-50 dark:bg-green-900/20" data-testid="alert-validation-success">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-700 dark:text-green-300">All Checks Passed</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-400">
                Your submission meets all conference requirements.
              </AlertDescription>
            </Alert>
          )}
      </CardContent>
    </Card>
  );
}

function ValidationResultRow({ result }: { result: ValidationResult }) {
  return (
    <div className="mt-2 p-2 rounded-md bg-muted/50 space-y-1" data-testid={`result-${result.field}`}>
      <div className="flex items-center gap-2 text-sm">
        {getStatusIcon(result.status)}
        <span>{result.message}</span>
      </div>
      {result.suggestion && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground pl-6">
          <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{result.suggestion}</span>
        </div>
      )}
    </div>
  );
}

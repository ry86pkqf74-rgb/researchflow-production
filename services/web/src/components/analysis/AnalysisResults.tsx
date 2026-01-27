/**
 * Analysis Results Component
 *
 * Displays results from real statistical analysis in a comprehensive,
 * publication-ready format with tables, visualizations, and interpretations.
 *
 * Features:
 * - Descriptive statistics tables
 * - Inferential test results with effect sizes
 * - Survival analysis curves and hazard ratios
 * - Regression coefficients and model fit statistics
 * - Correlation matrices with heatmap visualization
 * - Export functionality (CSV, JSON)
 */

import * as React from "react";
import { useState, useMemo } from "react";
import {
  Download,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  Info,
  BarChart3,
  TrendingUp,
  Activity,
  Table as TableIcon,
  FileText,
  Copy,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import type {
  RealAnalysisOutput,
  DescriptiveResult,
  InferentialResult,
  SurvivalResult,
  RegressionResult,
} from "@/hooks/use-real-analysis";

interface AnalysisResultsProps {
  results: RealAnalysisOutput | null;
  className?: string;
}

// Helper to format numbers
const formatNumber = (value: number | undefined | null, decimals = 3): string => {
  if (value === undefined || value === null || isNaN(value)) return "—";
  if (Math.abs(value) < 0.001 && value !== 0) return value.toExponential(2);
  return value.toFixed(decimals);
};

// Helper to format p-values
const formatPValue = (p: number | undefined): string => {
  if (p === undefined || p === null || isNaN(p)) return "—";
  if (p < 0.001) return "< 0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(3);
};

// Significance indicator
const SignificanceBadge = ({ pValue, alpha = 0.05 }: { pValue: number; alpha?: number }) => {
  if (pValue < 0.001) {
    return <Badge className="bg-green-100 text-green-800 border-green-300">***</Badge>;
  }
  if (pValue < 0.01) {
    return <Badge className="bg-green-100 text-green-700 border-green-300">**</Badge>;
  }
  if (pValue < alpha) {
    return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">*</Badge>;
  }
  return <Badge variant="outline" className="text-gray-500">ns</Badge>;
};

// Descriptive Statistics Table
function DescriptiveTable({ results }: { results: DescriptiveResult[] }) {
  if (!results || results.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>No descriptive statistics available.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white">Variable</TableHead>
              <TableHead className="text-right">N</TableHead>
              <TableHead className="text-right">Missing</TableHead>
              <TableHead className="text-right">Mean</TableHead>
              <TableHead className="text-right">SD</TableHead>
              <TableHead className="text-right">Median</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Max</TableHead>
              <TableHead className="text-right">Q1</TableHead>
              <TableHead className="text-right">Q3</TableHead>
              <TableHead className="text-right">Skewness</TableHead>
              <TableHead className="text-right">Kurtosis</TableHead>
              <TableHead className="text-right">Normality p</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium sticky left-0 bg-white">{row.variable}</TableCell>
                <TableCell className="text-right">{row.n}</TableCell>
                <TableCell className="text-right">
                  {row.n_missing > 0 ? (
                    <span className="text-amber-600">{row.n_missing}</span>
                  ) : (
                    row.n_missing
                  )}
                </TableCell>
                <TableCell className="text-right">{formatNumber(row.mean)}</TableCell>
                <TableCell className="text-right">{formatNumber(row.std)}</TableCell>
                <TableCell className="text-right">{formatNumber(row.median)}</TableCell>
                <TableCell className="text-right">{formatNumber(row.min)}</TableCell>
                <TableCell className="text-right">{formatNumber(row.max)}</TableCell>
                <TableCell className="text-right">{formatNumber(row.q1)}</TableCell>
                <TableCell className="text-right">{formatNumber(row.q3)}</TableCell>
                <TableCell className="text-right">{formatNumber(row.skewness)}</TableCell>
                <TableCell className="text-right">{formatNumber(row.kurtosis)}</TableCell>
                <TableCell className="text-right">
                  {row.normality_p !== undefined && (
                    <span className={row.normality_p < 0.05 ? "text-amber-600" : "text-green-600"}>
                      {formatPValue(row.normality_p)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="text-xs text-gray-500 space-y-1">
        <p>SD = Standard Deviation; Q1/Q3 = First/Third Quartile</p>
        <p>Normality tested using Shapiro-Wilk test (p &lt; 0.05 suggests non-normal distribution)</p>
      </div>
    </div>
  );
}

// Inferential Results Table
function InferentialTable({ results }: { results: InferentialResult[] }) {
  if (!results || results.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>No inferential test results available.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Variable</TableHead>
              <TableHead className="text-right">Statistic</TableHead>
              <TableHead className="text-right">df</TableHead>
              <TableHead className="text-right">p-value</TableHead>
              <TableHead className="text-right">Adj. p</TableHead>
              <TableHead className="text-right">Effect Size</TableHead>
              <TableHead className="text-center">95% CI</TableHead>
              <TableHead className="text-center">Sig.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, idx) => (
              <TableRow key={idx} className={row.significant ? "bg-green-50" : ""}>
                <TableCell className="font-medium">{row.test_name}</TableCell>
                <TableCell>{row.variable}</TableCell>
                <TableCell className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        {formatNumber(row.statistic)}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{row.statistic_name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right">
                  {row.degrees_of_freedom !== undefined ? row.degrees_of_freedom : "—"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={row.p_value < 0.05 ? "text-green-600 font-semibold" : ""}>
                    {formatPValue(row.p_value)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.adjusted_p_value !== undefined ? formatPValue(row.adjusted_p_value) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {row.effect_size !== undefined ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          {formatNumber(row.effect_size)}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{row.effect_size_name || "Effect size"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {row.ci_lower !== undefined && row.ci_upper !== undefined
                    ? `[${formatNumber(row.ci_lower, 2)}, ${formatNumber(row.ci_upper, 2)}]`
                    : "—"}
                </TableCell>
                <TableCell className="text-center">
                  <SignificanceBadge pValue={row.p_value} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Interpretations */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Interpretations</h4>
        {results.map((row, idx) => (
          <div key={idx} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
            <strong>{row.variable}:</strong> {row.interpretation}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500">
        <p>Significance: *** p &lt; 0.001, ** p &lt; 0.01, * p &lt; 0.05, ns = not significant</p>
      </div>
    </div>
  );
}

// Survival Analysis Results
function SurvivalTable({ results }: { results: SurvivalResult[] }) {
  if (!results || results.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>No survival analysis results available.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{result.method}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {result.median_survival !== undefined ? formatNumber(result.median_survival, 1) : "NR"}
                </div>
                <div className="text-xs text-blue-600">Median Survival</div>
                {result.ci_lower !== undefined && result.ci_upper !== undefined && (
                  <div className="text-xs text-gray-500">
                    95% CI: [{formatNumber(result.ci_lower, 1)}, {formatNumber(result.ci_upper, 1)}]
                  </div>
                )}
              </div>

              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{result.n_events}</div>
                <div className="text-xs text-green-600">Events</div>
              </div>

              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-2xl font-bold text-amber-700">{result.n_censored}</div>
                <div className="text-xs text-amber-600">Censored</div>
              </div>

              {result.hazard_ratio !== undefined && (
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">
                    {formatNumber(result.hazard_ratio, 2)}
                  </div>
                  <div className="text-xs text-purple-600">Hazard Ratio</div>
                  {result.hr_ci_lower !== undefined && result.hr_ci_upper !== undefined && (
                    <div className="text-xs text-gray-500">
                      95% CI: [{formatNumber(result.hr_ci_lower, 2)}, {formatNumber(result.hr_ci_upper, 2)}]
                    </div>
                  )}
                </div>
              )}
            </div>

            {result.log_rank_p !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Log-rank test:</span>
                <span className={cn(
                  "font-mono",
                  result.log_rank_p < 0.05 ? "text-green-600 font-semibold" : ""
                )}>
                  p = {formatPValue(result.log_rank_p)}
                </span>
                <SignificanceBadge pValue={result.log_rank_p} />
              </div>
            )}

            {result.survival_probabilities && Object.keys(result.survival_probabilities).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Survival Probabilities</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.survival_probabilities).map(([time, prob]) => (
                    <Badge key={time} variant="outline">
                      t={time}: {formatNumber(prob as number, 2)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Regression Results
function RegressionTable({ results }: { results: RegressionResult[] }) {
  if (!results || results.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>No regression results available.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {results.map((result, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{result.model_type}</CardTitle>
                <CardDescription>Outcome: {result.dependent_variable}</CardDescription>
              </div>
              <Badge variant="outline">n = {result.n_observations}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Model Fit Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {result.r_squared !== undefined && (
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-700">
                    {formatNumber(result.r_squared, 3)}
                  </div>
                  <div className="text-xs text-blue-600">R²</div>
                </div>
              )}
              {result.adj_r_squared !== undefined && (
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-700">
                    {formatNumber(result.adj_r_squared, 3)}
                  </div>
                  <div className="text-xs text-blue-600">Adj. R²</div>
                </div>
              )}
              {result.aic !== undefined && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-bold text-gray-700">
                    {formatNumber(result.aic, 1)}
                  </div>
                  <div className="text-xs text-gray-600">AIC</div>
                </div>
              )}
              {result.bic !== undefined && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-bold text-gray-700">
                    {formatNumber(result.bic, 1)}
                  </div>
                  <div className="text-xs text-gray-600">BIC</div>
                </div>
              )}
            </div>

            {result.f_statistic !== undefined && (
              <div className="text-sm text-gray-600">
                F-statistic: {formatNumber(result.f_statistic)} (p = {formatPValue(result.f_pvalue)})
              </div>
            )}

            {/* Coefficients Table */}
            {result.coefficients && Object.keys(result.coefficients).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Coefficients</h4>
                <ScrollArea className="h-[250px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variable</TableHead>
                        <TableHead className="text-right">Estimate</TableHead>
                        <TableHead className="text-right">Std. Error</TableHead>
                        <TableHead className="text-right">t / z</TableHead>
                        <TableHead className="text-right">p-value</TableHead>
                        <TableHead className="text-center">95% CI</TableHead>
                        <TableHead className="text-center">Sig.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(result.coefficients).map(([varName, coef]: [string, any]) => (
                        <TableRow key={varName} className={coef.p_value < 0.05 ? "bg-green-50" : ""}>
                          <TableCell className="font-medium">{varName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(coef.estimate || coef.coef)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(coef.std_error || coef.se)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(coef.t_value || coef.z_value || coef.statistic)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={coef.p_value < 0.05 ? "text-green-600 font-semibold" : ""}>
                              {formatPValue(coef.p_value)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {coef.ci_lower !== undefined && coef.ci_upper !== undefined
                              ? `[${formatNumber(coef.ci_lower, 2)}, ${formatNumber(coef.ci_upper, 2)}]`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {coef.p_value !== undefined && <SignificanceBadge pValue={coef.p_value} />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Correlation Matrix
function CorrelationMatrix({
  correlationMatrix,
  pValueMatrix,
}: {
  correlationMatrix?: Record<string, Record<string, number>>;
  pValueMatrix?: Record<string, Record<string, number>>;
}) {
  const [showPValues, setShowPValues] = useState(false);

  if (!correlationMatrix || Object.keys(correlationMatrix).length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>No correlation matrix available.</AlertDescription>
      </Alert>
    );
  }

  const variables = Object.keys(correlationMatrix);

  // Color scale for correlations
  const getCorrelationColor = (r: number) => {
    const intensity = Math.abs(r);
    if (r > 0) {
      return `rgba(34, 139, 34, ${intensity * 0.8})`; // Green for positive
    } else {
      return `rgba(178, 34, 34, ${intensity * 0.8})`; // Red for negative
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Correlation Matrix</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPValues(!showPValues)}
        >
          {showPValues ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {showPValues ? "Hide p-values" : "Show p-values"}
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white"></TableHead>
              {variables.map((v) => (
                <TableHead key={v} className="text-center text-xs">
                  {v.length > 10 ? v.slice(0, 10) + "..." : v}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {variables.map((rowVar) => (
              <TableRow key={rowVar}>
                <TableCell className="font-medium sticky left-0 bg-white text-xs">
                  {rowVar.length > 12 ? rowVar.slice(0, 12) + "..." : rowVar}
                </TableCell>
                {variables.map((colVar) => {
                  const r = correlationMatrix[rowVar]?.[colVar];
                  const p = pValueMatrix?.[rowVar]?.[colVar];
                  return (
                    <TableCell
                      key={colVar}
                      className="text-center p-1"
                      style={{
                        backgroundColor: r !== undefined ? getCorrelationColor(r) : undefined,
                        color: r !== undefined && Math.abs(r) > 0.5 ? "white" : undefined,
                      }}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-xs font-mono">
                              {r !== undefined ? formatNumber(r, 2) : "—"}
                              {showPValues && p !== undefined && (
                                <div className="text-[10px]">
                                  {p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : ""}
                                </div>
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>r = {formatNumber(r, 4)}</p>
                            {p !== undefined && <p>p = {formatPValue(p)}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "rgba(34, 139, 34, 0.8)" }} />
          <span>Positive correlation</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "rgba(178, 34, 34, 0.8)" }} />
          <span>Negative correlation</span>
        </div>
        <span>*** p &lt; 0.001, ** p &lt; 0.01, * p &lt; 0.05</span>
      </div>
    </div>
  );
}

// Main Component
export function AnalysisResults({ results, className }: AnalysisResultsProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("summary");

  // Determine what types of results we have
  const hasDescriptive = results?.results?.descriptive && results.results.descriptive.length > 0;
  const hasInferential = results?.results?.inferential && results.results.inferential.length > 0;
  const hasSurvival = results?.results?.survival && results.results.survival.length > 0;
  const hasRegression = results?.results?.regression && results.results.regression.length > 0;
  const hasCorrelation = results?.results?.correlation_matrix && Object.keys(results.results.correlation_matrix).length > 0;

  // Export functions
  const exportToJSON = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-results-${results.run_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Results exported to JSON" });
  };

  const copyToClipboard = () => {
    if (!results) return;
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    toast({ title: "Copied", description: "Results copied to clipboard" });
  };

  if (!results) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analysis Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Results</AlertTitle>
            <AlertDescription>
              Run an analysis to see results here.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analysis Results
              {results.status === "completed" && (
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {results.analysis_type} analysis • {results.execution_time_ms}ms •{" "}
              {results.dataset_info?.n_rows} observations
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={exportToJSON}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Warnings and Errors */}
        {results.warnings && results.warnings.length > 0 && (
          <Alert className="mb-4 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Warnings</AlertTitle>
            <AlertDescription className="text-amber-700">
              <ul className="list-disc list-inside">
                {results.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {results.errors && results.errors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Errors</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside">
                {results.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Results Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            {hasDescriptive && <TabsTrigger value="descriptive">Descriptive</TabsTrigger>}
            {hasInferential && <TabsTrigger value="inferential">Inferential</TabsTrigger>}
            {hasSurvival && <TabsTrigger value="survival">Survival</TabsTrigger>}
            {hasRegression && <TabsTrigger value="regression">Regression</TabsTrigger>}
            {hasCorrelation && <TabsTrigger value="correlation">Correlation</TabsTrigger>}
          </TabsList>

          <TabsContent value="summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {results.dataset_info?.n_rows || "—"}
                  </div>
                  <div className="text-sm text-gray-500">Observations</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {results.dataset_info?.n_columns || "—"}
                  </div>
                  <div className="text-sm text-gray-500">Variables</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {results.execution_time_ms}
                  </div>
                  <div className="text-sm text-gray-500">Execution (ms)</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-orange-600">
                    {results.mode === "live" ? "Real" : "Mock"}
                  </div>
                  <div className="text-sm text-gray-500">Analysis Mode</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {hasDescriptive && (
            <TabsContent value="descriptive">
              <DescriptiveTable results={results.results.descriptive!} />
            </TabsContent>
          )}

          {hasInferential && (
            <TabsContent value="inferential">
              <InferentialTable results={results.results.inferential!} />
            </TabsContent>
          )}

          {hasSurvival && (
            <TabsContent value="survival">
              <SurvivalTable results={results.results.survival!} />
            </TabsContent>
          )}

          {hasRegression && (
            <TabsContent value="regression">
              <RegressionTable results={results.results.regression!} />
            </TabsContent>
          )}

          {hasCorrelation && (
            <TabsContent value="correlation">
              <CorrelationMatrix
                correlationMatrix={results.results.correlation_matrix}
                pValueMatrix={results.results.p_value_matrix}
              />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default AnalysisResults;

/**
 * Real Statistical Analysis Panel
 *
 * A comprehensive UI for running REAL statistical analyses using the AnalysisService.
 * This component interfaces with the statistical analysis API endpoints that use
 * scipy, statsmodels, and lifelines for actual computations.
 *
 * Features:
 * - Analysis type selection (descriptive, inferential, survival, regression)
 * - Variable selection from dataset columns
 * - Test parameter configuration
 * - Real-time analysis execution
 * - Results display and export
 */

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Calculator,
  Play,
  Settings,
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
  Table,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  useAnalysisCapabilities,
  useRealAnalysis,
  useDescriptiveAnalysis,
  useGroupComparison,
  useSurvivalAnalysis,
  useRegressionAnalysis,
  type RealAnalysisInput,
  type RealAnalysisOutput,
  type AnalysisCapabilities,
} from "@/hooks/use-real-analysis";

// Types
export type AnalysisMode = "descriptive" | "inferential" | "survival" | "regression" | "correlation";

export interface DatasetInfo {
  id: string;
  name: string;
  path: string;
  columns: string[];
  rowCount: number;
}

interface RealAnalysisPanelProps {
  dataset?: DatasetInfo;
  onResultsChange?: (results: RealAnalysisOutput | null) => void;
  className?: string;
}

// Analysis type configurations
const ANALYSIS_CONFIGS: Record<AnalysisMode, {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}> = {
  descriptive: {
    label: "Descriptive Statistics",
    description: "Summary statistics, distributions, and data exploration",
    icon: BarChart3,
    color: "text-blue-600 bg-blue-100",
  },
  inferential: {
    label: "Group Comparison",
    description: "T-tests, ANOVA, chi-square, and non-parametric tests",
    icon: Activity,
    color: "text-green-600 bg-green-100",
  },
  survival: {
    label: "Survival Analysis",
    description: "Kaplan-Meier curves, Cox proportional hazards, log-rank tests",
    icon: TrendingUp,
    color: "text-purple-600 bg-purple-100",
  },
  regression: {
    label: "Regression Modeling",
    description: "Linear, logistic, Poisson, and Cox regression",
    icon: Calculator,
    color: "text-orange-600 bg-orange-100",
  },
  correlation: {
    label: "Correlation Analysis",
    description: "Pearson and Spearman correlations with p-values",
    icon: Table,
    color: "text-teal-600 bg-teal-100",
  },
};

const TEST_TYPES = {
  inferential: [
    { value: "auto", label: "Auto-detect (recommended)", description: "Automatically selects the appropriate test" },
    { value: "t_test_independent", label: "Independent T-test", description: "Compare means of two independent groups" },
    { value: "t_test_paired", label: "Paired T-test", description: "Compare means of paired observations" },
    { value: "anova", label: "One-way ANOVA", description: "Compare means across 3+ groups" },
    { value: "chi_square", label: "Chi-square Test", description: "Test independence of categorical variables" },
    { value: "mann_whitney", label: "Mann-Whitney U", description: "Non-parametric alternative to t-test" },
    { value: "kruskal_wallis", label: "Kruskal-Wallis", description: "Non-parametric alternative to ANOVA" },
    { value: "fisher_exact", label: "Fisher's Exact Test", description: "For small sample sizes in 2x2 tables" },
  ],
  survival: [
    { value: "kaplan_meier", label: "Kaplan-Meier", description: "Estimate survival curves" },
    { value: "cox_ph", label: "Cox Proportional Hazards", description: "Model hazard ratios with covariates" },
    { value: "log_rank", label: "Log-rank Test", description: "Compare survival curves between groups" },
  ],
};

const REGRESSION_TYPES = [
  { value: "linear", label: "Linear Regression", description: "For continuous outcomes" },
  { value: "logistic", label: "Logistic Regression", description: "For binary outcomes" },
  { value: "poisson", label: "Poisson Regression", description: "For count data" },
  { value: "cox", label: "Cox Regression", description: "For time-to-event data" },
];

const CORRECTION_METHODS = [
  { value: "none", label: "None", description: "No correction for multiple comparisons" },
  { value: "bonferroni", label: "Bonferroni", description: "Conservative, controls family-wise error rate" },
  { value: "holm", label: "Holm-Bonferroni", description: "Less conservative than Bonferroni" },
  { value: "fdr_bh", label: "FDR (Benjamini-Hochberg)", description: "Controls false discovery rate" },
];

export function RealAnalysisPanel({
  dataset,
  onResultsChange,
  className,
}: RealAnalysisPanelProps) {
  // State
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("descriptive");
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [groupVariable, setGroupVariable] = useState<string>("");
  const [outcomeVariable, setOutcomeVariable] = useState<string>("");
  const [timeVariable, setTimeVariable] = useState<string>("");
  const [eventVariable, setEventVariable] = useState<string>("");
  const [covariates, setCovariates] = useState<string[]>([]);
  const [testType, setTestType] = useState<string>("auto");
  const [regressionType, setRegressionType] = useState<"linear" | "logistic" | "poisson" | "cox">("linear");
  const [correctionMethod, setCorrectionMethod] = useState<string>("none");
  const [alphaLevel, setAlphaLevel] = useState<number>(0.05);
  const [confidenceLevel, setConfidenceLevel] = useState<number>(0.95);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Hooks
  const { data: capabilities, isLoading: capabilitiesLoading } = useAnalysisCapabilities();
  const realAnalysis = useRealAnalysis();
  const descriptiveAnalysis = useDescriptiveAnalysis();
  const groupComparison = useGroupComparison();
  const survivalAnalysis = useSurvivalAnalysis();
  const regressionAnalysis = useRegressionAnalysis();

  // Determine if service is available
  const serviceAvailable = capabilities?.service_available && capabilities?.mode === "live";

  // Get current analysis results
  const currentResults =
    realAnalysis.data ||
    descriptiveAnalysis.data ||
    groupComparison.data ||
    survivalAnalysis.data ||
    regressionAnalysis.data;

  const isAnalyzing =
    realAnalysis.isPending ||
    descriptiveAnalysis.isPending ||
    groupComparison.isPending ||
    survivalAnalysis.isPending ||
    regressionAnalysis.isPending;

  // Notify parent of results changes
  useEffect(() => {
    if (onResultsChange && currentResults) {
      onResultsChange(currentResults);
    }
  }, [currentResults, onResultsChange]);

  // Toggle variable selection
  const toggleVariable = useCallback((variable: string) => {
    setSelectedVariables((prev) =>
      prev.includes(variable)
        ? prev.filter((v) => v !== variable)
        : [...prev, variable]
    );
  }, []);

  // Toggle covariate selection
  const toggleCovariate = useCallback((variable: string) => {
    setCovariates((prev) =>
      prev.includes(variable)
        ? prev.filter((v) => v !== variable)
        : [...prev, variable]
    );
  }, []);

  // Run analysis
  const runAnalysis = useCallback(async () => {
    if (!dataset) return;

    const baseInput = {
      dataset_path: dataset.path,
      alpha_level: alphaLevel,
      confidence_level: confidenceLevel,
    };

    switch (analysisMode) {
      case "descriptive":
        descriptiveAnalysis.mutate({
          dataset_path: dataset.path,
          variables: selectedVariables.length > 0 ? selectedVariables : undefined,
        });
        break;

      case "inferential":
        if (!groupVariable || !outcomeVariable) return;
        groupComparison.mutate({
          dataset_path: dataset.path,
          group_variable: groupVariable,
          outcome_variable: outcomeVariable,
          test_type: testType === "auto" ? undefined : testType,
          correction_method: correctionMethod,
        });
        break;

      case "survival":
        if (!timeVariable || !eventVariable) return;
        survivalAnalysis.mutate({
          dataset_path: dataset.path,
          time_variable: timeVariable,
          event_variable: eventVariable,
          group_variable: groupVariable || undefined,
          test_type: testType,
        });
        break;

      case "regression":
        if (!outcomeVariable) return;
        regressionAnalysis.mutate({
          dataset_path: dataset.path,
          outcome_variable: outcomeVariable,
          covariates: covariates.length > 0 ? covariates : undefined,
          regression_type: regressionType,
        });
        break;

      case "correlation":
        realAnalysis.mutate({
          analysis_type: "correlation",
          dataset_path: dataset.path,
          variables: selectedVariables.length > 0 ? selectedVariables : undefined,
          correction_method: correctionMethod as any,
          alpha_level: alphaLevel,
          confidence_level: confidenceLevel,
        });
        break;
    }
  }, [
    dataset,
    analysisMode,
    selectedVariables,
    groupVariable,
    outcomeVariable,
    timeVariable,
    eventVariable,
    covariates,
    testType,
    regressionType,
    correctionMethod,
    alphaLevel,
    confidenceLevel,
    descriptiveAnalysis,
    groupComparison,
    survivalAnalysis,
    regressionAnalysis,
    realAnalysis,
  ]);

  // Check if analysis can be run
  const canRunAnalysis = useCallback(() => {
    if (!dataset || !serviceAvailable) return false;

    switch (analysisMode) {
      case "descriptive":
        return true;
      case "inferential":
        return !!groupVariable && !!outcomeVariable;
      case "survival":
        return !!timeVariable && !!eventVariable;
      case "regression":
        return !!outcomeVariable;
      case "correlation":
        return true;
      default:
        return false;
    }
  }, [dataset, serviceAvailable, analysisMode, groupVariable, outcomeVariable, timeVariable, eventVariable]);

  // Render service status
  const renderServiceStatus = () => {
    if (capabilitiesLoading) {
      return (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Checking Analysis Service</AlertTitle>
          <AlertDescription>Verifying statistical analysis capabilities...</AlertDescription>
        </Alert>
      );
    }

    if (!serviceAvailable) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Analysis Service Unavailable</AlertTitle>
          <AlertDescription>
            {capabilities?.error || "The statistical analysis service is not available. Results will use mock data."}
            {capabilities?.required_packages && (
              <div className="mt-2 text-xs">
                Required packages: {capabilities.required_packages.join(", ")}
              </div>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Real Statistical Analysis Ready</AlertTitle>
        <AlertDescription className="text-green-700">
          Using scipy {capabilities?.scipy_version}, statsmodels {capabilities?.statsmodels_version},
          lifelines {capabilities?.lifelines_version}
        </AlertDescription>
      </Alert>
    );
  };

  // Render variable selector
  const renderVariableSelector = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    excludeVariables: string[] = [],
    description?: string
  ) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3 w-3 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {dataset?.columns
            .filter((col) => !excludeVariables.includes(col))
            .map((col) => (
              <SelectItem key={col} value={col}>
                {col}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );

  // Render multi-variable checkbox selector
  const renderMultiVariableSelector = (
    label: string,
    selected: string[],
    onToggle: (variable: string) => void,
    excludeVariables: string[] = []
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ScrollArea className="h-32 border rounded-md p-2">
        <div className="space-y-2">
          {dataset?.columns
            .filter((col) => !excludeVariables.includes(col))
            .map((col) => (
              <div key={col} className="flex items-center space-x-2">
                <Checkbox
                  id={`var-${col}`}
                  checked={selected.includes(col)}
                  onCheckedChange={() => onToggle(col)}
                />
                <label
                  htmlFor={`var-${col}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {col}
                </label>
              </div>
            ))}
        </div>
      </ScrollArea>
      {selected.length > 0 && (
        <div className="text-xs text-gray-500">
          {selected.length} variable{selected.length !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  );

  // Render analysis-specific configuration
  const renderAnalysisConfig = () => {
    switch (analysisMode) {
      case "descriptive":
        return (
          <div className="space-y-4">
            {renderMultiVariableSelector(
              "Variables to Analyze (leave empty for all)",
              selectedVariables,
              toggleVariable
            )}
            <p className="text-sm text-gray-500">
              Computes mean, median, std, quartiles, skewness, kurtosis, and normality tests.
            </p>
          </div>
        );

      case "inferential":
        return (
          <div className="space-y-4">
            {renderVariableSelector(
              "Group Variable",
              groupVariable,
              setGroupVariable,
              [outcomeVariable],
              "Categorical variable defining the groups to compare"
            )}
            {renderVariableSelector(
              "Outcome Variable",
              outcomeVariable,
              setOutcomeVariable,
              [groupVariable],
              "The variable to compare across groups"
            )}
            <div className="space-y-2">
              <Label>Statistical Test</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEST_TYPES.inferential.map((test) => (
                    <SelectItem key={test.value} value={test.value}>
                      <div>
                        <div className="font-medium">{test.label}</div>
                        <div className="text-xs text-gray-500">{test.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "survival":
        return (
          <div className="space-y-4">
            {renderVariableSelector(
              "Time Variable",
              timeVariable,
              setTimeVariable,
              [eventVariable, groupVariable],
              "Follow-up time or time to event"
            )}
            {renderVariableSelector(
              "Event Variable",
              eventVariable,
              setEventVariable,
              [timeVariable, groupVariable],
              "Binary indicator (1=event occurred, 0=censored)"
            )}
            {renderVariableSelector(
              "Group Variable (optional)",
              groupVariable,
              setGroupVariable,
              [timeVariable, eventVariable],
              "Compare survival curves between groups"
            )}
            <div className="space-y-2">
              <Label>Analysis Method</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEST_TYPES.survival.map((test) => (
                    <SelectItem key={test.value} value={test.value}>
                      <div>
                        <div className="font-medium">{test.label}</div>
                        <div className="text-xs text-gray-500">{test.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "regression":
        return (
          <div className="space-y-4">
            {renderVariableSelector(
              "Outcome Variable",
              outcomeVariable,
              setOutcomeVariable,
              covariates,
              "The dependent variable to predict"
            )}
            {renderMultiVariableSelector(
              "Covariates (Predictors)",
              covariates,
              toggleCovariate,
              [outcomeVariable]
            )}
            <div className="space-y-2">
              <Label>Regression Type</Label>
              <Select value={regressionType} onValueChange={(v) => setRegressionType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGRESSION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-gray-500">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "correlation":
        return (
          <div className="space-y-4">
            {renderMultiVariableSelector(
              "Variables (leave empty for all numeric)",
              selectedVariables,
              toggleVariable
            )}
            <p className="text-sm text-gray-500">
              Computes Pearson and Spearman correlation matrices with p-values.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Real Statistical Analysis
            </CardTitle>
            <CardDescription>
              Run actual statistical computations on your dataset
            </CardDescription>
          </div>
          {serviceAvailable && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Live Mode
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Service Status */}
        {renderServiceStatus()}

        {/* Dataset Info */}
        {dataset ? (
          <Alert className="border-blue-200 bg-blue-50">
            <Database className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">{dataset.name}</AlertTitle>
            <AlertDescription className="text-blue-700">
              {dataset.rowCount} rows, {dataset.columns.length} columns
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Dataset Selected</AlertTitle>
            <AlertDescription>
              Please select or upload a dataset to run statistical analysis.
            </AlertDescription>
          </Alert>
        )}

        {/* Analysis Type Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Analysis Type</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(Object.entries(ANALYSIS_CONFIGS) as [AnalysisMode, typeof ANALYSIS_CONFIGS[AnalysisMode]][]).map(
              ([mode, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={mode}
                    onClick={() => setAnalysisMode(mode)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                      analysisMode === mode
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg", config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{config.label}</div>
                      <div className="text-xs text-gray-500 truncate">{config.description}</div>
                    </div>
                    {analysisMode === mode && (
                      <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>

        <Separator />

        {/* Analysis Configuration */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Configuration</Label>
          {renderAnalysisConfig()}
        </div>

        {/* Advanced Options */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Advanced Options
              </span>
              {showAdvanced ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alpha Level</Label>
                <Input
                  type="number"
                  min={0.001}
                  max={0.1}
                  step={0.01}
                  value={alphaLevel}
                  onChange={(e) => setAlphaLevel(parseFloat(e.target.value))}
                />
                <p className="text-xs text-gray-500">Significance threshold (default: 0.05)</p>
              </div>
              <div className="space-y-2">
                <Label>Confidence Level</Label>
                <Input
                  type="number"
                  min={0.9}
                  max={0.99}
                  step={0.01}
                  value={confidenceLevel}
                  onChange={(e) => setConfidenceLevel(parseFloat(e.target.value))}
                />
                <p className="text-xs text-gray-500">For confidence intervals (default: 0.95)</p>
              </div>
            </div>

            {(analysisMode === "inferential" || analysisMode === "correlation") && (
              <div className="space-y-2">
                <Label>Multiple Testing Correction</Label>
                <Select value={correctionMethod} onValueChange={setCorrectionMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CORRECTION_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div>
                          <div className="font-medium">{method.label}</div>
                          <div className="text-xs text-gray-500">{method.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            setSelectedVariables([]);
            setGroupVariable("");
            setOutcomeVariable("");
            setTimeVariable("");
            setEventVariable("");
            setCovariates([]);
            setTestType("auto");
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button
          onClick={runAnalysis}
          disabled={!canRunAnalysis() || isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Analysis
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default RealAnalysisPanel;

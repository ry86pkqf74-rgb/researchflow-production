/**
 * Statistical Analysis Page
 *
 * Standalone page for running real statistical analyses on uploaded datasets.
 * Provides a comprehensive interface for descriptive, inferential, survival,
 * regression, and correlation analyses.
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Calculator,
  Upload,
  Database,
  FileSpreadsheet,
  ArrowLeft,
  RefreshCw,
  HelpCircle,
  BookOpen,
  AlertCircle,
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import {
  RealAnalysisPanel,
  AnalysisResults,
  SurvivalCurveChart,
  StatisticalSummaryCard,
  type DatasetInfo,
} from "@/components/analysis";
import type { RealAnalysisOutput } from "@/hooks/use-real-analysis";

// Demo datasets for testing
const DEMO_DATASETS: DatasetInfo[] = [
  {
    id: "demo-clinical",
    name: "Clinical Trial Data",
    path: "/data/demo/clinical_trial.csv",
    columns: [
      "patient_id",
      "age",
      "sex",
      "treatment_group",
      "baseline_score",
      "week4_score",
      "week8_score",
      "response",
      "adverse_event",
      "follow_up_days",
      "event_occurred",
    ],
    rowCount: 500,
  },
  {
    id: "demo-survival",
    name: "Survival Study Data",
    path: "/data/demo/survival_study.csv",
    columns: [
      "patient_id",
      "age",
      "stage",
      "treatment",
      "time_to_event",
      "event",
      "biomarker_a",
      "biomarker_b",
      "performance_status",
    ],
    rowCount: 250,
  },
  {
    id: "demo-observational",
    name: "Observational Cohort",
    path: "/data/demo/observational.csv",
    columns: [
      "subject_id",
      "age",
      "bmi",
      "smoking_status",
      "exercise_hours",
      "systolic_bp",
      "diastolic_bp",
      "cholesterol",
      "glucose",
      "outcome",
    ],
    rowCount: 1000,
  },
];

export default function StatisticalAnalysisPage() {
  const [, navigate] = useLocation();
  const [selectedDataset, setSelectedDataset] = useState<DatasetInfo | undefined>(
    DEMO_DATASETS[0]
  );
  const [analysisResults, setAnalysisResults] = useState<RealAnalysisOutput | null>(null);
  const [activeTab, setActiveTab] = useState("configure");

  // Handle dataset selection
  const handleDatasetChange = useCallback((datasetId: string) => {
    const dataset = DEMO_DATASETS.find((d) => d.id === datasetId);
    setSelectedDataset(dataset);
    setAnalysisResults(null); // Clear previous results
  }, []);

  // Handle results update
  const handleResultsChange = useCallback((results: RealAnalysisOutput | null) => {
    setAnalysisResults(results);
    if (results) {
      setActiveTab("results");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/workflow")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Calculator className="h-6 w-6 text-blue-600" />
                  Statistical Analysis
                </h1>
                <p className="text-sm text-gray-500">
                  Real statistical computations using scipy, statsmodels, and lifelines
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <BookOpen className="h-4 w-4 mr-1" />
                Documentation
              </Button>
              <Button variant="outline" size="sm">
                <HelpCircle className="h-4 w-4 mr-1" />
                Help
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Dataset Selection */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Dataset
                </CardTitle>
                <CardDescription>
                  Select a dataset or upload your own data
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" />
                Upload Dataset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="mb-2 block">Select Dataset</Label>
                <Select
                  value={selectedDataset?.id}
                  onValueChange={handleDatasetChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_DATASETS.map((dataset) => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          <span>{dataset.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {dataset.rowCount} rows
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedDataset && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">{selectedDataset.columns.length}</span> columns:
                  <span className="ml-1 text-xs">
                    {selectedDataset.columns.slice(0, 5).join(", ")}
                    {selectedDataset.columns.length > 5 && "..."}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="configure">Configure Analysis</TabsTrigger>
            <TabsTrigger value="results" disabled={!analysisResults}>
              Results
              {analysisResults && (
                <Badge variant="secondary" className="ml-2">
                  {analysisResults.status}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="visualize" disabled={!analysisResults}>
              Visualizations
            </TabsTrigger>
          </TabsList>

          {/* Configure Tab */}
          <TabsContent value="configure">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Analysis Panel */}
              <div className="lg:col-span-2">
                <RealAnalysisPanel
                  dataset={selectedDataset}
                  onResultsChange={handleResultsChange}
                />
              </div>

              {/* Quick Reference */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Quick Reference</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div>
                      <h4 className="font-medium text-gray-700">Descriptive</h4>
                      <p className="text-xs text-gray-500">
                        Summary statistics, distributions, normality tests
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-gray-700">Group Comparison</h4>
                      <p className="text-xs text-gray-500">
                        T-tests, ANOVA, chi-square, Mann-Whitney
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-gray-700">Survival</h4>
                      <p className="text-xs text-gray-500">
                        Kaplan-Meier, Cox PH, log-rank tests
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-gray-700">Regression</h4>
                      <p className="text-xs text-gray-500">
                        Linear, logistic, Poisson, Cox regression
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tips</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-gray-500 space-y-2">
                    <p>
                      • Select "Auto-detect" to let the system choose the appropriate test
                    </p>
                    <p>
                      • Use multiple testing correction when comparing multiple variables
                    </p>
                    <p>
                      • Check normality before using parametric tests
                    </p>
                    <p>
                      • Report effect sizes alongside p-values
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            {analysisResults ? (
              <AnalysisResults results={analysisResults} />
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Results</AlertTitle>
                <AlertDescription>
                  Run an analysis to see results here.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Visualizations Tab */}
          <TabsContent value="visualize">
            {analysisResults ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Survival Curve if applicable */}
                {analysisResults.results?.survival && (
                  <SurvivalCurveChart
                    results={analysisResults.results.survival}
                    showRiskTable
                    showMedianLine
                  />
                )}

                {/* Summary Cards for key findings */}
                {analysisResults.results?.inferential?.map((result, idx) => (
                  <StatisticalSummaryCard
                    key={idx}
                    title={result.variable}
                    testName={result.test_name}
                    pValue={result.p_value}
                    effectSize={
                      result.effect_size
                        ? {
                            value: result.effect_size,
                            name: result.effect_size_name || "Effect Size",
                          }
                        : undefined
                    }
                    statistics={[
                      {
                        label: result.statistic_name,
                        value: result.statistic,
                        significance: result.significant ? "significant" : "not-significant",
                      },
                      ...(result.degrees_of_freedom
                        ? [{ label: "df", value: result.degrees_of_freedom }]
                        : []),
                      ...(result.ci_lower !== undefined && result.ci_upper !== undefined
                        ? [
                            { label: "CI Lower", value: result.ci_lower },
                            { label: "CI Upper", value: result.ci_upper },
                          ]
                        : []),
                    ]}
                  />
                ))}

                {/* Regression Summary */}
                {analysisResults.results?.regression?.map((result, idx) => (
                  <StatisticalSummaryCard
                    key={`reg-${idx}`}
                    title={`${result.model_type} Model`}
                    description={`Outcome: ${result.dependent_variable}`}
                    statistics={[
                      ...(result.r_squared !== undefined
                        ? [{ label: "R²", value: result.r_squared, highlight: true }]
                        : []),
                      ...(result.adj_r_squared !== undefined
                        ? [{ label: "Adj. R²", value: result.adj_r_squared }]
                        : []),
                      { label: "N", value: result.n_observations },
                      ...(result.aic !== undefined ? [{ label: "AIC", value: result.aic }] : []),
                    ]}
                    pValue={result.f_pvalue}
                  />
                ))}

                {/* Placeholder for when there's no visual content */}
                {!analysisResults.results?.survival &&
                  !analysisResults.results?.inferential?.length &&
                  !analysisResults.results?.regression?.length && (
                    <Card className="col-span-full">
                      <CardContent className="py-8 text-center text-gray-500">
                        <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>
                          Visualizations will appear here based on your analysis type.
                        </p>
                        <p className="text-sm mt-2">
                          Try running a survival analysis or group comparison.
                        </p>
                      </CardContent>
                    </Card>
                  )}
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Results</AlertTitle>
                <AlertDescription>
                  Run an analysis to see visualizations here.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

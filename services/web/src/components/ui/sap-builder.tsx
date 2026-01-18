import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ROLE_HIERARCHY } from "@packages/core/types/roles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Calculator, 
  FileText, 
  BarChart3, 
  TrendingUp, 
  GitBranch,
  CheckCircle,
  AlertTriangle,
  Download,
  Eye,
  Plus,
  X,
  Beaker,
  Target,
  Settings2,
  FileCheck,
  Loader2,
  Activity,
  ShieldCheck,
  FileCode
} from "lucide-react";

interface StatisticalTest {
  id: string;
  name: string;
  category: string;
  description: string;
  assumptions: string[];
  outputType: string;
}

const STATISTICAL_TESTS: StatisticalTest[] = [
  { id: "ttest-ind", name: "Independent t-test", category: "Comparison", description: "Compare means between two independent groups", assumptions: ["Normality", "Equal variance", "Independence"], outputType: "p-value, t-statistic, CI" },
  { id: "ttest-paired", name: "Paired t-test", category: "Comparison", description: "Compare means between paired/matched samples", assumptions: ["Normality of differences", "Paired observations"], outputType: "p-value, t-statistic, CI" },
  { id: "anova-one", name: "One-way ANOVA", category: "Comparison", description: "Compare means across 3+ independent groups", assumptions: ["Normality", "Homogeneity of variance", "Independence"], outputType: "F-statistic, p-value, post-hoc" },
  { id: "anova-two", name: "Two-way ANOVA", category: "Comparison", description: "Analyze effects of two categorical factors", assumptions: ["Normality", "Homogeneity", "No interaction (optional)"], outputType: "F-statistics, interaction effects" },
  { id: "chi-square", name: "Chi-square test", category: "Categorical", description: "Test association between categorical variables", assumptions: ["Expected freq ≥5", "Independence"], outputType: "χ², p-value, Cramér's V" },
  { id: "fisher", name: "Fisher's exact test", category: "Categorical", description: "Exact test for small sample categorical data", assumptions: ["Fixed marginals"], outputType: "Exact p-value, OR" },
  { id: "linear-reg", name: "Linear Regression", category: "Regression", description: "Model continuous outcome with predictors", assumptions: ["Linearity", "Normality of residuals", "Homoscedasticity"], outputType: "β coefficients, R², p-values" },
  { id: "logistic-reg", name: "Logistic Regression", category: "Regression", description: "Model binary outcome with predictors", assumptions: ["Independence", "No multicollinearity", "Linear logit"], outputType: "OR, 95% CI, p-values" },
  { id: "cox-reg", name: "Cox Proportional Hazards", category: "Survival", description: "Time-to-event analysis with covariates", assumptions: ["Proportional hazards", "Non-informative censoring"], outputType: "HR, 95% CI, p-values" },
  { id: "kaplan-meier", name: "Kaplan-Meier", category: "Survival", description: "Survival curve estimation", assumptions: ["Non-informative censoring"], outputType: "Survival curves, median survival" },
  { id: "mann-whitney", name: "Mann-Whitney U", category: "Non-parametric", description: "Non-parametric comparison of two groups", assumptions: ["Similar distribution shape", "Independence"], outputType: "U-statistic, p-value" },
  { id: "wilcoxon", name: "Wilcoxon signed-rank", category: "Non-parametric", description: "Non-parametric paired comparison", assumptions: ["Symmetric distribution"], outputType: "W-statistic, p-value" },
  { id: "correlation", name: "Pearson Correlation", category: "Association", description: "Linear association between continuous variables", assumptions: ["Linearity", "Bivariate normality"], outputType: "r, p-value, R²" },
  { id: "spearman", name: "Spearman Correlation", category: "Association", description: "Monotonic association (rank-based)", assumptions: ["Monotonic relationship"], outputType: "ρ, p-value" },
];

const ALPHA_LEVELS = [
  { value: "0.01", label: "α = 0.01 (99% CI)" },
  { value: "0.05", label: "α = 0.05 (95% CI)" },
  { value: "0.10", label: "α = 0.10 (90% CI)" },
];

const CORRECTION_METHODS = [
  { value: "none", label: "None", description: "No correction for multiple comparisons" },
  { value: "bonferroni", label: "Bonferroni", description: "Conservative correction (α/n)" },
  { value: "holm", label: "Holm-Bonferroni", description: "Step-down procedure" },
  { value: "fdr", label: "Benjamini-Hochberg", description: "False Discovery Rate control" },
];

interface Endpoint {
  id: string;
  name: string;
  type: "primary" | "secondary";
  dataType: "continuous" | "binary" | "categorical" | "time-to-event";
}

interface SapState {
  endpoints: Endpoint[];
  selectedTests: string[];
  alphaLevel: string;
  correctionMethod: string;
  covariates: string[];
  subgroupAnalyses: string[];
  sensitivityAnalyses: string[];
}

type MethodsFormat = 'markdown' | 'plain' | 'html';

interface SapBuilderPanelProps {
  topicId?: string;
  researchId?: string;
  onGenerateSap?: (state: SapState) => void;
}

export function SapBuilderPanel({ topicId, researchId, onGenerateSap }: SapBuilderPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const userRole = (user as any)?.role;
  const canApprove = userRole && ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] >= ROLE_HIERARCHY.STEWARD;
  
  const [sapState, setSapState] = useState<SapState>({
    endpoints: [
      { id: "ep-1", name: "HbA1c change from baseline", type: "primary", dataType: "continuous" },
      { id: "ep-2", name: "Cardiovascular event", type: "secondary", dataType: "time-to-event" },
    ],
    selectedTests: ["ttest-ind", "linear-reg"],
    alphaLevel: "0.05",
    correctionMethod: "fdr",
    covariates: ["Age", "Sex", "BMI", "Baseline HbA1c"],
    subgroupAnalyses: ["Age groups (<65 vs ≥65)", "Sex"],
    sensitivityAnalyses: ["Per-protocol population", "Complete case analysis"],
  });

  const [showPreview, setShowPreview] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState("");
  const [newEndpointType, setNewEndpointType] = useState<"primary" | "secondary">("primary");
  const [newEndpointDataType, setNewEndpointDataType] = useState<Endpoint["dataType"]>("continuous");
  const [newCovariate, setNewCovariate] = useState("");
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  
  const [createdSapId, setCreatedSapId] = useState<string | null>(null);
  const [sapStatus, setSapStatus] = useState<'draft' | 'approved'>('draft');
  const [methodsFormat, setMethodsFormat] = useState<MethodsFormat>('markdown');
  const [generatedMethods, setGeneratedMethods] = useState<string>('');
  const [approvalJustification, setApprovalJustification] = useState('');

  // Mutation for creating a new SAP
  const createSapMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiRequest("POST", "/api/ros/sap", payload);
      return response.json();
    },
    onSuccess: (data) => {
      setCreatedSapId(data.id);
      setSapStatus('draft');
      toast({
        title: "SAP Created",
        description: `Statistical Analysis Plan ${data.id} created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ros/sap'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create SAP",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for generating methods text
  const generateMethodsMutation = useMutation({
    mutationFn: async ({ sapId, format }: { sapId: string; format: MethodsFormat }) => {
      const response = await apiRequest("POST", `/api/ros/sap/${sapId}/generate-methods`, { format });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedMethods(data.methodsText || data.methods || '');
      toast({
        title: "Methods Generated",
        description: "Statistical methods text has been generated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate methods",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for approving SAP (STEWARD+ only)
  const approveSapMutation = useMutation({
    mutationFn: async ({ sapId, justification }: { sapId: string; justification: string }) => {
      const response = await apiRequest("POST", `/api/ros/sap/${sapId}/approve`, { justification });
      return response.json();
    },
    onSuccess: () => {
      setSapStatus('approved');
      setApprovalJustification('');
      toast({
        title: "SAP Approved",
        description: "Statistical Analysis Plan has been approved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ros/sap'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to approve SAP",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for running statistical analysis
  const runAnalysisMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiRequest("POST", "/api/ros/sap/execute", payload);
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysisResults(data);
      setShowPreview(true);
      toast({
        title: "Analysis Complete",
        description: `Executed ${data.n_tests || 0} statistical tests.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const toggleTest = useCallback((testId: string) => {
    setSapState(prev => ({
      ...prev,
      selectedTests: prev.selectedTests.includes(testId)
        ? prev.selectedTests.filter(id => id !== testId)
        : [...prev.selectedTests, testId]
    }));
  }, []);

  const addEndpoint = useCallback(() => {
    if (!newEndpoint.trim()) return;
    const endpoint: Endpoint = {
      id: `ep-${Date.now()}`,
      name: newEndpoint.trim(),
      type: newEndpointType,
      dataType: newEndpointDataType,
    };
    setSapState(prev => ({ ...prev, endpoints: [...prev.endpoints, endpoint] }));
    setNewEndpoint("");
  }, [newEndpoint, newEndpointType, newEndpointDataType]);

  const removeEndpoint = useCallback((id: string) => {
    setSapState(prev => ({
      ...prev,
      endpoints: prev.endpoints.filter(ep => ep.id !== id)
    }));
  }, []);

  const addCovariate = useCallback(() => {
    if (!newCovariate.trim() || sapState.covariates.includes(newCovariate.trim())) return;
    setSapState(prev => ({ ...prev, covariates: [...prev.covariates, newCovariate.trim()] }));
    setNewCovariate("");
  }, [newCovariate, sapState.covariates]);

  const removeCovariate = useCallback((cov: string) => {
    setSapState(prev => ({
      ...prev,
      covariates: prev.covariates.filter(c => c !== cov)
    }));
  }, []);

  const handleCreateSap = useCallback(() => {
    const primaryEndpoints = sapState.endpoints.filter(ep => ep.type === "primary");
    const secondaryEndpoints = sapState.endpoints.filter(ep => ep.type === "secondary");
    
    const primaryAnalyses = primaryEndpoints.map(ep => ({
      id: ep.id,
      hypothesis: `Analysis of ${ep.name}`,
      outcomeVariable: ep.name,
      exposureVariable: "treatment",
      modelType: ep.dataType === "time-to-event" ? "cox" : "linear",
      justification: "Pre-specified primary analysis"
    }));
    
    const secondaryAnalyses = secondaryEndpoints.map(ep => ({
      id: ep.id,
      hypothesis: `Secondary analysis of ${ep.name}`,
      outcomeVariable: ep.name,
      exposureVariable: "treatment",
      modelType: ep.dataType === "binary" ? "logistic" : "linear",
      justification: "Pre-specified secondary analysis"
    }));

    createSapMutation.mutate({
      topicId: topicId || "topic-default",
      researchId: researchId || "research-default",
      primaryAnalyses,
      secondaryAnalyses,
      covariateStrategy: {
        adjustment: "fully_adjusted",
        covariateList: sapState.covariates,
        selectionRationale: "A priori specified confounders"
      },
      sensitivityAnalyses: sapState.sensitivityAnalyses.map((sa, i) => ({
        name: sa,
        description: sa,
        modification: `Sensitivity analysis ${i + 1}`
      })),
      missingDataPlan: {
        mechanism: "MAR",
        approach: "multiple_imputation",
        assumptions: "Missing at random assumption"
      },
      multiplicityCorrection: sapState.correctionMethod,
      assumptionChecks: [
        { assumption: "Normality", testMethod: "Shapiro-Wilk", threshold: "p > 0.05" },
        { assumption: "Homoscedasticity", testMethod: "Levene's test", threshold: "p > 0.05" }
      ],
      subgroupAnalyses: sapState.subgroupAnalyses.map(sg => ({
        variable: sg,
        categories: [],
        justification: "Pre-specified subgroup"
      })),
      alphaLevel: parseFloat(sapState.alphaLevel)
    });
    
    setShowPreview(true);
    onGenerateSap?.(sapState);
  }, [sapState, topicId, researchId, onGenerateSap, createSapMutation]);

  const handleGenerateMethods = useCallback(() => {
    if (!createdSapId) {
      toast({
        title: "No SAP Created",
        description: "Please create a SAP first before generating methods.",
        variant: "destructive",
      });
      return;
    }
    generateMethodsMutation.mutate({ sapId: createdSapId, format: methodsFormat });
  }, [createdSapId, methodsFormat, generateMethodsMutation, toast]);

  const handleApproveSap = useCallback(() => {
    if (!createdSapId) {
      toast({
        title: "No SAP to Approve",
        description: "Please create a SAP first.",
        variant: "destructive",
      });
      return;
    }
    if (approvalJustification.length < 10) {
      toast({
        title: "Justification Required",
        description: "Please provide a justification (minimum 10 characters).",
        variant: "destructive",
      });
      return;
    }
    approveSapMutation.mutate({ sapId: createdSapId, justification: approvalJustification });
  }, [createdSapId, approvalJustification, approveSapMutation, toast]);

  const handleRunAnalysis = useCallback(() => {
    // Build the test configurations for the backend
    const tests = sapState.selectedTests.map(testId => {
      const test = STATISTICAL_TESTS.find(t => t.id === testId);
      const endpoint = sapState.endpoints[0]; // Use first endpoint for demo
      return {
        test_id: testId,
        test_name: test?.name || testId,
        endpoint_name: endpoint?.name || "Primary Outcome",
        endpoint_type: endpoint?.dataType || "continuous",
        alpha_level: parseFloat(sapState.alphaLevel),
        correction_method: sapState.correctionMethod,
        covariates: sapState.covariates
      };
    });

    runAnalysisMutation.mutate({
      tests,
      dataset_id: "thyroid-clinical-2024",
      alpha_level: parseFloat(sapState.alphaLevel),
      correction_method: sapState.correctionMethod
    });
  }, [sapState, runAnalysisMutation]);

  const testsByCategory = STATISTICAL_TESTS.reduce((acc, test) => {
    if (!acc[test.category]) acc[test.category] = [];
    acc[test.category].push(test);
    return acc;
  }, {} as Record<string, StatisticalTest[]>);

  const primaryEndpoints = sapState.endpoints.filter(ep => ep.type === "primary");
  const secondaryEndpoints = sapState.endpoints.filter(ep => ep.type === "secondary");
  const selectedTestDetails = STATISTICAL_TESTS.filter(t => sapState.selectedTests.includes(t.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-ros-workflow/30 bg-gradient-to-br from-ros-workflow/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-ros-workflow/10 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-ros-workflow" />
              </div>
              <div>
                <CardTitle className="text-lg">Statistical Analysis Plan Builder</CardTitle>
                <CardDescription>Define your analysis strategy for Stage 13</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-ros-workflow/50 text-ros-workflow">
              SAP v1.0
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="endpoints" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="endpoints" className="text-xs" data-testid="tab-endpoints">
                <Target className="w-3 h-3 mr-1" />
                Endpoints
              </TabsTrigger>
              <TabsTrigger value="tests" className="text-xs" data-testid="tab-tests">
                <Beaker className="w-3 h-3 mr-1" />
                Tests
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs" data-testid="tab-settings">
                <Settings2 className="w-3 h-3 mr-1" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs" data-testid="tab-preview">
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="endpoints" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-ros-primary/10 text-ros-primary border-ros-primary/30">Primary</Badge>
                    <span className="text-xs text-muted-foreground">{primaryEndpoints.length} defined</span>
                  </div>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    {primaryEndpoints.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No primary endpoints defined</p>
                    ) : (
                      <div className="space-y-2">
                        {primaryEndpoints.map(ep => (
                          <div key={ep.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div>
                              <p className="text-sm font-medium">{ep.name}</p>
                              <p className="text-xs text-muted-foreground">{ep.dataType}</p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => removeEndpoint(ep.id)}
                              data-testid={`remove-endpoint-${ep.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Secondary</Badge>
                    <span className="text-xs text-muted-foreground">{secondaryEndpoints.length} defined</span>
                  </div>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    {secondaryEndpoints.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No secondary endpoints defined</p>
                    ) : (
                      <div className="space-y-2">
                        {secondaryEndpoints.map(ep => (
                          <div key={ep.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div>
                              <p className="text-sm font-medium">{ep.name}</p>
                              <p className="text-xs text-muted-foreground">{ep.dataType}</p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => removeEndpoint(ep.id)}
                              data-testid={`remove-endpoint-${ep.id}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Add New Endpoint</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Endpoint name..."
                    value={newEndpoint}
                    onChange={(e) => setNewEndpoint(e.target.value)}
                    className="flex-1"
                    data-testid="input-new-endpoint"
                  />
                  <Select value={newEndpointType} onValueChange={(v) => setNewEndpointType(v as "primary" | "secondary")}>
                    <SelectTrigger className="w-28" data-testid="select-endpoint-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={newEndpointDataType} onValueChange={(v) => setNewEndpointDataType(v as Endpoint["dataType"])}>
                    <SelectTrigger className="w-32" data-testid="select-endpoint-datatype">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continuous">Continuous</SelectItem>
                      <SelectItem value="binary">Binary</SelectItem>
                      <SelectItem value="categorical">Categorical</SelectItem>
                      <SelectItem value="time-to-event">Time-to-event</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" onClick={addEndpoint} data-testid="button-add-endpoint">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tests" className="space-y-4">
              <ScrollArea className="h-64">
                <div className="space-y-4 pr-4">
                  {Object.entries(testsByCategory).map(([category, tests]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{category}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {tests.filter(t => sapState.selectedTests.includes(t.id)).length}/{tests.length} selected
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {tests.map(test => (
                          <div
                            key={test.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              sapState.selectedTests.includes(test.id)
                                ? "border-ros-workflow bg-ros-workflow/5"
                                : "border-muted hover:border-muted-foreground/30"
                            }`}
                            onClick={() => toggleTest(test.id)}
                            data-testid={`test-${test.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{test.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{test.description}</p>
                              </div>
                              <Checkbox
                                checked={sapState.selectedTests.includes(test.id)}
                                onCheckedChange={() => toggleTest(test.id)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {sapState.selectedTests.length} tests selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSapState(prev => ({ ...prev, selectedTests: [] }))}
                  >
                    Clear All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSapState(prev => ({ 
                      ...prev, 
                      selectedTests: STATISTICAL_TESTS.map(t => t.id) 
                    }))}
                  >
                    Select All
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Significance Level</Label>
                  <Select 
                    value={sapState.alphaLevel} 
                    onValueChange={(v) => setSapState(prev => ({ ...prev, alphaLevel: v }))}
                  >
                    <SelectTrigger data-testid="select-alpha">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALPHA_LEVELS.map(level => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Multiple Comparison Correction</Label>
                  <Select 
                    value={sapState.correctionMethod} 
                    onValueChange={(v) => setSapState(prev => ({ ...prev, correctionMethod: v }))}
                  >
                    <SelectTrigger data-testid="select-correction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CORRECTION_METHODS.map(method => (
                        <SelectItem key={method.value} value={method.value}>
                          <div>
                            <span className="font-medium">{method.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">- {method.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Covariates/Confounders</Label>
                  <Badge variant="outline">{sapState.covariates.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sapState.covariates.map(cov => (
                    <Badge 
                      key={cov} 
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive/10"
                      onClick={() => removeCovariate(cov)}
                    >
                      {cov}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add covariate..."
                    value={newCovariate}
                    onChange={(e) => setNewCovariate(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCovariate()}
                    data-testid="input-new-covariate"
                  />
                  <Button size="icon" onClick={addCovariate} data-testid="button-add-covariate">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Pre-specified Subgroup Analyses</Label>
                <div className="flex flex-wrap gap-2">
                  {sapState.subgroupAnalyses.map((sg, i) => (
                    <Badge key={i} variant="outline" className="border-ros-workflow/30">
                      <GitBranch className="h-3 w-3 mr-1" />
                      {sg}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Sensitivity Analyses</Label>
                <div className="flex flex-wrap gap-2">
                  {sapState.sensitivityAnalyses.map((sa, i) => (
                    <Badge key={i} variant="outline" className="border-amber-500/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {sa}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-ros-success" />
                    Statistical Analysis Plan Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Primary Endpoints ({primaryEndpoints.length})</p>
                    <ul className="list-disc list-inside space-y-1">
                      {primaryEndpoints.map(ep => (
                        <li key={ep.id}>{ep.name} <span className="text-muted-foreground">({ep.dataType})</span></li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Secondary Endpoints ({secondaryEndpoints.length})</p>
                    <ul className="list-disc list-inside space-y-1">
                      {secondaryEndpoints.map(ep => (
                        <li key={ep.id}>{ep.name} <span className="text-muted-foreground">({ep.dataType})</span></li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Planned Statistical Analyses</p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedTestDetails.map(test => (
                        <div key={test.id} className="p-2 rounded bg-background border">
                          <p className="font-medium">{test.name}</p>
                          <p className="text-xs text-muted-foreground">{test.outputType}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Significance Level</p>
                      <p>{ALPHA_LEVELS.find(l => l.value === sapState.alphaLevel)?.label}</p>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Multiple Comparison Correction</p>
                      <p>{CORRECTION_METHODS.find(m => m.value === sapState.correctionMethod)?.label}</p>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Model Covariates</p>
                    <p>{sapState.covariates.join(", ")}</p>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-ros-success">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">SAP Configuration Complete</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Estimated analyses: {sapState.endpoints.length * sapState.selectedTests.length} primary comparisons
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2 justify-end flex-wrap">
                <Button 
                  variant="outline" 
                  onClick={handleCreateSap} 
                  disabled={createSapMutation.isPending}
                  data-testid="button-create-sap"
                >
                  {createSapMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  {createSapMutation.isPending ? "Creating..." : "Create SAP"}
                </Button>
                <Button 
                  onClick={handleRunAnalysis} 
                  disabled={runAnalysisMutation.isPending}
                  data-testid="button-run-analysis"
                >
                  {runAnalysisMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BarChart3 className="h-4 w-4 mr-2" />
                  )}
                  {runAnalysisMutation.isPending ? "Running..." : "Run Analysis"}
                </Button>
              </div>

              {createdSapId && (
                <div className="mt-4 space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        SAP: {createdSapId}
                      </Badge>
                      <Badge className={sapStatus === 'approved' ? "bg-ros-success/10 text-ros-success border-ros-success/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}>
                        {sapStatus === 'approved' ? 'Approved' : 'Draft'}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Generate Methods Text</Label>
                    <div className="flex gap-2">
                      <Select value={methodsFormat} onValueChange={(v) => setMethodsFormat(v as MethodsFormat)}>
                        <SelectTrigger className="w-32" data-testid="select-methods-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="markdown">Markdown</SelectItem>
                          <SelectItem value="plain">Plain Text</SelectItem>
                          <SelectItem value="html">HTML</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline"
                        onClick={handleGenerateMethods}
                        disabled={generateMethodsMutation.isPending}
                        data-testid="button-generate-methods"
                      >
                        {generateMethodsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileCode className="h-4 w-4 mr-2" />
                        )}
                        {generateMethodsMutation.isPending ? "Generating..." : "Generate Methods"}
                      </Button>
                    </div>
                  </div>

                  {generatedMethods && (
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileCode className="h-4 w-4 text-ros-workflow" />
                          Generated Methods ({methodsFormat})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-48 rounded border bg-background p-3">
                          <pre className="text-xs whitespace-pre-wrap font-mono" data-testid="text-generated-methods">
                            {generatedMethods}
                          </pre>
                        </ScrollArea>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => navigator.clipboard.writeText(generatedMethods)}
                          data-testid="button-copy-methods"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Copy to Clipboard
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {canApprove && sapStatus !== 'approved' && (
                    <Card className="border-ros-success/30 bg-ros-success/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-ros-success" />
                          Approve SAP (Steward Action)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          As a steward, you can approve this SAP for execution
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Approval Justification</Label>
                          <Textarea
                            placeholder="Provide justification for approving this SAP (min 10 characters)..."
                            value={approvalJustification}
                            onChange={(e) => setApprovalJustification(e.target.value)}
                            className="text-sm"
                            data-testid="input-approval-justification"
                          />
                        </div>
                        <Button 
                          onClick={handleApproveSap}
                          disabled={approveSapMutation.isPending || approvalJustification.length < 10}
                          className="bg-ros-success hover:bg-ros-success/90"
                          data-testid="button-approve-sap"
                        >
                          {approveSapMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-4 w-4 mr-2" />
                          )}
                          {approveSapMutation.isPending ? "Approving..." : "Approve SAP"}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {sapStatus === 'approved' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-ros-success/30 bg-ros-success/5">
                      <CheckCircle className="h-5 w-5 text-ros-success" />
                      <span className="text-sm font-medium text-ros-success">SAP has been approved and is ready for execution</span>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {showPreview && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4"
        >
          <Card className="border-ros-success/30 bg-ros-success/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-ros-success" />
                  {analysisResults ? "Analysis Results" : "Analysis Execution Preview"}
                </CardTitle>
                <Button variant="outline" size="sm" data-testid="button-download-sap">
                  <Download className="h-3 w-3 mr-1" />
                  Export SAP
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div className="p-3 rounded-lg bg-background">
                  <p className="text-2xl font-bold text-ros-primary">{analysisResults?.n_observations || sapState.endpoints.length}</p>
                  <p className="text-xs text-muted-foreground">{analysisResults ? "Observations" : "Endpoints"}</p>
                </div>
                <div className="p-3 rounded-lg bg-background">
                  <p className="text-2xl font-bold text-ros-workflow">{analysisResults?.n_tests || sapState.selectedTests.length}</p>
                  <p className="text-xs text-muted-foreground">Statistical Tests</p>
                </div>
                <div className="p-3 rounded-lg bg-background">
                  <p className="text-2xl font-bold text-ros-success">
                    {analysisResults ? `${analysisResults.execution_time_ms}ms` : "~20 min"}
                  </p>
                  <p className="text-xs text-muted-foreground">{analysisResults ? "Execution Time" : "Est. Runtime"}</p>
                </div>
              </div>

              {analysisResults?.run_id && (
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {analysisResults.run_id}
                  </Badge>
                  <Badge className="bg-ros-success/10 text-ros-success border-ros-success/30">
                    {analysisResults.status}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {analysisResults?.results && analysisResults.results.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-ros-workflow" />
                  Test Results
                </CardTitle>
                <CardDescription>
                  {analysisResults.results.filter((r: any) => r.significant).length} of {analysisResults.results.length} tests significant at α = {sapState.alphaLevel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {analysisResults.results.map((result: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border ${
                          result.significant 
                            ? "border-ros-success/30 bg-ros-success/5" 
                            : "border-muted bg-muted/30"
                        }`}
                        data-testid={`result-${result.test_id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-medium text-sm">{result.test_name}</p>
                            <p className="text-xs text-muted-foreground">{result.endpoint_name}</p>
                          </div>
                          <Badge 
                            variant={result.significant ? "default" : "secondary"}
                            className={result.significant ? "bg-ros-success text-white" : ""}
                          >
                            {result.significant ? "Significant" : "NS"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">{result.statistic_name}:</span>
                            <span className="ml-1 font-mono">{result.statistic?.toFixed(3)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">p-value:</span>
                            <span className={`ml-1 font-mono ${result.p_value < 0.05 ? "text-ros-success font-semibold" : ""}`}>
                              {result.p_value.toFixed(4)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">95% CI:</span>
                            <span className="ml-1 font-mono">[{result.ci_lower?.toFixed(2)}, {result.ci_upper?.toFixed(2)}]</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{result.effect_size_name}:</span>
                            <span className="ml-1 font-mono">{result.effect_size?.toFixed(3)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {analysisResults.warnings && analysisResults.warnings.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-sm">Warnings</span>
                    </div>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      {analysisResults.warnings.map((warning: string, idx: number) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

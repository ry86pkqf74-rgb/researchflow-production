/**
 * Stage 07 - Statistical Modeling
 * Build and validate statistical models
 * Features: Model type selection, variable selection, assumptions checker, fit statistics, residual plots, model comparison, export
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Calculator,
  Play,
  Pause,
  RefreshCcw,
  Settings,
  Download,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  FileText,
  BarChart3,
  TrendingUp,
  ScatterChart,
  Table,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Copy,
  Eye,
  Layers,
  ArrowRight,
  Sigma,
  Percent,
  Activity,
  Target,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// ==================== Types ====================

export type ModelType =
  | 'linear_regression'
  | 'logistic_regression'
  | 'multiple_regression'
  | 'polynomial_regression'
  | 'anova_one_way'
  | 'anova_two_way'
  | 'anova_repeated'
  | 't_test_independent'
  | 't_test_paired'
  | 't_test_one_sample'
  | 'chi_square_independence'
  | 'chi_square_goodness'
  | 'correlation_pearson'
  | 'correlation_spearman'
  | 'mann_whitney'
  | 'wilcoxon'
  | 'kruskal_wallis'
  | 'mixed_effects';

export type VariableType = 'continuous' | 'categorical' | 'ordinal' | 'binary';

export type AssumptionStatus = 'not_checked' | 'checking' | 'passed' | 'violated' | 'warning';

export type ModelStatus = 'draft' | 'configured' | 'running' | 'completed' | 'failed';

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  description?: string;
  isDependent: boolean;
  isIndependent: boolean;
  isCovariates?: boolean;
  uniqueValues?: number;
  missingCount?: number;
  distribution?: 'normal' | 'skewed' | 'bimodal' | 'uniform' | 'unknown';
}

export interface ModelAssumption {
  id: string;
  name: string;
  description: string;
  status: AssumptionStatus;
  testName?: string;
  testStatistic?: number;
  pValue?: number;
  threshold?: number;
  message?: string;
  remediation?: string;
}

export interface CoefficientEstimate {
  variable: string;
  estimate: number;
  standardError: number;
  tStatistic?: number;
  zStatistic?: number;
  pValue: number;
  confidenceIntervalLower: number;
  confidenceIntervalUpper: number;
  isSignificant: boolean;
  vif?: number;
}

export interface ModelFitStatistics {
  rSquared?: number;
  adjustedRSquared?: number;
  fStatistic?: number;
  fPValue?: number;
  aic?: number;
  bic?: number;
  logLikelihood?: number;
  devianceResidual?: number;
  pseudoRSquared?: number;
  chiSquare?: number;
  chiSquarePValue?: number;
  degreesOfFreedom?: number;
  effectSize?: number;
  effectSizeType?: string;
  power?: number;
  sampleSize?: number;
  observedPower?: number;
}

export interface ResidualPlot {
  id: string;
  name: string;
  type: 'histogram' | 'qq_plot' | 'residual_vs_fitted' | 'scale_location' | 'residual_vs_leverage' | 'actual_vs_predicted';
  description: string;
  data?: {
    x: number[];
    y: number[];
    labels?: string[];
  };
  interpretation?: string;
}

export interface StatisticalModel {
  id: string;
  name: string;
  description?: string;
  type: ModelType;
  status: ModelStatus;
  dependentVariable?: string;
  independentVariables: string[];
  covariates?: string[];
  groupingVariable?: string;
  assumptions: ModelAssumption[];
  coefficients: CoefficientEstimate[];
  fitStatistics: ModelFitStatistics;
  residualPlots: ResidualPlot[];
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  confidenceLevel: number;
  hypothesisType: 'two_tailed' | 'left_tailed' | 'right_tailed';
}

export interface DatasetVariable {
  id: string;
  name: string;
  type: VariableType;
  uniqueValues: number;
  missingCount: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
}

interface Stage07Props {
  models: StatisticalModel[];
  onModelsChange: (models: StatisticalModel[]) => void;
  availableVariables: DatasetVariable[];
  onRunModel?: (modelId: string) => Promise<void>;
  onCheckAssumptions?: (modelId: string) => Promise<ModelAssumption[]>;
  onExportSummary?: (modelId: string, format: 'json' | 'csv' | 'html' | 'latex') => Promise<void>;
  onGenerateReport?: (modelId: string) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

// ==================== Model Type Metadata ====================

const MODEL_TYPE_INFO: Record<ModelType, {
  label: string;
  category: 'regression' | 'anova' | 't_test' | 'chi_square' | 'correlation' | 'nonparametric' | 'mixed';
  description: string;
  requiresDependent: boolean;
  requiresIndependent: boolean;
  minIndependent: number;
  maxIndependent: number;
  dependentTypes: VariableType[];
  independentTypes: VariableType[];
  icon: React.ComponentType<{ className?: string }>;
}> = {
  linear_regression: {
    label: 'Linear Regression',
    category: 'regression',
    description: 'Model linear relationship between continuous dependent and independent variables',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 1,
    dependentTypes: ['continuous'],
    independentTypes: ['continuous'],
    icon: TrendingUp,
  },
  multiple_regression: {
    label: 'Multiple Regression',
    category: 'regression',
    description: 'Model relationship with multiple independent variables',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 2,
    maxIndependent: 20,
    dependentTypes: ['continuous'],
    independentTypes: ['continuous', 'categorical', 'binary'],
    icon: Layers,
  },
  polynomial_regression: {
    label: 'Polynomial Regression',
    category: 'regression',
    description: 'Model non-linear relationships using polynomial terms',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 1,
    dependentTypes: ['continuous'],
    independentTypes: ['continuous'],
    icon: Activity,
  },
  logistic_regression: {
    label: 'Logistic Regression',
    category: 'regression',
    description: 'Model binary outcomes using logistic function',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 20,
    dependentTypes: ['binary'],
    independentTypes: ['continuous', 'categorical', 'binary'],
    icon: Sigma,
  },
  anova_one_way: {
    label: 'One-Way ANOVA',
    category: 'anova',
    description: 'Compare means across multiple groups',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 1,
    dependentTypes: ['continuous'],
    independentTypes: ['categorical'],
    icon: BarChart3,
  },
  anova_two_way: {
    label: 'Two-Way ANOVA',
    category: 'anova',
    description: 'Compare means with two categorical factors',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 2,
    maxIndependent: 2,
    dependentTypes: ['continuous'],
    independentTypes: ['categorical'],
    icon: BarChart3,
  },
  anova_repeated: {
    label: 'Repeated Measures ANOVA',
    category: 'anova',
    description: 'Compare means across repeated measurements',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 2,
    dependentTypes: ['continuous'],
    independentTypes: ['categorical'],
    icon: RefreshCcw,
  },
  t_test_independent: {
    label: 'Independent T-Test',
    category: 't_test',
    description: 'Compare means between two independent groups',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 1,
    dependentTypes: ['continuous'],
    independentTypes: ['binary'],
    icon: ArrowRight,
  },
  t_test_paired: {
    label: 'Paired T-Test',
    category: 't_test',
    description: 'Compare means between two related measurements',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 1,
    dependentTypes: ['continuous'],
    independentTypes: ['binary'],
    icon: ArrowRight,
  },
  t_test_one_sample: {
    label: 'One-Sample T-Test',
    category: 't_test',
    description: 'Compare sample mean to a known value',
    requiresDependent: true,
    requiresIndependent: false,
    minIndependent: 0,
    maxIndependent: 0,
    dependentTypes: ['continuous'],
    independentTypes: [],
    icon: Target,
  },
  chi_square_independence: {
    label: 'Chi-Square Test of Independence',
    category: 'chi_square',
    description: 'Test association between two categorical variables',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 1,
    dependentTypes: ['categorical', 'binary'],
    independentTypes: ['categorical', 'binary'],
    icon: Table,
  },
  chi_square_goodness: {
    label: 'Chi-Square Goodness of Fit',
    category: 'chi_square',
    description: 'Test if distribution matches expected frequencies',
    requiresDependent: true,
    requiresIndependent: false,
    minIndependent: 0,
    maxIndependent: 0,
    dependentTypes: ['categorical'],
    independentTypes: [],
    icon: Table,
  },
  correlation_pearson: {
    label: 'Pearson Correlation',
    category: 'correlation',
    description: 'Measure linear correlation between continuous variables',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 10,
    dependentTypes: ['continuous'],
    independentTypes: ['continuous'],
    icon: ScatterChart,
  },
  correlation_spearman: {
    label: 'Spearman Correlation',
    category: 'correlation',
    description: 'Measure monotonic correlation (rank-based)',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 10,
    dependentTypes: ['continuous', 'ordinal'],
    independentTypes: ['continuous', 'ordinal'],
    icon: ScatterChart,
  },
  mann_whitney: {
    label: 'Mann-Whitney U Test',
    category: 'nonparametric',
    description: 'Non-parametric alternative to independent t-test',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 1,
    dependentTypes: ['continuous', 'ordinal'],
    independentTypes: ['binary'],
    icon: BarChart3,
  },
  wilcoxon: {
    label: 'Wilcoxon Signed-Rank Test',
    category: 'nonparametric',
    description: 'Non-parametric alternative to paired t-test',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 1,
    dependentTypes: ['continuous', 'ordinal'],
    independentTypes: ['binary'],
    icon: BarChart3,
  },
  kruskal_wallis: {
    label: 'Kruskal-Wallis Test',
    category: 'nonparametric',
    description: 'Non-parametric alternative to one-way ANOVA',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 1,
    dependentTypes: ['continuous', 'ordinal'],
    independentTypes: ['categorical'],
    icon: BarChart3,
  },
  mixed_effects: {
    label: 'Mixed Effects Model',
    category: 'mixed',
    description: 'Model with both fixed and random effects',
    requiresDependent: true,
    requiresIndependent: true,
    minIndependent: 1,
    maxIndependent: 20,
    dependentTypes: ['continuous'],
    independentTypes: ['continuous', 'categorical', 'binary'],
    icon: Layers,
  },
};

const DEFAULT_MODEL: Omit<StatisticalModel, 'id' | 'createdAt'> = {
  name: '',
  type: 'linear_regression',
  status: 'draft',
  independentVariables: [],
  assumptions: [],
  coefficients: [],
  fitStatistics: {},
  residualPlots: [],
  confidenceLevel: 0.95,
  hypothesisType: 'two_tailed',
};

// ==================== Main Component ====================

export function Stage07StatisticalModeling({
  models,
  onModelsChange,
  availableVariables,
  onRunModel,
  onCheckAssumptions,
  onExportSummary,
  onGenerateReport,
  isProcessing = false,
  className,
}: Stage07Props) {
  const [selectedTab, setSelectedTab] = useState('configure');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    models[0]?.id || null
  );
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [newModel, setNewModel] = useState<Omit<StatisticalModel, 'id' | 'createdAt'>>(DEFAULT_MODEL);
  const [expandedAssumptions, setExpandedAssumptions] = useState<Set<string>>(new Set());

  const selectedModel = models.find(m => m.id === selectedModelId);

  // Create new model
  const handleCreateModel = useCallback(() => {
    if (!newModel.name.trim()) return;

    const model: StatisticalModel = {
      ...newModel,
      id: `model_${Date.now()}`,
      createdAt: new Date(),
      assumptions: generateDefaultAssumptions(newModel.type),
    };

    onModelsChange([...models, model]);
    setSelectedModelId(model.id);
    setNewModel(DEFAULT_MODEL);
    setIsCreatingModel(false);
    setSelectedTab('configure');
  }, [newModel, models, onModelsChange]);

  // Update model
  const updateModel = useCallback((modelId: string, updates: Partial<StatisticalModel>) => {
    onModelsChange(
      models.map(m => m.id === modelId ? { ...m, ...updates } : m)
    );
  }, [models, onModelsChange]);

  // Delete model
  const handleDeleteModel = useCallback((modelId: string) => {
    onModelsChange(models.filter(m => m.id !== modelId));
    if (selectedModelId === modelId) {
      setSelectedModelId(models.find(m => m.id !== modelId)?.id || null);
    }
  }, [models, onModelsChange, selectedModelId]);

  // Run model
  const handleRunModel = useCallback(async (modelId: string) => {
    if (!onRunModel) return;
    updateModel(modelId, { status: 'running' });
    try {
      await onRunModel(modelId);
    } catch {
      updateModel(modelId, { status: 'failed', errorMessage: 'Model execution failed' });
    }
  }, [onRunModel, updateModel]);

  // Check assumptions
  const handleCheckAssumptions = useCallback(async (modelId: string) => {
    if (!onCheckAssumptions) return;
    const model = models.find(m => m.id === modelId);
    if (!model) return;

    const updatedAssumptions = model.assumptions.map(a => ({
      ...a,
      status: 'checking' as AssumptionStatus,
    }));
    updateModel(modelId, { assumptions: updatedAssumptions });

    try {
      const results = await onCheckAssumptions(modelId);
      updateModel(modelId, { assumptions: results });
    } catch {
      updateModel(modelId, {
        assumptions: model.assumptions.map(a => ({
          ...a,
          status: 'not_checked' as AssumptionStatus,
          message: 'Check failed',
        })),
      });
    }
  }, [onCheckAssumptions, models, updateModel]);

  // Export summary
  const handleExport = useCallback(async (modelId: string, format: 'json' | 'csv' | 'html' | 'latex') => {
    if (!onExportSummary) return;
    await onExportSummary(modelId, format);
  }, [onExportSummary]);

  // Completed models
  const completedModels = models.filter(m => m.status === 'completed');

  return (
    <div className={cn('space-y-6', className)}>
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="configure">
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </TabsTrigger>
          <TabsTrigger value="assumptions">
            <CheckCircle className="mr-2 h-4 w-4" />
            Assumptions
          </TabsTrigger>
          <TabsTrigger value="results">
            <Calculator className="mr-2 h-4 w-4" />
            Results ({completedModels.length})
          </TabsTrigger>
          <TabsTrigger value="compare">
            <Layers className="mr-2 h-4 w-4" />
            Compare
          </TabsTrigger>
        </TabsList>

        {/* Configure Tab */}
        <TabsContent value="configure" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Model Configuration Panel */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      {isCreatingModel ? 'New Statistical Model' : 'Model Configuration'}
                    </CardTitle>
                    <CardDescription>
                      {isCreatingModel
                        ? 'Define a new statistical model'
                        : selectedModel
                        ? `Configure ${selectedModel.name}`
                        : 'Select or create a model to configure'}
                    </CardDescription>
                  </div>
                  {!isCreatingModel && (
                    <Button onClick={() => setIsCreatingModel(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Model
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isCreatingModel ? (
                  <ModelConfigForm
                    model={newModel}
                    availableVariables={availableVariables}
                    onModelChange={setNewModel}
                    onCancel={() => {
                      setIsCreatingModel(false);
                      setNewModel(DEFAULT_MODEL);
                    }}
                    onCreate={handleCreateModel}
                  />
                ) : selectedModel ? (
                  <ModelConfigForm
                    model={selectedModel}
                    availableVariables={availableVariables}
                    onModelChange={(updates) => updateModel(selectedModel.id, updates)}
                    isExisting
                    onRun={() => handleRunModel(selectedModel.id)}
                    onCheckAssumptions={() => handleCheckAssumptions(selectedModel.id)}
                    isProcessing={isProcessing || selectedModel.status === 'running'}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      No model selected. Create a new model or select from the list.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Models List */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Your Models</CardTitle>
                </CardHeader>
                <CardContent>
                  {models.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {models.map((model) => (
                          <ModelListItem
                            key={model.id}
                            model={model}
                            isSelected={selectedModelId === model.id}
                            onSelect={() => {
                              setSelectedModelId(model.id);
                              setIsCreatingModel(false);
                            }}
                            onDelete={() => handleDeleteModel(model.id)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No models yet</p>
                      <p className="text-xs">Create your first model to get started</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Model Templates */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quick Templates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setNewModel({
                        ...DEFAULT_MODEL,
                        name: 'Linear Regression Model',
                        type: 'linear_regression',
                      });
                      setIsCreatingModel(true);
                    }}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Linear Regression
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setNewModel({
                        ...DEFAULT_MODEL,
                        name: 'Logistic Regression Model',
                        type: 'logistic_regression',
                      });
                      setIsCreatingModel(true);
                    }}
                  >
                    <Sigma className="mr-2 h-4 w-4" />
                    Logistic Regression
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setNewModel({
                        ...DEFAULT_MODEL,
                        name: 'One-Way ANOVA',
                        type: 'anova_one_way',
                      });
                      setIsCreatingModel(true);
                    }}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    One-Way ANOVA
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setNewModel({
                        ...DEFAULT_MODEL,
                        name: 'Independent T-Test',
                        type: 't_test_independent',
                      });
                      setIsCreatingModel(true);
                    }}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Independent T-Test
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Assumptions Tab */}
        <TabsContent value="assumptions" className="mt-4">
          {selectedModel ? (
            <AssumptionsPanel
              model={selectedModel}
              expandedAssumptions={expandedAssumptions}
              onToggleExpanded={(id) => {
                setExpandedAssumptions(prev => {
                  const next = new Set(prev);
                  if (next.has(id)) {
                    next.delete(id);
                  } else {
                    next.add(id);
                  }
                  return next;
                });
              }}
              onCheckAssumptions={() => handleCheckAssumptions(selectedModel.id)}
              isProcessing={isProcessing}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a model to check assumptions</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="mt-4">
          {completedModels.length > 0 ? (
            <div className="space-y-4">
              {completedModels.map((model) => (
                <ModelResultsCard
                  key={model.id}
                  model={model}
                  onExport={(format) => handleExport(model.id, format)}
                  onGenerateReport={() => onGenerateReport?.(model.id)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No completed models yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Run a model to see results here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" className="mt-4">
          <ModelComparisonTable
            models={completedModels}
            onSelectModel={(id) => {
              setSelectedModelId(id);
              setSelectedTab('results');
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== Sub-Components ====================

// Model Configuration Form
interface ModelConfigFormProps {
  model: Omit<StatisticalModel, 'id' | 'createdAt'> | StatisticalModel;
  availableVariables: DatasetVariable[];
  onModelChange: (updates: Partial<StatisticalModel>) => void;
  onCancel?: () => void;
  onCreate?: () => void;
  isExisting?: boolean;
  onRun?: () => void;
  onCheckAssumptions?: () => void;
  isProcessing?: boolean;
}

function ModelConfigForm({
  model,
  availableVariables,
  onModelChange,
  onCancel,
  onCreate,
  isExisting,
  onRun,
  onCheckAssumptions,
  isProcessing,
}: ModelConfigFormProps) {
  const modelInfo = MODEL_TYPE_INFO[model.type];
  const ModelIcon = modelInfo.icon;

  // Filter variables based on model type requirements
  const eligibleDependentVars = availableVariables.filter(
    v => modelInfo.dependentTypes.includes(v.type)
  );
  const eligibleIndependentVars = availableVariables.filter(
    v => modelInfo.independentTypes.includes(v.type)
  );

  // Validation
  const isValid = useMemo(() => {
    if (!model.name.trim()) return false;
    if (modelInfo.requiresDependent && !model.dependentVariable) return false;
    if (modelInfo.requiresIndependent && model.independentVariables.length < modelInfo.minIndependent) return false;
    return true;
  }, [model, modelInfo]);

  return (
    <div className="space-y-6">
      {/* Model Name & Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="model-name">Model Name</Label>
          <Input
            id="model-name"
            placeholder="Enter model name..."
            value={model.name}
            onChange={(e) => onModelChange({ name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model-type">Model Type</Label>
          <Select
            value={model.type}
            onValueChange={(v) => onModelChange({
              type: v as ModelType,
              independentVariables: [],
              dependentVariable: undefined,
            })}
          >
            <SelectTrigger id="model-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear_regression">Linear Regression</SelectItem>
              <SelectItem value="multiple_regression">Multiple Regression</SelectItem>
              <SelectItem value="polynomial_regression">Polynomial Regression</SelectItem>
              <SelectItem value="logistic_regression">Logistic Regression</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="anova_one_way">One-Way ANOVA</SelectItem>
              <SelectItem value="anova_two_way">Two-Way ANOVA</SelectItem>
              <SelectItem value="anova_repeated">Repeated Measures ANOVA</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="t_test_independent">Independent T-Test</SelectItem>
              <SelectItem value="t_test_paired">Paired T-Test</SelectItem>
              <SelectItem value="t_test_one_sample">One-Sample T-Test</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="chi_square_independence">Chi-Square (Independence)</SelectItem>
              <SelectItem value="chi_square_goodness">Chi-Square (Goodness of Fit)</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="correlation_pearson">Pearson Correlation</SelectItem>
              <SelectItem value="correlation_spearman">Spearman Correlation</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="mann_whitney">Mann-Whitney U Test</SelectItem>
              <SelectItem value="wilcoxon">Wilcoxon Signed-Rank Test</SelectItem>
              <SelectItem value="kruskal_wallis">Kruskal-Wallis Test</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="mixed_effects">Mixed Effects Model</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Model Type Info */}
      <Alert>
        <ModelIcon className="h-4 w-4" />
        <AlertTitle>{modelInfo.label}</AlertTitle>
        <AlertDescription>{modelInfo.description}</AlertDescription>
      </Alert>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="model-description">Description (optional)</Label>
        <Textarea
          id="model-description"
          placeholder="Describe the purpose of this model..."
          value={model.description || ''}
          onChange={(e) => onModelChange({ description: e.target.value })}
          rows={2}
        />
      </div>

      <Separator />

      {/* Variable Selection */}
      <div className="space-y-4">
        <h3 className="font-medium">Variable Selection</h3>

        {/* Dependent Variable */}
        {modelInfo.requiresDependent && (
          <div className="space-y-2">
            <Label htmlFor="dependent-var">
              Dependent Variable (Outcome)
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Select
              value={model.dependentVariable || ''}
              onValueChange={(v) => onModelChange({ dependentVariable: v })}
            >
              <SelectTrigger id="dependent-var">
                <SelectValue placeholder="Select dependent variable..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleDependentVars.map((v) => (
                  <SelectItem key={v.id} value={v.name}>
                    <div className="flex items-center gap-2">
                      <span>{v.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {v.type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eligibleDependentVars.length === 0 && (
              <p className="text-xs text-destructive">
                No variables of type {modelInfo.dependentTypes.join(' or ')} available
              </p>
            )}
          </div>
        )}

        {/* Independent Variables */}
        {modelInfo.requiresIndependent && (
          <div className="space-y-2">
            <Label>
              Independent Variables (Predictors)
              <span className="text-destructive ml-1">*</span>
              <span className="text-muted-foreground ml-2">
                (min: {modelInfo.minIndependent}, max: {modelInfo.maxIndependent})
              </span>
            </Label>
            <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
              {eligibleIndependentVars.map((v) => (
                <div key={v.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`var-${v.id}`}
                    checked={model.independentVariables.includes(v.name)}
                    disabled={
                      !model.independentVariables.includes(v.name) &&
                      model.independentVariables.length >= modelInfo.maxIndependent
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onModelChange({
                          independentVariables: [...model.independentVariables, v.name],
                        });
                      } else {
                        onModelChange({
                          independentVariables: model.independentVariables.filter(
                            name => name !== v.name
                          ),
                        });
                      }
                    }}
                  />
                  <label
                    htmlFor={`var-${v.id}`}
                    className="flex-1 flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <span>{v.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {v.type}
                    </Badge>
                    {v.missingCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {v.missingCount} missing
                      </Badge>
                    )}
                  </label>
                </div>
              ))}
              {eligibleIndependentVars.length === 0 && (
                <p className="text-xs text-destructive">
                  No variables of type {modelInfo.independentTypes.join(' or ')} available
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected: {model.independentVariables.length} variable(s)
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Model Settings */}
      <div className="space-y-4">
        <h3 className="font-medium">Model Settings</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="confidence-level">Confidence Level</Label>
            <Select
              value={model.confidenceLevel.toString()}
              onValueChange={(v) => onModelChange({ confidenceLevel: parseFloat(v) })}
            >
              <SelectTrigger id="confidence-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.90">90%</SelectItem>
                <SelectItem value="0.95">95%</SelectItem>
                <SelectItem value="0.99">99%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hypothesis-type">Hypothesis Type</Label>
            <Select
              value={model.hypothesisType}
              onValueChange={(v) => onModelChange({ hypothesisType: v as StatisticalModel['hypothesisType'] })}
            >
              <SelectTrigger id="hypothesis-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="two_tailed">Two-Tailed</SelectItem>
                <SelectItem value="left_tailed">Left-Tailed</SelectItem>
                <SelectItem value="right_tailed">Right-Tailed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        {isExisting ? (
          <>
            <Button variant="outline" onClick={onCheckAssumptions} disabled={isProcessing}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Check Assumptions
            </Button>
            <Button onClick={onRun} disabled={!isValid || isProcessing}>
              {isProcessing ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Model
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={!isValid}>
              <Plus className="mr-2 h-4 w-4" />
              Create Model
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Model List Item
function ModelListItem({
  model,
  isSelected,
  onSelect,
  onDelete,
}: {
  model: StatisticalModel;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const modelInfo = MODEL_TYPE_INFO[model.type];
  const ModelIcon = modelInfo.icon;

  const statusConfig: Record<ModelStatus, { color: string; label: string }> = {
    draft: { color: 'bg-gray-100 text-gray-600', label: 'Draft' },
    configured: { color: 'bg-blue-100 text-blue-600', label: 'Configured' },
    running: { color: 'bg-yellow-100 text-yellow-600', label: 'Running' },
    completed: { color: 'bg-green-100 text-green-600', label: 'Completed' },
    failed: { color: 'bg-red-100 text-red-600', label: 'Failed' },
  };

  const status = statusConfig[model.status];

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
        isSelected && 'border-primary bg-primary/5',
        !isSelected && 'hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      <ModelIcon className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{model.name}</p>
        <p className="text-xs text-muted-foreground">{modelInfo.label}</p>
      </div>
      <Badge className={cn('text-xs', status.color)}>
        {status.label}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Assumptions Panel
function AssumptionsPanel({
  model,
  expandedAssumptions,
  onToggleExpanded,
  onCheckAssumptions,
  isProcessing,
}: {
  model: StatisticalModel;
  expandedAssumptions: Set<string>;
  onToggleExpanded: (id: string) => void;
  onCheckAssumptions: () => void;
  isProcessing: boolean;
}) {
  const passedCount = model.assumptions.filter(a => a.status === 'passed').length;
  const violatedCount = model.assumptions.filter(a => a.status === 'violated').length;
  const warningCount = model.assumptions.filter(a => a.status === 'warning').length;
  const notCheckedCount = model.assumptions.filter(a => a.status === 'not_checked').length;

  const overallStatus = violatedCount > 0
    ? 'violated'
    : warningCount > 0
    ? 'warning'
    : passedCount === model.assumptions.length
    ? 'passed'
    : 'not_checked';

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Model Assumptions for {model.name}
              </CardTitle>
              <CardDescription>
                Verify statistical assumptions before interpreting results
              </CardDescription>
            </div>
            <AssumptionStatusBadge status={overallStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{model.assumptions.length}</p>
              <p className="text-xs text-muted-foreground">Total Checks</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{passedCount}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{violatedCount}</p>
              <p className="text-xs text-muted-foreground">Violated</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={onCheckAssumptions} disabled={isProcessing} className="w-full">
            {isProcessing ? (
              <>
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                Checking Assumptions...
              </>
            ) : notCheckedCount > 0 ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Assumption Checks
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Re-run Checks
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Assumptions List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assumption Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {model.assumptions.map((assumption) => (
              <AssumptionCard
                key={assumption.id}
                assumption={assumption}
                isExpanded={expandedAssumptions.has(assumption.id)}
                onToggle={() => onToggleExpanded(assumption.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Assumption Status Badge
function AssumptionStatusBadge({ status }: { status: AssumptionStatus }) {
  const config: Record<AssumptionStatus, { color: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
    not_checked: { color: 'bg-gray-100 text-gray-600', label: 'Not Checked', icon: Info },
    checking: { color: 'bg-blue-100 text-blue-600', label: 'Checking...', icon: RefreshCcw },
    passed: { color: 'bg-green-100 text-green-600', label: 'Passed', icon: CheckCircle },
    violated: { color: 'bg-red-100 text-red-600', label: 'Violated', icon: X },
    warning: { color: 'bg-yellow-100 text-yellow-600', label: 'Warning', icon: AlertTriangle },
  };

  const { color, label, icon: Icon } = config[status];

  return (
    <Badge className={cn('gap-1', color)}>
      <Icon className={cn('h-3 w-3', status === 'checking' && 'animate-spin')} />
      {label}
    </Badge>
  );
}

// Assumption Card
function AssumptionCard({
  assumption,
  isExpanded,
  onToggle,
}: {
  assumption: ModelAssumption;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className={cn(
        assumption.status === 'violated' && 'border-red-200',
        assumption.status === 'warning' && 'border-yellow-200',
        assumption.status === 'passed' && 'border-green-200'
      )}>
        <CollapsibleTrigger asChild>
          <CardContent className="py-3 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <AssumptionStatusBadge status={assumption.status} />
              <div className="flex-1">
                <p className="font-medium text-sm">{assumption.name}</p>
                <p className="text-xs text-muted-foreground">{assumption.description}</p>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 border-t">
            <div className="space-y-3 pt-3">
              {assumption.testName && (
                <div>
                  <Label className="text-xs text-muted-foreground">Test Used</Label>
                  <p className="text-sm font-medium">{assumption.testName}</p>
                </div>
              )}
              {assumption.testStatistic !== undefined && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Test Statistic</Label>
                    <p className="text-sm font-mono">{assumption.testStatistic.toFixed(4)}</p>
                  </div>
                  {assumption.pValue !== undefined && (
                    <div>
                      <Label className="text-xs text-muted-foreground">p-value</Label>
                      <p className={cn(
                        'text-sm font-mono',
                        assumption.pValue < 0.05 ? 'text-red-600' : 'text-green-600'
                      )}>
                        {assumption.pValue < 0.001 ? '< 0.001' : assumption.pValue.toFixed(4)}
                      </p>
                    </div>
                  )}
                  {assumption.threshold !== undefined && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Threshold</Label>
                      <p className="text-sm font-mono">{assumption.threshold}</p>
                    </div>
                  )}
                </div>
              )}
              {assumption.message && (
                <Alert variant={assumption.status === 'violated' ? 'destructive' : 'default'}>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{assumption.message}</AlertDescription>
                </Alert>
              )}
              {assumption.remediation && assumption.status !== 'passed' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Suggested Remediation</Label>
                  <p className="text-sm">{assumption.remediation}</p>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Model Results Card
function ModelResultsCard({
  model,
  onExport,
  onGenerateReport,
}: {
  model: StatisticalModel;
  onExport: (format: 'json' | 'csv' | 'html' | 'latex') => void;
  onGenerateReport?: () => void;
}) {
  const [showResiduals, setShowResiduals] = useState(false);
  const modelInfo = MODEL_TYPE_INFO[model.type];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {model.name}
            </CardTitle>
            <CardDescription>
              {modelInfo.label} - Completed {model.completedAt?.toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => onExport(v as 'json' | 'csv' | 'html' | 'latex')}>
              <SelectTrigger className="w-32">
                <Download className="mr-2 h-4 w-4" />
                Export
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="latex">LaTeX</SelectItem>
              </SelectContent>
            </Select>
            {onGenerateReport && (
              <Button variant="outline" onClick={onGenerateReport}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Fit Statistics */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Model Fit Statistics
          </h4>
          <ModelFitDisplay statistics={model.fitStatistics} modelType={model.type} />
        </div>

        <Separator />

        {/* Coefficients Table */}
        {model.coefficients.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Table className="h-4 w-4" />
              Coefficient Estimates
            </h4>
            <CoefficientsTable
              coefficients={model.coefficients}
              confidenceLevel={model.confidenceLevel}
            />
          </div>
        )}

        {/* Residual Plots Toggle */}
        {model.residualPlots.length > 0 && (
          <>
            <Separator />
            <Collapsible open={showResiduals} onOpenChange={setShowResiduals}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <ScatterChart className="h-4 w-4" />
                    Residual Plots ({model.residualPlots.length})
                  </span>
                  {showResiduals ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <ResidualPlotsDisplay plots={model.residualPlots} />
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Model Fit Display
function ModelFitDisplay({
  statistics,
  modelType,
}: {
  statistics: ModelFitStatistics;
  modelType: ModelType;
}) {
  const displayStats: Array<{ label: string; value: string | number; highlight?: boolean; tooltip?: string }> = [];

  if (statistics.rSquared !== undefined) {
    displayStats.push({
      label: 'R-squared',
      value: statistics.rSquared.toFixed(4),
      highlight: statistics.rSquared > 0.7,
      tooltip: 'Proportion of variance explained by the model',
    });
  }
  if (statistics.adjustedRSquared !== undefined) {
    displayStats.push({
      label: 'Adjusted R-squared',
      value: statistics.adjustedRSquared.toFixed(4),
      tooltip: 'R-squared adjusted for number of predictors',
    });
  }
  if (statistics.fStatistic !== undefined) {
    displayStats.push({
      label: 'F-statistic',
      value: statistics.fStatistic.toFixed(2),
    });
  }
  if (statistics.fPValue !== undefined) {
    displayStats.push({
      label: 'F p-value',
      value: statistics.fPValue < 0.001 ? '< 0.001' : statistics.fPValue.toFixed(4),
      highlight: statistics.fPValue < 0.05,
    });
  }
  if (statistics.aic !== undefined) {
    displayStats.push({
      label: 'AIC',
      value: statistics.aic.toFixed(2),
      tooltip: 'Akaike Information Criterion (lower is better)',
    });
  }
  if (statistics.bic !== undefined) {
    displayStats.push({
      label: 'BIC',
      value: statistics.bic.toFixed(2),
      tooltip: 'Bayesian Information Criterion (lower is better)',
    });
  }
  if (statistics.chiSquare !== undefined) {
    displayStats.push({
      label: 'Chi-square',
      value: statistics.chiSquare.toFixed(2),
    });
  }
  if (statistics.chiSquarePValue !== undefined) {
    displayStats.push({
      label: 'Chi-square p-value',
      value: statistics.chiSquarePValue < 0.001 ? '< 0.001' : statistics.chiSquarePValue.toFixed(4),
      highlight: statistics.chiSquarePValue < 0.05,
    });
  }
  if (statistics.effectSize !== undefined) {
    displayStats.push({
      label: statistics.effectSizeType || 'Effect Size',
      value: statistics.effectSize.toFixed(4),
    });
  }
  if (statistics.power !== undefined) {
    displayStats.push({
      label: 'Statistical Power',
      value: `${(statistics.power * 100).toFixed(1)}%`,
      highlight: statistics.power >= 0.8,
    });
  }
  if (statistics.sampleSize !== undefined) {
    displayStats.push({
      label: 'Sample Size',
      value: statistics.sampleSize,
    });
  }
  if (statistics.degreesOfFreedom !== undefined) {
    displayStats.push({
      label: 'Degrees of Freedom',
      value: statistics.degreesOfFreedom,
    });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {displayStats.map((stat) => (
        <TooltipProvider key={stat.label}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'p-3 rounded-lg border',
                  stat.highlight && 'border-green-200 bg-green-50'
                )}
              >
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-semibold font-mono">{stat.value}</p>
              </div>
            </TooltipTrigger>
            {stat.tooltip && (
              <TooltipContent>
                <p>{stat.tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

// Coefficients Table
function CoefficientsTable({
  coefficients,
  confidenceLevel,
}: {
  coefficients: CoefficientEstimate[];
  confidenceLevel: number;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <UITable>
        <TableHeader>
          <TableRow>
            <TableHead>Variable</TableHead>
            <TableHead className="text-right">Estimate</TableHead>
            <TableHead className="text-right">Std. Error</TableHead>
            <TableHead className="text-right">t/z Statistic</TableHead>
            <TableHead className="text-right">p-value</TableHead>
            <TableHead className="text-right">{(confidenceLevel * 100).toFixed(0)}% CI</TableHead>
            <TableHead className="text-center">Sig.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coefficients.map((coef) => (
            <TableRow key={coef.variable}>
              <TableCell className="font-medium">{coef.variable}</TableCell>
              <TableCell className="text-right font-mono">
                {coef.estimate.toFixed(4)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {coef.standardError.toFixed(4)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {(coef.tStatistic || coef.zStatistic)?.toFixed(3) || '-'}
              </TableCell>
              <TableCell className={cn(
                'text-right font-mono',
                coef.pValue < 0.05 && 'text-green-600 font-medium',
                coef.pValue >= 0.05 && 'text-muted-foreground'
              )}>
                {coef.pValue < 0.001 ? '< 0.001' : coef.pValue.toFixed(4)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                [{coef.confidenceIntervalLower.toFixed(3)}, {coef.confidenceIntervalUpper.toFixed(3)}]
              </TableCell>
              <TableCell className="text-center">
                {coef.isSignificant ? (
                  <Badge className="bg-green-100 text-green-700">
                    <Check className="h-3 w-3" />
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <X className="h-3 w-3" />
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </UITable>
    </div>
  );
}

// Residual Plots Display
function ResidualPlotsDisplay({ plots }: { plots: ResidualPlot[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {plots.map((plot) => (
        <Card key={plot.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{plot.name}</CardTitle>
            <CardDescription className="text-xs">{plot.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Placeholder for actual plot visualization */}
            <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
              <ScatterChart className="h-8 w-8 text-muted-foreground" />
            </div>
            {plot.interpretation && (
              <p className="text-xs text-muted-foreground mt-2">{plot.interpretation}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Model Comparison Table
function ModelComparisonTable({
  models,
  onSelectModel,
}: {
  models: StatisticalModel[];
  onSelectModel: (id: string) => void;
}) {
  if (models.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Layers className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No completed models to compare
          </p>
          <p className="text-sm text-muted-foreground">
            Run multiple models to compare their fit statistics
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Model Comparison
        </CardTitle>
        <CardDescription>
          Compare fit statistics across different models
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <UITable>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">R-squared</TableHead>
                <TableHead className="text-right">Adj. R-squared</TableHead>
                <TableHead className="text-right">AIC</TableHead>
                <TableHead className="text-right">BIC</TableHead>
                <TableHead className="text-right">F p-value</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => {
                const modelInfo = MODEL_TYPE_INFO[model.type];
                return (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">{model.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{modelInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {model.fitStatistics.rSquared?.toFixed(4) || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {model.fitStatistics.adjustedRSquared?.toFixed(4) || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {model.fitStatistics.aic?.toFixed(2) || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {model.fitStatistics.bic?.toFixed(2) || '-'}
                    </TableCell>
                    <TableCell className={cn(
                      'text-right font-mono',
                      model.fitStatistics.fPValue !== undefined && model.fitStatistics.fPValue < 0.05
                        ? 'text-green-600'
                        : ''
                    )}>
                      {model.fitStatistics.fPValue !== undefined
                        ? model.fitStatistics.fPValue < 0.001
                          ? '< 0.001'
                          : model.fitStatistics.fPValue.toFixed(4)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectModel(model.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </UITable>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Utility Functions ====================

function generateDefaultAssumptions(modelType: ModelType): ModelAssumption[] {
  const commonAssumptions: ModelAssumption[] = [];

  switch (modelType) {
    case 'linear_regression':
    case 'multiple_regression':
      return [
        {
          id: 'linearity',
          name: 'Linearity',
          description: 'The relationship between variables is linear',
          status: 'not_checked',
          testName: 'Rainbow Test',
        },
        {
          id: 'normality',
          name: 'Normality of Residuals',
          description: 'Residuals are normally distributed',
          status: 'not_checked',
          testName: 'Shapiro-Wilk Test',
          remediation: 'Consider transforming variables or using robust regression',
        },
        {
          id: 'homoscedasticity',
          name: 'Homoscedasticity',
          description: 'Constant variance of residuals',
          status: 'not_checked',
          testName: 'Breusch-Pagan Test',
          remediation: 'Consider weighted least squares or heteroscedasticity-robust standard errors',
        },
        {
          id: 'independence',
          name: 'Independence of Errors',
          description: 'Residuals are independent',
          status: 'not_checked',
          testName: 'Durbin-Watson Test',
        },
        {
          id: 'multicollinearity',
          name: 'No Multicollinearity',
          description: 'Independent variables are not highly correlated',
          status: 'not_checked',
          testName: 'VIF Analysis',
          threshold: 5,
          remediation: 'Remove or combine highly correlated predictors',
        },
      ];

    case 'logistic_regression':
      return [
        {
          id: 'linearity_logit',
          name: 'Linearity in the Logit',
          description: 'Linear relationship between continuous predictors and log odds',
          status: 'not_checked',
          testName: 'Box-Tidwell Test',
        },
        {
          id: 'independence',
          name: 'Independence of Observations',
          description: 'Observations are independent',
          status: 'not_checked',
        },
        {
          id: 'multicollinearity',
          name: 'No Multicollinearity',
          description: 'Independent variables are not highly correlated',
          status: 'not_checked',
          testName: 'VIF Analysis',
          threshold: 5,
        },
        {
          id: 'sample_size',
          name: 'Adequate Sample Size',
          description: 'At least 10 events per predictor variable',
          status: 'not_checked',
        },
      ];

    case 'anova_one_way':
    case 'anova_two_way':
      return [
        {
          id: 'normality',
          name: 'Normality',
          description: 'Data in each group is normally distributed',
          status: 'not_checked',
          testName: 'Shapiro-Wilk Test',
          remediation: 'Consider Kruskal-Wallis test as non-parametric alternative',
        },
        {
          id: 'homogeneity',
          name: 'Homogeneity of Variances',
          description: 'Equal variances across groups',
          status: 'not_checked',
          testName: "Levene's Test",
          remediation: "Consider Welch's ANOVA or Games-Howell post-hoc",
        },
        {
          id: 'independence',
          name: 'Independence',
          description: 'Observations are independent',
          status: 'not_checked',
        },
      ];

    case 't_test_independent':
      return [
        {
          id: 'normality',
          name: 'Normality',
          description: 'Data in each group is normally distributed',
          status: 'not_checked',
          testName: 'Shapiro-Wilk Test',
          remediation: 'Consider Mann-Whitney U test as non-parametric alternative',
        },
        {
          id: 'homogeneity',
          name: 'Homogeneity of Variances',
          description: 'Equal variances between groups',
          status: 'not_checked',
          testName: "Levene's Test",
          remediation: "Use Welch's t-test which doesn't assume equal variances",
        },
        {
          id: 'independence',
          name: 'Independence',
          description: 'Observations are independent',
          status: 'not_checked',
        },
      ];

    case 't_test_paired':
      return [
        {
          id: 'normality_diff',
          name: 'Normality of Differences',
          description: 'Differences between pairs are normally distributed',
          status: 'not_checked',
          testName: 'Shapiro-Wilk Test',
          remediation: 'Consider Wilcoxon Signed-Rank test as non-parametric alternative',
        },
        {
          id: 'random_pairing',
          name: 'Random Pairing',
          description: 'Pairs are randomly selected',
          status: 'not_checked',
        },
      ];

    case 'chi_square_independence':
    case 'chi_square_goodness':
      return [
        {
          id: 'expected_freq',
          name: 'Expected Frequencies',
          description: 'Expected frequency in each cell is at least 5',
          status: 'not_checked',
          remediation: "Consider Fisher's Exact Test for small samples",
        },
        {
          id: 'independence',
          name: 'Independence',
          description: 'Observations are independent',
          status: 'not_checked',
        },
      ];

    case 'correlation_pearson':
      return [
        {
          id: 'linearity',
          name: 'Linearity',
          description: 'The relationship between variables is linear',
          status: 'not_checked',
          remediation: 'Consider Spearman correlation for non-linear relationships',
        },
        {
          id: 'normality',
          name: 'Bivariate Normality',
          description: 'Variables follow a bivariate normal distribution',
          status: 'not_checked',
          testName: 'Shapiro-Wilk Test',
        },
        {
          id: 'outliers',
          name: 'No Extreme Outliers',
          description: 'Data does not contain extreme outliers',
          status: 'not_checked',
        },
      ];

    default:
      return [
        {
          id: 'independence',
          name: 'Independence',
          description: 'Observations are independent',
          status: 'not_checked',
        },
      ];
  }
}

export default Stage07StatisticalModeling;

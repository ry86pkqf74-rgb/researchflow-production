/**
 * Statistical Analysis Plan (SAP) Builder Page
 * 
 * Provides UI for creating, viewing, and editing SAPs.
 * Features auto-generation from Topic Declaration, validation, and finalization.
 */

import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DemoOverlay } from '@/components/mode/DemoOverlay';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Lock,
  Save,
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { ChatAgentPanel } from "@/components/chat";

const MODEL_TYPES = [
  { value: 'linear', label: 'Linear Regression', description: 'Continuous outcomes' },
  { value: 'logistic', label: 'Logistic Regression', description: 'Binary outcomes' },
  { value: 'cox', label: 'Cox Proportional Hazards', description: 'Time-to-event outcomes' },
  { value: 'poisson', label: 'Poisson Regression', description: 'Count outcomes' },
  { value: 'mixed', label: 'Mixed Effects Model', description: 'Clustered/longitudinal data' },
  { value: 'ordinal', label: 'Ordinal Regression', description: 'Ordered categorical outcomes' },
  { value: 'negative_binomial', label: 'Negative Binomial', description: 'Overdispersed count outcomes' }
];

const ADJUSTMENT_STRATEGIES = [
  { value: 'unadjusted', label: 'Unadjusted', description: 'No covariates' },
  { value: 'minimally_adjusted', label: 'Minimally Adjusted', description: 'Age, sex only' },
  { value: 'fully_adjusted', label: 'Fully Adjusted', description: 'All pre-specified covariates' }
];

const MISSING_DATA_MECHANISMS = [
  { value: 'MCAR', label: 'MCAR', description: 'Missing Completely at Random' },
  { value: 'MAR', label: 'MAR', description: 'Missing at Random' },
  { value: 'MNAR', label: 'MNAR', description: 'Missing Not at Random' }
];

const MISSING_DATA_APPROACHES = [
  { value: 'complete_case', label: 'Complete Case Analysis' },
  { value: 'multiple_imputation', label: 'Multiple Imputation' },
  { value: 'sensitivity', label: 'Sensitivity Analysis' }
];

const MULTIPLICITY_CORRECTIONS = [
  { value: 'none', label: 'None' },
  { value: 'bonferroni', label: 'Bonferroni' },
  { value: 'holm', label: 'Holm-Bonferroni' },
  { value: 'fdr', label: 'FDR (Benjamini-Hochberg)' },
  { value: 'hierarchical', label: 'Hierarchical (Pre-specified)' }
];

interface PrimaryAnalysis {
  id: string;
  hypothesis: string;
  outcomeVariable: string;
  exposureVariable: string;
  modelType: string;
  justification: string;
}

interface CovariateStrategy {
  adjustment: string;
  covariateList: string[];
  selectionRationale: string;
}

interface SensitivityAnalysis {
  name: string;
  description: string;
  modification: string;
}

interface MissingDataPlan {
  mechanism: string;
  approach: string;
  assumptions: string;
}

interface SAP {
  id: string;
  topicId: string;
  topicVersion: number;
  researchId: string;
  primaryAnalyses: PrimaryAnalysis[];
  secondaryAnalyses?: PrimaryAnalysis[];
  covariateStrategy: CovariateStrategy;
  sensitivityAnalyses: SensitivityAnalysis[];
  missingDataPlan: MissingDataPlan;
  multiplicityCorrection: string;
  alphaLevel: string;
  randomSeed: number;
  status: 'draft' | 'approved' | 'executed';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export default function SAPBuilder() {
  const { topicId, researchId } = useParams<{ topicId: string; researchId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [sap, setSap] = useState<SAP | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch SAP for the research project using default fetcher pattern
  const { data: sapData, isLoading, error, refetch } = useQuery<{ researchId: string; saps: SAP[]; total: number }>({
    queryKey: ['/api/sap/research', researchId],
    enabled: !!researchId
  });

  // Set SAP from fetched data
  useEffect(() => {
    if (sapData?.saps && sapData.saps.length > 0) {
      setSap(sapData.saps[0]);
    }
  }, [sapData]);

  // Generate SAP mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/sap/generate', { topicId, researchId });
      return response.json();
    },
    onSuccess: (data) => {
      setSap(data.sap);
      toast({
        title: 'SAP Generated',
        description: 'Statistical Analysis Plan has been auto-generated. Review and modify as needed.'
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Update SAP mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<SAP>) => {
      const response = await apiRequest('PUT', `/api/sap/${sap?.id}`, updates);
      return response.json();
    },
    onSuccess: (data) => {
      setSap(data.sap);
      setHasChanges(false);
      toast({
        title: 'SAP Saved',
        description: 'Your changes have been saved.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sap/research', researchId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Save Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Validate SAP mutation
  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/sap/${sap?.id}/validate`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        setValidationErrors([]);
        toast({
          title: 'Validation Passed',
          description: 'SAP is ready for approval.'
        });
      } else {
        setValidationErrors(data.errors || []);
        toast({
          title: 'Validation Failed',
          description: 'Please address the errors before approval.',
          variant: 'destructive'
        });
      }
    }
  });

  // Approve SAP mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/sap/${sap?.id}/approve`);
      return response.json();
    },
    onSuccess: (data) => {
      setSap(data.sap);
      toast({
        title: 'SAP Approved',
        description: 'SAP has been finalized and locked from further edits.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sap/research', researchId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Approval Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Generate methods mutation
  const generateMethodsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/sap/${sap?.id}/generate-methods`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Methods Generated',
        description: 'Statistical methods narrative has been generated.'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const updateSAPField = (path: string, value: any) => {
    if (!sap || sap.status !== 'draft') return;
    
    const newSap = { ...sap };
    const keys = path.split('.');
    let current: any = newSap;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key.includes('[')) {
        const [arrayKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        current = current[arrayKey][index];
      } else {
        current = current[key];
      }
    }
    
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    
    setSap(newSap);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!sap) return;
    updateMutation.mutate({
      primaryAnalyses: sap.primaryAnalyses,
      covariateStrategy: sap.covariateStrategy,
      sensitivityAnalyses: sap.sensitivityAnalyses,
      missingDataPlan: sap.missingDataPlan,
      multiplicityCorrection: sap.multiplicityCorrection,
      alphaLevel: sap.alphaLevel
    });
  };

  const isLocked = sap?.status === 'approved' || sap?.status === 'executed';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="sap-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" data-testid="sap-error">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load SAP data</p>
        <Button onClick={() => refetch()} data-testid="button-retry">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6" data-testid="sap-builder-page">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/pipeline')}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-sap-title">Statistical Analysis Plan</h1>
          <p className="text-muted-foreground" data-testid="text-research-id">
            Research ID: {researchId}
          </p>
        </div>
        {sap && (
          <Badge 
            variant={isLocked ? 'default' : 'secondary'}
            className="flex items-center gap-1"
            data-testid="badge-sap-status"
          >
            {isLocked && <Lock className="w-3 h-3" />}
            {sap.status.toUpperCase()}
          </Badge>
        )}
      </div>

      {!sap ? (
        <Card className="p-8 text-center" data-testid="card-no-sap">
          <CardContent className="pt-6">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">No SAP Found</h2>
            <p className="text-muted-foreground mb-6">
              Generate a Statistical Analysis Plan from your Topic Declaration to get started.
            </p>
            <Button 
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-sap"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Auto-Generate SAP
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DemoOverlay>
          <div className="space-y-6">
            {validationErrors.length > 0 && (
              <Card className="border-destructive" data-testid="card-validation-errors">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Validation Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((err, idx) => (
                      <li key={idx} className="text-sm text-destructive">{err}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Primary Analyses Section */}
            <Card data-testid="card-primary-analyses">
              <CardHeader>
                <CardTitle>Primary Analyses</CardTitle>
                <CardDescription>
                  Define the main analyses for your research question
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {sap.primaryAnalyses?.map((analysis, idx) => (
                  <div key={analysis.id || idx} className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Analysis {idx + 1}</h4>
                      {!isLocked && sap.primaryAnalyses.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newAnalyses = sap.primaryAnalyses.filter((_, i) => i !== idx);
                            updateSAPField('primaryAnalyses', newAnalyses);
                          }}
                          data-testid={`button-remove-analysis-${idx}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Hypothesis</Label>
                        <Textarea
                          value={analysis.hypothesis}
                          onChange={(e) => {
                            const newAnalyses = [...sap.primaryAnalyses];
                            newAnalyses[idx] = { ...newAnalyses[idx], hypothesis: e.target.value };
                            updateSAPField('primaryAnalyses', newAnalyses);
                          }}
                          disabled={isLocked}
                          placeholder="State your primary hypothesis..."
                          data-testid={`input-hypothesis-${idx}`}
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Outcome Variable</Label>
                          <Input
                            value={analysis.outcomeVariable}
                            onChange={(e) => {
                              const newAnalyses = [...sap.primaryAnalyses];
                              newAnalyses[idx] = { ...newAnalyses[idx], outcomeVariable: e.target.value };
                              updateSAPField('primaryAnalyses', newAnalyses);
                            }}
                            disabled={isLocked}
                            placeholder="Primary outcome variable"
                            data-testid={`input-outcome-${idx}`}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Exposure Variable</Label>
                          <Input
                            value={analysis.exposureVariable}
                            onChange={(e) => {
                              const newAnalyses = [...sap.primaryAnalyses];
                              newAnalyses[idx] = { ...newAnalyses[idx], exposureVariable: e.target.value };
                              updateSAPField('primaryAnalyses', newAnalyses);
                            }}
                            disabled={isLocked}
                            placeholder="Primary exposure/intervention"
                            data-testid={`input-exposure-${idx}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Statistical Model</Label>
                        <Select
                          value={analysis.modelType}
                          onValueChange={(value) => {
                            const newAnalyses = [...sap.primaryAnalyses];
                            newAnalyses[idx] = { ...newAnalyses[idx], modelType: value };
                            updateSAPField('primaryAnalyses', newAnalyses);
                          }}
                          disabled={isLocked}
                        >
                          <SelectTrigger data-testid={`select-model-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MODEL_TYPES.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                {model.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Model Justification</Label>
                        <Textarea
                          value={analysis.justification}
                          onChange={(e) => {
                            const newAnalyses = [...sap.primaryAnalyses];
                            newAnalyses[idx] = { ...newAnalyses[idx], justification: e.target.value };
                            updateSAPField('primaryAnalyses', newAnalyses);
                          }}
                          disabled={isLocked}
                          placeholder="Justify the choice of model..."
                          data-testid={`input-justification-${idx}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Covariate Strategy Section */}
            <Card data-testid="card-covariate-strategy">
              <CardHeader>
                <CardTitle>Covariate Adjustment Strategy</CardTitle>
                <CardDescription>
                  Specify how covariates will be handled in the analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Adjustment Level</Label>
                    <Select
                      value={sap.covariateStrategy?.adjustment}
                      onValueChange={(value) => updateSAPField('covariateStrategy.adjustment', value)}
                      disabled={isLocked}
                    >
                      <SelectTrigger data-testid="select-adjustment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADJUSTMENT_STRATEGIES.map((strategy) => (
                          <SelectItem key={strategy.value} value={strategy.value}>
                            {strategy.label} - {strategy.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Covariates</Label>
                    <Input
                      value={sap.covariateStrategy?.covariateList?.join(', ') || ''}
                      onChange={(e) => updateSAPField('covariateStrategy.covariateList', 
                        e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      )}
                      disabled={isLocked}
                      placeholder="age, sex, bmi, smoking_status"
                      data-testid="input-covariates"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Selection Rationale</Label>
                  <Textarea
                    value={sap.covariateStrategy?.selectionRationale || ''}
                    onChange={(e) => updateSAPField('covariateStrategy.selectionRationale', e.target.value)}
                    disabled={isLocked}
                    placeholder="Explain why these covariates were selected..."
                    data-testid="input-covariate-rationale"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sensitivity Analyses Section */}
            <Card data-testid="card-sensitivity-analyses">
              <CardHeader>
                <CardTitle>Sensitivity Analyses</CardTitle>
                <CardDescription>
                  Pre-specified analyses to test robustness of results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sap.sensitivityAnalyses?.map((analysis, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-3 border rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        value={analysis.name}
                        onChange={(e) => {
                          const newAnalyses = [...sap.sensitivityAnalyses];
                          newAnalyses[idx] = { ...newAnalyses[idx], name: e.target.value };
                          updateSAPField('sensitivityAnalyses', newAnalyses);
                        }}
                        disabled={isLocked}
                        placeholder="Analysis name"
                        data-testid={`input-sensitivity-name-${idx}`}
                      />
                      <Input
                        value={analysis.description}
                        onChange={(e) => {
                          const newAnalyses = [...sap.sensitivityAnalyses];
                          newAnalyses[idx] = { ...newAnalyses[idx], description: e.target.value };
                          updateSAPField('sensitivityAnalyses', newAnalyses);
                        }}
                        disabled={isLocked}
                        placeholder="Description"
                        data-testid={`input-sensitivity-desc-${idx}`}
                      />
                      <Input
                        value={analysis.modification}
                        onChange={(e) => {
                          const newAnalyses = [...sap.sensitivityAnalyses];
                          newAnalyses[idx] = { ...newAnalyses[idx], modification: e.target.value };
                          updateSAPField('sensitivityAnalyses', newAnalyses);
                        }}
                        disabled={isLocked}
                        placeholder="Modification from primary"
                        data-testid={`input-sensitivity-mod-${idx}`}
                      />
                    </div>
                    {!isLocked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newAnalyses = sap.sensitivityAnalyses.filter((_, i) => i !== idx);
                          updateSAPField('sensitivityAnalyses', newAnalyses);
                        }}
                        data-testid={`button-remove-sensitivity-${idx}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {!isLocked && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newAnalyses = [...(sap.sensitivityAnalyses || []), {
                        name: '',
                        description: '',
                        modification: ''
                      }];
                      updateSAPField('sensitivityAnalyses', newAnalyses);
                    }}
                    data-testid="button-add-sensitivity"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Sensitivity Analysis
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Missing Data Plan */}
            <Card data-testid="card-missing-data">
              <CardHeader>
                <CardTitle>Missing Data Plan</CardTitle>
                <CardDescription>
                  Strategy for handling missing data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Assumed Mechanism</Label>
                    <Select
                      value={sap.missingDataPlan?.mechanism}
                      onValueChange={(value) => updateSAPField('missingDataPlan.mechanism', value)}
                      disabled={isLocked}
                    >
                      <SelectTrigger data-testid="select-missing-mechanism">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MISSING_DATA_MECHANISMS.map((mech) => (
                          <SelectItem key={mech.value} value={mech.value}>
                            {mech.label} - {mech.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Handling Approach</Label>
                    <Select
                      value={sap.missingDataPlan?.approach}
                      onValueChange={(value) => updateSAPField('missingDataPlan.approach', value)}
                      disabled={isLocked}
                    >
                      <SelectTrigger data-testid="select-missing-approach">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MISSING_DATA_APPROACHES.map((approach) => (
                          <SelectItem key={approach.value} value={approach.value}>
                            {approach.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Assumptions</Label>
                  <Textarea
                    value={sap.missingDataPlan?.assumptions || ''}
                    onChange={(e) => updateSAPField('missingDataPlan.assumptions', e.target.value)}
                    disabled={isLocked}
                    placeholder="Document assumptions about missing data..."
                    data-testid="input-missing-assumptions"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Multiplicity Considerations */}
            <Card data-testid="card-multiplicity">
              <CardHeader>
                <CardTitle>Multiplicity Considerations</CardTitle>
                <CardDescription>
                  Control for multiple testing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Correction Method</Label>
                    <Select
                      value={sap.multiplicityCorrection}
                      onValueChange={(value) => updateSAPField('multiplicityCorrection', value)}
                      disabled={isLocked}
                    >
                      <SelectTrigger data-testid="select-multiplicity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MULTIPLICITY_CORRECTIONS.map((corr) => (
                          <SelectItem key={corr.value} value={corr.value}>
                            {corr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Alpha Level</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.001"
                      max="0.1"
                      value={sap.alphaLevel}
                      onChange={(e) => updateSAPField('alphaLevel', e.target.value)}
                      disabled={isLocked}
                      data-testid="input-alpha"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleSave}
                  disabled={isLocked || !hasChanges || updateMutation.isPending}
                  data-testid="button-save-sap"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Draft
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => validateMutation.mutate()}
                  disabled={validateMutation.isPending}
                  data-testid="button-validate-sap"
                >
                  {validateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Validate
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => generateMethodsMutation.mutate()}
                  disabled={generateMethodsMutation.isPending}
                  data-testid="button-generate-methods"
                >
                  {generateMethodsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generate Methods
                </Button>
              </div>

              {sap.status === 'draft' && (
                <Button
                  variant="destructive"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve-sap"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Finalize SAP
                </Button>
              )}

              {isLocked && (
                <Badge variant="default" className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  SAP is locked
                </Badge>
              )}
            </div>
          </div>

          {/* IRB/Protocol Chat Agent */}
          <div className="mt-4">
            <ChatAgentPanel
              agentType="irb"
              artifactType="sap"
              artifactId={sap?.id || "default"}
              getClientContext={() => ({
                artifactContent: JSON.stringify(sap, null, 2),
                artifactMetadata: {
                  sapId: sap?.id,
                  isLocked,
                  status: sap?.status,
                },
              })}
              onActionExecuted={(action, result) => {
                toast({
                  title: "Action Applied",
                  description: `${action.actionType} has been executed successfully.`,
                });
                queryClient.invalidateQueries({ queryKey: ['sap', sap?.id] });
              }}
              defaultOpen={false}
            />
          </div>
        </DemoOverlay>
      )}
    </div>
  );
}

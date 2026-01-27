/**
 * Analysis Planner Page
 *
 * Interface for creating and managing AI-assisted statistical analysis plans.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Brain,
  FileSpreadsheet,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  planningApi,
  type AnalysisPlan,
  type AnalysisJob,
  type PlanType,
} from '@/lib/api/planning';

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const JOB_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  queued: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function AnalysisPlannerPage() {
  const [, setLocation] = useLocation();

  // Form state
  const [datasetId, setDatasetId] = useState('');
  const [planName, setPlanName] = useState('');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [planType, setPlanType] = useState<PlanType>('statistical');
  const [maxRows, setMaxRows] = useState(100000);

  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phiWarning, setPhiWarning] = useState<string | null>(null);

  // Plans state
  const [plans, setPlans] = useState<AnalysisPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<AnalysisPlan | null>(null);
  const [activeJob, setActiveJob] = useState<AnalysisJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load plans on mount
  useEffect(() => {
    loadPlans();
  }, []);

  // Subscribe to active job updates
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') {
      return;
    }

    const cleanup = planningApi.subscribeToJobEvents(
      activeJob.id,
      (event) => {
        if (event.job) {
          setActiveJob(event.job);
        }
        if (event.job?.status === 'completed' || event.job?.status === 'failed') {
          loadPlans();
        }
      },
      (err) => {
        console.error('SSE error:', err);
      }
    );

    return cleanup;
  }, [activeJob?.id]);

  const loadPlans = async () => {
    try {
      setIsLoading(true);
      const response = await planningApi.listPlans();
      if (response.success && response.data) {
        setPlans(response.data.plans);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhiWarning(null);

    if (!datasetId || !planName || !researchQuestion) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsCreating(true);

      const response = await planningApi.createPlan({
        datasetId,
        name: planName,
        researchQuestion,
        planType,
        constraints: { maxRows },
      });

      if (response.success && response.data) {
        if (response.data.phiWarning) {
          setPhiWarning(response.data.phiWarning);
        }

        setSelectedPlan(response.data.plan);
        setActiveJob(response.data.job);

        // Reset form
        setDatasetId('');
        setPlanName('');
        setResearchQuestion('');

        loadPlans();
      } else {
        setError(response.error?.message || 'Failed to create plan');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectPlan = async (plan: AnalysisPlan) => {
    try {
      const response = await planningApi.getPlan(plan.id);
      if (response.success && response.data) {
        setSelectedPlan(response.data.plan);
        if (response.data.jobs && response.data.jobs.length > 0) {
          setActiveJob(response.data.jobs[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load plan:', err);
    }
  };

  const handleApprovePlan = async (approved: boolean) => {
    if (!selectedPlan) return;

    try {
      const response = await planningApi.approvePlan(selectedPlan.id, { approved });
      if (response.success && response.data) {
        setSelectedPlan(response.data.plan);
        loadPlans();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve plan');
    }
  };

  const handleRunPlan = async () => {
    if (!selectedPlan) return;

    try {
      const response = await planningApi.runPlan(selectedPlan.id);
      if (response.success && response.data) {
        setActiveJob(response.data.job);
        loadPlans();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run plan');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Brain className="h-6 w-6 text-purple-600" />
                AI Analysis Planner
              </h1>
              <p className="text-gray-500">Create and execute statistical analysis plans</p>
            </div>
          </div>
          <Button variant="outline" onClick={loadPlans} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {phiWarning && (
          <Alert className="mb-4 border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">PHI Warning</AlertTitle>
            <AlertDescription className="text-yellow-700">{phiWarning}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Plan Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Plan</CardTitle>
              <CardDescription>
                Describe your research question and let AI generate an analysis plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div>
                  <Label htmlFor="datasetId">Dataset ID *</Label>
                  <Input
                    id="datasetId"
                    value={datasetId}
                    onChange={(e) => setDatasetId(e.target.value)}
                    placeholder="e.g., demo-clinical"
                  />
                </div>

                <div>
                  <Label htmlFor="planName">Plan Name *</Label>
                  <Input
                    id="planName"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g., Treatment Response Analysis"
                  />
                </div>

                <div>
                  <Label htmlFor="researchQuestion">Research Question *</Label>
                  <Textarea
                    id="researchQuestion"
                    value={researchQuestion}
                    onChange={(e) => setResearchQuestion(e.target.value)}
                    placeholder="Describe what you want to analyze..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="planType">Analysis Type</Label>
                  <Select value={planType} onValueChange={(v) => setPlanType(v as PlanType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="statistical">Statistical</SelectItem>
                      <SelectItem value="exploratory">Exploratory</SelectItem>
                      <SelectItem value="comparative">Comparative</SelectItem>
                      <SelectItem value="predictive">Predictive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="maxRows">Max Rows</Label>
                  <Input
                    id="maxRows"
                    type="number"
                    value={maxRows}
                    onChange={(e) => setMaxRows(parseInt(e.target.value) || 100000)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Plan
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Plans List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Plans</CardTitle>
              <CardDescription>{plans.length} plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPlan?.id === plan.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate">{plan.name}</div>
                      <Badge className={STATUS_COLORS[plan.status] || 'bg-gray-100'}>
                        {plan.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500 truncate mt-1">
                      {plan.researchQuestion}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(plan.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {plans.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No plans yet. Create one to get started!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Plan Details */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Details</CardTitle>
              <CardDescription>
                {selectedPlan ? selectedPlan.name : 'Select a plan to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedPlan ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">Status</div>
                    <Badge className={STATUS_COLORS[selectedPlan.status] || 'bg-gray-100'}>
                      {selectedPlan.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-500">Research Question</div>
                    <p className="text-sm">{selectedPlan.researchQuestion}</p>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-500">Type</div>
                    <p className="text-sm capitalize">{selectedPlan.planType}</p>
                  </div>

                  {selectedPlan.planSpec.stages.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-2">
                        Stages ({selectedPlan.planSpec.stages.length})
                      </div>
                      <div className="space-y-1">
                        {selectedPlan.planSpec.stages.map((stage, i) => (
                          <div
                            key={stage.stageId}
                            className="text-sm flex items-center gap-2"
                          >
                            <span className="text-gray-400">{i + 1}.</span>
                            <span>{stage.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Job Progress */}
                  {activeJob && (
                    <div>
                      <Separator className="my-4" />
                      <div className="text-sm font-medium text-gray-500 mb-2">
                        Job: {activeJob.jobType.replace('_', ' ')}
                      </div>
                      <Badge className={JOB_STATUS_COLORS[activeJob.status] || 'bg-gray-100'}>
                        {activeJob.status}
                      </Badge>
                      {activeJob.status === 'running' && (
                        <div className="mt-2">
                          <Progress value={activeJob.progress} className="h-2" />
                          <div className="text-xs text-gray-500 mt-1">
                            {activeJob.currentStage || 'Processing...'} ({activeJob.progress}%)
                          </div>
                        </div>
                      )}
                      {activeJob.errorMessage && (
                        <div className="text-sm text-red-600 mt-2">
                          {activeJob.errorMessage}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <Separator className="my-4" />
                  <div className="flex gap-2">
                    {selectedPlan.status === 'pending_approval' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApprovePlan(true)}
                          className="flex-1"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprovePlan(false)}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {selectedPlan.status === 'approved' && (
                      <Button size="sm" onClick={handleRunPlan} className="w-full">
                        <Play className="h-4 w-4 mr-1" />
                        Run Analysis
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  Select a plan to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

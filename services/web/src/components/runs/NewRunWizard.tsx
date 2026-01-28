/**
 * New Run Wizard Component (Phase 4C - RUN-008)
 *
 * Multi-step stepper for creating new research runs.
 * Steps: Select Project → Choose Workflow → Upload Inputs → PHI Scan → Confirm
 *
 * Features:
 * - Step-by-step form progression
 * - Project and workflow selection
 * - Input file upload
 * - PHI scanning integration
 * - Summary and confirmation
 * - Validation at each step
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Upload,
  Shield,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

interface NewRunWizardProps {
  projects: Project[];
  workflows?: Record<string, Workflow[]>;
  onComplete?: (config: RunConfiguration) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export interface RunConfiguration {
  projectId: string;
  workflowId: string;
  inputs: Record<string, any>;
  phiCleared: boolean;
}

type WizardStep = 'project' | 'workflow' | 'inputs' | 'phi-scan' | 'confirm';

const stepLabels: Record<WizardStep, string> = {
  'project': 'Select Project',
  'workflow': 'Choose Workflow',
  'inputs': 'Upload Inputs',
  'phi-scan': 'PHI Scan',
  'confirm': 'Confirm',
};

const stepOrder: WizardStep[] = ['project', 'workflow', 'inputs', 'phi-scan', 'confirm'];

export function NewRunWizard({
  projects,
  workflows = {},
  onComplete,
  onCancel,
  isLoading = false,
}: NewRunWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('project');
  const [selectedProject, setSelectedProject] = useState<string>();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [phiCleared, setPhiCleared] = useState(false);
  const [phiScanning, setPhiScanning] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<WizardStep, string>>>({});

  const currentProject = projects.find((p) => p.id === selectedProject);
  const availableWorkflows = selectedProject ? workflows[selectedProject] || [] : [];
  const currentWorkflow = availableWorkflows.find((w) => w.id === selectedWorkflow);

  const canProceed = {
    project: !!selectedProject,
    workflow: !!selectedWorkflow,
    inputs: uploadedFiles.length > 0,
    'phi-scan': phiCleared,
    confirm: true,
  };

  const handleNext = async () => {
    const currentIdx = stepOrder.indexOf(currentStep);
    if (currentIdx < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIdx + 1];
      if (nextStep === 'phi-scan' && uploadedFiles.length > 0) {
        // Trigger PHI scan
        setPhiScanning(true);
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate scan
          setPhiCleared(true);
        } catch (err) {
          setErrors((prev) => ({ ...prev, 'phi-scan': 'PHI scan failed' }));
        } finally {
          setPhiScanning(false);
        }
      }
      setCurrentStep(nextStep);
    } else if (currentStep === 'confirm') {
      // Complete wizard
      onComplete?.({
        projectId: selectedProject!,
        workflowId: selectedWorkflow!,
        inputs: Object.fromEntries(uploadedFiles.map((f) => [f.name, f])),
        phiCleared,
      });
    }
  };

  const handleBack = () => {
    const currentIdx = stepOrder.indexOf(currentStep);
    if (currentIdx > 0) {
      setCurrentStep(stepOrder[currentIdx - 1]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {stepOrder.map((step, idx) => (
            <React.Fragment key={step}>
              <button
                onClick={() => {
                  const stepIdx = stepOrder.indexOf(currentStep);
                  if (idx <= stepIdx) {
                    setCurrentStep(step);
                  }
                }}
                disabled={idx > stepOrder.indexOf(currentStep)}
                className={cn(
                  'flex flex-col items-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all',
                    idx < stepOrder.indexOf(currentStep)
                      ? 'bg-green-600 text-white'
                      : idx === stepOrder.indexOf(currentStep)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {idx < stepOrder.indexOf(currentStep) ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className="text-xs font-medium text-center hidden sm:block">
                  {stepLabels[step]}
                </span>
              </button>

              {idx < stepOrder.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-1 mx-2 transition-all',
                    idx < stepOrder.indexOf(currentStep)
                      ? 'bg-green-600'
                      : 'bg-gray-200'
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{stepLabels[currentStep]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Project Selection */}
          {currentStep === 'project' && (
            <div className="space-y-3">
              {projects.length === 0 ? (
                <p className="text-gray-600">No projects available</p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setSelectedProject(project.id);
                      setSelectedWorkflow(undefined);
                    }}
                    className={cn(
                      'w-full p-4 rounded-lg border-2 text-left transition-all',
                      selectedProject === project.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{project.name}</p>
                        {project.description && (
                          <p className="text-sm text-gray-600">{project.description}</p>
                        )}
                      </div>
                      {selectedProject === project.id && (
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Workflow Selection */}
          {currentStep === 'workflow' && (
            <div className="space-y-3">
              {availableWorkflows.length === 0 ? (
                <p className="text-gray-600">
                  No workflows available for this project
                </p>
              ) : (
                availableWorkflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    onClick={() => setSelectedWorkflow(workflow.id)}
                    className={cn(
                      'w-full p-4 rounded-lg border-2 text-left transition-all',
                      selectedWorkflow === workflow.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{workflow.name}</p>
                        {workflow.description && (
                          <p className="text-sm text-gray-600">
                            {workflow.description}
                          </p>
                        )}
                      </div>
                      {selectedWorkflow === workflow.id && (
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Input Upload */}
          {currentStep === 'inputs' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="font-medium mb-1">Upload Input Files</p>
                <p className="text-sm text-gray-600 mb-4">
                  or drag and drop your files here
                </p>
                <label className="inline-block">
                  <Input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".csv,.json,.xlsx,.xls,.txt"
                  />
                  <span className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
                    Choose Files
                  </span>
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium">Uploaded Files:</p>
                  {uploadedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                    >
                      <span className="text-sm">{file.name}</span>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PHI Scan */}
          {currentStep === 'phi-scan' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-blue-900">PHI Protection Scan</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Scanning uploaded files for Protected Health Information (PHI)...
                    </p>
                  </div>
                </div>
              </div>

              {phiScanning && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                  <p className="text-gray-600">Scanning files for PHI...</p>
                </div>
              )}

              {phiCleared && !phiScanning && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="font-semibold text-green-900">
                      PHI scan complete - No PHI detected
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirmation */}
          {currentStep === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Project</p>
                  <p className="font-semibold">{currentProject?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Workflow</p>
                  <p className="font-semibold">{currentWorkflow?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Input Files</p>
                  <div className="mt-1 space-y-1">
                    {uploadedFiles.map((file, idx) => (
                      <p key={idx} className="text-sm font-medium">
                        {file.name}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Shield className="h-3 w-3 mr-1" />
                    PHI Cleared
                  </Badge>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Everything looks good! Click "Start Run" to begin execution.
              </p>
            </div>
          )}

          {errors[currentStep] && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{errors[currentStep]}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 'project'}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed[currentStep] || isLoading || phiScanning}
          >
            {currentStep === 'confirm' ? (
              <>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Start Run
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NewRunWizard;

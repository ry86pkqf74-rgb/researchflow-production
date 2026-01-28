/**
 * SpreadsheetCellParse Page
 * 
 * Main page for spreadsheet cell-level clinical extraction workflow.
 * Implements a 4-stage workflow:
 * 1. Upload - Drag & drop CSV/XLSX files
 * 2. Configure - Set extraction parameters
 * 3. Process - Monitor real-time extraction progress
 * 4. Results - View and export extracted data
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  FileSpreadsheet,
  Settings,
  PlayCircle,
  CheckCircle2,
  Upload,
  ArrowRight,
  ArrowLeft,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ExtractionConfigPanel,
  ExtractionProgressPanel,
  ExtractionResultsViewer,
} from '@/components/extraction';
import { useSpreadsheetParse } from '@/hooks/useSpreadsheetParse';
import { useToast } from '@/hooks/use-toast';

// Stage definitions
type Stage = 'upload' | 'configure' | 'process' | 'results';

const STAGES: { id: Stage; label: string; icon: React.ElementType }[] = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'configure', label: 'Configure', icon: Settings },
  { id: 'process', label: 'Process', icon: PlayCircle },
  { id: 'results', label: 'Results', icon: CheckCircle2 },
];

export default function SpreadsheetCellParse() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Current stage
  const [currentStage, setCurrentStage] = useState<Stage>('upload');
  
  // File state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [artifactPath, setArtifactPath] = useState<string | null>(null);
  
  // Configuration state
  const [config, setConfig] = useState({
    tier: 'MINI' as const,
    columns: [],
    enablePhiScanning: true,
    blockOnPhi: true,
    enableNlmEnrichment: false,
    minTextLength: 120,
    maxConcurrent: 24,
    outputFormat: 'json' as const,
  });
  
  // Use the spreadsheet parse hook
  const {
    jobId,
    status,
    progress,
    results,
    error,
    isLoading,
    uploadFile,
    startParsing,
    cancelJob,
    reset,
  } = useSpreadsheetParse();
  
  // File upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setUploadedFile(file);
      const path = await uploadFile(file);
      setArtifactPath(path);
      toast({
        title: 'File uploaded',
        description: `${file.name} ready for processing`,
      });
      setCurrentStage('configure');
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [uploadFile, toast]);
  
  // Drag and drop handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      handleFileUpload(file);
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV or Excel file',
        variant: 'destructive',
      });
    }
  }, [handleFileUpload, toast]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);
  
  // Start processing
  const handleStartProcessing = useCallback(async () => {
    if (!artifactPath) return;

    try {
      await startParsing({
        artifactPath,
        fileType: uploadedFile?.name.endsWith('.csv') ? 'csv' : 'xlsx',
        config,
      });
      setCurrentStage('process');
    } catch (err) {
      toast({
        title: 'Failed to start processing',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [artifactPath, uploadedFile, config, startParsing, toast]);
  
  // Watch for completion
  React.useEffect(() => {
    if (status === 'completed' && currentStage === 'process') {
      setCurrentStage('results');
      toast({
        title: 'Extraction complete',
        description: `Processed ${results?.summary?.totalCells || 0} cells`,
      });
    }
  }, [status, currentStage, results, toast]);
  
  // Reset workflow
  const handleReset = useCallback(() => {
    reset();
    setUploadedFile(null);
    setArtifactPath(null);
    setCurrentStage('upload');
  }, [reset]);
  
  // Get current stage index
  const currentStageIndex = STAGES.findIndex(s => s.id === currentStage);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-semibold">Spreadsheet Cell Extraction</h1>
                <p className="text-sm text-muted-foreground">
                  Extract structured clinical data from spreadsheet cells
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/workflow')}>
              Back to Workflow
            </Button>
          </div>
        </div>
      </header>
      
      {/* Progress Steps */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {STAGES.map((stage, index) => {
              const Icon = stage.icon;
              const isActive = stage.id === currentStage;
              const isComplete = index < currentStageIndex;
              
              return (
                <React.Fragment key={stage.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                        flex h-10 w-10 items-center justify-center rounded-full
                        ${isActive ? 'bg-primary text-primary-foreground' : ''}
                        ${isComplete ? 'bg-green-500 text-white' : ''}
                        ${!isActive && !isComplete ? 'bg-muted text-muted-foreground' : ''}
                      `}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span
                      className={`
                        text-sm font-medium
                        ${isActive ? 'text-primary' : ''}
                        ${isComplete ? 'text-green-600' : ''}
                        ${!isActive && !isComplete ? 'text-muted-foreground' : ''}
                      `}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {index < STAGES.length - 1 && (
                    <div
                      className={`
                        h-0.5 flex-1 mx-4
                        ${index < currentStageIndex ? 'bg-green-500' : 'bg-muted'}
                      `}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Upload Stage */}
        {currentStage === 'upload' && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Upload Spreadsheet</CardTitle>
              <CardDescription>
                Upload a CSV or Excel file containing clinical data for extraction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="
                  border-2 border-dashed rounded-lg p-12
                  flex flex-col items-center justify-center gap-4
                  hover:border-primary hover:bg-primary/5
                  transition-colors cursor-pointer
                "
              >
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-lg font-medium">
                    Drag and drop your file here
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to browse
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">CSV</Badge>
                  <Badge variant="secondary">XLSX</Badge>
                  <Badge variant="secondary">XLS</Badge>
                </div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Configure Stage */}
        {currentStage === 'configure' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configure Extraction</CardTitle>
                <CardDescription>
                  Set parameters for cell detection and extraction
                </CardDescription>
              </CardHeader>
              <CardContent>
                {uploadedFile && (
                  <div className="mb-6 p-4 bg-muted rounded-lg flex items-center gap-4">
                    <FileSpreadsheet className="h-10 w-10 text-primary" />
                    <div>
                      <p className="font-medium">{uploadedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        setUploadedFile(null);
                        setArtifactPath(null);
                        setCurrentStage('upload');
                      }}
                    >
                      Change file
                    </Button>
                  </div>
                )}
                
                <ExtractionConfigPanel
                  columns={[]}
                  config={config}
                  onConfigChange={setConfig}
                  onStartExtraction={handleStartProcessing}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
            
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStage('upload')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleStartProcessing} disabled={isLoading}>
                Start Extraction
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Process Stage */}
        {currentStage === 'process' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <ExtractionProgressPanel
              jobId={jobId}
              status={status}
              progress={progress}
              onCancel={cancelJob}
            />
            
            {status === 'failed' && (
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleReset}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button onClick={handleStartProcessing}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* Results Stage */}
        {currentStage === 'results' && results && (
          <div className="space-y-6">
            <ExtractionResultsViewer
              results={results}
              jobId={jobId}
            />
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleReset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Process Another File
              </Button>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

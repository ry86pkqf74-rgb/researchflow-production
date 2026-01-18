import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileArchive,
  FileJson,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Shield,
  Hash,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface BundleValidationResult {
  isValid: boolean;
  schemaValid: boolean;
  provenanceVerified: boolean;
  hashIntegrity: boolean;
  errors: string[];
  warnings: string[];
  bundleInfo?: {
    projectName: string;
    createdAt: string;
    createdBy: string;
    artifactCount: number;
    version: string;
  };
}

export interface BundleImportProps {
  onImportSuccess?: (projectId: string) => void;
  onCancel?: () => void;
  maxFileSizeMB?: number;
}

interface ImportResponse {
  success: boolean;
  projectId?: string;
  error?: string;
}

export function BundleImport({
  onImportSuccess,
  onCancel,
  maxFileSizeMB = 50,
}: BundleImportProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationResult, setValidationResult] = useState<BundleValidationResult | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "validate" | "import" | "success">("upload");

  const validateMutation = useMutation({
    mutationFn: async (fileToValidate: File) => {
      const formData = new FormData();
      formData.append("bundle", fileToValidate);
      
      const response = await fetch("/api/bundles/verify", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Validation failed");
      }
      
      return response.json() as Promise<BundleValidationResult>;
    },
    onSuccess: (result) => {
      setValidationResult(result);
      setImportStep(result.isValid ? "validate" : "upload");
      if (!result.isValid) {
        toast({
          title: "Validation Failed",
          description: result.errors[0] || "Bundle validation failed",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Validation Error",
        description: error.message,
        variant: "destructive",
      });
      setValidationResult(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      
      const formData = new FormData();
      formData.append("bundle", file);
      
      const response = await fetch("/api/projects/import-handoff", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }
      
      return response.json() as Promise<ImportResponse>;
    },
    onSuccess: (result) => {
      if (result.success && result.projectId) {
        setImportStep("success");
        toast({
          title: "Import Successful",
          description: "Project created from bundle",
        });
        onImportSuccess?.(result.projectId);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback((selectedFile: File) => {
    const maxBytes = maxFileSizeMB * 1024 * 1024;
    
    if (selectedFile.size > maxBytes) {
      toast({
        title: "File Too Large",
        description: `Maximum file size is ${maxFileSizeMB}MB`,
        variant: "destructive",
      });
      return;
    }
    
    const isValidType = selectedFile.name.endsWith(".zip") || 
                        selectedFile.name.endsWith(".json") ||
                        selectedFile.type === "application/zip" ||
                        selectedFile.type === "application/json";
    
    if (!isValidType) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a ZIP or JSON bundle file",
        variant: "destructive",
      });
      return;
    }
    
    setFile(selectedFile);
    setValidationResult(null);
    setImportStep("upload");
    
    validateMutation.mutate(selectedFile);
  }, [maxFileSizeMB, toast, validateMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const handleImport = useCallback(() => {
    if (!validationResult?.isValid) return;
    setImportStep("import");
    importMutation.mutate();
  }, [validationResult, importMutation]);

  const handleReset = useCallback(() => {
    setFile(null);
    setValidationResult(null);
    setImportStep("upload");
  }, []);

  const isZipFile = file?.name.endsWith(".zip");
  const FileIcon = isZipFile ? FileArchive : FileJson;

  return (
    <Card data-testid="card-bundle-import">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ros-workflow/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-ros-workflow" />
          </div>
          <div>
            <CardTitle>Import Research Bundle</CardTitle>
            <CardDescription>
              Upload a reproducibility bundle (ZIP or JSON) to create a new project
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          {["upload", "validate", "import", "success"].map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${importStep === step ? "bg-ros-primary text-white" : 
                  ["validate", "import", "success"].indexOf(importStep) > ["upload", "validate", "import", "success"].indexOf(step) 
                    ? "bg-ros-success text-white" 
                    : "bg-muted text-muted-foreground"}
              `}>
                {["validate", "import", "success"].indexOf(importStep) > ["upload", "validate", "import", "success"].indexOf(step) 
                  ? <CheckCircle className="w-4 h-4" /> 
                  : index + 1}
              </div>
              <span className="ml-2 text-sm capitalize hidden sm:inline">{step}</span>
              {index < 3 && (
                <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {importStep === "upload" && (
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragOver ? "border-ros-primary bg-ros-primary/5" : "border-muted-foreground/25 hover:border-ros-primary/50"}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById("bundle-file-input")?.click()}
            data-testid="dropzone"
          >
            <input
              id="bundle-file-input"
              type="file"
              accept=".zip,.json,application/zip,application/json"
              className="hidden"
              onChange={handleInputChange}
              data-testid="input-file"
            />
            
            {validateMutation.isPending ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-12 h-12 text-ros-primary animate-spin" />
                <p className="text-sm font-medium">Validating bundle...</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-3">
                <FileIcon className="w-12 h-12 text-ros-workflow" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleReset(); }}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Choose Different File
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-12 h-12 text-muted-foreground" />
                <div>
                  <p className="font-medium">Drop your bundle here or click to browse</p>
                  <p className="text-sm text-muted-foreground">
                    Supports ZIP and JSON bundles up to {maxFileSizeMB}MB
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {validationResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <ValidationBadge
                label="Schema"
                valid={validationResult.schemaValid}
                icon={FileText}
              />
              <ValidationBadge
                label="Provenance"
                valid={validationResult.provenanceVerified}
                icon={Shield}
              />
              <ValidationBadge
                label="Hash Integrity"
                valid={validationResult.hashIntegrity}
                icon={Hash}
              />
            </div>

            {validationResult.bundleInfo && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Bundle Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Project: </span>
                      <span className="font-medium">{validationResult.bundleInfo.projectName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created: </span>
                      <span>{new Date(validationResult.bundleInfo.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">By: </span>
                      <span>{validationResult.bundleInfo.createdBy}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Artifacts: </span>
                      <span>{validationResult.bundleInfo.artifactCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="w-4 h-4" />
                <AlertTitle>Validation Errors</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-32">
                    <ul className="list-disc list-inside space-y-1">
                      {validationResult.errors.map((error, i) => (
                        <li key={i} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            {validationResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Warnings</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-32">
                    <ul className="list-disc list-inside space-y-1">
                      {validationResult.warnings.map((warning, i) => (
                        <li key={i} className="text-sm">{warning}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {importStep === "import" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-12 h-12 text-ros-primary animate-spin" />
            <p className="font-medium">Importing project from bundle...</p>
            <Progress value={66} className="w-64" />
          </div>
        )}

        {importStep === "success" && (
          <Alert className="border-ros-success bg-ros-success/10">
            <CheckCircle className="w-4 h-4 text-ros-success" />
            <AlertTitle className="text-ros-success">Import Successful</AlertTitle>
            <AlertDescription>
              Your project has been created from the bundle. You can now access it from the projects list.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-4 border-t pt-6">
        <Button
          variant="outline"
          onClick={onCancel || handleReset}
          disabled={importMutation.isPending}
          data-testid="button-cancel"
        >
          {importStep === "success" ? "Close" : "Cancel"}
        </Button>
        
        {importStep === "validate" && validationResult?.isValid && (
          <Button
            onClick={handleImport}
            disabled={importMutation.isPending}
            data-testid="button-import"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Import Project
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

interface ValidationBadgeProps {
  label: string;
  valid: boolean;
  icon: typeof FileText;
}

function ValidationBadge({ label, valid, icon: Icon }: ValidationBadgeProps) {
  return (
    <div className={`
      p-3 rounded-lg border text-center
      ${valid 
        ? "border-ros-success/30 bg-ros-success/10" 
        : "border-destructive/30 bg-destructive/10"}
    `}>
      <div className="flex items-center justify-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${valid ? "text-ros-success" : "text-destructive"}`} />
        {valid ? (
          <CheckCircle className="w-4 h-4 text-ros-success" />
        ) : (
          <XCircle className="w-4 h-4 text-destructive" />
        )}
      </div>
      <p className={`text-xs font-medium ${valid ? "text-ros-success" : "text-destructive"}`}>
        {label} {valid ? "Valid" : "Invalid"}
      </p>
    </div>
  );
}

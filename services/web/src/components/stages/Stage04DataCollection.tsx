/**
 * Stage 04 - Data Collection
 * Collect and manage research data with manifests
 * Supports file upload, dataset management, manifest editing, and PHI scanning
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Database,
  Upload,
  FileText,
  Trash2,
  Edit3,
  Check,
  X,
  Eye,
  Download,
  Plus,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  FolderOpen,
  FileJson,
  Calendar,
  HardDrive,
  FileType,
  RefreshCw,
  Copy,
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
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  type PhiStatus,
  PHI_STATUS_METADATA,
  canProceedWithPhiStatus,
} from '@/lib/governance';

// Dataset types
export interface DatasetFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  status: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'ready' | 'error';
  progress?: number;
  errorMessage?: string;
}

export interface DatasetMetadata {
  title: string;
  description: string;
  source: string;
  dataType: 'clinical' | 'genomic' | 'imaging' | 'survey' | 'other';
  format: string;
  recordCount?: number;
  variableCount?: number;
  dateRange?: { start: string; end: string };
  tags: string[];
  version: string;
  lastModified: Date;
}

export interface Dataset {
  id: string;
  files: DatasetFile[];
  metadata: DatasetMetadata;
  phiStatus: PhiStatus;
  phiScanDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataManifest {
  version: string;
  createdAt: string;
  updatedAt: string;
  datasets: {
    id: string;
    title: string;
    fileCount: number;
    totalSize: number;
    phiStatus: PhiStatus;
    metadata: DatasetMetadata;
  }[];
  summary: {
    totalDatasets: number;
    totalFiles: number;
    totalSize: number;
    phiScanned: number;
    phiClean: number;
  };
}

interface Stage04Props {
  datasets: Dataset[];
  onDatasetsChange: (datasets: Dataset[]) => void;
  manifest?: DataManifest;
  onManifestChange?: (manifest: DataManifest) => void;
  onUpload?: (files: File[]) => Promise<DatasetFile[]>;
  onPhiScan?: (datasetId: string) => Promise<{ status: PhiStatus; findings?: string[] }>;
  onPreview?: (datasetId: string, fileId: string) => Promise<string>;
  isUploading?: boolean;
  isScanning?: boolean;
  className?: string;
}

export function Stage04DataCollection({
  datasets,
  onDatasetsChange,
  manifest,
  onManifestChange,
  onUpload,
  onPhiScan,
  onPreview,
  isUploading = false,
  isScanning = false,
  className,
}: Stage04Props) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [manifestEditorOpen, setManifestEditorOpen] = useState(false);
  const [editedManifestJson, setEditedManifestJson] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalFiles = datasets.reduce((sum, ds) => sum + ds.files.length, 0);
    const totalSize = datasets.reduce(
      (sum, ds) => sum + ds.files.reduce((s, f) => s + f.size, 0),
      0
    );
    const phiScanned = datasets.filter((ds) => ds.phiStatus !== 'UNCHECKED').length;
    const phiClean = datasets.filter((ds) => ds.phiStatus === 'PASS').length;

    return {
      totalDatasets: datasets.length,
      totalFiles,
      totalSize,
      phiScanned,
      phiClean,
    };
  }, [datasets]);

  // Generate manifest from current datasets
  const generateManifest = useCallback((): DataManifest => {
    return {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      datasets: datasets.map((ds) => ({
        id: ds.id,
        title: ds.metadata.title,
        fileCount: ds.files.length,
        totalSize: ds.files.reduce((sum, f) => sum + f.size, 0),
        phiStatus: ds.phiStatus,
        metadata: ds.metadata,
      })),
      summary: summaryStats,
    };
  }, [datasets, summaryStats]);

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      if (onUpload) {
        const uploadedFiles = await onUpload(files);
        const newDataset: Dataset = {
          id: crypto.randomUUID(),
          files: uploadedFiles,
          metadata: {
            title: `Dataset ${datasets.length + 1}`,
            description: '',
            source: '',
            dataType: 'other',
            format: files[0]?.type || 'unknown',
            tags: [],
            version: '1.0.0',
            lastModified: new Date(),
          },
          phiStatus: 'UNCHECKED',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        onDatasetsChange([...datasets, newDataset]);
      }
    },
    [datasets, onDatasetsChange, onUpload]
  );

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      if (onUpload) {
        const uploadedFiles = await onUpload(files);
        const newDataset: Dataset = {
          id: crypto.randomUUID(),
          files: uploadedFiles,
          metadata: {
            title: `Dataset ${datasets.length + 1}`,
            description: '',
            source: '',
            dataType: 'other',
            format: files[0]?.type || 'unknown',
            tags: [],
            version: '1.0.0',
            lastModified: new Date(),
          },
          phiStatus: 'UNCHECKED',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        onDatasetsChange([...datasets, newDataset]);
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [datasets, onDatasetsChange, onUpload]
  );

  // Update dataset
  const updateDataset = useCallback(
    (id: string, updates: Partial<Dataset>) => {
      onDatasetsChange(
        datasets.map((ds) =>
          ds.id === id ? { ...ds, ...updates, updatedAt: new Date() } : ds
        )
      );
    },
    [datasets, onDatasetsChange]
  );

  // Delete dataset
  const deleteDataset = useCallback(
    (id: string) => {
      onDatasetsChange(datasets.filter((ds) => ds.id !== id));
      if (selectedDatasetId === id) {
        setSelectedDatasetId(null);
      }
    },
    [datasets, onDatasetsChange, selectedDatasetId]
  );

  // Trigger PHI scan
  const handlePhiScan = useCallback(
    async (datasetId: string) => {
      if (!onPhiScan) return;

      updateDataset(datasetId, { phiStatus: 'SCANNING' });

      try {
        const result = await onPhiScan(datasetId);
        updateDataset(datasetId, {
          phiStatus: result.status,
          phiScanDate: new Date(),
        });
      } catch (error) {
        updateDataset(datasetId, { phiStatus: 'UNCHECKED' });
      }
    },
    [onPhiScan, updateDataset]
  );

  // Handle preview
  const handlePreview = useCallback(
    async (datasetId: string, fileId: string) => {
      if (!onPreview) return;

      try {
        const content = await onPreview(datasetId, fileId);
        setPreviewContent(content);
        setPreviewDialogOpen(true);
      } catch (error) {
        console.error('Preview failed:', error);
      }
    },
    [onPreview]
  );

  // Export manifest
  const exportManifest = useCallback(() => {
    const manifestData = generateManifest();
    const blob = new Blob([JSON.stringify(manifestData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generateManifest]);

  // Open manifest editor
  const openManifestEditor = useCallback(() => {
    const manifestData = generateManifest();
    setEditedManifestJson(JSON.stringify(manifestData, null, 2));
    setManifestEditorOpen(true);
  }, [generateManifest]);

  // Save manifest changes
  const saveManifestChanges = useCallback(() => {
    try {
      const parsed = JSON.parse(editedManifestJson) as DataManifest;
      onManifestChange?.(parsed);
      setManifestEditorOpen(false);
    } catch (error) {
      console.error('Invalid JSON:', error);
    }
  }, [editedManifestJson, onManifestChange]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Get PHI status badge
  const getPhiStatusBadge = (status: PhiStatus) => {
    const meta = PHI_STATUS_METADATA[status];
    const iconMap: Record<PhiStatus, React.ReactNode> = {
      UNCHECKED: <Shield className="h-3 w-3" />,
      SCANNING: <Loader2 className="h-3 w-3 animate-spin" />,
      PASS: <ShieldCheck className="h-3 w-3" />,
      FAIL: <ShieldAlert className="h-3 w-3" />,
      QUARANTINED: <AlertTriangle className="h-3 w-3" />,
      OVERRIDDEN: <Shield className="h-3 w-3" />,
    };

    return (
      <Badge
        variant="outline"
        className={cn('gap-1 text-xs', meta.bgColor, meta.color)}
      >
        {iconMap[status]}
        {meta.label}
      </Badge>
    );
  };

  const selectedDataset = datasets.find((ds) => ds.id === selectedDatasetId);

  return (
    <div className={cn('space-y-6', className)}>
      {/* PHI Compliance Warning */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>PHI Compliance Required</AlertTitle>
        <AlertDescription>
          This stage processes potentially sensitive data. All datasets must be scanned for PHI
          before proceeding to analysis stages.
        </AlertDescription>
      </Alert>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Collection Overview
          </CardTitle>
          <CardDescription>
            Manage research datasets and track PHI compliance status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{summaryStats.totalDatasets}</p>
              <p className="text-xs text-muted-foreground">Datasets</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{summaryStats.totalFiles}</p>
              <p className="text-xs text-muted-foreground">Files</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{formatFileSize(summaryStats.totalSize)}</p>
              <p className="text-xs text-muted-foreground">Total Size</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{summaryStats.phiScanned}</p>
              <p className="text-xs text-muted-foreground">PHI Scanned</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">{summaryStats.phiClean}</p>
              <p className="text-xs text-muted-foreground">PHI Clean</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Files
          </CardTitle>
          <CardDescription>
            Drag and drop files or click to browse. Supported formats: CSV, Excel, JSON, SPSS, SAS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              accept=".csv,.xlsx,.xls,.json,.sav,.sas7bdat,.dta"
            />
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isUploading ? (
              <div className="space-y-2">
                <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading files...</p>
              </div>
            ) : (
              <>
                <p className="text-lg font-medium">Drop files here or click to upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Maximum file size: 100MB per file
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dataset List and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dataset List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Datasets</CardTitle>
              <Button variant="outline" size="sm" onClick={openManifestEditor}>
                <FileJson className="h-4 w-4 mr-1" />
                Manifest
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {datasets.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No datasets uploaded yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {datasets.map((dataset) => (
                    <div
                      key={dataset.id}
                      onClick={() => setSelectedDatasetId(dataset.id)}
                      className={cn(
                        'p-4 cursor-pointer transition-colors hover:bg-muted/50',
                        selectedDatasetId === dataset.id && 'bg-muted'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{dataset.metadata.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {dataset.files.length} file(s) - {formatFileSize(
                              dataset.files.reduce((sum, f) => sum + f.size, 0)
                            )}
                          </p>
                        </div>
                        {getPhiStatusBadge(dataset.phiStatus)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="border-t p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={exportManifest}
              disabled={datasets.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Manifest
            </Button>
          </CardFooter>
        </Card>

        {/* Dataset Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDataset ? selectedDataset.metadata.title : 'Dataset Details'}
            </CardTitle>
            {selectedDataset && (
              <CardDescription>
                Uploaded {formatDate(selectedDataset.createdAt)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedDataset ? (
              <div className="space-y-6">
                {/* Metadata Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Metadata</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditingMetadataId(
                          editingMetadataId === selectedDataset.id ? null : selectedDataset.id
                        )
                      }
                    >
                      {editingMetadataId === selectedDataset.id ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Done
                        </>
                      ) : (
                        <>
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </>
                      )}
                    </Button>
                  </div>

                  {editingMetadataId === selectedDataset.id ? (
                    <MetadataEditor
                      metadata={selectedDataset.metadata}
                      onChange={(metadata) =>
                        updateDataset(selectedDataset.id, { metadata })
                      }
                    />
                  ) : (
                    <MetadataDisplay metadata={selectedDataset.metadata} />
                  )}
                </div>

                <Separator />

                {/* PHI Scan Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">PHI Compliance</h3>
                    <Button
                      variant={
                        canProceedWithPhiStatus(selectedDataset.phiStatus)
                          ? 'outline'
                          : 'default'
                      }
                      size="sm"
                      onClick={() => handlePhiScan(selectedDataset.id)}
                      disabled={isScanning || selectedDataset.phiStatus === 'SCANNING'}
                    >
                      {selectedDataset.phiStatus === 'SCANNING' ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          {selectedDataset.phiStatus === 'UNCHECKED'
                            ? 'Run PHI Scan'
                            : 'Re-scan'}
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">Status:</span>
                        {getPhiStatusBadge(selectedDataset.phiStatus)}
                      </div>
                      {selectedDataset.phiScanDate && (
                        <p className="text-xs text-muted-foreground">
                          Last scanned: {formatDate(selectedDataset.phiScanDate)}
                        </p>
                      )}
                    </div>
                    {!canProceedWithPhiStatus(selectedDataset.phiStatus) && (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                </div>

                <Separator />

                {/* Files Table */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Files</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDataset.files.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell className="font-mono text-sm">
                            {file.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {file.type || 'unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatFileSize(file.size)}</TableCell>
                          <TableCell>
                            {file.status === 'uploading' && file.progress !== undefined ? (
                              <div className="flex items-center gap-2">
                                <Progress value={file.progress} className="h-2 w-16" />
                                <span className="text-xs">{file.progress}%</span>
                              </div>
                            ) : (
                              <Badge
                                variant={file.status === 'ready' ? 'outline' : 'secondary'}
                                className={cn(
                                  'text-xs',
                                  file.status === 'ready' && 'bg-green-500/10 text-green-600',
                                  file.status === 'error' && 'bg-red-500/10 text-red-600'
                                )}
                              >
                                {file.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        handlePreview(selectedDataset.id, file.id)
                                      }
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Preview</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => {
                                        const updatedFiles = selectedDataset.files.filter(
                                          (f) => f.id !== file.id
                                        );
                                        updateDataset(selectedDataset.id, {
                                          files: updatedFiles,
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a dataset to view details</p>
                </div>
              </div>
            )}
          </CardContent>
          {selectedDataset && (
            <CardFooter className="border-t justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteDataset(selectedDataset.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Dataset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const json = JSON.stringify(selectedDataset.metadata, null, 2);
                  navigator.clipboard.writeText(json);
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Metadata
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Data Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Data Preview</DialogTitle>
            <DialogDescription>
              Preview of the first rows of data
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] rounded-md border">
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
              {previewContent || 'Loading...'}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manifest Editor Dialog */}
      <Dialog open={manifestEditorOpen} onOpenChange={setManifestEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Manifest Editor
            </DialogTitle>
            <DialogDescription>
              Edit the dataset manifest JSON directly
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editedManifestJson}
              onChange={(e) => setEditedManifestJson(e.target.value)}
              className="font-mono text-sm h-[400px]"
              placeholder="Manifest JSON..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManifestEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveManifestChanges}>
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Metadata Display Component
interface MetadataDisplayProps {
  metadata: DatasetMetadata;
}

function MetadataDisplay({ metadata }: MetadataDisplayProps) {
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="text-muted-foreground">Description</p>
        <p className="font-medium">{metadata.description || 'No description'}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Source</p>
        <p className="font-medium">{metadata.source || 'Not specified'}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Data Type</p>
        <Badge variant="outline">{metadata.dataType}</Badge>
      </div>
      <div>
        <p className="text-muted-foreground">Format</p>
        <p className="font-medium">{metadata.format}</p>
      </div>
      {metadata.recordCount !== undefined && (
        <div>
          <p className="text-muted-foreground">Records</p>
          <p className="font-medium">{metadata.recordCount.toLocaleString()}</p>
        </div>
      )}
      {metadata.variableCount !== undefined && (
        <div>
          <p className="text-muted-foreground">Variables</p>
          <p className="font-medium">{metadata.variableCount}</p>
        </div>
      )}
      <div>
        <p className="text-muted-foreground">Version</p>
        <p className="font-medium">{metadata.version}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Tags</p>
        <div className="flex flex-wrap gap-1">
          {metadata.tags.length > 0 ? (
            metadata.tags.map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">No tags</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Metadata Editor Component
interface MetadataEditorProps {
  metadata: DatasetMetadata;
  onChange: (metadata: DatasetMetadata) => void;
}

function MetadataEditor({ metadata, onChange }: MetadataEditorProps) {
  const [localMetadata, setLocalMetadata] = useState(metadata);
  const [tagInput, setTagInput] = useState('');

  const handleChange = (field: keyof DatasetMetadata, value: string | number | string[]) => {
    const updated = { ...localMetadata, [field]: value, lastModified: new Date() };
    setLocalMetadata(updated);
    onChange(updated);
  };

  const addTag = () => {
    if (tagInput.trim() && !localMetadata.tags.includes(tagInput.trim())) {
      handleChange('tags', [...localMetadata.tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    handleChange(
      'tags',
      localMetadata.tags.filter((t) => t !== tag)
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={localMetadata.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Dataset title"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={localMetadata.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Describe the dataset"
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="source">Source</Label>
          <Input
            id="source"
            value={localMetadata.source}
            onChange={(e) => handleChange('source', e.target.value)}
            placeholder="Data source"
          />
        </div>
        <div>
          <Label htmlFor="dataType">Data Type</Label>
          <Select
            value={localMetadata.dataType}
            onValueChange={(value) =>
              handleChange('dataType', value as DatasetMetadata['dataType'])
            }
          >
            <SelectTrigger id="dataType">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clinical">Clinical</SelectItem>
              <SelectItem value="genomic">Genomic</SelectItem>
              <SelectItem value="imaging">Imaging</SelectItem>
              <SelectItem value="survey">Survey</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="recordCount">Record Count</Label>
          <Input
            id="recordCount"
            type="number"
            value={localMetadata.recordCount || ''}
            onChange={(e) => handleChange('recordCount', parseInt(e.target.value) || 0)}
            placeholder="Number of records"
          />
        </div>
        <div>
          <Label htmlFor="variableCount">Variable Count</Label>
          <Input
            id="variableCount"
            type="number"
            value={localMetadata.variableCount || ''}
            onChange={(e) => handleChange('variableCount', parseInt(e.target.value) || 0)}
            placeholder="Number of variables"
          />
        </div>
        <div className="col-span-2">
          <Label>Tags</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add a tag"
            />
            <Button type="button" variant="outline" onClick={addTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {localMetadata.tags.map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Stage04DataCollection;

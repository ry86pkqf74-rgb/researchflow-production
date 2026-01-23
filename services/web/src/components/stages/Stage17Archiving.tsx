/**
 * Stage 17 - Archiving
 * Archive research data for long-term preservation
 * Features: Archive repository selection, preservation formats, retention policies,
 *           DOI/persistent identifier assignment, file integrity verification,
 *           archive job progress tracking, PHI redaction options, AI metadata enrichment
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Archive,
  Database,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Eye,
  RefreshCcw,
  ExternalLink,
  Calendar,
  Lock,
  Globe,
  HardDrive,
  FolderArchive,
  Hash,
  Settings,
  Sparkles,
  Play,
  Pause,
  FileCheck,
  Link2,
  Copy,
  Building2,
  Server,
  CloudUpload,
  Timer,
  FileWarning,
  ShieldCheck,
  Boxes,
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// ==================== Types ====================

export type ArchiveRepositoryType = 'institutional' | 'zenodo' | 'figshare' | 'dryad' | 'dataverse' | 'custom';

export type PreservationFormat = 'bagit' | 'oais' | 'mets' | 'custom';

export type RetentionPeriod = '1year' | '3years' | '5years' | '10years' | '25years' | 'permanent';

export type ArchiveJobStatus = 'pending' | 'preparing' | 'uploading' | 'verifying' | 'completed' | 'failed' | 'cancelled';

export type ChecksumAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512';

export type PhiRedactionStatus = 'not_scanned' | 'scanning' | 'clean' | 'redaction_needed' | 'redacted';

export type MetadataEnrichmentStatus = 'not_started' | 'in_progress' | 'completed' | 'failed';

export interface ArchiveRepository {
  id: string;
  type: ArchiveRepositoryType;
  name: string;
  description: string;
  url?: string;
  apiEndpoint?: string;
  isConnected: boolean;
  isDefault: boolean;
  credentials?: {
    configured: boolean;
    lastValidated?: Date;
  };
  supportedFormats: PreservationFormat[];
  maxFileSize?: number;
  storageQuota?: {
    used: number;
    total: number;
  };
}

export interface PreservationConfig {
  format: PreservationFormat;
  checksumAlgorithm: ChecksumAlgorithm;
  includeManifest: boolean;
  includeReadme: boolean;
  compressArchive: boolean;
  compressionLevel: 'low' | 'medium' | 'high';
  validateOnCreate: boolean;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  period: RetentionPeriod;
  description: string;
  autoDelete: boolean;
  notifyBeforeExpiry: boolean;
  notifyDays: number;
  legalHold: boolean;
  complianceFramework?: string;
}

export interface PersistentIdentifier {
  type: 'doi' | 'ark' | 'handle' | 'urn' | 'purl';
  value: string;
  url: string;
  assignedAt?: Date;
  status: 'pending' | 'reserved' | 'registered' | 'failed';
  provider?: string;
}

export interface FileIntegrityRecord {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  checksums: Record<ChecksumAlgorithm, string>;
  validatedAt?: Date;
  isValid: boolean;
  errorMessage?: string;
}

export interface ArchiveJob {
  id: string;
  name: string;
  repositoryId: string;
  repositoryName: string;
  status: ArchiveJobStatus;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number;
  totalFiles: number;
  processedFiles: number;
  totalSize: number;
  processedSize: number;
  errorMessage?: string;
  archiveUrl?: string;
  persistentIdentifier?: PersistentIdentifier;
  logs: ArchiveJobLog[];
}

export interface ArchiveJobLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: string;
}

export interface PhiRedactionConfig {
  enabled: boolean;
  status: PhiRedactionStatus;
  scanDate?: Date;
  findingsCount: number;
  findings: PhiFinding[];
  redactionStrategy: 'remove' | 'mask' | 'generalize' | 'pseudonymize';
  customPatterns: string[];
}

export interface PhiFinding {
  id: string;
  type: 'name' | 'date' | 'location' | 'id' | 'medical' | 'contact' | 'financial' | 'other';
  text: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  confidence: number;
  redacted: boolean;
  redactedValue?: string;
}

export interface PreservationMetadata {
  title: string;
  description: string;
  creators: string[];
  contributors: string[];
  keywords: string[];
  subjects: string[];
  dateCreated: Date;
  dateModified: Date;
  language: string;
  license: string;
  rights: string;
  fundingReferences: string[];
  relatedIdentifiers: Array<{
    type: string;
    identifier: string;
    relation: string;
  }>;
  customMetadata: Record<string, string>;
}

export interface MetadataEnrichment {
  status: MetadataEnrichmentStatus;
  suggestions: Array<{
    field: keyof PreservationMetadata;
    currentValue: string | string[];
    suggestedValue: string | string[];
    confidence: number;
    source: string;
    accepted: boolean;
  }>;
  lastEnrichedAt?: Date;
}

export interface ArchiveRecord {
  id: string;
  projectId: string;
  projectName: string;
  repositories: ArchiveRepository[];
  preservationConfig: PreservationConfig;
  retentionPolicy: RetentionPolicy;
  persistentIdentifiers: PersistentIdentifier[];
  fileIntegrity: FileIntegrityRecord[];
  jobs: ArchiveJob[];
  phiRedaction: PhiRedactionConfig;
  metadata: PreservationMetadata;
  metadataEnrichment: MetadataEnrichment;
  createdAt: Date;
  updatedAt: Date;
}

// Stage component props following the pattern
export interface StageComponentProps {
  topicId: string;
  researchId: string;
  stageData: ArchiveRecord | null;
  onComplete: (data: ArchiveRecord) => void;
  onSave: (data: ArchiveRecord) => void;
  isReadOnly?: boolean;
}

interface Stage17Props extends StageComponentProps {
  governanceMode?: 'DEMO' | 'LIVE';
  onStartArchiveJob?: (repositoryId: string) => Promise<ArchiveJob>;
  onCancelArchiveJob?: (jobId: string) => Promise<void>;
  onRunPhiScan?: () => Promise<PhiRedactionConfig>;
  onEnrichMetadata?: () => Promise<MetadataEnrichment>;
  onReserveIdentifier?: (type: PersistentIdentifier['type']) => Promise<PersistentIdentifier>;
  onValidateIntegrity?: () => Promise<FileIntegrityRecord[]>;
  onConnectRepository?: (type: ArchiveRepositoryType) => Promise<ArchiveRepository>;
  isProcessing?: boolean;
  className?: string;
}

// ==================== Configuration ====================

const REPOSITORY_CONFIG: Record<ArchiveRepositoryType, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  url: string;
}> = {
  institutional: {
    label: 'Institutional Repository',
    description: 'Your organization\'s internal archive system',
    icon: Building2,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    url: '',
  },
  zenodo: {
    label: 'Zenodo',
    description: 'Open repository by CERN for research data',
    icon: Globe,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    url: 'https://zenodo.org',
  },
  figshare: {
    label: 'Figshare',
    description: 'Repository for academic research outputs',
    icon: Database,
    color: 'bg-green-100 text-green-700 border-green-200',
    url: 'https://figshare.com',
  },
  dryad: {
    label: 'Dryad',
    description: 'Curated resource for scientific data',
    icon: FolderArchive,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    url: 'https://datadryad.org',
  },
  dataverse: {
    label: 'Dataverse',
    description: 'Open source research data repository',
    icon: Server,
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    url: 'https://dataverse.org',
  },
  custom: {
    label: 'Custom Repository',
    description: 'Configure a custom archive endpoint',
    icon: HardDrive,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    url: '',
  },
};

const FORMAT_CONFIG: Record<PreservationFormat, {
  label: string;
  description: string;
  standard: string;
}> = {
  bagit: {
    label: 'BagIt',
    description: 'Library of Congress BagIt specification',
    standard: 'RFC 8493',
  },
  oais: {
    label: 'OAIS',
    description: 'Open Archival Information System reference model',
    standard: 'ISO 14721:2012',
  },
  mets: {
    label: 'METS',
    description: 'Metadata Encoding and Transmission Standard',
    standard: 'Library of Congress',
  },
  custom: {
    label: 'Custom Format',
    description: 'Define a custom preservation package format',
    standard: 'User-defined',
  },
};

const RETENTION_CONFIG: Record<RetentionPeriod, {
  label: string;
  years: number | null;
}> = {
  '1year': { label: '1 Year', years: 1 },
  '3years': { label: '3 Years', years: 3 },
  '5years': { label: '5 Years', years: 5 },
  '10years': { label: '10 Years', years: 10 },
  '25years': { label: '25 Years', years: 25 },
  'permanent': { label: 'Permanent', years: null },
};

const JOB_STATUS_CONFIG: Record<ArchiveJobStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
  preparing: { label: 'Preparing', color: 'bg-blue-100 text-blue-700', icon: Settings },
  uploading: { label: 'Uploading', color: 'bg-indigo-100 text-indigo-700', icon: CloudUpload },
  verifying: { label: 'Verifying', color: 'bg-yellow-100 text-yellow-700', icon: ShieldCheck },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: X },
};

const PHI_STATUS_CONFIG: Record<PhiRedactionStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  not_scanned: { label: 'Not Scanned', color: 'bg-gray-100 text-gray-700', icon: FileWarning },
  scanning: { label: 'Scanning', color: 'bg-blue-100 text-blue-700', icon: RefreshCcw },
  clean: { label: 'Clean', color: 'bg-green-100 text-green-700', icon: ShieldCheck },
  redaction_needed: { label: 'Redaction Needed', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  redacted: { label: 'Redacted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

// ==================== Helper Functions ====================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function getDefaultArchiveRecord(projectId: string, projectName: string): ArchiveRecord {
  return {
    id: crypto.randomUUID(),
    projectId,
    projectName,
    repositories: [],
    preservationConfig: {
      format: 'bagit',
      checksumAlgorithm: 'sha256',
      includeManifest: true,
      includeReadme: true,
      compressArchive: true,
      compressionLevel: 'medium',
      validateOnCreate: true,
    },
    retentionPolicy: {
      id: crypto.randomUUID(),
      name: 'Standard Retention',
      period: '10years',
      description: 'Standard 10-year retention for research data',
      autoDelete: false,
      notifyBeforeExpiry: true,
      notifyDays: 90,
      legalHold: false,
    },
    persistentIdentifiers: [],
    fileIntegrity: [],
    jobs: [],
    phiRedaction: {
      enabled: true,
      status: 'not_scanned',
      findingsCount: 0,
      findings: [],
      redactionStrategy: 'mask',
      customPatterns: [],
    },
    metadata: {
      title: projectName,
      description: '',
      creators: [],
      contributors: [],
      keywords: [],
      subjects: [],
      dateCreated: new Date(),
      dateModified: new Date(),
      language: 'en',
      license: 'CC-BY-4.0',
      rights: '',
      fundingReferences: [],
      relatedIdentifiers: [],
      customMetadata: {},
    },
    metadataEnrichment: {
      status: 'not_started',
      suggestions: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ==================== Main Component ====================

export function Stage17Archiving({
  topicId,
  researchId,
  stageData,
  onComplete,
  onSave,
  isReadOnly = false,
  governanceMode = 'DEMO',
  onStartArchiveJob,
  onCancelArchiveJob,
  onRunPhiScan,
  onEnrichMetadata,
  onReserveIdentifier,
  onValidateIntegrity,
  onConnectRepository,
  isProcessing = false,
  className,
}: Stage17Props) {
  // Initialize state from stageData or defaults
  const [archiveRecord, setArchiveRecord] = useState<ArchiveRecord>(() => {
    if (stageData) return stageData;
    return getDefaultArchiveRecord(researchId, `Research Project ${researchId}`);
  });

  const [selectedTab, setSelectedTab] = useState('configuration');
  const [isAddingRepository, setIsAddingRepository] = useState(false);
  const [selectedRepositoryType, setSelectedRepositoryType] = useState<ArchiveRepositoryType>('zenodo');
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [phiFindingsExpanded, setPhiFindingsExpanded] = useState(false);
  const [jobLogsExpanded, setJobLogsExpanded] = useState<Record<string, boolean>>({});

  // Update archive record and trigger save
  const updateArchiveRecord = useCallback((updates: Partial<ArchiveRecord>) => {
    const updated = {
      ...archiveRecord,
      ...updates,
      updatedAt: new Date(),
    };
    setArchiveRecord(updated);
    onSave(updated);
  }, [archiveRecord, onSave]);

  // Calculate statistics
  const stats = useMemo(() => {
    const connectedRepos = archiveRecord.repositories.filter(r => r.isConnected).length;
    const completedJobs = archiveRecord.jobs.filter(j => j.status === 'completed').length;
    const activeJobs = archiveRecord.jobs.filter(j => ['pending', 'preparing', 'uploading', 'verifying'].includes(j.status)).length;
    const validFiles = archiveRecord.fileIntegrity.filter(f => f.isValid).length;
    const totalFiles = archiveRecord.fileIntegrity.length;
    const integrityPercent = totalFiles > 0 ? Math.round((validFiles / totalFiles) * 100) : 0;
    const hasIdentifier = archiveRecord.persistentIdentifiers.some(p => p.status === 'registered');

    return {
      connectedRepos,
      completedJobs,
      activeJobs,
      validFiles,
      totalFiles,
      integrityPercent,
      hasIdentifier,
    };
  }, [archiveRecord]);

  // Check if archive is ready
  const canArchive = useMemo(() => {
    const hasConnectedRepo = archiveRecord.repositories.some(r => r.isConnected);
    const phiClean = archiveRecord.phiRedaction.status === 'clean' || archiveRecord.phiRedaction.status === 'redacted';
    const integrityValid = stats.integrityPercent === 100 || stats.totalFiles === 0;

    if (governanceMode === 'LIVE') {
      return hasConnectedRepo && phiClean && integrityValid;
    }
    return hasConnectedRepo;
  }, [archiveRecord, stats, governanceMode]);

  // Handle repository connection
  const handleConnectRepository = useCallback(async (type: ArchiveRepositoryType) => {
    if (!onConnectRepository || isReadOnly) return;

    try {
      const repo = await onConnectRepository(type);
      updateArchiveRecord({
        repositories: [...archiveRecord.repositories, repo],
      });
      setIsAddingRepository(false);
    } catch (error) {
      console.error('Failed to connect repository:', error);
    }
  }, [onConnectRepository, isReadOnly, archiveRecord, updateArchiveRecord]);

  // Handle starting an archive job
  const handleStartArchiveJob = useCallback(async (repositoryId: string) => {
    if (!onStartArchiveJob || isReadOnly) return;

    try {
      const job = await onStartArchiveJob(repositoryId);
      updateArchiveRecord({
        jobs: [...archiveRecord.jobs, job],
      });
    } catch (error) {
      console.error('Failed to start archive job:', error);
    }
  }, [onStartArchiveJob, isReadOnly, archiveRecord, updateArchiveRecord]);

  // Handle cancelling an archive job
  const handleCancelJob = useCallback(async (jobId: string) => {
    if (!onCancelArchiveJob || isReadOnly) return;

    try {
      await onCancelArchiveJob(jobId);
      updateArchiveRecord({
        jobs: archiveRecord.jobs.map(j =>
          j.id === jobId ? { ...j, status: 'cancelled' as ArchiveJobStatus } : j
        ),
      });
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  }, [onCancelArchiveJob, isReadOnly, archiveRecord, updateArchiveRecord]);

  // Handle PHI scan
  const handlePhiScan = useCallback(async () => {
    if (!onRunPhiScan || isReadOnly) return;

    try {
      const result = await onRunPhiScan();
      updateArchiveRecord({
        phiRedaction: result,
      });
    } catch (error) {
      console.error('Failed to run PHI scan:', error);
    }
  }, [onRunPhiScan, isReadOnly, updateArchiveRecord]);

  // Handle metadata enrichment
  const handleEnrichMetadata = useCallback(async () => {
    if (!onEnrichMetadata || isReadOnly) return;

    try {
      const enrichment = await onEnrichMetadata();
      updateArchiveRecord({
        metadataEnrichment: enrichment,
      });
    } catch (error) {
      console.error('Failed to enrich metadata:', error);
    }
  }, [onEnrichMetadata, isReadOnly, updateArchiveRecord]);

  // Handle reserving persistent identifier
  const handleReserveIdentifier = useCallback(async (type: PersistentIdentifier['type']) => {
    if (!onReserveIdentifier || isReadOnly) return;

    try {
      const identifier = await onReserveIdentifier(type);
      updateArchiveRecord({
        persistentIdentifiers: [...archiveRecord.persistentIdentifiers, identifier],
      });
    } catch (error) {
      console.error('Failed to reserve identifier:', error);
    }
  }, [onReserveIdentifier, isReadOnly, archiveRecord, updateArchiveRecord]);

  // Handle file integrity validation
  const handleValidateIntegrity = useCallback(async () => {
    if (!onValidateIntegrity || isReadOnly) return;

    try {
      const records = await onValidateIntegrity();
      updateArchiveRecord({
        fileIntegrity: records,
      });
    } catch (error) {
      console.error('Failed to validate integrity:', error);
    }
  }, [onValidateIntegrity, isReadOnly, updateArchiveRecord]);

  // Handle preservation config update
  const updatePreservationConfig = useCallback((updates: Partial<PreservationConfig>) => {
    updateArchiveRecord({
      preservationConfig: {
        ...archiveRecord.preservationConfig,
        ...updates,
      },
    });
  }, [archiveRecord, updateArchiveRecord]);

  // Handle retention policy update
  const updateRetentionPolicy = useCallback((updates: Partial<RetentionPolicy>) => {
    updateArchiveRecord({
      retentionPolicy: {
        ...archiveRecord.retentionPolicy,
        ...updates,
      },
    });
  }, [archiveRecord, updateArchiveRecord]);

  // Handle metadata update
  const updateMetadata = useCallback((updates: Partial<PreservationMetadata>) => {
    updateArchiveRecord({
      metadata: {
        ...archiveRecord.metadata,
        ...updates,
        dateModified: new Date(),
      },
    });
  }, [archiveRecord, updateArchiveRecord]);

  // Toggle job logs expansion
  const toggleJobLogs = useCallback((jobId: string) => {
    setJobLogsExpanded(prev => ({
      ...prev,
      [jobId]: !prev[jobId],
    }));
  }, []);

  // Complete the stage
  const handleComplete = useCallback(() => {
    if (canArchive && stats.completedJobs > 0) {
      onComplete(archiveRecord);
    }
  }, [canArchive, stats.completedJobs, archiveRecord, onComplete]);

  // ==================== Render Functions ====================

  // Configuration Tab Content
  const renderConfigurationTab = () => (
    <div className="space-y-6">
      {/* Preservation Format Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            Preservation Format
          </CardTitle>
          <CardDescription>
            Select the archive package format and validation settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {(Object.keys(FORMAT_CONFIG) as PreservationFormat[]).map(format => {
              const config = FORMAT_CONFIG[format];
              const isSelected = archiveRecord.preservationConfig.format === format;

              return (
                <div
                  key={format}
                  className={cn(
                    'p-4 border rounded-lg cursor-pointer transition-colors',
                    isSelected && 'border-primary bg-primary/5',
                    !isSelected && 'hover:bg-muted/50',
                    isReadOnly && 'cursor-not-allowed opacity-60'
                  )}
                  onClick={() => !isReadOnly && updatePreservationConfig({ format })}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'h-4 w-4 rounded-full border-2',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                    )} />
                    <span className="font-medium">{config.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
                  <Badge variant="outline" className="mt-2">{config.standard}</Badge>
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Checksum Algorithm</Label>
              <Select
                value={archiveRecord.preservationConfig.checksumAlgorithm}
                onValueChange={(value) => updatePreservationConfig({ checksumAlgorithm: value as ChecksumAlgorithm })}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="md5">MD5</SelectItem>
                  <SelectItem value="sha1">SHA-1</SelectItem>
                  <SelectItem value="sha256">SHA-256 (Recommended)</SelectItem>
                  <SelectItem value="sha512">SHA-512</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Compression Level</Label>
              <Select
                value={archiveRecord.preservationConfig.compressionLevel}
                onValueChange={(value) => updatePreservationConfig({ compressionLevel: value as 'low' | 'medium' | 'high' })}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Faster)</SelectItem>
                  <SelectItem value="medium">Medium (Balanced)</SelectItem>
                  <SelectItem value="high">High (Smaller)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Include Manifest File</Label>
                <p className="text-sm text-muted-foreground">Add checksums and file listings</p>
              </div>
              <Switch
                checked={archiveRecord.preservationConfig.includeManifest}
                onCheckedChange={(checked) => updatePreservationConfig({ includeManifest: checked })}
                disabled={isReadOnly}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Include README</Label>
                <p className="text-sm text-muted-foreground">Auto-generate documentation</p>
              </div>
              <Switch
                checked={archiveRecord.preservationConfig.includeReadme}
                onCheckedChange={(checked) => updatePreservationConfig({ includeReadme: checked })}
                disabled={isReadOnly}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Validate on Create</Label>
                <p className="text-sm text-muted-foreground">Verify archive integrity after creation</p>
              </div>
              <Switch
                checked={archiveRecord.preservationConfig.validateOnCreate}
                onCheckedChange={(checked) => updatePreservationConfig({ validateOnCreate: checked })}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retention Policy Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Retention Policy
          </CardTitle>
          <CardDescription>
            Configure data retention and compliance settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Policy Name</Label>
              <Input
                value={archiveRecord.retentionPolicy.name}
                onChange={(e) => updateRetentionPolicy({ name: e.target.value })}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Retention Period</Label>
              <Select
                value={archiveRecord.retentionPolicy.period}
                onValueChange={(value) => updateRetentionPolicy({ period: value as RetentionPeriod })}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RETENTION_CONFIG) as RetentionPeriod[]).map(period => (
                    <SelectItem key={period} value={period}>
                      {RETENTION_CONFIG[period].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={archiveRecord.retentionPolicy.description}
              onChange={(e) => updateRetentionPolicy({ description: e.target.value })}
              disabled={isReadOnly}
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Notify Before Expiry</Label>
                <p className="text-sm text-muted-foreground">Send reminder before retention period ends</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={archiveRecord.retentionPolicy.notifyDays}
                  onChange={(e) => updateRetentionPolicy({ notifyDays: parseInt(e.target.value) || 90 })}
                  className="w-20"
                  disabled={isReadOnly || !archiveRecord.retentionPolicy.notifyBeforeExpiry}
                />
                <span className="text-sm text-muted-foreground">days</span>
                <Switch
                  checked={archiveRecord.retentionPolicy.notifyBeforeExpiry}
                  onCheckedChange={(checked) => updateRetentionPolicy({ notifyBeforeExpiry: checked })}
                  disabled={isReadOnly}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Legal Hold</Label>
                <p className="text-sm text-muted-foreground">Prevent deletion for compliance</p>
              </div>
              <Switch
                checked={archiveRecord.retentionPolicy.legalHold}
                onCheckedChange={(checked) => updateRetentionPolicy({ legalHold: checked })}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PHI Redaction Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                PHI Redaction
              </CardTitle>
              <CardDescription>
                Scan and redact Protected Health Information before archiving
              </CardDescription>
            </div>
            <Badge className={cn(PHI_STATUS_CONFIG[archiveRecord.phiRedaction.status].color)}>
              {React.createElement(PHI_STATUS_CONFIG[archiveRecord.phiRedaction.status].icon, {
                className: cn('h-3 w-3 mr-1', archiveRecord.phiRedaction.status === 'scanning' && 'animate-spin')
              })}
              {PHI_STATUS_CONFIG[archiveRecord.phiRedaction.status].label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable PHI Scanning</Label>
              <p className="text-sm text-muted-foreground">Automatically scan files for PHI before archiving</p>
            </div>
            <Switch
              checked={archiveRecord.phiRedaction.enabled}
              onCheckedChange={(checked) => updateArchiveRecord({
                phiRedaction: { ...archiveRecord.phiRedaction, enabled: checked }
              })}
              disabled={isReadOnly}
            />
          </div>

          {archiveRecord.phiRedaction.enabled && (
            <>
              <div className="space-y-2">
                <Label>Redaction Strategy</Label>
                <Select
                  value={archiveRecord.phiRedaction.redactionStrategy}
                  onValueChange={(value) => updateArchiveRecord({
                    phiRedaction: {
                      ...archiveRecord.phiRedaction,
                      redactionStrategy: value as PhiRedactionConfig['redactionStrategy']
                    }
                  })}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remove">Remove (Delete entirely)</SelectItem>
                    <SelectItem value="mask">Mask (Replace with ***)</SelectItem>
                    <SelectItem value="generalize">Generalize (Reduce specificity)</SelectItem>
                    <SelectItem value="pseudonymize">Pseudonymize (Replace with fake data)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {archiveRecord.phiRedaction.status === 'not_scanned' && (
                <div className="text-center py-4">
                  <FileWarning className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Files have not been scanned for PHI yet.
                  </p>
                  <Button onClick={handlePhiScan} disabled={isProcessing || isReadOnly}>
                    <Shield className="mr-2 h-4 w-4" />
                    Start PHI Scan
                  </Button>
                </div>
              )}

              {archiveRecord.phiRedaction.status === 'scanning' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Scanning files for PHI...</span>
                    <span>Please wait</span>
                  </div>
                  <Progress value={45} className="h-2" />
                </div>
              )}

              {(archiveRecord.phiRedaction.status === 'redaction_needed' || archiveRecord.phiRedaction.findingsCount > 0) && (
                <>
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>PHI Detected</AlertTitle>
                    <AlertDescription>
                      {archiveRecord.phiRedaction.findingsCount} potential PHI instances found. Review and redact before archiving.
                    </AlertDescription>
                  </Alert>

                  <Collapsible open={phiFindingsExpanded} onOpenChange={setPhiFindingsExpanded}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span>View Findings ({archiveRecord.phiRedaction.findingsCount})</span>
                        {phiFindingsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2">
                      {archiveRecord.phiRedaction.findings.map(finding => (
                        <div
                          key={finding.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{finding.type}</Badge>
                            <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {finding.text}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {finding.location.file}:{finding.location.line}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {Math.round(finding.confidence * 100)}%
                            </Badge>
                            <Checkbox
                              checked={finding.redacted}
                              disabled={isReadOnly}
                            />
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              {archiveRecord.phiRedaction.status === 'clean' && (
                <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <ShieldCheck className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">
                      No PHI Detected
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Files are clean and ready for archiving
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Repositories Tab Content
  const renderRepositoriesTab = () => (
    <div className="space-y-6">
      {/* Connected Repositories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Archive Repositories
              </CardTitle>
              <CardDescription>
                Connect to repositories for long-term data preservation
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsAddingRepository(true)}
              disabled={isReadOnly}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Repository
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {archiveRecord.repositories.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No repositories connected yet. Add a repository to start archiving.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {archiveRecord.repositories.map(repo => {
                const config = REPOSITORY_CONFIG[repo.type];
                const Icon = config.icon;

                return (
                  <div
                    key={repo.id}
                    className={cn(
                      'flex items-center justify-between p-4 border rounded-lg',
                      repo.isDefault && 'border-primary'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn('p-2 rounded-lg', config.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{repo.name}</span>
                          {repo.isDefault && <Badge variant="outline">Default</Badge>}
                          <Badge variant={repo.isConnected ? 'default' : 'secondary'}>
                            {repo.isConnected ? 'Connected' : 'Disconnected'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{repo.description}</p>
                        {repo.storageQuota && (
                          <div className="flex items-center gap-2 mt-1">
                            <Progress
                              value={(repo.storageQuota.used / repo.storageQuota.total) * 100}
                              className="h-1 w-24"
                            />
                            <span className="text-xs text-muted-foreground">
                              {formatBytes(repo.storageQuota.used)} / {formatBytes(repo.storageQuota.total)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {repo.url && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" asChild>
                                <a href={repo.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open repository</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => handleStartArchiveJob(repo.id)}
                        disabled={!repo.isConnected || isProcessing || isReadOnly || !canArchive}
                      >
                        <CloudUpload className="mr-2 h-4 w-4" />
                        Archive
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Persistent Identifiers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Persistent Identifiers
          </CardTitle>
          <CardDescription>
            Reserve and manage DOIs and other permanent identifiers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {archiveRecord.persistentIdentifiers.length === 0 ? (
            <div className="text-center py-4">
              <Link2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                No identifiers assigned yet.
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleReserveIdentifier('doi')}
                  disabled={isProcessing || isReadOnly}
                >
                  Reserve DOI
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReserveIdentifier('ark')}
                  disabled={isProcessing || isReadOnly}
                >
                  Reserve ARK
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archiveRecord.persistentIdentifiers.map(id => (
                  <TableRow key={id.value}>
                    <TableCell>
                      <Badge variant="outline">{id.type.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{id.value}</TableCell>
                    <TableCell>
                      <Badge variant={id.status === 'registered' ? 'default' : 'secondary'}>
                        {id.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy identifier</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {id.url && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" asChild>
                                  <a href={id.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open in browser</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Repository Dialog */}
      <Dialog open={isAddingRepository} onOpenChange={setIsAddingRepository}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Archive Repository</DialogTitle>
            <DialogDescription>
              Select a repository type to connect for archiving your research data.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {(Object.keys(REPOSITORY_CONFIG) as ArchiveRepositoryType[]).map(type => {
              const config = REPOSITORY_CONFIG[type];
              const Icon = config.icon;
              const isSelected = selectedRepositoryType === type;

              return (
                <div
                  key={type}
                  className={cn(
                    'p-4 border rounded-lg cursor-pointer transition-colors',
                    isSelected && 'border-primary bg-primary/5',
                    !isSelected && 'hover:bg-muted/50'
                  )}
                  onClick={() => setSelectedRepositoryType(type)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingRepository(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleConnectRepository(selectedRepositoryType)}>
              Connect Repository
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Metadata Tab Content
  const renderMetadataTab = () => (
    <div className="space-y-6">
      {/* Preservation Metadata Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Preservation Metadata
              </CardTitle>
              <CardDescription>
                Describe your research data for discoverability and citation
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleEnrichMetadata}
                disabled={isProcessing || isReadOnly}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI Enrich
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                disabled={isReadOnly}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                {isEditingMetadata ? 'Done' : 'Edit'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={archiveRecord.metadata.title}
                onChange={(e) => updateMetadata({ title: e.target.value })}
                disabled={!isEditingMetadata || isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={archiveRecord.metadata.language}
                onValueChange={(value) => updateMetadata({ language: value })}
                disabled={!isEditingMetadata || isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={archiveRecord.metadata.description}
              onChange={(e) => updateMetadata({ description: e.target.value })}
              disabled={!isEditingMetadata || isReadOnly}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Creators (one per line)</Label>
            <Textarea
              value={archiveRecord.metadata.creators.join('\n')}
              onChange={(e) => updateMetadata({ creators: e.target.value.split('\n').filter(Boolean) })}
              disabled={!isEditingMetadata || isReadOnly}
              rows={3}
              placeholder="John Doe&#10;Jane Smith"
            />
          </div>

          <div className="space-y-2">
            <Label>Keywords (comma-separated)</Label>
            <Input
              value={archiveRecord.metadata.keywords.join(', ')}
              onChange={(e) => updateMetadata({ keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })}
              disabled={!isEditingMetadata || isReadOnly}
              placeholder="machine learning, healthcare, clinical trials"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>License</Label>
              <Select
                value={archiveRecord.metadata.license}
                onValueChange={(value) => updateMetadata({ license: value })}
                disabled={!isEditingMetadata || isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC-BY-4.0">CC BY 4.0</SelectItem>
                  <SelectItem value="CC-BY-SA-4.0">CC BY-SA 4.0</SelectItem>
                  <SelectItem value="CC-BY-NC-4.0">CC BY-NC 4.0</SelectItem>
                  <SelectItem value="CC0-1.0">CC0 1.0 (Public Domain)</SelectItem>
                  <SelectItem value="MIT">MIT License</SelectItem>
                  <SelectItem value="Apache-2.0">Apache 2.0</SelectItem>
                  <SelectItem value="custom">Custom License</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rights Statement</Label>
              <Input
                value={archiveRecord.metadata.rights}
                onChange={(e) => updateMetadata({ rights: e.target.value })}
                disabled={!isEditingMetadata || isReadOnly}
                placeholder="Additional rights information"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Enrichment Suggestions */}
      {archiveRecord.metadataEnrichment.suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Suggestions
            </CardTitle>
            <CardDescription>
              Review and accept AI-generated metadata enhancements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {archiveRecord.metadataEnrichment.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={cn(
                    'p-3 border rounded-lg',
                    suggestion.accepted && 'bg-green-50 dark:bg-green-950 border-green-200'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="outline" className="mb-1">{suggestion.field}</Badge>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Suggested: </span>
                        <span className="font-medium">
                          {Array.isArray(suggestion.suggestedValue)
                            ? suggestion.suggestedValue.join(', ')
                            : suggestion.suggestedValue}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Source: {suggestion.source} ({Math.round(suggestion.confidence * 100)}% confidence)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {suggestion.accepted ? (
                        <Badge variant="default">
                          <Check className="h-3 w-3 mr-1" />
                          Accepted
                        </Badge>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = [...archiveRecord.metadataEnrichment.suggestions];
                              updated[index] = { ...updated[index], accepted: true };
                              updateArchiveRecord({
                                metadataEnrichment: {
                                  ...archiveRecord.metadataEnrichment,
                                  suggestions: updated,
                                },
                                metadata: {
                                  ...archiveRecord.metadata,
                                  [suggestion.field]: suggestion.suggestedValue,
                                },
                              });
                            }}
                            disabled={isReadOnly}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = archiveRecord.metadataEnrichment.suggestions.filter(
                                (_, i) => i !== index
                              );
                              updateArchiveRecord({
                                metadataEnrichment: {
                                  ...archiveRecord.metadataEnrichment,
                                  suggestions: updated,
                                },
                              });
                            }}
                            disabled={isReadOnly}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Integrity Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                File Integrity
              </CardTitle>
              <CardDescription>
                Verify file checksums and validate archive contents
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={handleValidateIntegrity}
              disabled={isProcessing || isReadOnly}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Validate All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {archiveRecord.fileIntegrity.length === 0 ? (
            <div className="text-center py-4">
              <FileCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No files have been validated yet.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <Progress value={stats.integrityPercent} className="flex-1" />
                <span className="text-sm font-medium">
                  {stats.validFiles} / {stats.totalFiles} files valid
                </span>
              </div>
              <ScrollArea className="h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Checksum</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archiveRecord.fileIntegrity.map(file => (
                      <TableRow key={file.id}>
                        <TableCell className="font-mono text-sm">{file.fileName}</TableCell>
                        <TableCell>{formatBytes(file.fileSize)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {file.checksums.sha256?.substring(0, 16)}...
                        </TableCell>
                        <TableCell>
                          {file.isValid ? (
                            <Badge variant="default" className="bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Invalid
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Status Tab Content
  const renderStatusTab = () => (
    <div className="space-y-6">
      {/* Active Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5" />
            Archive Jobs
          </CardTitle>
          <CardDescription>
            Track the progress of your archive operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {archiveRecord.jobs.length === 0 ? (
            <div className="text-center py-8">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No archive jobs yet. Connect a repository and start archiving.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {archiveRecord.jobs.map(job => {
                const statusConfig = JOB_STATUS_CONFIG[job.status];
                const StatusIcon = statusConfig.icon;
                const isActive = ['pending', 'preparing', 'uploading', 'verifying'].includes(job.status);

                return (
                  <div key={job.id} className="border rounded-lg overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge className={cn(statusConfig.color)}>
                            <StatusIcon className={cn(
                              'h-3 w-3 mr-1',
                              isActive && 'animate-spin'
                            )} />
                            {statusConfig.label}
                          </Badge>
                          <span className="font-medium">{job.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelJob(job.id)}
                              disabled={isReadOnly}
                            >
                              <Pause className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          )}
                          {job.archiveUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={job.archiveUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                View Archive
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground mb-2">
                        Repository: {job.repositoryName}
                      </div>

                      {isActive && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>
                              {job.processedFiles} / {job.totalFiles} files
                              ({formatBytes(job.processedSize)} / {formatBytes(job.totalSize)})
                            </span>
                            {job.estimatedTimeRemaining && (
                              <span className="text-muted-foreground">
                                ~{formatDuration(job.estimatedTimeRemaining)} remaining
                              </span>
                            )}
                          </div>
                          <Progress value={job.progress} className="h-2" />
                        </div>
                      )}

                      {job.status === 'completed' && job.persistentIdentifier && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded">
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-mono">
                            {job.persistentIdentifier.type.toUpperCase()}: {job.persistentIdentifier.value}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {job.status === 'failed' && job.errorMessage && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{job.errorMessage}</AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* Job Logs */}
                    {job.logs.length > 0 && (
                      <Collapsible
                        open={jobLogsExpanded[job.id]}
                        onOpenChange={() => toggleJobLogs(job.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between rounded-none border-t"
                          >
                            <span className="text-sm">View Logs ({job.logs.length})</span>
                            {jobLogsExpanded[job.id] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ScrollArea className="h-40 bg-muted/50 p-2">
                            <div className="space-y-1 font-mono text-xs">
                              {job.logs.map(log => (
                                <div
                                  key={log.id}
                                  className={cn(
                                    'flex gap-2',
                                    log.level === 'error' && 'text-red-600',
                                    log.level === 'warning' && 'text-yellow-600'
                                  )}
                                >
                                  <span className="text-muted-foreground">
                                    [{log.timestamp.toLocaleTimeString()}]
                                  </span>
                                  <span className="uppercase w-12">[{log.level}]</span>
                                  <span>{log.message}</span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Archive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <Database className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.connectedRepos}</p>
              <p className="text-sm text-muted-foreground">Repositories</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">{stats.completedJobs}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <CloudUpload className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold">{stats.activeJobs}</p>
              <p className="text-sm text-muted-foreground">Active Jobs</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <Link2 className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold">{archiveRecord.persistentIdentifiers.length}</p>
              <p className="text-sm text-muted-foreground">Identifiers</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ==================== Main Render ====================

  return (
    <div className={cn('space-y-6', className)}>
      {/* Governance Warning */}
      {governanceMode === 'LIVE' && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>LIVE Mode Archiving</AlertTitle>
          <AlertDescription>
            You are archiving in LIVE mode. All archives will be permanently stored and require PHI compliance verification.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="repositories" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Repositories
          </TabsTrigger>
          <TabsTrigger value="metadata" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Metadata
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="mt-6">
          {renderConfigurationTab()}
        </TabsContent>

        <TabsContent value="repositories" className="mt-6">
          {renderRepositoriesTab()}
        </TabsContent>

        <TabsContent value="metadata" className="mt-6">
          {renderMetadataTab()}
        </TabsContent>

        <TabsContent value="status" className="mt-6">
          {renderStatusTab()}
        </TabsContent>
      </Tabs>

      {/* Complete Stage Action */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium">Archive Status</p>
            <p className="text-sm text-muted-foreground">
              {stats.completedJobs > 0
                ? `${stats.completedJobs} archive(s) completed successfully`
                : 'No archives completed yet'}
            </p>
          </div>
          <Button
            onClick={handleComplete}
            disabled={!canArchive || stats.completedJobs === 0 || isReadOnly}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Complete Archiving Stage
          </Button>
        </CardContent>
      </Card>

      {!canArchive && governanceMode === 'LIVE' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Archive Blocked</AlertTitle>
          <AlertDescription>
            {!archiveRecord.repositories.some(r => r.isConnected) && 'No repository connected. '}
            {archiveRecord.phiRedaction.status !== 'clean' && archiveRecord.phiRedaction.status !== 'redacted' && 'PHI scan must pass. '}
            {stats.integrityPercent < 100 && stats.totalFiles > 0 && 'File integrity validation incomplete.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default Stage17Archiving;

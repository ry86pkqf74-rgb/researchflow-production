/**
 * Stage 15 - Artifact Bundling
 * Bundle all research artifacts for preservation and sharing
 * Features: Artifact selection tree, manifest editor with Dublin Core fields,
 * bundle structure preview, PHI scan integration, bundle format options,
 * AI-assisted metadata description generation, export/download functionality
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Package,
  FileText,
  Code,
  Image,
  BarChart3,
  Folder,
  FolderOpen,
  File,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCcw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Eye,
  Sparkles,
  Archive,
  FileArchive,
  BookOpen,
  Database,
  Settings,
  Info,
  Search,
  Filter,
  Clock,
  User,
  Calendar,
  Globe,
  Tag,
  Link2,
  Copy,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Layers,
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
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ModelTierSelect, type ModelTier } from '@/components/ai';

// ==================== Types ====================

export type ArtifactCategory =
  | 'data'
  | 'code'
  | 'documentation'
  | 'visualization'
  | 'supplementary';

export type BundleFormat = 'zip' | 'tar.gz' | 'research-compendium';

export type PhiScanStatus = 'pending' | 'scanning' | 'clean' | 'detected' | 'error';

export type ArtifactStatus = 'included' | 'excluded' | 'partial';

export interface Artifact {
  id: string;
  name: string;
  path: string;
  category: ArtifactCategory;
  size: number;
  mimeType: string;
  createdAt: Date;
  modifiedAt: Date;
  phiStatus: PhiScanStatus;
  selected: boolean;
  children?: Artifact[];
  metadata?: Record<string, string>;
}

export interface DublinCoreMetadata {
  title: string;
  creator: string[];
  subject: string[];
  description: string;
  publisher: string;
  contributor: string[];
  date: string;
  type: string;
  format: string;
  identifier: string;
  source: string;
  language: string;
  relation: string[];
  coverage: string;
  rights: string;
}

export interface BundleManifest {
  id: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  dublinCore: DublinCoreMetadata;
  artifacts: Array<{
    id: string;
    path: string;
    checksum: string;
    size: number;
    category: ArtifactCategory;
  }>;
  phiScanResults: {
    status: PhiScanStatus;
    scannedAt?: Date;
    detectedItems: number;
  };
  customMetadata: Record<string, string>;
}

export interface BundleConfiguration {
  format: BundleFormat;
  includeManifest: boolean;
  includeReadme: boolean;
  includeChecksums: boolean;
  compressionLevel: 'none' | 'fast' | 'balanced' | 'maximum';
  preserveDirectoryStructure: boolean;
  excludePhiDetected: boolean;
}

export interface BundlePreview {
  totalSize: number;
  fileCount: number;
  structure: PreviewNode[];
}

export interface PreviewNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: PreviewNode[];
}

export interface StageComponentProps {
  topicId: string;
  researchId: string;
  stageData?: ArtifactBundlingState;
  onComplete?: (data: ArtifactBundlingState) => void;
  onSave?: (data: ArtifactBundlingState) => void;
  isReadOnly?: boolean;
}

export interface ArtifactBundlingState {
  artifacts: Artifact[];
  manifest: BundleManifest;
  configuration: BundleConfiguration;
  modelTier: ModelTier;
}

interface Stage15Props extends StageComponentProps {
  onRunPhiScan?: () => Promise<void>;
  onGenerateMetadata?: (artifactIds: string[], prompt: string) => Promise<Partial<DublinCoreMetadata>>;
  onExportBundle?: (config: BundleConfiguration) => Promise<void>;
  isScanning?: boolean;
  isExporting?: boolean;
  className?: string;
}

// ==================== Configuration ====================

const ARTIFACT_CATEGORIES: Record<
  ArtifactCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  data: { label: 'Data Files', icon: Database, color: 'bg-blue-100 text-blue-700' },
  code: { label: 'Code/Scripts', icon: Code, color: 'bg-green-100 text-green-700' },
  documentation: { label: 'Documentation', icon: FileText, color: 'bg-purple-100 text-purple-700' },
  visualization: { label: 'Visualizations', icon: BarChart3, color: 'bg-orange-100 text-orange-700' },
  supplementary: { label: 'Supplementary', icon: Layers, color: 'bg-gray-100 text-gray-700' },
};

const BUNDLE_FORMATS: Record<
  BundleFormat,
  { label: string; description: string; extension: string }
> = {
  zip: {
    label: 'ZIP Archive',
    description: 'Standard compressed archive format, widely compatible',
    extension: '.zip',
  },
  'tar.gz': {
    label: 'TAR.GZ Archive',
    description: 'Unix-style compressed archive, preserves permissions',
    extension: '.tar.gz',
  },
  'research-compendium': {
    label: 'Research Compendium',
    description: 'Structured format following research compendium standards',
    extension: '.rc.zip',
  },
};

const PHI_SCAN_STATUS_CONFIG: Record<
  PhiScanStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: 'Not Scanned', color: 'bg-gray-100 text-gray-700', icon: Shield },
  scanning: { label: 'Scanning...', color: 'bg-blue-100 text-blue-700', icon: RefreshCcw },
  clean: { label: 'PHI Clean', color: 'bg-green-100 text-green-700', icon: ShieldCheck },
  detected: { label: 'PHI Detected', color: 'bg-red-100 text-red-700', icon: ShieldAlert },
  error: { label: 'Scan Error', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
};

const DUBLIN_CORE_FIELDS: Array<{
  key: keyof DublinCoreMetadata;
  label: string;
  description: string;
  type: 'text' | 'textarea' | 'array' | 'date';
  required?: boolean;
}> = [
  { key: 'title', label: 'Title', description: 'Name of the resource', type: 'text', required: true },
  { key: 'creator', label: 'Creator', description: 'Entities primarily responsible for creating the resource', type: 'array', required: true },
  { key: 'subject', label: 'Subject', description: 'Topics or keywords describing the resource', type: 'array' },
  { key: 'description', label: 'Description', description: 'Summary or abstract of the resource', type: 'textarea', required: true },
  { key: 'publisher', label: 'Publisher', description: 'Entity responsible for making the resource available', type: 'text' },
  { key: 'contributor', label: 'Contributor', description: 'Entities contributing to the resource', type: 'array' },
  { key: 'date', label: 'Date', description: 'Date associated with the resource', type: 'date', required: true },
  { key: 'type', label: 'Type', description: 'Nature or genre of the resource', type: 'text' },
  { key: 'format', label: 'Format', description: 'File format or physical medium', type: 'text' },
  { key: 'identifier', label: 'Identifier', description: 'Unique identifier (DOI, URL, etc.)', type: 'text' },
  { key: 'source', label: 'Source', description: 'Related resource from which this is derived', type: 'text' },
  { key: 'language', label: 'Language', description: 'Language of the resource', type: 'text' },
  { key: 'relation', label: 'Relation', description: 'Related resources', type: 'array' },
  { key: 'coverage', label: 'Coverage', description: 'Spatial or temporal scope', type: 'text' },
  { key: 'rights', label: 'Rights', description: 'Information about rights held in the resource', type: 'textarea' },
];

// ==================== Default Values ====================

const DEFAULT_DUBLIN_CORE: DublinCoreMetadata = {
  title: '',
  creator: [],
  subject: [],
  description: '',
  publisher: '',
  contributor: [],
  date: new Date().toISOString().split('T')[0],
  type: 'Dataset',
  format: 'application/zip',
  identifier: '',
  source: '',
  language: 'en',
  relation: [],
  coverage: '',
  rights: '',
};

const DEFAULT_CONFIGURATION: BundleConfiguration = {
  format: 'zip',
  includeManifest: true,
  includeReadme: true,
  includeChecksums: true,
  compressionLevel: 'balanced',
  preserveDirectoryStructure: true,
  excludePhiDetected: true,
};

// ==================== Main Component ====================

export function Stage15ArtifactBundling({
  topicId,
  researchId,
  stageData,
  onComplete,
  onSave,
  isReadOnly = false,
  onRunPhiScan,
  onGenerateMetadata,
  onExportBundle,
  isScanning = false,
  isExporting = false,
  className,
}: Stage15Props) {
  // Initialize state from stageData or defaults
  const [artifacts, setArtifacts] = useState<Artifact[]>(stageData?.artifacts || []);
  const [manifest, setManifest] = useState<BundleManifest>(
    stageData?.manifest || {
      id: crypto.randomUUID(),
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      dublinCore: DEFAULT_DUBLIN_CORE,
      artifacts: [],
      phiScanResults: {
        status: 'pending',
        detectedItems: 0,
      },
      customMetadata: {},
    }
  );
  const [configuration, setConfiguration] = useState<BundleConfiguration>(
    stageData?.configuration || DEFAULT_CONFIGURATION
  );
  const [modelTier, setModelTier] = useState<ModelTier>(stageData?.modelTier || 'standard');

  const [selectedTab, setSelectedTab] = useState('artifacts');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ArtifactCategory | 'all'>('all');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Calculate statistics
  const stats = useMemo(() => {
    const selectedArtifacts = artifacts.filter((a) => a.selected);
    const flattenArtifacts = (items: Artifact[]): Artifact[] => {
      return items.reduce<Artifact[]>((acc, item) => {
        acc.push(item);
        if (item.children) {
          acc.push(...flattenArtifacts(item.children));
        }
        return acc;
      }, []);
    };

    const allArtifacts = flattenArtifacts(artifacts);
    const allSelected = flattenArtifacts(selectedArtifacts);

    const totalSize = allSelected.reduce((sum, a) => sum + a.size, 0);
    const phiClean = allSelected.filter((a) => a.phiStatus === 'clean').length;
    const phiDetected = allSelected.filter((a) => a.phiStatus === 'detected').length;
    const phiPending = allSelected.filter((a) => a.phiStatus === 'pending').length;

    const byCategory: Record<ArtifactCategory, number> = {
      data: 0,
      code: 0,
      documentation: 0,
      visualization: 0,
      supplementary: 0,
    };
    allSelected.forEach((a) => {
      byCategory[a.category]++;
    });

    return {
      total: allArtifacts.length,
      selected: allSelected.length,
      totalSize,
      phiClean,
      phiDetected,
      phiPending,
      byCategory,
    };
  }, [artifacts]);

  // Filter artifacts based on search and category
  const filteredArtifacts = useMemo(() => {
    const filterFn = (items: Artifact[]): Artifact[] => {
      return items
        .map((item) => {
          const matchesSearch =
            !searchQuery ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.path.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

          if (item.children) {
            const filteredChildren = filterFn(item.children);
            if (filteredChildren.length > 0 || (matchesSearch && matchesCategory)) {
              return { ...item, children: filteredChildren };
            }
          }

          if (matchesSearch && matchesCategory) {
            return item;
          }

          return null;
        })
        .filter(Boolean) as Artifact[];
    };

    return filterFn(artifacts);
  }, [artifacts, searchQuery, categoryFilter]);

  // Generate bundle preview
  const bundlePreview = useMemo((): BundlePreview => {
    const buildStructure = (items: Artifact[]): PreviewNode[] => {
      return items
        .filter((item) => item.selected)
        .map((item) => ({
          name: item.name,
          type: item.children ? ('directory' as const) : ('file' as const),
          size: item.size,
          children: item.children ? buildStructure(item.children) : undefined,
        }));
    };

    const structure: PreviewNode[] = [];

    // Add manifest if configured
    if (configuration.includeManifest) {
      structure.push({ name: 'manifest.json', type: 'file', size: 2048 });
    }

    // Add README if configured
    if (configuration.includeReadme) {
      structure.push({ name: 'README.md', type: 'file', size: 1024 });
    }

    // Add checksums if configured
    if (configuration.includeChecksums) {
      structure.push({ name: 'checksums.sha256', type: 'file', size: 512 });
    }

    // Add artifacts by category if preserving structure
    if (configuration.preserveDirectoryStructure) {
      Object.entries(ARTIFACT_CATEGORIES).forEach(([category, config]) => {
        const categoryArtifacts = artifacts.filter(
          (a) => a.selected && a.category === category
        );
        if (categoryArtifacts.length > 0) {
          structure.push({
            name: category,
            type: 'directory',
            children: buildStructure(categoryArtifacts),
          });
        }
      });
    } else {
      structure.push(...buildStructure(artifacts.filter((a) => a.selected)));
    }

    return {
      totalSize: stats.totalSize + (configuration.includeManifest ? 2048 : 0) + (configuration.includeReadme ? 1024 : 0),
      fileCount: stats.selected + (configuration.includeManifest ? 1 : 0) + (configuration.includeReadme ? 1 : 0),
      structure,
    };
  }, [artifacts, configuration, stats]);

  // Toggle artifact selection
  const toggleArtifactSelection = useCallback(
    (artifactId: string, selected?: boolean) => {
      if (isReadOnly) return;

      const updateSelection = (items: Artifact[]): Artifact[] => {
        return items.map((item) => {
          if (item.id === artifactId) {
            const newSelected = selected !== undefined ? selected : !item.selected;
            return {
              ...item,
              selected: newSelected,
              children: item.children
                ? item.children.map((child) => ({ ...child, selected: newSelected }))
                : undefined,
            };
          }
          if (item.children) {
            return { ...item, children: updateSelection(item.children) };
          }
          return item;
        });
      };

      setArtifacts(updateSelection(artifacts));
    },
    [artifacts, isReadOnly]
  );

  // Select/deselect all in category
  const toggleCategorySelection = useCallback(
    (category: ArtifactCategory, selected: boolean) => {
      if (isReadOnly) return;

      const updateSelection = (items: Artifact[]): Artifact[] => {
        return items.map((item) => {
          if (item.category === category) {
            return {
              ...item,
              selected,
              children: item.children
                ? item.children.map((child) => ({ ...child, selected }))
                : undefined,
            };
          }
          if (item.children) {
            return { ...item, children: updateSelection(item.children) };
          }
          return item;
        });
      };

      setArtifacts(updateSelection(artifacts));
    },
    [artifacts, isReadOnly]
  );

  // Toggle folder expansion
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Update Dublin Core metadata
  const updateDublinCore = useCallback(
    (field: keyof DublinCoreMetadata, value: string | string[]) => {
      if (isReadOnly) return;

      setManifest((prev) => ({
        ...prev,
        updatedAt: new Date(),
        dublinCore: {
          ...prev.dublinCore,
          [field]: value,
        },
      }));
    },
    [isReadOnly]
  );

  // Update custom metadata
  const updateCustomMetadata = useCallback(
    (key: string, value: string) => {
      if (isReadOnly) return;

      setManifest((prev) => ({
        ...prev,
        updatedAt: new Date(),
        customMetadata: {
          ...prev.customMetadata,
          [key]: value,
        },
      }));
    },
    [isReadOnly]
  );

  // Remove custom metadata field
  const removeCustomMetadata = useCallback(
    (key: string) => {
      if (isReadOnly) return;

      setManifest((prev) => {
        const { [key]: _, ...rest } = prev.customMetadata;
        return {
          ...prev,
          updatedAt: new Date(),
          customMetadata: rest,
        };
      });
    },
    [isReadOnly]
  );

  // Generate metadata with AI
  const handleGenerateMetadata = useCallback(async () => {
    if (!onGenerateMetadata || !aiPrompt.trim()) return;

    setIsGeneratingMetadata(true);
    try {
      const selectedIds = artifacts.filter((a) => a.selected).map((a) => a.id);
      const generatedMetadata = await onGenerateMetadata(selectedIds, aiPrompt);

      setManifest((prev) => ({
        ...prev,
        updatedAt: new Date(),
        dublinCore: {
          ...prev.dublinCore,
          ...generatedMetadata,
        },
      }));
      setAiPrompt('');
    } finally {
      setIsGeneratingMetadata(false);
    }
  }, [onGenerateMetadata, aiPrompt, artifacts]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!onExportBundle) return;
    await onExportBundle(configuration);
    setShowExportDialog(false);
  }, [onExportBundle, configuration]);

  // Save current state
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave({
        artifacts,
        manifest,
        configuration,
        modelTier,
      });
    }
  }, [onSave, artifacts, manifest, configuration, modelTier]);

  // Complete stage
  const handleComplete = useCallback(() => {
    if (onComplete) {
      onComplete({
        artifacts,
        manifest,
        configuration,
        modelTier,
      });
    }
  }, [onComplete, artifacts, manifest, configuration, modelTier]);

  const phiStatusConfig = PHI_SCAN_STATUS_CONFIG[manifest.phiScanResults.status];
  const PhiStatusIcon = phiStatusConfig.icon;

  const canExport = stats.selected > 0 && (manifest.phiScanResults.status === 'clean' || stats.phiPending === 0);

  return (
    <div className={cn('space-y-6', className)}>
      {/* PHI Warning */}
      {manifest.phiScanResults.status === 'detected' && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>PHI Detected in Selected Artifacts</AlertTitle>
          <AlertDescription>
            {manifest.phiScanResults.detectedItems} artifact(s) contain potential PHI.
            {configuration.excludePhiDetected
              ? ' These will be automatically excluded from the bundle.'
              : ' Please review and remove sensitive information before bundling.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Artifact Bundle
                  <Badge variant="outline" className="text-xs">
                    v{manifest.version}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Bundle research artifacts for preservation and sharing
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* PHI Scan Status */}
              <Badge className={cn('gap-1', phiStatusConfig.color)}>
                <PhiStatusIcon
                  className={cn('h-3 w-3', manifest.phiScanResults.status === 'scanning' && 'animate-spin')}
                />
                {phiStatusConfig.label}
              </Badge>

              {/* Model Tier */}
              <div className="w-32">
                <ModelTierSelect
                  value={modelTier}
                  onChange={setModelTier}
                  requirePhiCompliant
                  disabled={isReadOnly}
                />
              </div>

              {/* Actions */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={onRunPhiScan}
                      disabled={isScanning || isReadOnly}
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Run PHI Scan</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button variant="outline" onClick={handleSave} disabled={isReadOnly}>
                Save Draft
              </Button>

              <Button
                onClick={() => setShowExportDialog(true)}
                disabled={!canExport || isExporting || isReadOnly}
              >
                {isExporting ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Bundle
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Statistics */}
        <CardContent className="pt-0">
          <div className="grid grid-cols-6 gap-4">
            <StatCard label="Total Artifacts" value={stats.total} />
            <StatCard label="Selected" value={stats.selected} color="text-primary" />
            <StatCard
              label="Bundle Size"
              value={formatBytes(stats.totalSize)}
            />
            <StatCard label="PHI Clean" value={stats.phiClean} color="text-green-600" />
            <StatCard label="PHI Detected" value={stats.phiDetected} color="text-red-600" />
            <StatCard label="Not Scanned" value={stats.phiPending} color="text-gray-600" />
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="artifacts">
            <Folder className="mr-2 h-4 w-4" />
            Artifacts
          </TabsTrigger>
          <TabsTrigger value="manifest">
            <FileText className="mr-2 h-4 w-4" />
            Manifest
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Artifacts Tab */}
        <TabsContent value="artifacts" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Category Sidebar */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant={categoryFilter === 'all' ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setCategoryFilter('all')}
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    All Categories
                    <Badge variant="secondary" className="ml-auto">
                      {stats.total}
                    </Badge>
                  </Button>
                  {Object.entries(ARTIFACT_CATEGORIES).map(([key, config]) => {
                    const category = key as ArtifactCategory;
                    const Icon = config.icon;
                    const count = stats.byCategory[category];
                    return (
                      <Button
                        key={category}
                        variant={categoryFilter === category ? 'default' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => setCategoryFilter(category)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {config.label}
                        <Badge variant="secondary" className="ml-auto">
                          {count}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quick Actions</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const updateAll = (items: Artifact[], selected: boolean): Artifact[] =>
                        items.map((item) => ({
                          ...item,
                          selected,
                          children: item.children ? updateAll(item.children, selected) : undefined,
                        }));
                      setArtifacts(updateAll(artifacts, true));
                    }}
                    disabled={isReadOnly}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const updateAll = (items: Artifact[], selected: boolean): Artifact[] =>
                        items.map((item) => ({
                          ...item,
                          selected,
                          children: item.children ? updateAll(item.children, selected) : undefined,
                        }));
                      setArtifacts(updateAll(artifacts, false));
                    }}
                    disabled={isReadOnly}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Deselect All
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Artifact Tree */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Artifact Selection</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search artifacts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {filteredArtifacts.length > 0 ? (
                    <div className="space-y-1">
                      {filteredArtifacts.map((artifact) => (
                        <ArtifactTreeItem
                          key={artifact.id}
                          artifact={artifact}
                          depth={0}
                          expanded={expandedFolders}
                          onToggleExpand={toggleFolder}
                          onToggleSelect={toggleArtifactSelection}
                          isReadOnly={isReadOnly}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No artifacts found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {searchQuery
                          ? 'Try adjusting your search query'
                          : 'Add artifacts from previous stages'}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Manifest Tab */}
        <TabsContent value="manifest" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dublin Core Fields */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Dublin Core Metadata</CardTitle>
                    <CardDescription>
                      Standard metadata fields for resource description
                    </CardDescription>
                  </div>
                  {onGenerateMetadata && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            AI-Assisted
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          AI can help generate metadata descriptions
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {DUBLIN_CORE_FIELDS.map((field) => (
                      <DublinCoreField
                        key={field.key}
                        field={field}
                        value={manifest.dublinCore[field.key]}
                        onChange={(value) => updateDublinCore(field.key, value)}
                        disabled={isReadOnly}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* AI Generation & Custom Metadata */}
            <div className="space-y-6">
              {/* AI Metadata Generation */}
              {onGenerateMetadata && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Metadata Assistant
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe the research context, methodology, or specific metadata needs..."
                        rows={4}
                        disabled={isReadOnly || isGeneratingMetadata}
                      />
                      <Button
                        onClick={handleGenerateMetadata}
                        disabled={!aiPrompt.trim() || isGeneratingMetadata || isReadOnly}
                        className="w-full"
                      >
                        {isGeneratingMetadata ? (
                          <>
                            <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Metadata
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        AI will analyze selected artifacts and generate appropriate metadata
                        descriptions.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Custom Metadata */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Custom Metadata</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateCustomMetadata(`custom_${Date.now()}`, '')}
                      disabled={isReadOnly}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {Object.keys(manifest.customMetadata).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(manifest.customMetadata).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <Input
                            value={key}
                            onChange={(e) => {
                              const newKey = e.target.value;
                              removeCustomMetadata(key);
                              updateCustomMetadata(newKey, value);
                            }}
                            placeholder="Field name"
                            className="w-1/3"
                            disabled={isReadOnly}
                          />
                          <Input
                            value={value}
                            onChange={(e) => updateCustomMetadata(key, e.target.value)}
                            placeholder="Value"
                            className="flex-1"
                            disabled={isReadOnly}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeCustomMetadata(key)}
                            disabled={isReadOnly}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No custom metadata fields added
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Bundle Configuration */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Bundle Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Bundle Format</Label>
                      <Select
                        value={configuration.format}
                        onValueChange={(v) =>
                          setConfiguration({ ...configuration, format: v as BundleFormat })
                        }
                        disabled={isReadOnly}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(BUNDLE_FORMATS).map(([key, format]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex flex-col">
                                <span>{format.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Include Manifest</Label>
                        <Switch
                          checked={configuration.includeManifest}
                          onCheckedChange={(v) =>
                            setConfiguration({ ...configuration, includeManifest: v })
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Include README</Label>
                        <Switch
                          checked={configuration.includeReadme}
                          onCheckedChange={(v) =>
                            setConfiguration({ ...configuration, includeReadme: v })
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Include Checksums</Label>
                        <Switch
                          checked={configuration.includeChecksums}
                          onCheckedChange={(v) =>
                            setConfiguration({ ...configuration, includeChecksums: v })
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Preserve Directory Structure</Label>
                        <Switch
                          checked={configuration.preserveDirectoryStructure}
                          onCheckedChange={(v) =>
                            setConfiguration({ ...configuration, preserveDirectoryStructure: v })
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Exclude PHI-Detected Files</Label>
                        <Switch
                          checked={configuration.excludePhiDetected}
                          onCheckedChange={(v) =>
                            setConfiguration({ ...configuration, excludePhiDetected: v })
                          }
                          disabled={isReadOnly}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bundle Structure */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bundle Structure</CardTitle>
                <CardDescription>
                  Preview of the final bundle contents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="font-mono text-sm">
                    <PreviewTree
                      nodes={bundlePreview.structure}
                      bundleName={`${manifest.dublinCore.title || 'research-bundle'}${BUNDLE_FORMATS[configuration.format].extension}`}
                    />
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <div className="flex items-center justify-between w-full text-sm">
                  <span className="text-muted-foreground">
                    {bundlePreview.fileCount} files
                  </span>
                  <span className="font-medium">{formatBytes(bundlePreview.totalSize)}</span>
                </div>
              </CardFooter>
            </Card>

            {/* Manifest Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Manifest Preview</CardTitle>
                    <CardDescription>manifest.json content</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const json = JSON.stringify(manifest, null, 2);
                      navigator.clipboard.writeText(json);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                    {JSON.stringify(
                      {
                        ...manifest,
                        artifacts: artifacts
                          .filter((a) => a.selected)
                          .map((a) => ({
                            id: a.id,
                            path: a.path,
                            checksum: 'sha256:...',
                            size: a.size,
                            category: a.category,
                          })),
                      },
                      null,
                      2
                    )}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        configuration={configuration}
        bundlePreview={bundlePreview}
        manifest={manifest}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  );
}

// ==================== Sub-Components ====================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="text-center p-3 bg-muted/50 rounded-lg">
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

interface ArtifactTreeItemProps {
  artifact: Artifact;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleSelect: (id: string, selected?: boolean) => void;
  isReadOnly: boolean;
}

function ArtifactTreeItem({
  artifact,
  depth,
  expanded,
  onToggleExpand,
  onToggleSelect,
  isReadOnly,
}: ArtifactTreeItemProps) {
  const hasChildren = artifact.children && artifact.children.length > 0;
  const isExpanded = expanded.has(artifact.id);
  const categoryConfig = ARTIFACT_CATEGORIES[artifact.category];
  const CategoryIcon = categoryConfig.icon;
  const phiConfig = PHI_SCAN_STATUS_CONFIG[artifact.phiStatus];
  const PhiIcon = phiConfig.icon;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer',
          artifact.selected && 'bg-primary/5'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onToggleExpand(artifact.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6" />
        )}

        <Checkbox
          checked={artifact.selected}
          onCheckedChange={(checked) => onToggleSelect(artifact.id, !!checked)}
          disabled={isReadOnly}
        />

        {hasChildren ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 text-muted-foreground" />
          )
        ) : (
          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
        )}

        <span className="flex-1 text-sm truncate">{artifact.name}</span>

        <Badge variant="outline" className={cn('text-xs', categoryConfig.color)}>
          {categoryConfig.label}
        </Badge>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className={cn('text-xs gap-1', phiConfig.color)}>
                <PhiIcon className="h-3 w-3" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{phiConfig.label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <span className="text-xs text-muted-foreground w-20 text-right">
          {formatBytes(artifact.size)}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {artifact.children!.map((child) => (
            <ArtifactTreeItem
              key={child.id}
              artifact={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DublinCoreFieldProps {
  field: {
    key: keyof DublinCoreMetadata;
    label: string;
    description: string;
    type: 'text' | 'textarea' | 'array' | 'date';
    required?: boolean;
  };
  value: string | string[];
  onChange: (value: string | string[]) => void;
  disabled: boolean;
}

function DublinCoreField({ field, value, onChange, disabled }: DublinCoreFieldProps) {
  const [arrayInput, setArrayInput] = useState('');

  const handleAddArrayItem = () => {
    if (!arrayInput.trim()) return;
    const currentArray = Array.isArray(value) ? value : [];
    onChange([...currentArray, arrayInput.trim()]);
    setArrayInput('');
  };

  const handleRemoveArrayItem = (index: number) => {
    if (!Array.isArray(value)) return;
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{field.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {field.type === 'text' && (
        <Input
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description}
          disabled={disabled}
        />
      )}

      {field.type === 'textarea' && (
        <Textarea
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description}
          rows={3}
          disabled={disabled}
        />
      )}

      {field.type === 'date' && (
        <Input
          type="date"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {field.type === 'array' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={arrayInput}
              onChange={(e) => setArrayInput(e.target.value)}
              placeholder={`Add ${field.label.toLowerCase()}...`}
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddArrayItem();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleAddArrayItem}
              disabled={disabled || !arrayInput.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {Array.isArray(value) && value.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {value.map((item, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {item}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PreviewTreeProps {
  nodes: PreviewNode[];
  bundleName: string;
}

function PreviewTree({ nodes, bundleName }: PreviewTreeProps) {
  const renderNode = (node: PreviewNode, prefix: string, isLast: boolean): React.ReactNode => {
    const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 ';
    const nextPrefix = prefix + (isLast ? '    ' : '\u2502   ');

    return (
      <div key={node.name}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="whitespace-pre">{prefix + connector}</span>
          {node.type === 'directory' ? (
            <FolderOpen className="h-4 w-4 text-primary" />
          ) : (
            <File className="h-4 w-4" />
          )}
          <span className={node.type === 'directory' ? 'text-primary font-medium' : ''}>
            {node.name}
          </span>
          {node.size !== undefined && (
            <span className="text-xs text-muted-foreground">({formatBytes(node.size)})</span>
          )}
        </div>
        {node.children?.map((child, index) =>
          renderNode(child, nextPrefix, index === node.children!.length - 1)
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 font-medium">
        <FileArchive className="h-4 w-4 text-primary" />
        {bundleName}
      </div>
      {nodes.map((node, index) => renderNode(node, '', index === nodes.length - 1))}
    </div>
  );
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuration: BundleConfiguration;
  bundlePreview: BundlePreview;
  manifest: BundleManifest;
  onExport: () => void;
  isExporting: boolean;
}

function ExportDialog({
  open,
  onOpenChange,
  configuration,
  bundlePreview,
  manifest,
  onExport,
  isExporting,
}: ExportDialogProps) {
  const formatConfig = BUNDLE_FORMATS[configuration.format];
  const phiConfig = PHI_SCAN_STATUS_CONFIG[manifest.phiScanResults.status];
  const canExport = manifest.phiScanResults.status === 'clean';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Artifact Bundle</DialogTitle>
          <DialogDescription>
            Review bundle details before exporting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* PHI Status Warning */}
          {manifest.phiScanResults.status !== 'clean' && (
            <Alert variant={manifest.phiScanResults.status === 'detected' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {manifest.phiScanResults.status === 'detected'
                  ? 'PHI Detected'
                  : 'PHI Scan Required'}
              </AlertTitle>
              <AlertDescription>
                {manifest.phiScanResults.status === 'detected'
                  ? 'Please review and remove PHI before exporting.'
                  : 'Run a PHI scan to ensure compliance before exporting.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Bundle Summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Format</span>
                  <Badge variant="outline">{formatConfig.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Files</span>
                  <span className="font-medium">{bundlePreview.fileCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Size</span>
                  <span className="font-medium">{formatBytes(bundlePreview.totalSize)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">PHI Status</span>
                  <Badge className={cn('gap-1', phiConfig.color)}>
                    {phiConfig.label}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Included Components */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Included Components</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-sm">
                {configuration.includeManifest ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                Manifest
              </div>
              <div className="flex items-center gap-2 text-sm">
                {configuration.includeReadme ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                README
              </div>
              <div className="flex items-center gap-2 text-sm">
                {configuration.includeChecksums ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                Checksums
              </div>
              <div className="flex items-center gap-2 text-sm">
                {configuration.preserveDirectoryStructure ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                Directory Structure
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onExport} disabled={isExporting || !canExport}>
            {isExporting ? (
              <>
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Bundle
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Utilities ====================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default Stage15ArtifactBundling;

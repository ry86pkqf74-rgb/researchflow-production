/**
 * Stage 12 - Documentation
 * Generate reports and documentation
 * Features: Report template selector, section editor with WYSIWYG markdown support,
 * AI-assisted content generation, table of contents auto-generation,
 * citation management integration, PHI scan status, export to Markdown and PDF
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  RefreshCcw,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Eye,
  EyeOff,
  Sparkles,
  BookOpen,
  List,
  Link2,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Copy,
  ExternalLink,
  Save,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Quote,
  ListOrdered,
  ListTodo,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Table2,
  Minus,
  FileDown,
  Settings,
  Search,
  Filter,
  SortAsc,
  MoreVertical,
  Bookmark,
  BookmarkCheck,
  FolderOpen,
  FilePlus,
  FileCheck,
  AlertCircle,
  Info,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export type ReportTemplateType =
  | 'research_report'
  | 'protocol'
  | 'methods'
  | 'findings_summary'
  | 'technical_documentation'
  | 'custom';

export type SectionStatus = 'draft' | 'in_review' | 'approved' | 'needs_revision';

export type PhiScanStatus = 'pending' | 'scanning' | 'clean' | 'detected' | 'error';

export type ExportFormat = 'markdown' | 'pdf';

export interface Citation {
  id: string;
  key: string;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  type: 'article' | 'book' | 'conference' | 'website' | 'other';
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  level: 1 | 2 | 3;
  order: number;
  status: SectionStatus;
  citationKeys: string[];
  isCollapsed: boolean;
  lastEditedAt: Date;
  aiGenerated: boolean;
  wordCount: number;
}

export interface TableOfContentsItem {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  order: number;
}

export interface DocumentPhiScan {
  status: PhiScanStatus;
  lastScannedAt?: Date;
  detectedItems: Array<{
    sectionId: string;
    text: string;
    type: string;
    startIndex: number;
    endIndex: number;
  }>;
  scanDuration?: number;
}

export interface ReportTemplate {
  id: ReportTemplateType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultSections: Array<{
    title: string;
    level: 1 | 2 | 3;
    placeholder: string;
  }>;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  description?: string;
  templateType: ReportTemplateType;
  createdAt: Date;
  updatedAt: Date;
  version: string;
  author: string;
  collaborators: string[];
  tags: string[];
}

export interface ExportOptions {
  format: ExportFormat;
  includeTableOfContents: boolean;
  includeCitations: boolean;
  includeMetadata: boolean;
  pageNumbers: boolean;
  headerFooter: boolean;
  customCss?: string;
}

interface Stage12Props {
  document: DocumentMetadata;
  sections: DocumentSection[];
  citations: Citation[];
  phiScan: DocumentPhiScan;
  modelTier: ModelTier;
  onDocumentChange: (document: DocumentMetadata) => void;
  onSectionsChange: (sections: DocumentSection[]) => void;
  onCitationsChange: (citations: Citation[]) => void;
  onModelTierChange: (tier: ModelTier) => void;
  onGenerateSectionContent?: (
    sectionId: string,
    prompt: string
  ) => Promise<string>;
  onRunPhiScan?: () => Promise<DocumentPhiScan>;
  onExport?: (options: ExportOptions) => Promise<void>;
  onSaveDraft?: () => Promise<void>;
  isGenerating?: boolean;
  isExporting?: boolean;
  className?: string;
}

// ==================== Template Configuration ====================

const REPORT_TEMPLATES: Record<ReportTemplateType, ReportTemplate> = {
  research_report: {
    id: 'research_report',
    name: 'Research Report',
    description: 'Comprehensive research report with all standard sections',
    icon: FileText,
    defaultSections: [
      { title: 'Abstract', level: 1, placeholder: 'Provide a brief summary of the research...' },
      { title: 'Introduction', level: 1, placeholder: 'Introduce the research context and objectives...' },
      { title: 'Background', level: 2, placeholder: 'Provide relevant background information...' },
      { title: 'Methods', level: 1, placeholder: 'Describe the research methodology...' },
      { title: 'Results', level: 1, placeholder: 'Present the research findings...' },
      { title: 'Discussion', level: 1, placeholder: 'Discuss the implications of the results...' },
      { title: 'Conclusion', level: 1, placeholder: 'Summarize the key conclusions...' },
      { title: 'References', level: 1, placeholder: 'List all cited references...' },
    ],
  },
  protocol: {
    id: 'protocol',
    name: 'Research Protocol',
    description: 'Detailed protocol document for research procedures',
    icon: BookOpen,
    defaultSections: [
      { title: 'Protocol Overview', level: 1, placeholder: 'Provide an overview of the protocol...' },
      { title: 'Objectives', level: 1, placeholder: 'List the primary and secondary objectives...' },
      { title: 'Study Design', level: 1, placeholder: 'Describe the study design...' },
      { title: 'Participants', level: 1, placeholder: 'Define participant criteria...' },
      { title: 'Procedures', level: 1, placeholder: 'Detail the procedures step by step...' },
      { title: 'Data Collection', level: 1, placeholder: 'Describe data collection methods...' },
      { title: 'Analysis Plan', level: 1, placeholder: 'Outline the analysis plan...' },
      { title: 'Safety Considerations', level: 1, placeholder: 'Address safety measures...' },
    ],
  },
  methods: {
    id: 'methods',
    name: 'Methods Document',
    description: 'Detailed methods and procedures documentation',
    icon: List,
    defaultSections: [
      { title: 'Overview', level: 1, placeholder: 'Provide a methods overview...' },
      { title: 'Materials', level: 1, placeholder: 'List all materials used...' },
      { title: 'Equipment', level: 1, placeholder: 'Describe equipment specifications...' },
      { title: 'Procedures', level: 1, placeholder: 'Detail each procedure step...' },
      { title: 'Quality Control', level: 1, placeholder: 'Describe quality control measures...' },
      { title: 'Troubleshooting', level: 1, placeholder: 'Address common issues and solutions...' },
    ],
  },
  findings_summary: {
    id: 'findings_summary',
    name: 'Findings Summary',
    description: 'Executive summary of research findings',
    icon: FileCheck,
    defaultSections: [
      { title: 'Executive Summary', level: 1, placeholder: 'Provide a high-level summary...' },
      { title: 'Key Findings', level: 1, placeholder: 'List the most important findings...' },
      { title: 'Implications', level: 1, placeholder: 'Discuss practical implications...' },
      { title: 'Recommendations', level: 1, placeholder: 'Provide actionable recommendations...' },
      { title: 'Next Steps', level: 1, placeholder: 'Outline suggested next steps...' },
    ],
  },
  technical_documentation: {
    id: 'technical_documentation',
    name: 'Technical Documentation',
    description: 'Technical specifications and implementation details',
    icon: Code,
    defaultSections: [
      { title: 'Overview', level: 1, placeholder: 'Provide a technical overview...' },
      { title: 'Architecture', level: 1, placeholder: 'Describe the system architecture...' },
      { title: 'Data Specifications', level: 1, placeholder: 'Define data formats and schemas...' },
      { title: 'Implementation', level: 1, placeholder: 'Detail implementation specifics...' },
      { title: 'API Reference', level: 1, placeholder: 'Document API endpoints...' },
      { title: 'Deployment', level: 1, placeholder: 'Describe deployment procedures...' },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom Document',
    description: 'Start from scratch with custom sections',
    icon: FilePlus,
    defaultSections: [
      { title: 'Introduction', level: 1, placeholder: 'Begin writing your document...' },
    ],
  },
};

const SECTION_STATUS_CONFIG: Record<
  SectionStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit3 },
  in_review: { label: 'In Review', color: 'bg-blue-100 text-blue-700', icon: Eye },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: Check },
  needs_revision: { label: 'Needs Revision', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
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

// ==================== Main Component ====================

export function Stage12Documentation({
  document,
  sections,
  citations,
  phiScan,
  modelTier,
  onDocumentChange,
  onSectionsChange,
  onCitationsChange,
  onModelTierChange,
  onGenerateSectionContent,
  onRunPhiScan,
  onExport,
  onSaveDraft,
  isGenerating = false,
  isExporting = false,
  className,
}: Stage12Props) {
  const [selectedTab, setSelectedTab] = useState('editor');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    sections[0]?.id || null
  );
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showCitationDialog, setShowCitationDialog] = useState(false);
  const [editingCitationId, setEditingCitationId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'markdown',
    includeTableOfContents: true,
    includeCitations: true,
    includeMetadata: true,
    pageNumbers: true,
    headerFooter: true,
  });

  const selectedSection = sections.find((s) => s.id === selectedSectionId);

  // Generate table of contents
  const tableOfContents: TableOfContentsItem[] = useMemo(() => {
    return sections
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        id: section.id,
        title: section.title,
        level: section.level,
        order: section.order,
      }));
  }, [sections]);

  // Calculate document statistics
  const documentStats = useMemo(() => {
    const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0);
    const totalSections = sections.length;
    const approvedSections = sections.filter((s) => s.status === 'approved').length;
    const draftSections = sections.filter((s) => s.status === 'draft').length;
    const citationCount = citations.length;
    const avgWordsPerSection = totalSections > 0 ? Math.round(totalWords / totalSections) : 0;

    return {
      totalWords,
      totalSections,
      approvedSections,
      draftSections,
      citationCount,
      avgWordsPerSection,
      completionPercent: totalSections > 0 ? Math.round((approvedSections / totalSections) * 100) : 0,
    };
  }, [sections, citations]);

  // Add new section
  const addSection = useCallback(
    (afterSectionId?: string) => {
      const newOrder = afterSectionId
        ? (sections.find((s) => s.id === afterSectionId)?.order || 0) + 0.5
        : sections.length;

      const newSection: DocumentSection = {
        id: crypto.randomUUID(),
        title: 'New Section',
        content: '',
        level: 1,
        order: newOrder,
        status: 'draft',
        citationKeys: [],
        isCollapsed: false,
        lastEditedAt: new Date(),
        aiGenerated: false,
        wordCount: 0,
      };

      // Reorder sections
      const updatedSections = [...sections, newSection]
        .sort((a, b) => a.order - b.order)
        .map((s, i) => ({ ...s, order: i }));

      onSectionsChange(updatedSections);
      setSelectedSectionId(newSection.id);
    },
    [sections, onSectionsChange]
  );

  // Update section
  const updateSection = useCallback(
    (sectionId: string, updates: Partial<DocumentSection>) => {
      const updatedSections = sections.map((s) => {
        if (s.id === sectionId) {
          const updated = { ...s, ...updates, lastEditedAt: new Date() };
          // Update word count if content changed
          if (updates.content !== undefined) {
            updated.wordCount = updates.content.trim().split(/\s+/).filter(Boolean).length;
          }
          return updated;
        }
        return s;
      });
      onSectionsChange(updatedSections);
    },
    [sections, onSectionsChange]
  );

  // Delete section
  const deleteSection = useCallback(
    (sectionId: string) => {
      const updatedSections = sections
        .filter((s) => s.id !== sectionId)
        .map((s, i) => ({ ...s, order: i }));
      onSectionsChange(updatedSections);
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(updatedSections[0]?.id || null);
      }
    },
    [sections, onSectionsChange, selectedSectionId]
  );

  // Move section
  const moveSection = useCallback(
    (sectionId: string, direction: 'up' | 'down') => {
      const index = sections.findIndex((s) => s.id === sectionId);
      if (index === -1) return;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sections.length) return;

      const updatedSections = [...sections];
      [updatedSections[index], updatedSections[newIndex]] = [
        updatedSections[newIndex],
        updatedSections[index],
      ];

      onSectionsChange(updatedSections.map((s, i) => ({ ...s, order: i })));
    },
    [sections, onSectionsChange]
  );

  // Generate content with AI
  const handleGenerateContent = useCallback(
    async (sectionId: string) => {
      if (!onGenerateSectionContent || !aiPrompt.trim()) return;

      setGeneratingSectionId(sectionId);
      try {
        const content = await onGenerateSectionContent(sectionId, aiPrompt);
        updateSection(sectionId, { content, aiGenerated: true });
        setAiPrompt('');
      } finally {
        setGeneratingSectionId(null);
      }
    },
    [onGenerateSectionContent, aiPrompt, updateSection]
  );

  // Apply template
  const applyTemplate = useCallback(
    (templateId: ReportTemplateType) => {
      const template = REPORT_TEMPLATES[templateId];
      const newSections: DocumentSection[] = template.defaultSections.map((s, i) => ({
        id: crypto.randomUUID(),
        title: s.title,
        content: '',
        level: s.level,
        order: i,
        status: 'draft',
        citationKeys: [],
        isCollapsed: false,
        lastEditedAt: new Date(),
        aiGenerated: false,
        wordCount: 0,
      }));

      onSectionsChange(newSections);
      onDocumentChange({ ...document, templateType: templateId });
      setShowTemplateDialog(false);
      setSelectedSectionId(newSections[0]?.id || null);
    },
    [document, onDocumentChange, onSectionsChange]
  );

  // Handle export
  const handleExport = useCallback(async () => {
    if (!onExport) return;
    await onExport(exportOptions);
    setShowExportDialog(false);
  }, [onExport, exportOptions]);

  // Add citation
  const addCitation = useCallback(
    (citation: Omit<Citation, 'id'>) => {
      const newCitation: Citation = {
        ...citation,
        id: crypto.randomUUID(),
      };
      onCitationsChange([...citations, newCitation]);
      setShowCitationDialog(false);
    },
    [citations, onCitationsChange]
  );

  // Update citation
  const updateCitation = useCallback(
    (citationId: string, updates: Partial<Citation>) => {
      onCitationsChange(
        citations.map((c) => (c.id === citationId ? { ...c, ...updates } : c))
      );
    },
    [citations, onCitationsChange]
  );

  // Delete citation
  const deleteCitation = useCallback(
    (citationId: string) => {
      onCitationsChange(citations.filter((c) => c.id !== citationId));
    },
    [citations, onCitationsChange]
  );

  // Insert citation into section
  const insertCitation = useCallback(
    (sectionId: string, citationKey: string) => {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;

      const updatedCitationKeys = section.citationKeys.includes(citationKey)
        ? section.citationKeys
        : [...section.citationKeys, citationKey];

      updateSection(sectionId, {
        content: section.content + ` [@${citationKey}]`,
        citationKeys: updatedCitationKeys,
      });
    },
    [sections, updateSection]
  );

  const phiStatusConfig = PHI_SCAN_STATUS_CONFIG[phiScan.status];
  const PhiStatusIcon = phiStatusConfig.icon;

  return (
    <div className={cn('space-y-6', className)}>
      {/* PHI Warning */}
      {phiScan.status === 'detected' && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>PHI Detected in Document</AlertTitle>
          <AlertDescription>
            {phiScan.detectedItems.length} potential PHI item(s) were detected in your document.
            Please review and remove or redact sensitive information before exporting.
          </AlertDescription>
        </Alert>
      )}

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {document.title || 'Untitled Document'}
                  <Badge variant="outline" className="text-xs">
                    v{document.version}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {REPORT_TEMPLATES[document.templateType].name} - Last updated{' '}
                  {document.updatedAt.toLocaleDateString()}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* PHI Scan Status */}
              <Badge className={cn('gap-1', phiStatusConfig.color)}>
                <PhiStatusIcon
                  className={cn('h-3 w-3', phiScan.status === 'scanning' && 'animate-spin')}
                />
                {phiStatusConfig.label}
              </Badge>

              {/* Model Tier */}
              <div className="w-32">
                <ModelTierSelect
                  value={modelTier}
                  onChange={onModelTierChange}
                  requirePhiCompliant
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
                      disabled={phiScan.status === 'scanning'}
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Run PHI Scan</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Templates
              </Button>

              <Button variant="outline" onClick={onSaveDraft}>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>

              <Button onClick={() => setShowExportDialog(true)} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Document Statistics */}
        <CardContent className="pt-0">
          <div className="grid grid-cols-6 gap-4">
            <StatCard label="Total Words" value={documentStats.totalWords.toLocaleString()} />
            <StatCard label="Sections" value={documentStats.totalSections} />
            <StatCard
              label="Approved"
              value={documentStats.approvedSections}
              color="text-green-600"
            />
            <StatCard label="Drafts" value={documentStats.draftSections} color="text-gray-600" />
            <StatCard label="Citations" value={documentStats.citationCount} />
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-lg font-bold">{documentStats.completionPercent}%</p>
              <p className="text-xs text-muted-foreground">Complete</p>
              <Progress value={documentStats.completionPercent} className="h-1 mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="editor">
            <Edit3 className="mr-2 h-4 w-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="toc">
            <List className="mr-2 h-4 w-4" />
            Table of Contents
          </TabsTrigger>
          <TabsTrigger value="citations">
            <BookOpen className="mr-2 h-4 w-4" />
            Citations ({citations.length})
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Section List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Sections</CardTitle>
                  <Button size="sm" onClick={() => addSection()}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {sections
                      .sort((a, b) => a.order - b.order)
                      .map((section, index) => (
                        <SectionListItem
                          key={section.id}
                          section={section}
                          isSelected={selectedSectionId === section.id}
                          onSelect={() => setSelectedSectionId(section.id)}
                          onMoveUp={() => moveSection(section.id, 'up')}
                          onMoveDown={() => moveSection(section.id, 'down')}
                          onDelete={() => deleteSection(section.id)}
                          canMoveUp={index > 0}
                          canMoveDown={index < sections.length - 1}
                        />
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Section Editor */}
            <Card className="lg:col-span-2">
              {selectedSection ? (
                <>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Input
                          value={selectedSection.title}
                          onChange={(e) =>
                            updateSection(selectedSection.id, { title: e.target.value })
                          }
                          className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0"
                          placeholder="Section Title"
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <Select
                            value={String(selectedSection.level)}
                            onValueChange={(v) =>
                              updateSection(selectedSection.id, {
                                level: Number(v) as 1 | 2 | 3,
                              })
                            }
                          >
                            <SelectTrigger className="w-24 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">H1</SelectItem>
                              <SelectItem value="2">H2</SelectItem>
                              <SelectItem value="3">H3</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={selectedSection.status}
                            onValueChange={(v) =>
                              updateSection(selectedSection.id, {
                                status: v as SectionStatus,
                              })
                            }
                          >
                            <SelectTrigger className="w-32 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="in_review">In Review</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="needs_revision">Needs Revision</SelectItem>
                            </SelectContent>
                          </Select>
                          <Badge variant="outline" className="text-xs">
                            {selectedSection.wordCount} words
                          </Badge>
                          {selectedSection.aiGenerated && (
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Generated
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Toolbar */}
                    <EditorToolbar
                      onInsertCitation={() =>
                        citations.length > 0 && setShowCitationDialog(true)
                      }
                    />

                    {/* Content Editor */}
                    <Textarea
                      value={selectedSection.content}
                      onChange={(e) =>
                        updateSection(selectedSection.id, { content: e.target.value })
                      }
                      placeholder="Start writing your section content here... You can use Markdown formatting."
                      className="min-h-[300px] font-mono text-sm mt-2"
                    />

                    {/* AI Generation */}
                    {onGenerateSectionContent && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          AI Content Generation
                        </Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Describe what content you want to generate..."
                            disabled={generatingSectionId === selectedSection.id}
                          />
                          <Button
                            onClick={() => handleGenerateContent(selectedSection.id)}
                            disabled={
                              !aiPrompt.trim() ||
                              generatingSectionId === selectedSection.id
                            }
                          >
                            {generatingSectionId === selectedSection.id ? (
                              <>
                                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          AI will generate content based on your prompt and append it to
                          the current section.
                        </p>
                      </div>
                    )}

                    {/* Section Citations */}
                    {selectedSection.citationKeys.length > 0 && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium">Section Citations</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedSection.citationKeys.map((key) => {
                            const citation = citations.find((c) => c.key === key);
                            return (
                              <Badge key={key} variant="outline" className="text-xs">
                                [{key}] {citation?.title?.slice(0, 30)}...
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a section to edit</p>
                  <Button variant="outline" className="mt-4" onClick={() => addSection()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Section
                  </Button>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Table of Contents Tab */}
        <TabsContent value="toc" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Table of Contents</CardTitle>
              <CardDescription>
                Auto-generated from document sections. Drag to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1">
                  {tableOfContents.map((item, index) => (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer',
                        item.level === 2 && 'pl-6',
                        item.level === 3 && 'pl-10'
                      )}
                      onClick={() => {
                        setSelectedSectionId(item.id);
                        setSelectedTab('editor');
                      }}
                    >
                      <span className="text-muted-foreground font-mono text-sm">
                        {index + 1}.
                      </span>
                      <span
                        className={cn(
                          item.level === 1 && 'font-semibold',
                          item.level === 2 && 'font-medium',
                          item.level === 3 && 'text-sm text-muted-foreground'
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Citations Tab */}
        <TabsContent value="citations" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Citations</CardTitle>
                  <CardDescription>
                    Manage references and citations for your document
                  </CardDescription>
                </div>
                <Button onClick={() => setShowCitationDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Citation
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {citations.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {citations.map((citation) => (
                      <CitationCard
                        key={citation.id}
                        citation={citation}
                        onEdit={() => setEditingCitationId(citation.id)}
                        onDelete={() => deleteCitation(citation.id)}
                        onInsert={
                          selectedSectionId
                            ? () => insertCitation(selectedSectionId, citation.key)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No citations added yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowCitationDialog(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Citation
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Document Preview</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Markdown Preview</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <h1>{document.title}</h1>
                  {document.description && <p className="lead">{document.description}</p>}

                  {/* Render TOC */}
                  <div className="not-prose p-4 bg-muted/50 rounded-lg mb-6">
                    <h3 className="font-semibold mb-2">Table of Contents</h3>
                    <ul className="space-y-1 text-sm">
                      {tableOfContents.map((item, index) => (
                        <li
                          key={item.id}
                          className={cn(
                            item.level === 2 && 'ml-4',
                            item.level === 3 && 'ml-8'
                          )}
                        >
                          {index + 1}. {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Render sections */}
                  {sections
                    .sort((a, b) => a.order - b.order)
                    .map((section) => (
                      <div key={section.id} className="mb-6">
                        {section.level === 1 && <h2>{section.title}</h2>}
                        {section.level === 2 && <h3>{section.title}</h3>}
                        {section.level === 3 && <h4>{section.title}</h4>}
                        <div className="whitespace-pre-wrap">
                          {section.content || (
                            <span className="text-muted-foreground italic">
                              No content yet...
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                  {/* Render references */}
                  {citations.length > 0 && (
                    <div className="mt-8 pt-8 border-t">
                      <h2>References</h2>
                      <ol className="space-y-2">
                        {citations.map((citation, index) => (
                          <li key={citation.id} className="text-sm">
                            <span className="font-medium">[{citation.key}]</span>{' '}
                            {citation.authors.join(', ')} ({citation.year}).{' '}
                            <em>{citation.title}</em>.
                            {citation.journal && ` ${citation.journal}.`}
                            {citation.doi && (
                              <span className="ml-1 text-primary">
                                doi:{citation.doi}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <TemplateDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onSelectTemplate={applyTemplate}
        currentTemplate={document.templateType}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        options={exportOptions}
        onOptionsChange={setExportOptions}
        onExport={handleExport}
        isExporting={isExporting}
        phiStatus={phiScan.status}
      />

      {/* Citation Dialog */}
      <CitationDialog
        open={showCitationDialog}
        onOpenChange={setShowCitationDialog}
        onSave={addCitation}
        citations={citations}
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

function SectionListItem({
  section,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  section: DocumentSection;
  isSelected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const statusConfig = SECTION_STATUS_CONFIG[section.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
        isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
        section.level === 2 && 'pl-4',
        section.level === 3 && 'pl-6'
      )}
      onClick={onSelect}
    >
      <GripVertical className="h-4 w-4 opacity-50" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{section.title}</p>
        <div className="flex items-center gap-2 text-xs opacity-70">
          <Badge
            variant="outline"
            className={cn('text-xs px-1 py-0', !isSelected && statusConfig.color)}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
          <span>{section.wordCount} words</span>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onMoveUp} disabled={!canMoveUp}>
            <ChevronUp className="mr-2 h-4 w-4" />
            Move Up
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMoveDown} disabled={!canMoveDown}>
            <ChevronDown className="mr-2 h-4 w-4" />
            Move Down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EditorToolbar({ onInsertCitation }: { onInsertCitation: () => void }) {
  return (
    <div className="flex items-center gap-1 p-1 border rounded-md bg-muted/50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bold</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Italic className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Italic</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Code className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Code</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Heading1 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 1</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Heading2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Heading 2</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ListOrdered className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ordered List</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Quote className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Quote</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Link2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert Link</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Image className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert Image</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Table2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert Table</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onInsertCitation}>
              <BookOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert Citation</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function CitationCard({
  citation,
  onEdit,
  onDelete,
  onInsert,
}: {
  citation: Citation;
  onEdit: () => void;
  onDelete: () => void;
  onInsert?: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-start gap-3">
          <Badge variant="outline" className="font-mono">
            [{citation.key}]
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{citation.title}</p>
            <p className="text-xs text-muted-foreground">
              {citation.authors.join(', ')} ({citation.year})
            </p>
            {citation.journal && (
              <p className="text-xs text-muted-foreground italic">{citation.journal}</p>
            )}
            {citation.doi && (
              <a
                href={`https://doi.org/${citation.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                doi:{citation.doi}
              </a>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onInsert && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onInsert}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Insert into section</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Dialogs ====================

function TemplateDialog({
  open,
  onOpenChange,
  onSelectTemplate,
  currentTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: ReportTemplateType) => void;
  currentTemplate: ReportTemplateType;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select Report Template</DialogTitle>
          <DialogDescription>
            Choose a template to structure your document. This will replace all current sections.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          {Object.values(REPORT_TEMPLATES).map((template) => {
            const Icon = template.icon;
            const isSelected = currentTemplate === template.id;

            return (
              <Card
                key={template.id}
                className={cn(
                  'cursor-pointer transition-all',
                  isSelected && 'border-primary ring-2 ring-primary/20',
                  !isSelected && 'hover:border-primary/50'
                )}
                onClick={() => onSelectTemplate(template.id)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{template.name}</h4>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {template.defaultSections.length} sections
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExportDialog({
  open,
  onOpenChange,
  options,
  onOptionsChange,
  onExport,
  isExporting,
  phiStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ExportOptions;
  onOptionsChange: (options: ExportOptions) => void;
  onExport: () => void;
  isExporting: boolean;
  phiStatus: PhiScanStatus;
}) {
  const canExport = phiStatus === 'clean' || phiStatus === 'pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Document</DialogTitle>
          <DialogDescription>Choose export format and options</DialogDescription>
        </DialogHeader>

        {phiStatus === 'detected' && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>PHI Detected</AlertTitle>
            <AlertDescription>
              Cannot export document with detected PHI. Please review and remove sensitive
              information before exporting.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select
              value={options.format}
              onValueChange={(v) =>
                onOptionsChange({ ...options, format: v as ExportFormat })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Markdown (.md)
                  </span>
                </SelectItem>
                <SelectItem value="pdf">
                  <span className="flex items-center gap-2">
                    <FileDown className="h-4 w-4" />
                    PDF (.pdf)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Options</Label>
            <div className="flex items-center justify-between">
              <span className="text-sm">Include Table of Contents</span>
              <Switch
                checked={options.includeTableOfContents}
                onCheckedChange={(v) =>
                  onOptionsChange({ ...options, includeTableOfContents: v })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Include Citations/References</span>
              <Switch
                checked={options.includeCitations}
                onCheckedChange={(v) =>
                  onOptionsChange({ ...options, includeCitations: v })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Include Document Metadata</span>
              <Switch
                checked={options.includeMetadata}
                onCheckedChange={(v) =>
                  onOptionsChange({ ...options, includeMetadata: v })
                }
              />
            </div>
            {options.format === 'pdf' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Page Numbers</span>
                  <Switch
                    checked={options.pageNumbers}
                    onCheckedChange={(v) =>
                      onOptionsChange({ ...options, pageNumbers: v })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Header/Footer</span>
                  <Switch
                    checked={options.headerFooter}
                    onCheckedChange={(v) =>
                      onOptionsChange({ ...options, headerFooter: v })
                    }
                  />
                </div>
              </>
            )}
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
                Export {options.format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CitationDialog({
  open,
  onOpenChange,
  onSave,
  citations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (citation: Omit<Citation, 'id'>) => void;
  citations: Citation[];
}) {
  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [journal, setJournal] = useState('');
  const [doi, setDoi] = useState('');
  const [type, setType] = useState<Citation['type']>('article');

  const handleSubmit = () => {
    if (!key.trim() || !title.trim()) return;

    onSave({
      key: key.trim(),
      title: title.trim(),
      authors: authors.split(',').map((a) => a.trim()).filter(Boolean),
      year,
      journal: journal.trim() || undefined,
      doi: doi.trim() || undefined,
      type,
    });

    // Reset form
    setKey('');
    setTitle('');
    setAuthors('');
    setYear(new Date().getFullYear());
    setJournal('');
    setDoi('');
    setType('article');
  };

  const keyExists = citations.some((c) => c.key === key.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Citation</DialogTitle>
          <DialogDescription>Add a new reference to your document</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Citation Key *</Label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="e.g., smith2024"
              />
              {keyExists && (
                <p className="text-xs text-destructive">This key already exists</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as Citation['type'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">Journal Article</SelectItem>
                  <SelectItem value="book">Book</SelectItem>
                  <SelectItem value="conference">Conference Paper</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Full title of the work"
            />
          </div>

          <div className="space-y-2">
            <Label>Authors</Label>
            <Input
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="Comma-separated: Smith J, Doe A"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={1900}
                max={2100}
              />
            </div>
            <div className="space-y-2">
              <Label>Journal/Publisher</Label>
              <Input
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                placeholder="Journal name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>DOI</Label>
            <Input
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="10.1000/example"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!key.trim() || !title.trim() || keyExists}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Citation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Stage12Documentation;

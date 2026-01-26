/**
 * Stage 19 - Dissemination
 * Share findings through publications and presentations
 * Features: Journal submission tracker, presentation builder, press release generator,
 * social media content generator, conference/event calendar, target audience selector,
 * PHI review for public-facing materials, AI assistance for audience adaptation,
 * multi-channel publishing workflow
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Share2,
  FileText,
  Presentation,
  Newspaper,
  Twitter,
  Linkedin,
  Globe,
  Calendar,
  Users,
  Target,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  Download,
  Upload,
  Send,
  Eye,
  Copy,
  ExternalLink,
  Sparkles,
  MessageSquare,
  BarChart3,
  BookOpen,
  GraduationCap,
  Stethoscope,
  Building2,
  Mic,
  Video,
  Image,
  FileImage,
  Settings,
  Filter,
  Search,
  MoreVertical,
  ArrowRight,
  Play,
  Pause,
  LayoutTemplate,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { StageLayout } from './StageLayout';
import { ModelTierSelect, type ModelTier } from '@/components/ai';

// ==================== Types ====================

export type PublicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revision_requested'
  | 'revision_submitted'
  | 'accepted'
  | 'published'
  | 'rejected';

export type TargetAudience = 'academic' | 'clinical' | 'public' | 'policy' | 'industry';

export type PresentationType = 'oral' | 'poster' | 'workshop' | 'keynote' | 'webinar';

export type MediaMaterialType = 'press_release' | 'plain_summary' | 'infographic' | 'social_media' | 'blog_post';

export type SocialPlatform = 'twitter' | 'linkedin' | 'facebook' | 'mastodon' | 'bluesky';

export type PhiReviewStatus = 'pending' | 'scanning' | 'passed' | 'failed' | 'needs_review';

export type DisseminationEventType = 'conference' | 'seminar' | 'webinar' | 'meeting' | 'publication_deadline';

export interface JournalSubmission {
  id: string;
  journalName: string;
  journalImpactFactor?: number;
  manuscriptTitle: string;
  manuscriptId?: string;
  status: PublicationStatus;
  targetAudience: TargetAudience;
  submittedDate?: Date;
  lastUpdatedDate: Date;
  expectedResponseDate?: Date;
  decisionDate?: Date;
  publicationDate?: Date;
  revisionNumber: number;
  reviewerComments?: string;
  authorResponse?: string;
  attachments: string[];
  phiReviewStatus: PhiReviewStatus;
  notes?: string;
}

export interface SlideTemplate {
  id: string;
  name: string;
  description: string;
  layout: 'title' | 'content' | 'two_column' | 'image_focus' | 'data_chart' | 'quote' | 'conclusion';
  placeholders: string[];
}

export interface PresentationSlide {
  id: string;
  templateId: string;
  title: string;
  content: string;
  speakerNotes?: string;
  imageUrl?: string;
  chartData?: Record<string, unknown>;
  order: number;
}

export interface PresentationMaterial {
  id: string;
  title: string;
  type: PresentationType;
  targetAudience: TargetAudience;
  eventName?: string;
  eventDate?: Date;
  duration?: number; // in minutes
  slides: PresentationSlide[];
  phiReviewStatus: PhiReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  exportUrl?: string;
}

export interface MediaMaterial {
  id: string;
  type: MediaMaterialType;
  title: string;
  content: string;
  targetAudience: TargetAudience;
  plainLanguageScore?: number; // readability score
  characterCount?: number;
  wordCount?: number;
  phiReviewStatus: PhiReviewStatus;
  platforms?: SocialPlatform[];
  scheduledDate?: Date;
  publishedDate?: Date;
  status: 'draft' | 'scheduled' | 'published';
  engagementMetrics?: {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DisseminationEvent {
  id: string;
  name: string;
  type: DisseminationEventType;
  date: Date;
  endDate?: Date;
  location?: string;
  isVirtual: boolean;
  deadlineDate?: Date;
  submissionStatus?: 'not_submitted' | 'submitted' | 'accepted' | 'rejected';
  relatedMaterialIds: string[];
  notes?: string;
  url?: string;
}

export interface PhiScanResult {
  status: PhiReviewStatus;
  scannedAt?: Date;
  scannedBy?: string;
  findings: Array<{
    id: string;
    text: string;
    type: string;
    location: string;
    redacted: boolean;
  }>;
}

export interface StageComponentProps {
  topicId: string;
  researchId: string;
  stageData?: DisseminationState;
  onComplete?: () => void;
  onSave?: (data: DisseminationState) => void;
  isReadOnly?: boolean;
}

export interface DisseminationState {
  publications: JournalSubmission[];
  presentations: PresentationMaterial[];
  mediaMaterials: MediaMaterial[];
  events: DisseminationEvent[];
  modelTier: ModelTier;
}

// ==================== Configuration ====================

const PUBLICATION_STATUS_CONFIG: Record<PublicationStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit3 },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: Send },
  under_review: { label: 'Under Review', color: 'bg-purple-100 text-purple-700', icon: Eye },
  revision_requested: { label: 'Revision Requested', color: 'bg-orange-100 text-orange-700', icon: RefreshCcw },
  revision_submitted: { label: 'Revision Submitted', color: 'bg-cyan-100 text-cyan-700', icon: Send },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  published: { label: 'Published', color: 'bg-emerald-100 text-emerald-700', icon: Globe },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const AUDIENCE_CONFIG: Record<TargetAudience, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  academic: {
    label: 'Academic',
    description: 'Researchers and academic institutions',
    icon: GraduationCap,
    color: 'bg-indigo-100 text-indigo-700',
  },
  clinical: {
    label: 'Clinical',
    description: 'Healthcare professionals and clinicians',
    icon: Stethoscope,
    color: 'bg-teal-100 text-teal-700',
  },
  public: {
    label: 'Public',
    description: 'General public and media',
    icon: Users,
    color: 'bg-amber-100 text-amber-700',
  },
  policy: {
    label: 'Policy',
    description: 'Policymakers and government agencies',
    icon: Building2,
    color: 'bg-rose-100 text-rose-700',
  },
  industry: {
    label: 'Industry',
    description: 'Industry partners and stakeholders',
    icon: Target,
    color: 'bg-violet-100 text-violet-700',
  },
};

const PRESENTATION_TYPE_CONFIG: Record<PresentationType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  oral: { label: 'Oral Presentation', icon: Mic },
  poster: { label: 'Poster', icon: FileImage },
  workshop: { label: 'Workshop', icon: Users },
  keynote: { label: 'Keynote', icon: Presentation },
  webinar: { label: 'Webinar', icon: Video },
};

const MEDIA_TYPE_CONFIG: Record<MediaMaterialType, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  press_release: { label: 'Press Release', description: 'Official media announcement', icon: Newspaper },
  plain_summary: { label: 'Plain Language Summary', description: 'Accessible research summary', icon: FileText },
  infographic: { label: 'Infographic', description: 'Visual data summary', icon: Image },
  social_media: { label: 'Social Media Post', description: 'Short-form social content', icon: MessageSquare },
  blog_post: { label: 'Blog Post', description: 'Extended web article', icon: BookOpen },
};

const SOCIAL_PLATFORM_CONFIG: Record<SocialPlatform, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  maxChars?: number;
}> = {
  twitter: { label: 'Twitter/X', icon: Twitter, maxChars: 280 },
  linkedin: { label: 'LinkedIn', icon: Linkedin, maxChars: 3000 },
  facebook: { label: 'Facebook', icon: Globe, maxChars: 63206 },
  mastodon: { label: 'Mastodon', icon: Globe, maxChars: 500 },
  bluesky: { label: 'Bluesky', icon: Globe, maxChars: 300 },
};

const PHI_STATUS_CONFIG: Record<PhiReviewStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: { label: 'Not Scanned', color: 'bg-gray-100 text-gray-700', icon: Shield },
  scanning: { label: 'Scanning...', color: 'bg-blue-100 text-blue-700', icon: RefreshCcw },
  passed: { label: 'PHI Clear', color: 'bg-green-100 text-green-700', icon: ShieldCheck },
  failed: { label: 'PHI Detected', color: 'bg-red-100 text-red-700', icon: ShieldAlert },
  needs_review: { label: 'Needs Review', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
};

const SLIDE_TEMPLATES: SlideTemplate[] = [
  { id: 'title', name: 'Title Slide', description: 'Opening slide with title and authors', layout: 'title', placeholders: ['title', 'subtitle', 'authors', 'affiliation'] },
  { id: 'content', name: 'Content Slide', description: 'Standard text content slide', layout: 'content', placeholders: ['title', 'body', 'notes'] },
  { id: 'two_column', name: 'Two Column', description: 'Split content layout', layout: 'two_column', placeholders: ['title', 'left_content', 'right_content'] },
  { id: 'image_focus', name: 'Image Focus', description: 'Centered image with caption', layout: 'image_focus', placeholders: ['title', 'image', 'caption'] },
  { id: 'data_chart', name: 'Data Chart', description: 'Data visualization slide', layout: 'data_chart', placeholders: ['title', 'chart', 'interpretation'] },
  { id: 'quote', name: 'Quote', description: 'Highlighted quote or finding', layout: 'quote', placeholders: ['quote', 'attribution', 'context'] },
  { id: 'conclusion', name: 'Conclusion', description: 'Summary and key takeaways', layout: 'conclusion', placeholders: ['title', 'key_points', 'next_steps'] },
];

// ==================== Main Component ====================

interface Stage19Props {
  topicId: string;
  researchId: string;
  stageData?: DisseminationState;
  onComplete?: () => void;
  onSave?: (data: DisseminationState) => void;
  isReadOnly?: boolean;
  governanceMode?: 'DEMO' | 'LIVE';
  onGenerateContent?: (type: string, audience: TargetAudience, prompt: string) => Promise<string>;
  onRunPhiScan?: (materialId: string, materialType: 'publication' | 'presentation' | 'media') => Promise<PhiScanResult>;
  onExportPresentation?: (presentationId: string, format: 'pptx' | 'pdf' | 'html') => Promise<string>;
  className?: string;
}

export function Stage19Dissemination({
  topicId,
  researchId,
  stageData,
  onComplete,
  onSave,
  isReadOnly = false,
  governanceMode = 'DEMO',
  onGenerateContent,
  onRunPhiScan,
  onExportPresentation,
  className,
}: Stage19Props) {
  // State initialization
  const [publications, setPublications] = useState<JournalSubmission[]>(
    stageData?.publications || []
  );
  const [presentations, setPresentations] = useState<PresentationMaterial[]>(
    stageData?.presentations || []
  );
  const [mediaMaterials, setMediaMaterials] = useState<MediaMaterial[]>(
    stageData?.mediaMaterials || []
  );
  const [events, setEvents] = useState<DisseminationEvent[]>(
    stageData?.events || []
  );
  const [modelTier, setModelTier] = useState<ModelTier>(stageData?.modelTier || 'premium');

  // UI State
  const [selectedTab, setSelectedTab] = useState('publications');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScanning, setIsScanning] = useState<string | null>(null);
  const [showPublicationDialog, setShowPublicationDialog] = useState(false);
  const [showPresentationDialog, setShowPresentationDialog] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingPublication, setEditingPublication] = useState<JournalSubmission | null>(null);
  const [editingPresentation, setEditingPresentation] = useState<PresentationMaterial | null>(null);
  const [editingMedia, setEditingMedia] = useState<MediaMaterial | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<TargetAudience>('academic');

  // Computed Statistics
  const stats = useMemo(() => {
    const pubStats = {
      total: publications.length,
      published: publications.filter(p => p.status === 'published').length,
      underReview: publications.filter(p => ['submitted', 'under_review', 'revision_submitted'].includes(p.status)).length,
      draft: publications.filter(p => p.status === 'draft').length,
    };

    const presentStats = {
      total: presentations.length,
      upcoming: presentations.filter(p => p.eventDate && new Date(p.eventDate) > new Date()).length,
    };

    const mediaStats = {
      total: mediaMaterials.length,
      published: mediaMaterials.filter(m => m.status === 'published').length,
      scheduled: mediaMaterials.filter(m => m.status === 'scheduled').length,
    };

    const phiPending = [
      ...publications.filter(p => p.phiReviewStatus === 'pending' || p.phiReviewStatus === 'failed'),
      ...presentations.filter(p => p.phiReviewStatus === 'pending' || p.phiReviewStatus === 'failed'),
      ...mediaMaterials.filter(m => m.phiReviewStatus === 'pending' || m.phiReviewStatus === 'failed'),
    ].length;

    return { pubStats, presentStats, mediaStats, phiPending };
  }, [publications, presentations, mediaMaterials]);

  // Save handler
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave({
        publications,
        presentations,
        mediaMaterials,
        events,
        modelTier,
      });
    }
  }, [publications, presentations, mediaMaterials, events, modelTier, onSave]);

  // Publication handlers
  const addPublication = useCallback((pub: Omit<JournalSubmission, 'id'>) => {
    const newPub: JournalSubmission = {
      ...pub,
      id: crypto.randomUUID(),
    };
    setPublications(prev => [...prev, newPub]);
    setShowPublicationDialog(false);
  }, []);

  const updatePublication = useCallback((id: string, updates: Partial<JournalSubmission>) => {
    setPublications(prev =>
      prev.map(p => p.id === id ? { ...p, ...updates, lastUpdatedDate: new Date() } : p)
    );
  }, []);

  const deletePublication = useCallback((id: string) => {
    setPublications(prev => prev.filter(p => p.id !== id));
  }, []);

  // Presentation handlers
  const addPresentation = useCallback((pres: Omit<PresentationMaterial, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newPres: PresentationMaterial = {
      ...pres,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setPresentations(prev => [...prev, newPres]);
    setShowPresentationDialog(false);
  }, []);

  const updatePresentation = useCallback((id: string, updates: Partial<PresentationMaterial>) => {
    setPresentations(prev =>
      prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p)
    );
  }, []);

  const deletePresentation = useCallback((id: string) => {
    setPresentations(prev => prev.filter(p => p.id !== id));
  }, []);

  // Media material handlers
  const addMediaMaterial = useCallback((media: Omit<MediaMaterial, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newMedia: MediaMaterial = {
      ...media,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setMediaMaterials(prev => [...prev, newMedia]);
    setShowMediaDialog(false);
  }, []);

  const updateMediaMaterial = useCallback((id: string, updates: Partial<MediaMaterial>) => {
    setMediaMaterials(prev =>
      prev.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m)
    );
  }, []);

  const deleteMediaMaterial = useCallback((id: string) => {
    setMediaMaterials(prev => prev.filter(m => m.id !== id));
  }, []);

  // Event handlers
  const addEvent = useCallback((event: Omit<DisseminationEvent, 'id'>) => {
    const newEvent: DisseminationEvent = {
      ...event,
      id: crypto.randomUUID(),
    };
    setEvents(prev => [...prev, newEvent]);
    setShowEventDialog(false);
  }, []);

  const updateEvent = useCallback((id: string, updates: Partial<DisseminationEvent>) => {
    setEvents(prev =>
      prev.map(e => e.id === id ? { ...e, ...updates } : e)
    );
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  // PHI Scan handler
  const handlePhiScan = useCallback(async (
    materialId: string,
    materialType: 'publication' | 'presentation' | 'media'
  ) => {
    if (!onRunPhiScan) return;

    setIsScanning(materialId);
    try {
      const result = await onRunPhiScan(materialId, materialType);

      if (materialType === 'publication') {
        updatePublication(materialId, { phiReviewStatus: result.status });
      } else if (materialType === 'presentation') {
        updatePresentation(materialId, { phiReviewStatus: result.status });
      } else {
        updateMediaMaterial(materialId, { phiReviewStatus: result.status });
      }
    } finally {
      setIsScanning(null);
    }
  }, [onRunPhiScan, updatePublication, updatePresentation, updateMediaMaterial]);

  // AI Content generation
  const handleGenerateContent = useCallback(async (
    type: string,
    audience: TargetAudience,
    prompt: string
  ) => {
    if (!onGenerateContent) return '';

    setIsGenerating(true);
    try {
      return await onGenerateContent(type, audience, prompt);
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerateContent]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* PHI Warning for LIVE mode */}
      {governanceMode === 'LIVE' && stats.phiPending > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>PHI Review Required</AlertTitle>
          <AlertDescription>
            {stats.phiPending} material(s) require PHI review before public dissemination.
            All public-facing content must pass PHI scanning in LIVE mode.
          </AlertDescription>
        </Alert>
      )}

      {/* Header Card with Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Share2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Research Dissemination</CardTitle>
                <CardDescription>
                  Share your findings through multiple channels
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={governanceMode === 'LIVE' ? 'destructive' : 'secondary'}>
                {governanceMode} Mode
              </Badge>
              <div className="w-36">
                <ModelTierSelect
                  value={modelTier}
                  onChange={setModelTier}
                  requirePhiCompliant={governanceMode === 'LIVE'}
                />
              </div>
              <Button variant="outline" onClick={handleSave} disabled={isReadOnly}>
                Save Progress
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Publications"
              value={stats.pubStats.total}
              subtext={`${stats.pubStats.published} published, ${stats.pubStats.underReview} in review`}
              icon={FileText}
            />
            <StatCard
              label="Presentations"
              value={stats.presentStats.total}
              subtext={`${stats.presentStats.upcoming} upcoming`}
              icon={Presentation}
            />
            <StatCard
              label="Media Materials"
              value={stats.mediaStats.total}
              subtext={`${stats.mediaStats.published} published`}
              icon={Newspaper}
            />
            <StatCard
              label="PHI Pending"
              value={stats.phiPending}
              subtext="materials need review"
              icon={Shield}
              highlight={stats.phiPending > 0}
            />
          </div>

          {/* Target Audience Selector */}
          <div className="mt-6">
            <Label className="text-sm font-medium mb-2 block">Target Audience for New Content</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(AUDIENCE_CONFIG) as TargetAudience[]).map(audience => {
                const config = AUDIENCE_CONFIG[audience];
                const Icon = config.icon;
                return (
                  <Badge
                    key={audience}
                    variant={selectedAudience === audience ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-all',
                      selectedAudience === audience && config.color
                    )}
                    onClick={() => setSelectedAudience(audience)}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="publications">
            <FileText className="mr-2 h-4 w-4" />
            Publications ({publications.length})
          </TabsTrigger>
          <TabsTrigger value="presentations">
            <Presentation className="mr-2 h-4 w-4" />
            Presentations ({presentations.length})
          </TabsTrigger>
          <TabsTrigger value="media">
            <Newspaper className="mr-2 h-4 w-4" />
            Media ({mediaMaterials.length})
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule ({events.length})
          </TabsTrigger>
        </TabsList>

        {/* Publications Tab */}
        <TabsContent value="publications" className="mt-4">
          <PublicationsPanel
            publications={publications}
            onAdd={() => setShowPublicationDialog(true)}
            onEdit={(pub) => {
              setEditingPublication(pub);
              setShowPublicationDialog(true);
            }}
            onUpdate={updatePublication}
            onDelete={deletePublication}
            onPhiScan={(id) => handlePhiScan(id, 'publication')}
            isScanning={isScanning}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {/* Presentations Tab */}
        <TabsContent value="presentations" className="mt-4">
          <PresentationsPanel
            presentations={presentations}
            onAdd={() => setShowPresentationDialog(true)}
            onEdit={(pres) => {
              setEditingPresentation(pres);
              setShowPresentationDialog(true);
            }}
            onUpdate={updatePresentation}
            onDelete={deletePresentation}
            onPhiScan={(id) => handlePhiScan(id, 'presentation')}
            onExport={onExportPresentation}
            isScanning={isScanning}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media" className="mt-4">
          <MediaPanel
            materials={mediaMaterials}
            onAdd={() => setShowMediaDialog(true)}
            onEdit={(media) => {
              setEditingMedia(media);
              setShowMediaDialog(true);
            }}
            onUpdate={updateMediaMaterial}
            onDelete={deleteMediaMaterial}
            onPhiScan={(id) => handlePhiScan(id, 'media')}
            onGenerateContent={handleGenerateContent}
            selectedAudience={selectedAudience}
            isScanning={isScanning}
            isGenerating={isGenerating}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-4">
          <SchedulePanel
            events={events}
            publications={publications}
            presentations={presentations}
            mediaMaterials={mediaMaterials}
            onAddEvent={() => setShowEventDialog(true)}
            onUpdateEvent={updateEvent}
            onDeleteEvent={deleteEvent}
            isReadOnly={isReadOnly}
          />
        </TabsContent>
      </Tabs>

      {/* Publication Dialog */}
      <PublicationDialog
        open={showPublicationDialog}
        onOpenChange={(open) => {
          setShowPublicationDialog(open);
          if (!open) setEditingPublication(null);
        }}
        publication={editingPublication}
        onSave={editingPublication
          ? (updates) => {
              updatePublication(editingPublication.id, updates);
              setShowPublicationDialog(false);
              setEditingPublication(null);
            }
          : addPublication
        }
        defaultAudience={selectedAudience}
      />

      {/* Presentation Dialog */}
      <PresentationDialog
        open={showPresentationDialog}
        onOpenChange={(open) => {
          setShowPresentationDialog(open);
          if (!open) setEditingPresentation(null);
        }}
        presentation={editingPresentation}
        onSave={editingPresentation
          ? (updates) => {
              updatePresentation(editingPresentation.id, updates);
              setShowPresentationDialog(false);
              setEditingPresentation(null);
            }
          : addPresentation
        }
        defaultAudience={selectedAudience}
      />

      {/* Media Dialog */}
      <MediaMaterialDialog
        open={showMediaDialog}
        onOpenChange={(open) => {
          setShowMediaDialog(open);
          if (!open) setEditingMedia(null);
        }}
        material={editingMedia}
        onSave={editingMedia
          ? (updates) => {
              updateMediaMaterial(editingMedia.id, updates);
              setShowMediaDialog(false);
              setEditingMedia(null);
            }
          : addMediaMaterial
        }
        onGenerateContent={handleGenerateContent}
        isGenerating={isGenerating}
        defaultAudience={selectedAudience}
      />

      {/* Event Dialog */}
      <EventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        onSave={addEvent}
      />
    </div>
  );
}

// ==================== Sub-Components ====================

function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: number;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'p-4 rounded-lg border',
      highlight ? 'bg-red-50 border-red-200' : 'bg-muted/50'
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', highlight ? 'text-red-600' : 'text-muted-foreground')} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold', highlight && 'text-red-600')}>{value}</p>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}

// Publications Panel
function PublicationsPanel({
  publications,
  onAdd,
  onEdit,
  onUpdate,
  onDelete,
  onPhiScan,
  isScanning,
  isReadOnly,
}: {
  publications: JournalSubmission[];
  onAdd: () => void;
  onEdit: (pub: JournalSubmission) => void;
  onUpdate: (id: string, updates: Partial<JournalSubmission>) => void;
  onDelete: (id: string) => void;
  onPhiScan: (id: string) => void;
  isScanning: string | null;
  isReadOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Journal Submissions</h3>
          <p className="text-sm text-muted-foreground">Track your publication pipeline</p>
        </div>
        <Button onClick={onAdd} disabled={isReadOnly}>
          <Plus className="mr-2 h-4 w-4" />
          New Submission
        </Button>
      </div>

      {publications.length > 0 ? (
        <div className="space-y-3">
          {publications.map(pub => (
            <PublicationCard
              key={pub.id}
              publication={pub}
              onEdit={() => onEdit(pub)}
              onUpdateStatus={(status) => onUpdate(pub.id, { status })}
              onDelete={() => onDelete(pub.id)}
              onPhiScan={() => onPhiScan(pub.id)}
              isScanning={isScanning === pub.id}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No Publications Yet"
          description="Start tracking your journal submissions"
          action={
            <Button onClick={onAdd} disabled={isReadOnly}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Submission
            </Button>
          }
        />
      )}
    </div>
  );
}

function PublicationCard({
  publication,
  onEdit,
  onUpdateStatus,
  onDelete,
  onPhiScan,
  isScanning,
  isReadOnly,
}: {
  publication: JournalSubmission;
  onEdit: () => void;
  onUpdateStatus: (status: PublicationStatus) => void;
  onDelete: () => void;
  onPhiScan: () => void;
  isScanning: boolean;
  isReadOnly: boolean;
}) {
  const statusConfig = PUBLICATION_STATUS_CONFIG[publication.status];
  const StatusIcon = statusConfig.icon;
  const audienceConfig = AUDIENCE_CONFIG[publication.targetAudience];
  const phiConfig = PHI_STATUS_CONFIG[publication.phiReviewStatus];
  const PhiIcon = phiConfig.icon;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className={cn('p-2 rounded-lg', statusConfig.color)}>
            <StatusIcon className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-medium truncate">{publication.manuscriptTitle}</h4>
              <Badge className={cn('text-xs', statusConfig.color)}>
                {statusConfig.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {audienceConfig.label}
              </Badge>
              <Badge className={cn('text-xs', phiConfig.color)}>
                <PhiIcon className={cn('h-3 w-3 mr-1', isScanning && 'animate-spin')} />
                {phiConfig.label}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">{publication.journalName}</p>

            {publication.manuscriptId && (
              <p className="text-xs text-muted-foreground mt-1">
                Manuscript ID: {publication.manuscriptId}
              </p>
            )}

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {publication.submittedDate && (
                <span className="flex items-center gap-1">
                  <Send className="h-3 w-3" />
                  Submitted: {new Date(publication.submittedDate).toLocaleDateString()}
                </span>
              )}
              {publication.expectedResponseDate && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expected: {new Date(publication.expectedResponseDate).toLocaleDateString()}
                </span>
              )}
              {publication.revisionNumber > 0 && (
                <span className="flex items-center gap-1">
                  <RefreshCcw className="h-3 w-3" />
                  Revision {publication.revisionNumber}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={publication.status}
              onValueChange={(v) => onUpdateStatus(v as PublicationStatus)}
              disabled={isReadOnly}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PUBLICATION_STATUS_CONFIG) as PublicationStatus[]).map(status => (
                  <SelectItem key={status} value={status}>
                    {PUBLICATION_STATUS_CONFIG[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onPhiScan}
                    disabled={isScanning || isReadOnly}
                  >
                    <Shield className={cn('h-4 w-4', isScanning && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Run PHI Scan</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit} disabled={isReadOnly}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} disabled={isReadOnly} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Presentations Panel
function PresentationsPanel({
  presentations,
  onAdd,
  onEdit,
  onUpdate,
  onDelete,
  onPhiScan,
  onExport,
  isScanning,
  isReadOnly,
}: {
  presentations: PresentationMaterial[];
  onAdd: () => void;
  onEdit: (pres: PresentationMaterial) => void;
  onUpdate: (id: string, updates: Partial<PresentationMaterial>) => void;
  onDelete: (id: string) => void;
  onPhiScan: (id: string) => void;
  onExport?: (id: string, format: 'pptx' | 'pdf' | 'html') => Promise<string>;
  isScanning: string | null;
  isReadOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Presentation Materials</h3>
          <p className="text-sm text-muted-foreground">Create and manage presentations</p>
        </div>
        <Button onClick={onAdd} disabled={isReadOnly}>
          <Plus className="mr-2 h-4 w-4" />
          New Presentation
        </Button>
      </div>

      {presentations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {presentations.map(pres => (
            <PresentationCard
              key={pres.id}
              presentation={pres}
              onEdit={() => onEdit(pres)}
              onDelete={() => onDelete(pres.id)}
              onPhiScan={() => onPhiScan(pres.id)}
              onExport={onExport}
              isScanning={isScanning === pres.id}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Presentation}
          title="No Presentations Yet"
          description="Create slide decks for conferences and seminars"
          action={
            <Button onClick={onAdd} disabled={isReadOnly}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Presentation
            </Button>
          }
        />
      )}
    </div>
  );
}

function PresentationCard({
  presentation,
  onEdit,
  onDelete,
  onPhiScan,
  onExport,
  isScanning,
  isReadOnly,
}: {
  presentation: PresentationMaterial;
  onEdit: () => void;
  onDelete: () => void;
  onPhiScan: () => void;
  onExport?: (id: string, format: 'pptx' | 'pdf' | 'html') => Promise<string>;
  isScanning: boolean;
  isReadOnly: boolean;
}) {
  const typeConfig = PRESENTATION_TYPE_CONFIG[presentation.type];
  const TypeIcon = typeConfig.icon;
  const audienceConfig = AUDIENCE_CONFIG[presentation.targetAudience];
  const phiConfig = PHI_STATUS_CONFIG[presentation.phiReviewStatus];
  const PhiIcon = phiConfig.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <TypeIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{presentation.title}</CardTitle>
              <CardDescription>{typeConfig.label}</CardDescription>
            </div>
          </div>
          <Badge className={cn('text-xs', phiConfig.color)}>
            <PhiIcon className={cn('h-3 w-3 mr-1', isScanning && 'animate-spin')} />
            {phiConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">{audienceConfig.label}</Badge>
          <span className="text-muted-foreground">{presentation.slides.length} slides</span>
          {presentation.duration && (
            <span className="text-muted-foreground">{presentation.duration} min</span>
          )}
        </div>

        {presentation.eventName && (
          <div className="text-sm">
            <span className="text-muted-foreground">Event: </span>
            <span>{presentation.eventName}</span>
            {presentation.eventDate && (
              <span className="text-muted-foreground ml-2">
                ({new Date(presentation.eventDate).toLocaleDateString()})
              </span>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0 gap-2">
        <Button variant="outline" size="sm" onClick={onPhiScan} disabled={isScanning || isReadOnly}>
          <Shield className={cn('mr-1 h-3 w-3', isScanning && 'animate-spin')} />
          PHI Scan
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit} disabled={isReadOnly}>
          <Edit3 className="mr-1 h-3 w-3" />
          Edit
        </Button>
        {onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-1 h-3 w-3" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onExport(presentation.id, 'pptx')}>
                PowerPoint (.pptx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(presentation.id, 'pdf')}>
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(presentation.id, 'html')}>
                HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} disabled={isReadOnly} className="text-destructive ml-auto">
          <Trash2 className="h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// Media Panel
function MediaPanel({
  materials,
  onAdd,
  onEdit,
  onUpdate,
  onDelete,
  onPhiScan,
  onGenerateContent,
  selectedAudience,
  isScanning,
  isGenerating,
  isReadOnly,
}: {
  materials: MediaMaterial[];
  onAdd: () => void;
  onEdit: (media: MediaMaterial) => void;
  onUpdate: (id: string, updates: Partial<MediaMaterial>) => void;
  onDelete: (id: string) => void;
  onPhiScan: (id: string) => void;
  onGenerateContent?: (type: string, audience: TargetAudience, prompt: string) => Promise<string>;
  selectedAudience: TargetAudience;
  isScanning: string | null;
  isGenerating: boolean;
  isReadOnly: boolean;
}) {
  const materialsByType = useMemo(() => {
    const grouped: Partial<Record<MediaMaterialType, MediaMaterial[]>> = {};
    materials.forEach(m => {
      if (!grouped[m.type]) grouped[m.type] = [];
      grouped[m.type]!.push(m);
    });
    return grouped;
  }, [materials]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Media Materials</h3>
          <p className="text-sm text-muted-foreground">
            Press releases, summaries, and social media content
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onGenerateContent && (
            <Button variant="outline" onClick={onAdd} disabled={isReadOnly || isGenerating}>
              <Sparkles className="mr-2 h-4 w-4" />
              AI Generate
            </Button>
          )}
          <Button onClick={onAdd} disabled={isReadOnly}>
            <Plus className="mr-2 h-4 w-4" />
            New Material
          </Button>
        </div>
      </div>

      {/* Quick Create Buttons */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MEDIA_TYPE_CONFIG) as MediaMaterialType[]).map(type => {
          const config = MEDIA_TYPE_CONFIG[type];
          const Icon = config.icon;
          const count = materialsByType[type]?.length || 0;
          return (
            <Badge
              key={type}
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              onClick={onAdd}
            >
              <Icon className="h-3 w-3 mr-1" />
              {config.label} ({count})
            </Badge>
          );
        })}
      </div>

      {materials.length > 0 ? (
        <div className="space-y-3">
          {materials.map(material => (
            <MediaMaterialCard
              key={material.id}
              material={material}
              onEdit={() => onEdit(material)}
              onUpdate={(updates) => onUpdate(material.id, updates)}
              onDelete={() => onDelete(material.id)}
              onPhiScan={() => onPhiScan(material.id)}
              isScanning={isScanning === material.id}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Newspaper}
          title="No Media Materials Yet"
          description="Create press releases, summaries, and social content"
          action={
            <Button onClick={onAdd} disabled={isReadOnly}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Material
            </Button>
          }
        />
      )}
    </div>
  );
}

function MediaMaterialCard({
  material,
  onEdit,
  onUpdate,
  onDelete,
  onPhiScan,
  isScanning,
  isReadOnly,
}: {
  material: MediaMaterial;
  onEdit: () => void;
  onUpdate: (updates: Partial<MediaMaterial>) => void;
  onDelete: () => void;
  onPhiScan: () => void;
  isScanning: boolean;
  isReadOnly: boolean;
}) {
  const typeConfig = MEDIA_TYPE_CONFIG[material.type];
  const TypeIcon = typeConfig.icon;
  const audienceConfig = AUDIENCE_CONFIG[material.targetAudience];
  const phiConfig = PHI_STATUS_CONFIG[material.phiReviewStatus];
  const PhiIcon = phiConfig.icon;

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-blue-100 text-blue-700',
    published: 'bg-green-100 text-green-700',
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-muted">
            <TypeIcon className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-medium">{material.title}</h4>
              <Badge className={cn('text-xs', statusColors[material.status])}>
                {material.status.charAt(0).toUpperCase() + material.status.slice(1)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {audienceConfig.label}
              </Badge>
              <Badge className={cn('text-xs', phiConfig.color)}>
                <PhiIcon className={cn('h-3 w-3 mr-1', isScanning && 'animate-spin')} />
                {phiConfig.label}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-2">{typeConfig.description}</p>

            <p className="text-sm line-clamp-2">{material.content}</p>

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {material.wordCount && <span>{material.wordCount} words</span>}
              {material.plainLanguageScore && (
                <span>Readability: {material.plainLanguageScore}%</span>
              )}
              {material.platforms && material.platforms.length > 0 && (
                <span className="flex items-center gap-1">
                  Platforms: {material.platforms.map(p => SOCIAL_PLATFORM_CONFIG[p].label).join(', ')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onPhiScan}
              disabled={isScanning || isReadOnly}
            >
              <Shield className={cn('h-4 w-4', isScanning && 'animate-spin')} />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onEdit} disabled={isReadOnly}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={onDelete}
              disabled={isReadOnly}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Schedule Panel
function SchedulePanel({
  events,
  publications,
  presentations,
  mediaMaterials,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  isReadOnly,
}: {
  events: DisseminationEvent[];
  publications: JournalSubmission[];
  presentations: PresentationMaterial[];
  mediaMaterials: MediaMaterial[];
  onAddEvent: () => void;
  onUpdateEvent: (id: string, updates: Partial<DisseminationEvent>) => void;
  onDeleteEvent: (id: string) => void;
  isReadOnly: boolean;
}) {
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const upcomingDeadlines = useMemo(() => {
    const deadlines: Array<{ type: string; name: string; date: Date }> = [];

    publications.forEach(p => {
      if (p.expectedResponseDate && new Date(p.expectedResponseDate) > new Date()) {
        deadlines.push({
          type: 'Publication Response',
          name: p.manuscriptTitle,
          date: new Date(p.expectedResponseDate),
        });
      }
    });

    events.forEach(e => {
      if (e.deadlineDate && new Date(e.deadlineDate) > new Date()) {
        deadlines.push({
          type: 'Submission Deadline',
          name: e.name,
          date: new Date(e.deadlineDate),
        });
      }
    });

    return deadlines.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  }, [publications, events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Dissemination Schedule</h3>
          <p className="text-sm text-muted-foreground">
            Track conferences, deadlines, and publication dates
          </p>
        </div>
        <Button onClick={onAddEvent} disabled={isReadOnly}>
          <Plus className="mr-2 h-4 w-4" />
          Add Event
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length > 0 ? (
              <div className="space-y-3">
                {upcomingDeadlines.map((deadline, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div>
                      <p className="text-sm font-medium">{deadline.name}</p>
                      <p className="text-xs text-muted-foreground">{deadline.type}</p>
                    </div>
                    <Badge variant="outline">
                      {deadline.date.toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming deadlines
              </p>
            )}
          </CardContent>
        </Card>

        {/* Event Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedEvents.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {sortedEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'p-1 rounded',
                          new Date(event.date) < new Date() ? 'bg-gray-100' : 'bg-blue-100'
                        )}>
                          <Calendar className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{event.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleDateString()}
                            {event.isVirtual && ' (Virtual)'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onDeleteEvent(event.id)}
                        disabled={isReadOnly}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No events scheduled
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

// ==================== Dialogs ====================

// Publication Dialog
function PublicationDialog({
  open,
  onOpenChange,
  publication,
  onSave,
  defaultAudience,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publication: JournalSubmission | null;
  onSave: (pub: Omit<JournalSubmission, 'id'> | Partial<JournalSubmission>) => void;
  defaultAudience: TargetAudience;
}) {
  const [journalName, setJournalName] = useState(publication?.journalName || '');
  const [manuscriptTitle, setManuscriptTitle] = useState(publication?.manuscriptTitle || '');
  const [manuscriptId, setManuscriptId] = useState(publication?.manuscriptId || '');
  const [status, setStatus] = useState<PublicationStatus>(publication?.status || 'draft');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>(
    publication?.targetAudience || defaultAudience
  );
  const [notes, setNotes] = useState(publication?.notes || '');

  React.useEffect(() => {
    if (publication) {
      setJournalName(publication.journalName);
      setManuscriptTitle(publication.manuscriptTitle);
      setManuscriptId(publication.manuscriptId || '');
      setStatus(publication.status);
      setTargetAudience(publication.targetAudience);
      setNotes(publication.notes || '');
    } else {
      setJournalName('');
      setManuscriptTitle('');
      setManuscriptId('');
      setStatus('draft');
      setTargetAudience(defaultAudience);
      setNotes('');
    }
  }, [publication, defaultAudience]);

  const handleSave = () => {
    if (publication) {
      onSave({
        journalName,
        manuscriptTitle,
        manuscriptId: manuscriptId || undefined,
        status,
        targetAudience,
        notes: notes || undefined,
      });
    } else {
      onSave({
        journalName,
        manuscriptTitle,
        manuscriptId: manuscriptId || undefined,
        status,
        targetAudience,
        notes: notes || undefined,
        lastUpdatedDate: new Date(),
        revisionNumber: 0,
        attachments: [],
        phiReviewStatus: 'pending',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {publication ? 'Edit Publication' : 'New Journal Submission'}
          </DialogTitle>
          <DialogDescription>
            Track your manuscript submission to academic journals
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Manuscript Title *</Label>
            <Input
              value={manuscriptTitle}
              onChange={(e) => setManuscriptTitle(e.target.value)}
              placeholder="Enter manuscript title"
            />
          </div>

          <div className="space-y-2">
            <Label>Journal Name *</Label>
            <Input
              value={journalName}
              onChange={(e) => setJournalName(e.target.value)}
              placeholder="e.g., Nature Medicine"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Manuscript ID</Label>
              <Input
                value={manuscriptId}
                onChange={(e) => setManuscriptId(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PublicationStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PUBLICATION_STATUS_CONFIG) as PublicationStatus[]).map(s => (
                    <SelectItem key={s} value={s}>
                      {PUBLICATION_STATUS_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AUDIENCE_CONFIG) as TargetAudience[]).map(a => (
                  <SelectItem key={a} value={a}>
                    {AUDIENCE_CONFIG[a].label} - {AUDIENCE_CONFIG[a].description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!journalName.trim() || !manuscriptTitle.trim()}>
            {publication ? 'Save Changes' : 'Add Submission'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Presentation Dialog
function PresentationDialog({
  open,
  onOpenChange,
  presentation,
  onSave,
  defaultAudience,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: PresentationMaterial | null;
  onSave: (pres: Omit<PresentationMaterial, 'id' | 'createdAt' | 'updatedAt'> | Partial<PresentationMaterial>) => void;
  defaultAudience: TargetAudience;
}) {
  const [title, setTitle] = useState(presentation?.title || '');
  const [type, setType] = useState<PresentationType>(presentation?.type || 'oral');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>(
    presentation?.targetAudience || defaultAudience
  );
  const [eventName, setEventName] = useState(presentation?.eventName || '');
  const [duration, setDuration] = useState(presentation?.duration?.toString() || '');

  React.useEffect(() => {
    if (presentation) {
      setTitle(presentation.title);
      setType(presentation.type);
      setTargetAudience(presentation.targetAudience);
      setEventName(presentation.eventName || '');
      setDuration(presentation.duration?.toString() || '');
    } else {
      setTitle('');
      setType('oral');
      setTargetAudience(defaultAudience);
      setEventName('');
      setDuration('');
    }
  }, [presentation, defaultAudience]);

  const handleSave = () => {
    if (presentation) {
      onSave({
        title,
        type,
        targetAudience,
        eventName: eventName || undefined,
        duration: duration ? parseInt(duration) : undefined,
      });
    } else {
      onSave({
        title,
        type,
        targetAudience,
        eventName: eventName || undefined,
        duration: duration ? parseInt(duration) : undefined,
        slides: [],
        phiReviewStatus: 'pending',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {presentation ? 'Edit Presentation' : 'New Presentation'}
          </DialogTitle>
          <DialogDescription>
            Create presentation materials for conferences and events
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Presentation title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PresentationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRESENTATION_TYPE_CONFIG) as PresentationType[]).map(t => (
                    <SelectItem key={t} value={t}>
                      {PRESENTATION_TYPE_CONFIG[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AUDIENCE_CONFIG) as TargetAudience[]).map(a => (
                  <SelectItem key={a} value={a}>
                    {AUDIENCE_CONFIG[a].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Event Name</Label>
            <Input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Annual Research Conference 2026"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            {presentation ? 'Save Changes' : 'Create Presentation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Media Material Dialog
function MediaMaterialDialog({
  open,
  onOpenChange,
  material,
  onSave,
  onGenerateContent,
  isGenerating,
  defaultAudience,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MediaMaterial | null;
  onSave: (media: Omit<MediaMaterial, 'id' | 'createdAt' | 'updatedAt'> | Partial<MediaMaterial>) => void;
  onGenerateContent?: (type: string, audience: TargetAudience, prompt: string) => Promise<string>;
  isGenerating: boolean;
  defaultAudience: TargetAudience;
}) {
  const [title, setTitle] = useState(material?.title || '');
  const [type, setType] = useState<MediaMaterialType>(material?.type || 'press_release');
  const [content, setContent] = useState(material?.content || '');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>(
    material?.targetAudience || defaultAudience
  );
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(material?.platforms || []);
  const [aiPrompt, setAiPrompt] = useState('');

  React.useEffect(() => {
    if (material) {
      setTitle(material.title);
      setType(material.type);
      setContent(material.content);
      setTargetAudience(material.targetAudience);
      setPlatforms(material.platforms || []);
    } else {
      setTitle('');
      setType('press_release');
      setContent('');
      setTargetAudience(defaultAudience);
      setPlatforms([]);
    }
  }, [material, defaultAudience]);

  const handleGenerate = async () => {
    if (!onGenerateContent || !aiPrompt.trim()) return;
    const generated = await onGenerateContent(type, targetAudience, aiPrompt);
    setContent(generated);
    setAiPrompt('');
  };

  const handleSave = () => {
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    const charCount = content.length;

    if (material) {
      onSave({
        title,
        type,
        content,
        targetAudience,
        platforms: type === 'social_media' ? platforms : undefined,
        wordCount,
        characterCount: charCount,
      });
    } else {
      onSave({
        title,
        type,
        content,
        targetAudience,
        platforms: type === 'social_media' ? platforms : undefined,
        wordCount,
        characterCount: charCount,
        status: 'draft',
        phiReviewStatus: 'pending',
      });
    }
  };

  const togglePlatform = (platform: SocialPlatform) => {
    setPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {material ? 'Edit Media Material' : 'New Media Material'}
          </DialogTitle>
          <DialogDescription>
            Create content for press, public communications, and social media
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Material title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as MediaMaterialType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEDIA_TYPE_CONFIG) as MediaMaterialType[]).map(t => (
                    <SelectItem key={t} value={t}>
                      {MEDIA_TYPE_CONFIG[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUDIENCE_CONFIG) as TargetAudience[]).map(a => (
                    <SelectItem key={a} value={a}>
                      {AUDIENCE_CONFIG[a].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === 'social_media' && (
            <div className="space-y-2">
              <Label>Target Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SOCIAL_PLATFORM_CONFIG) as SocialPlatform[]).map(platform => {
                  const config = SOCIAL_PLATFORM_CONFIG[platform];
                  const Icon = config.icon;
                  return (
                    <Badge
                      key={platform}
                      variant={platforms.includes(platform) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => togglePlatform(platform)}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                      {config.maxChars && ` (${config.maxChars})`}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Generation */}
          {onGenerateContent && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Content Generation
              </Label>
              <div className="flex gap-2">
                <Input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want to generate..."
                  disabled={isGenerating}
                />
                <Button onClick={handleGenerate} disabled={isGenerating || !aiPrompt.trim()}>
                  {isGenerating ? (
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
              <p className="text-xs text-muted-foreground">
                Content will be adapted for {AUDIENCE_CONFIG[targetAudience].label.toLowerCase()} audience
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Content *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your content here..."
              rows={8}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{content.trim().split(/\s+/).filter(Boolean).length} words</span>
              <span>{content.length} characters</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || !content.trim()}>
            {material ? 'Save Changes' : 'Create Material'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Event Dialog
function EventDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (event: Omit<DisseminationEvent, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DisseminationEventType>('conference');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [url, setUrl] = useState('');

  const handleSave = () => {
    onSave({
      name,
      type,
      date: new Date(date),
      location: location || undefined,
      isVirtual,
      deadlineDate: deadlineDate ? new Date(deadlineDate) : undefined,
      url: url || undefined,
      relatedMaterialIds: [],
    });
    // Reset form
    setName('');
    setType('conference');
    setDate('');
    setLocation('');
    setIsVirtual(false);
    setDeadlineDate('');
    setUrl('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>
            Add a conference, seminar, or publication deadline
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Event Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Annual Research Conference 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as DisseminationEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="seminar">Seminar</SelectItem>
                  <SelectItem value="webinar">Webinar</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="publication_deadline">Publication Deadline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
              />
            </div>
            <div className="space-y-2">
              <Label>Submission Deadline</Label>
              <Input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={isVirtual}
              onCheckedChange={(checked) => setIsVirtual(!!checked)}
            />
            <Label>Virtual Event</Label>
          </div>

          <div className="space-y-2">
            <Label>Event URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !date}>
            Add Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Stage19Dissemination;
